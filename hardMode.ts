import { GameState, UpgradeType, WINNING_STREAK, HARD_MODE_WINNING_STREAK, FRAGMENTS_PER_WIN } from './types';

// ── Hard Mode: "The Gauntlet" ────────────────────────────────────────────────
// Upgrades can only lift the base chance to 60%. Everything above that has to be
// earned during the streak: Heat builds with consecutive Heads, Void Injection
// pierces the cap for a few flips, and Wards save the streak in the clutch zone.

export const HARD_BASE_CAP = 0.60;
export const HARD_CHANCE_CEILING = 0.90;   // Never 100%, no matter what is stacked

// Heat is tracked in whole percentage points to avoid float drift
export const HEAT_PER_HEADS = 1;
export const BASE_HEAT_CAP = 20;
export const HEAT_CAP_PER_MOMENTUM = 5;

// Goal grows with every hard win, then slows down so it never becomes a wall
// (simulated median: ~11 min for win #1, ~2.5 h by win #20, each win <= 1.5x the last)
export const HARD_GOAL_STEP = 2;
export const HARD_GOAL_SOFTCAP_WINS = 6;
export const HARD_GOAL_LATE_STEP = 1;

// Wards and Injection only work in the clutch zone: the last N Heads before the goal (never Wards during a Push).
// It grows with the goal so late wins keep their clutch moments instead of being decided before the zone.
export const CLUTCH_ZONE = 10;
export const CLUTCH_ZONE_GOAL_FRACTION = 0.25;
export const BASE_WARD_CAP = 1;

export const INJECTION_BOOST = 0.20;
export const INJECTION_FLIPS = 10;
export const MAX_INJECTION_CHARGES = 3;
// Price of each Void Injection charge bought this run (the last entry repeats); resets on ascend
export const INJECTION_PRICES = [5];
export const HARD_VF_PER_TEN_STREAK = 5;   // VF paid each time a hard mode streak hits a multiple of 10
export const CLUTCH_PAUSE_MS = 3000;
export const AUTO_BANK_DELAY_MS = 5000;
export const HARD_EVENT_HOLD_MS = 1000;     // Clutch/Ward/Injection banners show this long and can't be overwritten by streak pops
export const HARD_CONFETTI_BURST = 40;      // Streaks of 20-30 would otherwise bury the HUD in confetti
export const HARD_CONFETTI_MAX = 120;       // ...and bursts at auto-flip speed would still pile up without a total cap

export const PUSH_STEP = 5;
export const MAX_PUSHES = 3;
export const BUST_MULTIPLIER = 0.25;

// Resolve only comes from wins (x Push multiplier, nothing on a bust), so progress tracks skill
export const RESOLVE_PER_WIN_BASE = 25;
export const RESOLVE_PER_WIN_STEP = 10;

type ChanceState = Pick<GameState, 'upgrades' | 'isHardMode' | 'hardHeat' | 'injectionFlipsLeft'>;
type GoalState = Pick<GameState, 'isHardMode' | 'hardPushLevel'> & { stats: Pick<GameState['stats'], 'hardModeWins'> };
type InjectState = ChanceState & GoalState & Pick<GameState, 'streak'>;

export const getHardGoal = (hardWins: number, pushLevel: number = 0): number => {
    const early = Math.min(hardWins, HARD_GOAL_SOFTCAP_WINS);
    const late = Math.max(0, hardWins - HARD_GOAL_SOFTCAP_WINS);
    return HARD_MODE_WINNING_STREAK + early * HARD_GOAL_STEP + late * HARD_GOAL_LATE_STEP + pushLevel * PUSH_STEP;
};

export const getGoal = (state: GoalState): number =>
    state.isHardMode ? getHardGoal(state.stats.hardModeWins, state.hardPushLevel) : WINNING_STREAK;

export const getClutchZoneSize = (goal: number): number => Math.max(CLUTCH_ZONE, Math.round(goal * CLUTCH_ZONE_GOAL_FRACTION));

export const getClutchZoneStart = (goal: number): number => Math.max(0, goal - getClutchZoneSize(goal));

export const isInClutchZone = (state: GoalState & Pick<GameState, 'streak'>): boolean =>
    state.isHardMode && state.streak >= getClutchZoneStart(getGoal(state));

// Wards protect the goal, not the Push: pushing is a pure gamble on Heat and Injection
export const canWardAbsorb = (state: GoalState & Pick<GameState, 'streak' | 'wardsHeld'>): boolean =>
    state.wardsHeld > 0 && state.hardPushLevel === 0 && isInClutchZone(state);

