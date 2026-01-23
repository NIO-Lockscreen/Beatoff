export enum UpgradeType {
  // Standard
  CHANCE = 'CHANCE',
  SPEED = 'SPEED',
  COMBO = 'COMBO',
  VALUE = 'VALUE',
  AUTO_FLIP = 'AUTO_FLIP',
  PASSIVE_INCOME = 'PASSIVE_INCOME',
  EDGING = 'EDGING',
  
  // Prestige (Void)
  PRESTIGE_KARMA = 'PRESTIGE_KARMA', // Starting money
  PRESTIGE_FATE = 'PRESTIGE_FATE',   // Base chance increase
  PRESTIGE_FLUX = 'PRESTIGE_FLUX',   // Base speed increase
}

export interface UpgradeConfig {
  id: UpgradeType;
  name: string;
  description: string;
  baseCost: number;
  costTiers: number[];
  maxLevel: number;
  isPrestige?: boolean; // If true, costs Void Fragments
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
  
  // Prestige Data
  prestigeLevel: number; // Multiplier for global income
  voidFragments: number; // Currency for prestige shop
}

export const WINNING_STREAK = 10;
export const FRAGMENTS_PER_WIN = 5;