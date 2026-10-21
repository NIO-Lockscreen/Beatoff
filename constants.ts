import { UpgradeType, UpgradeConfig } from './types';
import { BASE_HEAT_CAP, HEAT_CAP_PER_MOMENTUM, BASE_WARD_CAP, INJECTION_BOOST, INJECTION_FLIPS, MAX_INJECTION_CHARGES } from './hardMode';

const formatLargeNumber = (val: number): string => {
    if (val >= 1e33) return '$' + (val / 1e33).toFixed(1).replace(/\.0$/, '') + 'Dc';
    if (val >= 1e30) return '$' + (val / 1e30).toFixed(1).replace(/\.0$/, '') + 'No';
    if (val >= 1e27) return '$' + (val / 1e27).toFixed(1).replace(/\.0$/, '') + 'Oc';
    if (val >= 1e24) return '$' + (val / 1e24).toFixed(1).replace(/\.0$/, '') + 'Sp';
    if (val >= 1e21) return '$' + (val / 1e21).toFixed(1).replace(/\.0$/, '') + 'Sx';
    if (val >= 1e18) return '$' + (val / 1e18).toFixed(1).replace(/\.0$/, '') + 'Qi';
    if (val >= 1e15) return '$' + (val / 1e15).toFixed(1).replace(/\.0$/, '') + 'Qa';
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 1e3) return '$' + (val / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return '$' + val.toLocaleString();
}

