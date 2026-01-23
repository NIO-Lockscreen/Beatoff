export enum UpgradeType {
  CHANCE = 'CHANCE',
  SPEED = 'SPEED',
  COMBO = 'COMBO',
  VALUE = 'VALUE',
  AUTO_FLIP = 'AUTO_FLIP',
}

export interface UpgradeConfig {
  id: UpgradeType;
  name: string;
  description: string;
  baseCost: number;
  costTiers: number[];
  maxLevel: number;
  // Function to calculate effect based on level
  getEffect: (level: number) => number;
  // Function to format the effect for display
  formatEffect: (value: number) => string;
}

export interface GameState {
  money: number;
  streak: number;
  maxStreak: number;
  totalFlips: number;
  upgrades: Record<UpgradeType, number>;
  history: ('H' | 'T')[];
}

export const WINNING_STREAK = 10;