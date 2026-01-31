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
  
  // New Prestige Unlocks
  PRESTIGE_PASSIVE = 'PRESTIGE_PASSIVE', // Permanent Passive Income
  PRESTIGE_AUTO = 'PRESTIGE_AUTO',       // Permanent Auto Flip
  PRESTIGE_AUTO_BUY = 'PRESTIGE_AUTO_BUY', // NEW: Auto Buyer
  PRESTIGE_EDGING = 'PRESTIGE_EDGING',   // Permanent Edging
  PRESTIGE_GOLD_DIGGER = 'PRESTIGE_GOLD_DIGGER', // New Multiplier
  PRESTIGE_LIMITLESS = 'PRESTIGE_LIMITLESS', // Break all limits
  PRESTIGE_MOM = 'PRESTIGE_MOM', // The forbidden button
  PRESTIGE_CARE_PACKAGE = 'PRESTIGE_CARE_PACKAGE', // Dollar store upgrade
  PRESTIGE_VETERAN = 'PRESTIGE_VETERAN', // Unlocked after Hard Mode win
  
  // Hard Mode
  HARD_MODE_BUFF = 'HARD_MODE_BUFF', // +20% for one flip
}

export interface UpgradeConfig {
  id: UpgradeType;
  name: string;
  description: string;
  baseCost: number;
  costTiers: number[];
  maxLevel: number;
  limitlessMaxLevel?: number; // New max level when Limitless is active
  isPrestige?: boolean; // If true, costs Void Fragments
  // Function to calculate effect based on level
  getEffect: (level: number) => number;
  // Function to format the effect for display
  formatEffect: (value: number) => string;
}

export interface PlayerStats {
  puristWins: number;      // Wins without auto flip
  momPurchases: number;    // Times "Your Mom" was bought
  highestCash: number;     // Highest cash ever held (at time of win)
  totalPrestiges: number;  // Total number of prestiges performed
  maxPrestigeLevel: number; // Highest prestige level reached (for leaderboard)
  hardModeWins: number;    // Number of times Hard Mode was beaten
}

export interface Title {
  id: string;
  name: string;
  level: number; // x1, x2, etc.
  description: string;
  secret?: boolean;
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
  autoFlipEnabled: boolean; // Toggle for auto flippers
  autoBuyEnabled: boolean; // Toggle for auto buyer
  
  // Hard Mode
  isHardMode: boolean; // 70% Cap, 15 Streak goal
  
  // UX
  seenUpgrades: UpgradeType[]; // List of upgrades user has scrolled to/seen
  
  // Leaderboard & Titles
  playerName: string | null;
  stats: PlayerStats;
  unlockedTitles: Record<string, number>; // Key is Title ID, value is Level
  activeTitle: string | null;
  isPuristRun: boolean; // Tracks if current run has used auto flip
  hasCheated: boolean; // Tracks if debug keys were used
}

export const WINNING_STREAK = 10;
export const HARD_MODE_WINNING_STREAK = 15;
export const FRAGMENTS_PER_WIN = 5;

// Leaderboard Types
export interface LeaderboardEntry {
  name: string;
  score: number;
  date: number;
  title?: string;
}

export interface GlobalLeaderboard {
  purist: LeaderboardEntry[];
  prestige: LeaderboardEntry[];
  rich: LeaderboardEntry[];
  mommy: LeaderboardEntry[];
}