export const UPGRADES: Record<UpgradeType, UpgradeConfig> = {
  // --- Standard Upgrades ---
  [UpgradeType.CHANCE]: {
    id: UpgradeType.CHANCE,
    name: "Weighted Coin",
    description: "Increases the probability of flipping Heads.",
    baseCost: 1,
    // Extended tiers for Limitless - Costs scale aggressively to prevent trivializing the game immediately
    costTiers: [
        1, 10, 100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 7000, 8000, 9000, 
        // Limitless Tiers
        250000, 1000000, 5000000, 25000000, 100000000, 500000000, 2500000000, 10000000000
    ],
    maxLevel: 14,
    limitlessMaxLevel: 22, 
    getEffect: (level) => level * 0.05,
    formatEffect: (val) => `+${(val * 100).toFixed(0)}%`,
  },
  [UpgradeType.SPEED]: {
    id: UpgradeType.SPEED,
    name: "Sleight of Hand",
    description: "Reduces the time it takes to flip.",
    baseCost: 1,
    costTiers: [
        1, 10, 100, 1000, 10000,
        // Limitless Tiers
        1000000, 10000000, 100000000, 1000000000, 10000000000, 100000000000, 1000000000000
    ],
    maxLevel: 5,
    limitlessMaxLevel: 12,
    getEffect: (level) => {
      // Standard logic for first few levels
      const speeds = [2000, 1500, 1000, 750, 500, 250];
      if (level < speeds.length) return speeds[level];
      
      // Limitless logic: decays rapidly towards 0
      const extraLevels = level - 5;
      const base = 250;
      return Math.max(1, Math.floor(base / Math.pow(2, extraLevels)));
    },
    formatEffect: (val) => `${(val / 1000).toFixed(3)}s`,
  },
  [UpgradeType.COMBO]: {
    id: UpgradeType.COMBO,
    name: "Streak Multiplier",
    description: "Increases money earned for consecutive Heads.",
    baseCost: 1,
    costTiers: [
        1, 10, 100, 1000, 10000,
        // Limitless
        2000000, 20000000, 200000000, 2000000000, 20000000000, 200000000000, 2000000000000, 20000000000000
    ],
    maxLevel: 5,
    limitlessMaxLevel: 13,
    getEffect: (level) => {
      const multis = [1, 1.25, 1.5, 2.0, 3.0, 5.0];
      if (level < multis.length) return multis[level];
      // Exponential growth for Limitless
      return Math.pow(2, level - 2); 
    },
    formatEffect: (val) => `${val.toLocaleString()}x`,
  },
  [UpgradeType.VALUE]: {
    id: UpgradeType.VALUE,
    name: "Coin Value",
    description: "Increases the base value of a Heads result.",
    baseCost: 1,
    costTiers: [
        1, 10, 100, 1000, 10000,
        // Limitless
        10000000, 100000000, 1000000000, 10000000000, 100000000000, 1000000000000
    ],
    maxLevel: 5,
    limitlessMaxLevel: 11,
    getEffect: (level) => {
      const values = [1, 5, 10, 25, 50, 100];
      if (level < values.length) return values[level];
      // Massive jumps
      return values[values.length - 1] * Math.pow(10, level - 5);
    },
    formatEffect: (val) => formatLargeNumber(val),
  },
  [UpgradeType.PASSIVE_INCOME]: {
    id: UpgradeType.PASSIVE_INCOME,
    name: "Passive Income",
    description: "Earn a small amount of cash even when you flip Tails.",
    baseCost: 20,
    costTiers: [
        20, 50, 150, 400, 1000, 2500,
        // Limitless
        500000, 2500000, 12500000, 60000000, 300000000
    ], 
    maxLevel: 6,
    limitlessMaxLevel: 11,
    getEffect: (level) => {
        if (level <= 6) return level;
        return level * Math.pow(5, level - 6);
    },
    formatEffect: (val) => formatLargeNumber(val),
  },
  [UpgradeType.AUTO_FLIP]: {
    id: UpgradeType.AUTO_FLIP,
    name: "Auto Flipper",
    description: "Automatically flips the coin for you.",
    baseCost: 500,
    costTiers: [500],
    maxLevel: 1,
    getEffect: (level) => level,
    formatEffect: (val) => val > 0 ? "ON" : "OFF",
  },
  [UpgradeType.EDGING]: {
    id: UpgradeType.EDGING,
    name: "Edging",
    description: "10x income multiplier. Living on the edge.",
    baseCost: 10000,
    costTiers: [10000],
    maxLevel: 1,
    getEffect: (level) => level > 0 ? 10 : 1,
    formatEffect: (val) => `${val}x`,
  },

  // --- Prestige (Void) Upgrades ---
  [UpgradeType.PRESTIGE_KARMA]: {
    id: UpgradeType.PRESTIGE_KARMA,
    name: "Karma",
    description: "Start every new run with more cash.",
    baseCost: 1,
    costTiers: [1, 2, 3, 4, 5, 10, 15, 20], 
    maxLevel: 8,
    isPrestige: true,
    getEffect: (level) => level * 100, 
    formatEffect: (val) => `+$${val} Start`,
  },
  [UpgradeType.PRESTIGE_FATE]: {
    id: UpgradeType.PRESTIGE_FATE,
    name: "Twisted Fate",
    description: "Permanently increases base Heads probability.",
    baseCost: 5,
    costTiers: [5, 10, 15, 25, 50],
    maxLevel: 5,
    isPrestige: true,
    getEffect: (level) => level * 0.025,
    formatEffect: (val) => `+${(val*100).toFixed(1)}% Base`,
  },
  [UpgradeType.PRESTIGE_FLUX]: {
    id: UpgradeType.PRESTIGE_FLUX,
    name: "Temporal Flux",
    description: "Reduces base flip time permanently.",
    baseCost: 3,
    costTiers: [3, 6, 9, 12, 15],
    maxLevel: 5,
    isPrestige: true,
    getEffect: (level) => level * 250,
    formatEffect: (val) => `-${val}ms`,
  },
  
  // --- New Prestige Unlocks ---
  [UpgradeType.PRESTIGE_PASSIVE]: {
    id: UpgradeType.PRESTIGE_PASSIVE,
    name: "Void Siphon",
    description: "Generate significant wealth from failure. Permanent.",
    baseCost: 10,
    costTiers: [10, 20, 30, 40, 50],
    maxLevel: 5,
    isPrestige: true,
    getEffect: (level) => level * 50,
    formatEffect: (val) => `+$${val}/Tail`,
  },
  [UpgradeType.PRESTIGE_AUTO]: {
    id: UpgradeType.PRESTIGE_AUTO,
    name: "Phantom Hand",
    description: "A spectral force flips the coin eternally.",
    baseCost: 25,
    costTiers: [25],
    maxLevel: 1,
    isPrestige: true,
    getEffect: (level) => level,
    formatEffect: (val) => val > 0 ? "PERMANENT" : "LOCKED",
  },
  [UpgradeType.PRESTIGE_AUTO_BUY]: {
    id: UpgradeType.PRESTIGE_AUTO_BUY,
    name: "Algorithmic Greed",
    description: "Automatically purchases affordable dollar upgrades.",
    baseCost: 50,
    costTiers: [50],
    maxLevel: 1,
    isPrestige: true,
    getEffect: (level) => level,
    formatEffect: (val) => val > 0 ? "ENABLED" : "LOCKED",
  },
  [UpgradeType.PRESTIGE_EDGING]: {
    id: UpgradeType.PRESTIGE_EDGING,
    name: "Abyssal Greed",
    description: "Harness the void to multiply all gains by 10x.",
    baseCost: 100,
    costTiers: [100],
    maxLevel: 1,
    isPrestige: true,
    getEffect: (level) => level > 0 ? 10 : 1,
    formatEffect: (val) => `${val}x PERM`,
  },
  [UpgradeType.PRESTIGE_GOLD_DIGGER]: {
    id: UpgradeType.PRESTIGE_GOLD_DIGGER,
    name: "Gold Digger",
    description: "Absurd wealth scaling for the dedicated.",
    baseCost: 50000000,
    costTiers: [
        50000000,       // 50M
        250000000,      // 250M
        1000000000,     // 1B
        5000000000,     // 5B
        25000000000,    // 25B
        100000000000,   // 100B
        500000000000,   // 500B
        2500000000000,  // 2.5T
        10000000000000, // 10T
        100000000000000 // 100T
    ], 
    maxLevel: 10,
    isPrestige: true,
    getEffect: (level) => {
        if (level === 0) return 1;
        if (level === 1) return 2;
        return Math.pow(level, 2);
    },
    formatEffect: (val) => `${val}x Reward`,
  },
  [UpgradeType.PRESTIGE_LIMITLESS]: {
    id: UpgradeType.PRESTIGE_LIMITLESS,
    name: "Limitless",
    description: "Unlocks extended tiers for Dollar Store upgrades.",
    baseCost: 1000,
    costTiers: [1000],
    maxLevel: 1,
    isPrestige: true,
    getEffect: (level) => level > 0 ? 1 : 0,
    formatEffect: (val) => val > 0 ? "UNLOCKED" : "LOCKED",
  },
  [UpgradeType.PRESTIGE_MOM]: {
    id: UpgradeType.PRESTIGE_MOM,
    name: "Your Mom",
    description: "???",
    baseCost: 1000000,
    costTiers: [1000000],
    maxLevel: 1,
    isPrestige: false, 
    getEffect: (level) => level > 0 ? 1 : 0,
    formatEffect: (val) => "???",
  },
  [UpgradeType.PRESTIGE_CARE_PACKAGE]: {
    id: UpgradeType.PRESTIGE_CARE_PACKAGE,
    name: "Care Package",
    description: "Exchange $1M for 25 Void Fragments. One time purchase.",
    baseCost: 1000000,
    costTiers: [1000000],
    maxLevel: 1, 
    isPrestige: false, // Dollar store
    getEffect: (level) => 25,
    formatEffect: (val) => `+25 VF`,
  },
  [UpgradeType.PRESTIGE_VETERAN]: {
    id: UpgradeType.PRESTIGE_VETERAN,
    name: "Veteran's Badge",
    description: "Multiply gains by 10% of your Prestige Level.",
    baseCost: 67000000000,
    costTiers: [67000000000],
    maxLevel: 1,
    isPrestige: false,
    getEffect: (level) => level > 0 ? 1 : 0,
    formatEffect: (val) => val > 0 ? "ACTIVE" : "LOCKED",
  },
  [UpgradeType.PRESTIGE_PARTY_POOPER]: {
    id: UpgradeType.PRESTIGE_PARTY_POOPER,
    name: "Party Pooper",
    description: "Silence the void. Disables all confetti and celebration effects.",
    baseCost: 1,
    costTiers: [1],
    maxLevel: 1,
    isPrestige: true,
    getEffect: (level) => level > 0 ? 1 : 0,
    formatEffect: (val) => val > 0 ? "SILENCED" : "LOCKED",
  },
  [UpgradeType.HARD_MODE_BUFF]: {
    id: UpgradeType.HARD_MODE_BUFF,
    name: "Void Injection",
    description: `+${Math.round(INJECTION_BOOST * 100)}% chance for ${INJECTION_FLIPS} flips, piercing the 60% cap. Buy charges, use them in the clutch.`,
    baseCost: 5,
    costTiers: Array(MAX_INJECTION_CHARGES).fill(5),
    maxLevel: MAX_INJECTION_CHARGES, // Charges held; one is spent per injection
    isPrestige: true,
    getEffect: (level) => level,
    formatEffect: (val) => `${val}/${MAX_INJECTION_CHARGES} Charges`,
  },
  [UpgradeType.HARD_WARD]: {
    id: UpgradeType.HARD_WARD,
    name: "Ward",
    description: "Absorbs one Tails in the clutch zone (not during a Push). Your streak survives, your Heat doesn't.",
    baseCost: 2.5e18,
    // Price doubles with every Ward bought this run, scaled by income multipliers (see getWardPrice)
    costTiers: [2.5e18, 5e18, 1e19, 2e19, 4e19, 8e19, 1.6e20, 3.2e20],
    maxLevel: 8,
    getEffect: (level) => level,
    formatEffect: (val) => `${val} Bought`,
  },

  // --- Abyss (Hard Mode, costs Resolve) ---
  [UpgradeType.HARD_BULWARK]: {
    id: UpgradeType.HARD_BULWARK,
    name: "Bulwark",
    description: "Hold one more Ward at a time.",
    baseCost: 25,
    costTiers: [25, 100],
    maxLevel: 2,
    isPrestige: true,
    currency: 'resolve',
    getEffect: (level) => BASE_WARD_CAP + level,
    formatEffect: (val) => `${val} Ward${val === 1 ? '' : 's'}`,
  },
  [UpgradeType.HARD_MOMENTUM]: {
    id: UpgradeType.HARD_MOMENTUM,
    name: "Momentum Engine",
    description: "Raises the Heat cap. Long streaks burn hotter.",
    baseCost: 40,
    costTiers: [40, 120],
    maxLevel: 2,
    isPrestige: true,
    currency: 'resolve',
    getEffect: (level) => BASE_HEAT_CAP + level * HEAT_CAP_PER_MOMENTUM,
    formatEffect: (val) => `+${val}% Max Heat`,
  },
  [UpgradeType.HARD_STEADY]: {
    id: UpgradeType.HARD_STEADY,
    name: "Steady Nerve",
    description: "A Ward save only halves your Heat instead of wiping it.",
    baseCost: 250,
    costTiers: [250],
    maxLevel: 1,
    isPrestige: true,
    currency: 'resolve',
    getEffect: (level) => level,
    formatEffect: (val) => val > 0 ? "HALF HEAT" : "HEAT LOST",
  },
  [UpgradeType.HARD_HEAD_START]: {
    id: UpgradeType.HARD_HEAD_START,
    name: "Head Start",
    description: "Heat never drops below this, even after a Tails. For Gauntlet veterans.",
    baseCost: 300,
    // Late-game sink: arrives around wins #11, #15 and #20 at the simulated Resolve rate
    costTiers: [300, 600, 1200],
    maxLevel: 3,
    isPrestige: true,
    currency: 'resolve',
    getEffect: (level) => level,
    formatEffect: (val) => `${val}% Min Heat`,
  },
};

// Wards are priced against the permanent income multipliers so they stay a real purchase for big earners
export const getWardPrice = (upgrades: Record<UpgradeType, number>, prestigeLevel: number): number | undefined => {
    const base = UPGRADES[UpgradeType.HARD_WARD].costTiers[upgrades[UpgradeType.HARD_WARD] || 0];
    if (base === undefined) return undefined;
    const goldDigger = UPGRADES[UpgradeType.PRESTIGE_GOLD_DIGGER].getEffect(upgrades[UpgradeType.PRESTIGE_GOLD_DIGGER] || 0);
    const veteran = (upgrades[UpgradeType.PRESTIGE_VETERAN] || 0) > 0 ? Math.max(1, 1 + (prestigeLevel * 0.10)) : 1;
    return base * goldDigger * veteran;
};
