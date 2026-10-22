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
// (simulated median: ~10 min for win #1, ~20-25 min late, a clutch zone entry every ~5 min throughout)
export const HARD_GOAL_STEP = 1;
export const HARD_GOAL_SOFTCAP_WINS = 10;
export const HARD_GOAL_LATE_STEP = 0.5;

// Wards and Injection only work in the clutch zone (never Wards during a Push). It starts at a fixed
// streak, so reaching it doesn't get harder as the goal grows; a longer goal just means a longer zone.
export const CLUTCH_ZONE_START = 18;
export const CLUTCH_ZONE_MIN = 10;          // ...but it's always at least the last 10 Heads
export const BASE_WARD_CAP = 1;

export const INJECTION_BOOST = 0.20;
export const INJECTION_FLIPS = 10;
export const MAX_INJECTION_CHARGES = 3;
// Charges are earned, not bought: every 10-streak and every hard win fill a meter, and each full
// meter becomes a charge. A big VF bank can't buy them, so they stay scarce for veterans too.
export const INJECTION_METER_PER_CHARGE = 20;
export const INJECTION_METER_PER_TEN_STREAK = 1;
export const HARD_VF_PER_TEN_STREAK = 0;   // 10-streaks feed the Injection meter instead of paying VF
export const CLUTCH_PAUSE_MS = 3000;
export const AUTO_BANK_DELAY_MS = 5000;
export const HARD_EVENT_HOLD_MS = 1000;     // Clutch/Ward/Injection banners show this long and can't be overwritten by streak pops
export const HARD_CONFETTI_BURST = 40;      // Streaks of 20-30 would otherwise bury the HUD in confetti
export const HARD_CONFETTI_MAX = 120;       // ...and bursts at auto-flip speed would still pile up without a total cap

// Edge landing: on the climb to the clutch zone, a slice of every flip lands the coin on its edge for
// +EDGE_STREAK (capped at the goal). Kept out of the zone and Pushes: in simulation, edges anywhere at
// +3 made wins 1.7-8x faster (an edge would turn a lost clutch flip into three Heads); climb-only keeps
// it at ~1.25x (1%) to ~1.6x (2%, Razor's Edge maxed) and adds clutch zone entries.
export const EDGE_STREAK = 3;
export const BASE_EDGE_CHANCE = 0.01;
export const EDGE_CHANCE_PER_LEVEL = 0.0025;
export const EDGE_HOLD_MS = 900;            // Auto-flip pauses this long so the edge is seen (own timer)

export const PUSH_STEP = 5;
export const MAX_PUSHES = 3;
export const BUST_MULTIPLIER = 0.25;

// Resolve only comes from wins (x Push multiplier, nothing on a bust), so progress tracks skill
export const RESOLVE_PER_WIN_BASE = 25;
export const RESOLVE_PER_WIN_STEP = 10;

type ChanceState = Pick<GameState, 'upgrades' | 'isHardMode' | 'hardHeat' | 'injectionFlipsLeft'>;
type GoalState = Pick<GameState, 'isHardMode' | 'hardPushLevel'> & { stats: Pick<GameState['stats'], 'hardModeWins'> };
type InjectState = ChanceState & GoalState & Pick<GameState, 'streak' | 'injectionMeter'>;

export const getHardGoal = (hardWins: number, pushLevel: number = 0): number => {
    const early = Math.min(hardWins, HARD_GOAL_SOFTCAP_WINS);
    const late = Math.max(0, hardWins - HARD_GOAL_SOFTCAP_WINS);
    return HARD_MODE_WINNING_STREAK + early * HARD_GOAL_STEP + Math.floor(late * HARD_GOAL_LATE_STEP) + pushLevel * PUSH_STEP;
};

export const getGoal = (state: GoalState): number =>
    state.isHardMode ? getHardGoal(state.stats.hardModeWins, state.hardPushLevel) : WINNING_STREAK;

export const getClutchZoneStart = (goal: number): number => Math.max(0, Math.min(goal - CLUTCH_ZONE_MIN, CLUTCH_ZONE_START));

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

export const getEdgeChance = (state: GoalState & Pick<GameState, 'streak' | 'upgrades'>): number => {
    if (!state.isHardMode || state.hardPushLevel > 0 || state.streak >= getClutchZoneStart(getGoal(state))) return 0;
    return BASE_EDGE_CHANCE + (state.upgrades[UpgradeType.HARD_EDGE] || 0) * EDGE_CHANCE_PER_LEVEL;
};

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

// Turns full meters into charges while there's room; a full meter waits (capped) while charges are full
export const settleInjectionMeter = <T extends Pick<GameState, 'upgrades' | 'injectionMeter'>>(state: T): T => {
    let charges = state.upgrades[UpgradeType.HARD_MODE_BUFF] || 0;
    let meter = state.injectionMeter;
    while (meter >= INJECTION_METER_PER_CHARGE && charges < MAX_INJECTION_CHARGES) {
        meter -= INJECTION_METER_PER_CHARGE;
        charges++;
    }
    meter = Math.min(meter, INJECTION_METER_PER_CHARGE);
    if (charges === (state.upgrades[UpgradeType.HARD_MODE_BUFF] || 0) && meter === state.injectionMeter) return state;
    return { ...state, injectionMeter: meter, upgrades: { ...state.upgrades, [UpgradeType.HARD_MODE_BUFF]: charges } };
};

export const addInjectionMeter = <T extends Pick<GameState, 'upgrades' | 'injectionMeter'>>(state: T, points: number): T =>
    settleInjectionMeter({ ...state, injectionMeter: state.injectionMeter + points });

// Consumes a Void Injection charge (a waiting full meter refills it). Returns the same object if nothing changed.
export const inject = <T extends InjectState>(state: T): T => {
    if (!canInject(state)) return state;
    return settleInjectionMeter({
        ...state,
        injectionFlipsLeft: INJECTION_FLIPS,
        upgrades: { ...state.upgrades, [UpgradeType.HARD_MODE_BUFF]: state.upgrades[UpgradeType.HARD_MODE_BUFF] - 1 },
    });
};

// Auto-inject holds back at the ceiling. At zone entry it also keeps one charge in reserve for a
// Ward break or a Push, which simulates as fast as spending it and pays more Resolve when pushing.
export const shouldAutoInject = (state: InjectState & Pick<GameState, 'autoInjectEnabled'>, keepSpare: boolean = false): boolean =>
    state.autoInjectEnabled && canInject(state) && getChance(state) < HARD_CHANCE_CEILING &&
    (!keepSpare || (state.upgrades[UpgradeType.HARD_MODE_BUFF] || 0) >= 2);

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
