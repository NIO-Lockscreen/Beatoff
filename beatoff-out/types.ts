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
  PRESTIGE_KARMA = 'PRESTIGE_KARMA',
  PRESTIGE_FATE = 'PRESTIGE_FATE',
  PRESTIGE_FLUX = 'PRESTIGE_FLUX',
  
  // New Prestige Unlocks
  PRESTIGE_PASSIVE = 'PRESTIGE_PASSIVE',
  PRESTIGE_AUTO = 'PRESTIGE_AUTO',
  PRESTIGE_AUTO_BUY = 'PRESTIGE_AUTO_BUY',
  PRESTIGE_EDGING = 'PRESTIGE_EDGING',
  PRESTIGE_GOLD_DIGGER = 'PRESTIGE_GOLD_DIGGER',
  PRESTIGE_LIMITLESS = 'PRESTIGE_LIMITLESS',
  PRESTIGE_MOM = 'PRESTIGE_MOM',
  PRESTIGE_CARE_PACKAGE = 'PRESTIGE_CARE_PACKAGE',
  PRESTIGE_VETERAN = 'PRESTIGE_VETERAN',
  PRESTIGE_PARTY_POOPER = 'PRESTIGE_PARTY_POOPER',

  // Hard Mode
  HARD_MODE_BUFF = 'HARD_MODE_BUFF',
  HARD_MODE_MULTI_FLIP = 'HARD_MODE_MULTI_FLIP',
  HARD_MODE_FORGIVENESS = 'HARD_MODE_FORGIVENESS',
  HARD_MODE_MORE_FRAGMENTS = 'HARD_MODE_MORE_FRAGMENTS',
  HARD_MODE_NICKEL = 'HARD_MODE_NICKEL',
}

export interface UpgradeConfig {
  id: UpgradeType;
  name: string;
  description: string;
  baseCost: number;
  costTiers: number[];
  maxLevel: number;
  limitlessMaxLevel?: number;
  isPrestige?: boolean;
  getEffect: (level: number) => number;
  formatEffect: (value: number) => string;
}

export interface PlayerStats {
  puristWins: number;
  momPurchases: number;
  highestCash: number;
  totalPrestiges: number;
  maxPrestigeLevel: number;
  hardModeWins: number;
}

export interface Title {
  id: string;
  name: string;
  level: number;
  description: string;
  secret?: boolean;
}

export interface GameState {
  money: number;
  streak: number;
  maxStreak: number;
  totalFlips: number;
  upgrades: Record<UpgradeType, number>;
  history: ('H' | 'T' | 'E')[];
  
  prestigeLevel: number;
  voidFragments: number;
  autoFlipEnabled: boolean;
  autoBuyEnabled: boolean;
  partyPooperEnabled: boolean;
  
  isHardMode: boolean;
  
  seenUpgrades: UpgradeType[];
  flipSpeedMultiplier: number; // 0.25–3.0, default 1.0, persists across runs
  
  playerName: string | null;
  stats: PlayerStats;
  unlockedTitles: Record<string, number>;
  activeTitle: string | null;
  isPuristRun: boolean;
  hasCheated: boolean;
}

export const WINNING_STREAK = 10;
export const HARD_MODE_WINNING_STREAK = 15;
export const FRAGMENTS_PER_WIN = 5;

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
  hardMode: LeaderboardEntry[];
}
