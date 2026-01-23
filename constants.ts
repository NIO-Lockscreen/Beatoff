import { UpgradeType, UpgradeConfig } from './types';

export const UPGRADES: Record<UpgradeType, UpgradeConfig> = {
  // --- Standard Upgrades ---
  [UpgradeType.CHANCE]: {
    id: UpgradeType.CHANCE,
    name: "Weighted Coin",
    description: "Increases the probability of flipping Heads.",
    baseCost: 1,
    costTiers: [1, 10, 100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 7000, 8000, 9000],
    maxLevel: 14,
    getEffect: (level) => level * 0.05, // ADDITIVE to base
    formatEffect: (val) => `+${(val * 100).toFixed(0)}%`,
  },
  [UpgradeType.SPEED]: {
    id: UpgradeType.SPEED,
    name: "Sleight of Hand",
    description: "Reduces the time it takes to flip.",
    baseCost: 1,
    costTiers: [1, 10, 100, 1000, 10000],
    maxLevel: 5,
    getEffect: (level) => {
      // 2.0s base. Tiers reduce it significantly.
      const speeds = [2000, 1500, 1000, 750, 500, 250];
      return speeds[Math.min(level, speeds.length - 1)];
    },
    formatEffect: (val) => `${(val / 1000).toFixed(2)}s`,
  },
  [UpgradeType.COMBO]: {
    id: UpgradeType.COMBO,
    name: "Streak Multiplier",
    description: "Increases money earned for consecutive Heads.",
    baseCost: 1,
    costTiers: [1, 10, 100, 1000, 10000],
    maxLevel: 5,
    getEffect: (level) => {
      const multis = [1, 1.25, 1.5, 2.0, 3.0, 5.0];
      return multis[Math.min(level, multis.length - 1)];
    },
    formatEffect: (val) => `${val}x`,
  },
  [UpgradeType.VALUE]: {
    id: UpgradeType.VALUE,
    name: "Coin Value",
    description: "Increases the base value of a Heads result.",
    baseCost: 1,
    costTiers: [1, 10, 100, 1000, 10000],
    maxLevel: 5,
    getEffect: (level) => {
      const values = [1, 5, 10, 25, 50, 100];
      return values[Math.min(level, values.length - 1)];
    },
    formatEffect: (val) => `$${val}`,
  },
  [UpgradeType.PASSIVE_INCOME]: {
    id: UpgradeType.PASSIVE_INCOME,
    name: "Passive Income",
    description: "Earn a small amount of cash even when you flip Tails.",
    baseCost: 20,
    costTiers: [20, 50, 150, 400, 1000, 2500], 
    maxLevel: 6,
    getEffect: (level) => level, 
    formatEffect: (val) => `$${val}`,
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
    costTiers: [1, 2, 3, 4, 5, 10, 15, 20], // Costs Fragments
    maxLevel: 8,
    isPrestige: true,
    getEffect: (level) => level * 100, // $0, $100, $200...
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
    getEffect: (level) => level * 0.01, // +1% per level
    formatEffect: (val) => `+${(val*100).toFixed(0)}% Base`,
  },
  [UpgradeType.PRESTIGE_FLUX]: {
    id: UpgradeType.PRESTIGE_FLUX,
    name: "Temporal Flux",
    description: "Reduces base flip time permanently.",
    baseCost: 3,
    costTiers: [3, 6, 9, 12, 15],
    maxLevel: 5,
    isPrestige: true,
    getEffect: (level) => level * 100, // -100ms per level
    formatEffect: (val) => `-${val}ms`,
  }
};