export const getHeatCap = (upgrades: Record<UpgradeType, number>): number =>
    BASE_HEAT_CAP + (upgrades[UpgradeType.HARD_MOMENTUM] || 0) * HEAT_CAP_PER_MOMENTUM;

// Head Start: what Heat falls back to after a Tails (and at the start of a run)
export const getHeatFloor = (upgrades: Record<UpgradeType, number>): number =>
    Math.min(getHeatCap(upgrades), upgrades[UpgradeType.HARD_HEAD_START] || 0);

export const getWardCap = (upgrades: Record<UpgradeType, number>): number =>
    BASE_WARD_CAP + (upgrades[UpgradeType.HARD_BULWARK] || 0);

export const getBaseChance = (upgrades: Record<UpgradeType, number>): number =>
    0.20 + (upgrades[UpgradeType.CHANCE] || 0) * 0.05 + (upgrades[UpgradeType.PRESTIGE_FATE] || 0) * 0.025;

const hardChance = (base: number, heat: number, injected: boolean): number =>
    Math.min(HARD_CHANCE_CEILING, Math.min(HARD_BASE_CAP, base) + heat / 100 + (injected ? INJECTION_BOOST : 0));

// Chance of Heads on the next flip
export const getChance = (state: ChanceState): number => {
    const base = getBaseChance(state.upgrades);
    if (!state.isHardMode) return Math.min(0.99, base);
    return hardChance(base, state.hardHeat, state.injectionFlipsLeft > 0);
};

// Injection is a clutch tool: only usable in the clutch zone or during a Push
// (anywhere else, a self-funding inject at every 10-streak dominated all other play)
export const canInject = (state: InjectState): boolean =>
    state.isHardMode && state.injectionFlipsLeft === 0 && (state.upgrades[UpgradeType.HARD_MODE_BUFF] || 0) > 0 &&
    (isInClutchZone(state) || state.hardPushLevel > 0);

// Consumes a Void Injection charge. Returns the same object if nothing changed.
export const inject = <T extends InjectState>(state: T): T => {
    if (!canInject(state)) return state;
    return {
        ...state,
        injectionFlipsLeft: INJECTION_FLIPS,
        upgrades: { ...state.upgrades, [UpgradeType.HARD_MODE_BUFF]: state.upgrades[UpgradeType.HARD_MODE_BUFF] - 1 },
    };
};

// Auto-inject only holds back when the ceiling is already reached (charges are plentiful)
export const shouldAutoInject = (state: InjectState & Pick<GameState, 'autoInjectEnabled'>): boolean =>
    state.autoInjectEnabled && canInject(state) && getChance(state) < HARD_CHANCE_CEILING;

export const getInjectionPrice = (boughtThisRun: number): number =>
    INJECTION_PRICES[Math.min(boughtThisRun, INJECTION_PRICES.length - 1)];

export const getPushMultiplier = (pushLevel: number, bust: boolean): number =>
    bust ? BUST_MULTIPLIER : Math.pow(2, pushLevel);

export const getHardWinRewards = (hardWins: number, pushLevel: number, bust: boolean) => {
    const mult = getPushMultiplier(pushLevel, bust);
    return {
        voidFragments: Math.max(1, Math.round(FRAGMENTS_PER_WIN * mult)),
        resolve: bust ? 0 : Math.round((RESOLVE_PER_WIN_BASE + RESOLVE_PER_WIN_STEP * hardWins) * mult),
    };
};

// Exact odds of landing PUSH_STEP more Heads from the current state. Wards don't
// apply during a Push, so the only winning path is Heads every flip.
// useInjection: whether a charge is spent as the Push starts (defaults to what auto-inject would do).
export const getPushSuccessChance = (state: GameState, useInjection: boolean = shouldAutoInject(state)): number => {
    const base = getBaseChance(state.upgrades);
    const heatCap = getHeatCap(state.upgrades);
    const hasCharge = (state.upgrades[UpgradeType.HARD_MODE_BUFF] || 0) > 0;
    let heat = state.hardHeat;
    let injFlips = useInjection && hasCharge && state.injectionFlipsLeft === 0 ? INJECTION_FLIPS : state.injectionFlipsLeft;
    let odds = 1;
    for (let i = 0; i < PUSH_STEP; i++) {
        odds *= hardChance(base, heat, injFlips > 0);
        heat = Math.min(heatCap, heat + HEAT_PER_HEADS);
        injFlips = Math.max(0, injFlips - 1);
    }
    return odds;
};
