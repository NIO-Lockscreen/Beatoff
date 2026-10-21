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
  PRESTIGE_PARTY_POOPER = 'PRESTIGE_PARTY_POOPER', // Disable confetti effects

  // Hard Mode
  HARD_MODE_BUFF = 'HARD_MODE_BUFF', // Void Injection charges (+20% for 10 flips)
  HARD_WARD = 'HARD_WARD',           // $ consumable: absorbs a Tails in the clutch zone (level = bought this run)
  HARD_BULWARK = 'HARD_BULWARK',     // Abyss: +1 Ward capacity
  HARD_MOMENTUM = 'HARD_MOMENTUM',   // Abyss: +5% Heat cap
  HARD_STEADY = 'HARD_STEADY',       // Abyss: Ward saves halve Heat instead of resetting it
  HARD_HEAD_START = 'HARD_HEAD_START', // Abyss: Heat never drops below this many points
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
  currency?: 'resolve'; // Overrides the currency (Abyss upgrades cost Resolve)
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
  history: ('H' | 'T' | 'W')[]; // W = Tails absorbed by a Ward
  
  // Prestige Data
  prestigeLevel: number; // Multiplier for global income
  voidFragments: number; // Currency for prestige shop
  autoFlipEnabled: boolean; // Toggle for auto flippers
  autoBuyEnabled: boolean; // Toggle for auto buyer
  partyPooperEnabled: boolean; // Toggle for Party Pooper (disables confetti)
  
  // Hard Mode
  isHardMode: boolean; // 60% base cap; Heat, Wards and Void Injection push past it
  resolve: number; // Hard-only currency for Abyss upgrades
  hardHeat: number; // Heat in % points from consecutive Heads
  wardsHeld: number; // Wards ready to absorb a Tails in the clutch zone
  injectionFlipsLeft: number; // Flips left on the active Void Injection
  hardPushLevel: number; // Pushes taken past the goal this run
  hardPushBust: boolean; // A push ended on an unabsorbed Tails
  autoInjectEnabled: boolean; // Fire Void Injection automatically at clutch moments
  autoBankEnabled: boolean; // Bank hard mode wins automatically after a short delay
  
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
export const HARD_MODE_WINNING_STREAK = 30;
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