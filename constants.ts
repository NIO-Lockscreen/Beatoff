import { UpgradeType, UpgradeConfig } from './types';

// Based on the "observed" costs from the design doc
export const UPGRADES: Record<UpgradeType, UpgradeConfig> = {
  [UpgradeType.CHANCE]: {
    id: UpgradeType.CHANCE,
    name: "Weighted Coin",
    description: "Increases the probability of flipping Heads.",
    baseCost: 1,
    // $1, $10, $100, $200, $300, $500, $1,000, $1,500, $2,000, $3,000, $5,000, $7,000, $8,000, $9,000
    costTiers: [1, 10, 100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 7000, 8000, 9000],
    maxLevel: 14, // 0-indexed in array logic, so 15 levels total approx
    getEffect: (level) => 0.20 + (level * 0.05), // Starts at 20%, +5% per level
    formatEffect: (val) => `${(val * 100).toFixed(0)}%`,
  },
  [UpgradeType.SPEED]: {
    id: UpgradeType.SPEED,
    name: "Sleight of Hand",
    description: "Reduces the time it takes to flip.",
    baseCost: 1,
    // $1, $10, $100, $1,000, $10,000
    costTiers: [1, 10, 100, 1000, 10000],
    maxLevel: 5,
    getEffect: (level) => {
      // 2.0s base. Tiers reduce it significantly.
      // Levels: 0=2000, 1=1500, 2=1000, 3=750, 4=500, 5=250
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
    // $1, $10, $100, $1,000, $10,000
    costTiers: [1, 10, 100, 1000, 10000],
    maxLevel: 5,
    getEffect: (level) => {
      // 1.0x base.
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
    // $1, $10, $100, $1,000, $10,000
    costTiers: [1, 10, 100, 1000, 10000],
    maxLevel: 5,
    getEffect: (level) => {
      // $1 base.
      const values = [1, 5, 10, 25, 50, 100];
      return values[Math.min(level, values.length - 1)];
    },
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
};