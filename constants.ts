import { UpgradeType, UpgradeConfig } from './types';

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
    // Extended tiers for Limitless
    costTiers: [
        1, 10, 100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 7000, 8000, 9000, 
        // Limitless Tiers
        25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000
    ],
    maxLevel: 14,
    limitlessMaxLevel: 22, // Goes well beyond 90% combined with Prestige
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
        50000, 100000, 500000, 1000000, 10000000, 50000000, 100000000
    ],
    maxLevel: 5,
    limitlessMaxLevel: 12,
    getEffect: (level) => {
      // Standard logic for first few levels
      const speeds = [2000, 1500, 1000, 750, 500, 250];
      if (level < speeds.length) return speeds[level];
      
      // Limitless logic: decays rapidly towards 0
      // Level 6: 150, Lvl 7: 100, Lvl 8: 75, Lvl 9: 50, Lvl 10: 25, Lvl 11: 10, Lvl 12: 1
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
        100000, 500000, 2000000, 10000000, 50000000, 100000000, 500000000, 1000000000
    ],
    maxLevel: 5,
    limitlessMaxLevel: 13,
    getEffect: (level) => {
      const multis = [1, 1.25, 1.5, 2.0, 3.0, 5.0];
      if (level < multis.length) return multis[level];
      // Exponential growth for Limitless
      return Math.pow(2, level - 2); // 5->8x, 6->16x, 7->32x...
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
        100000, 1000000, 10000000, 100000000, 1000000000, 10000000000
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
        10000, 50000, 250000, 1000000, 5000000
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
    getEffect: (level) => level * 0.025, // BUFFED from 0.01 to 0.025
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
    getEffect: (level) => level * 250, // BUFFED from 100 to 250
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
    isPrestige: true, // Note: Handled as Money cost in Shop
    getEffect: (level) => {
        if (level === 0) return 1;
        if (level === 1) return 2;
        return Math.pow(level, 2); // 2x, 4x, 9x, 16x ... 100x
    },
    formatEffect: (val) => `${val}x Reward`,
  },
  [UpgradeType.PRESTIGE_LIMITLESS]: {
    id: UpgradeType.PRESTIGE_LIMITLESS,
    name: "Limitless",
    description: "Breaks all restrictions. 99% Chance. Instant Speed. Infinite Scaling.",
    baseCost: 1000,
    costTiers: [1000],
    maxLevel: 1,
    isPrestige: true,
    getEffect: (level) => level > 0 ? 1 : 0,
    formatEffect: (val) => val > 0 ? "ACTIVE" : "LOCKED",
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
  }
};