import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, UpgradeType, WINNING_STREAK, FRAGMENTS_PER_WIN, PlayerStats, GlobalLeaderboard, LeaderboardEntry } from './types';
import { UPGRADES } from './constants';
import Shop from './components/Shop';
import ProbabilityModal from './components/ProbabilityModal';
import LeaderboardModal from './components/LeaderboardModal';
import ConfettiSystem from './components/ConfettiSystem';
import { AudioService } from './services/audioService';
import { LeaderboardService } from './services/leaderboardService';
import { HelpCircle, Trash2, Trophy, Volume2, VolumeX, Sparkles, AlertCircle, Heart, List, Crown } from 'lucide-react';

const CELEBRATION_MESSAGES = [
  "", 
  "", 
  "LUCKY", 
  "HEATING UP", 
  "UNREAL", 
  "DEFYING ODDS", 
  "SYSTEM ERROR", 
  "IMPOSSIBLE", 
  "DESTINY", 
  "Winner!!!"
];

const COMPLIMENTS = [
    "You have a wonderful smile.",
    "Your persistence is admirable.",
    "You bring light to those around you.",
    "You are capable of amazing things.",
    "Your creative instincts are sharp.",
    "You are a great listener.",
    "You have a unique perspective.",
    "Your kindness is a gift.",
    "You are stronger than you know.",
    "Your potential is limitless."
];

const INITIAL_STATS: PlayerStats = {
    puristWins: 0,
    momPurchases: 0,
    highestCash: 0,
    totalPrestiges: 0,
    maxPrestigeLevel: 0,
};

const INITIAL_STATE: GameState = {
  money: 0,
  streak: 0,
  maxStreak: 0,
  totalFlips: 0,
  upgrades: {
    [UpgradeType.CHANCE]: 0,
    [UpgradeType.SPEED]: 0,
    [UpgradeType.COMBO]: 0,
    [UpgradeType.VALUE]: 0,
    [UpgradeType.AUTO_FLIP]: 0,
    [UpgradeType.PASSIVE_INCOME]: 0,
    [UpgradeType.EDGING]: 0,
    // Prestige Upgrades
    [UpgradeType.PRESTIGE_KARMA]: 0,
    [UpgradeType.PRESTIGE_FATE]: 0,
    [UpgradeType.PRESTIGE_FLUX]: 0,
    [UpgradeType.PRESTIGE_PASSIVE]: 0,
    [UpgradeType.PRESTIGE_AUTO]: 0,
    [UpgradeType.PRESTIGE_AUTO_BUY]: 0, // New
    [UpgradeType.PRESTIGE_EDGING]: 0,
    [UpgradeType.PRESTIGE_GOLD_DIGGER]: 0,
    [UpgradeType.PRESTIGE_LIMITLESS]: 0,
    [UpgradeType.PRESTIGE_MOM]: 0,
  },
  history: [],
  prestigeLevel: 0,
  voidFragments: 0,
  autoFlipEnabled: true,
  autoBuyEnabled: false, // New
  seenUpgrades: [UpgradeType.CHANCE, UpgradeType.SPEED, UpgradeType.COMBO, UpgradeType.VALUE], // Base items always seen
  
  // New State
  playerName: null,
  stats: INITIAL_STATS,
  unlockedTitles: {},
  activeTitle: null,
  isPuristRun: true,
  hasCheated: false,
};

const SAVE_KEY = 'beatTheOdds_save';
const META_SAVE_KEY = 'beatTheOdds_meta';
const SEEN_COMPLIMENTS_KEY = 'beatTheOdds_seen_compliments';

// Priority Order for Auto Buy
const AUTO_BUY_TARGETS = [
    UpgradeType.CHANCE,
    UpgradeType.SPEED,
    UpgradeType.COMBO,
    UpgradeType.VALUE,
    UpgradeType.PASSIVE_INCOME,
    UpgradeType.EDGING,
    UpgradeType.AUTO_FLIP
];

const App: React.FC = () => {
  
  // --- Meta Data Management (Persistence across Resets) ---
  const getMetaStats = (): PlayerStats => {
      try {
          const s = localStorage.getItem(META_SAVE_KEY);
          if (s) {
              const parsed = JSON.parse(s);
              // Migration for older saves that might miss new fields
              return { ...INITIAL_STATS, ...parsed };
          }
      } catch (e) { console.error(e); }
      return INITIAL_STATS;
  };

  const saveMetaStats = (stats: PlayerStats) => {
      localStorage.setItem(META_SAVE_KEY, JSON.stringify(stats));
  };

  // --- State Initialization ---
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure upgrades object has the new keys if loading old save
        const defaults = INITIAL_STATE.upgrades;
        for (const key of Object.keys(defaults) as UpgradeType[]) {
             if (typeof parsed.upgrades[key] === 'undefined') {
                 parsed.upgrades[key] = 0;
             }
        }
        if (typeof parsed.prestigeLevel === 'undefined') parsed.prestigeLevel = 0;
        if (typeof parsed.voidFragments === 'undefined') parsed.voidFragments = 0;
        if (typeof parsed.autoFlipEnabled === 'undefined') parsed.autoFlipEnabled = true;
        if (typeof parsed.autoBuyEnabled === 'undefined') parsed.autoBuyEnabled = false;
        
        // Initialize seenUpgrades for legacy saves
        if (!parsed.seenUpgrades) {
            parsed.seenUpgrades = [UpgradeType.CHANCE, UpgradeType.SPEED, UpgradeType.COMBO, UpgradeType.VALUE];
            Object.keys(parsed.upgrades).forEach((key) => {
                const k = key as UpgradeType;
                if (parsed.upgrades[k] > 0 && !parsed.seenUpgrades.includes(k)) {
                    parsed.seenUpgrades.push(k);
                }
            });
        }
        
        // Load Meta Stats for Leaderboard Accuracy
        const metaStats = getMetaStats();
        parsed.stats = metaStats; // Always trust meta storage for stats

        if (!parsed.unlockedTitles) parsed.unlockedTitles = {};
        if (typeof parsed.isPuristRun === 'undefined') parsed.isPuristRun = true;
        if (typeof parsed.hasCheated === 'undefined') parsed.hasCheated = false;

        return parsed;
      }
    } catch (e) {
      console.error("Failed to load save", e);
    }
    
    // If no save, load meta stats anyway
    const metaStats = getMetaStats();
    return { ...INITIAL_STATE, stats: metaStats };
  });

  const [isFlipping, setIsFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState<'H' | 'T' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMomModal, setShowMomModal] = useState<{show: boolean, text: string}>({show: false, text: ""});
  const [hasWon, setHasWon] = useState(false);
  const [celebration, setCelebration] = useState<{text: string, level: number, id: number} | null>(null);
  const [muted, setMuted] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showTitleSelector, setShowTitleSelector] = useState(false);

  const flipTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);
  const cheatCodeBuffer = useRef<string>("");

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // --- Mute Sync ---
  useEffect(() => {
     AudioService.setMuted(muted);
  }, [muted]);

  // --- Derived Values (Stats Calculation) ---
  
  const hasLimitless = (gameState.upgrades[UpgradeType.PRESTIGE_LIMITLESS] || 0) > 0;
  const hasAlgorithmicGreed = (gameState.upgrades[UpgradeType.PRESTIGE_AUTO_BUY] || 0) > 0;

  // 1. Calculate Base Values from Prestige
  const prestigeKarmaMoney = UPGRADES[UpgradeType.PRESTIGE_KARMA].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_KARMA] || 0);
  const prestigeBaseChance = UPGRADES[UpgradeType.PRESTIGE_FATE].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FATE] || 0);
  const prestigeSpeedReduc = UPGRADES[UpgradeType.PRESTIGE_FLUX].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0);

  // 2. Calculate Standard Upgrade Effects
  const standardChanceAdd = UPGRADES[UpgradeType.CHANCE].getEffect(gameState.upgrades[UpgradeType.CHANCE]);
  const standardSpeed = UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]); 
  
  // 3. Combine
  const baseChance = 0.20 + prestigeBaseChance;
  const currentChance = Math.min(0.99, baseChance + standardChanceAdd); // Hard cap at 99% logic
  
  // Speed calculation:
  const rawSpeed = standardSpeed - prestigeSpeedReduc;
  const minSpeed = hasLimitless ? 1 : 50;
  const currentSpeed = Math.max(minSpeed, rawSpeed);

  const currentCombo = UPGRADES[UpgradeType.COMBO].getEffect(gameState.upgrades[UpgradeType.COMBO]);
  const currentBaseValue = UPGRADES[UpgradeType.VALUE].getEffect(gameState.upgrades[UpgradeType.VALUE]);
  
  const hasAutoFlip = (gameState.upgrades[UpgradeType.AUTO_FLIP] || 0) > 0 || 
                      (gameState.upgrades[UpgradeType.PRESTIGE_AUTO] || 0) > 0;
  
  const prestigeMultiplier = 1 + (gameState.prestigeLevel * 0.1);

  const isRichMode = (gameState.activeTitle === 'RICH' && gameState.money >= 1000000);

  // --- Helper: Unlock Title ---
  const unlockTitle = useCallback((titleId: string, level: number = 1) => {
     setGameState(prev => {
         const currentLevel = prev.unlockedTitles[titleId] || 0;
         if (level > currentLevel) {
             // New title or level up
             if (!prev.activeTitle) {
                 return {
                     ...prev,
                     unlockedTitles: { ...prev.unlockedTitles, [titleId]: level },
                     activeTitle: titleId // Auto equip if none equipped
                 };
             }
             return {
                 ...prev,
                 unlockedTitles: { ...prev.unlockedTitles, [titleId]: level }
             };
         }
         return prev;
     });
  }, []);

  // --- Logic Checks (Rich) ---
  useEffect(() => {
      if (gameState.money > 10000000) {
          unlockTitle('RICH', 1);
      }
      // Removed automatic Highest Cash update. Now handled in handleFlip(win)
  }, [gameState.money, unlockTitle]);

  const formatMoney = (val: number) => {
    if (val >= 1e33) return '$' + (val / 1e33).toFixed(2).replace(/\.00$/, '') + 'Dc';
    if (val >= 1e30) return '$' + (val / 1e30).toFixed(2).replace(/\.00$/, '') + 'No';
    if (val >= 1e27) return '$' + (val / 1e27).toFixed(2).replace(/\.00$/, '') + 'Oc';
    if (val >= 1e24) return '$' + (val / 1e24).toFixed(2).replace(/\.00$/, '') + 'Sp';
    if (val >= 1e21) return '$' + (val / 1e21).toFixed(2).replace(/\.00$/, '') + 'Sx';
    if (val >= 1e18) return '$' + (val / 1e18).toFixed(2).replace(/\.00$/, '') + 'Qi';
    if (val >= 1e15) return '$' + (val / 1e15).toFixed(2).replace(/\.00$/, '') + 'Qa';
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    return '$' + val.toLocaleString();
  };
  
  // --- Actions ---

  const handleFlip = useCallback((forceHeads: boolean = false, isAuto: boolean = false) => {
    const isDebug = typeof forceHeads === 'boolean' && forceHeads === true;

    // IMPORTANT: Stop auto flipping if we reached the win condition (streak >= 10)
    if (gameState.streak >= 10 && !forceHeads && !hasWon) {
        // Just let the last animation finish and trigger win
    }

    if (isFlipping || hasWon || showMomModal.show) return;

    setIsFlipping(true);
    // Audio throttle for high speeds
    if (currentSpeed > 50) AudioService.playFlip();

    const duration = currentSpeed;

    flipTimeoutRef.current = window.setTimeout(() => {
      let isHeads = Math.random() < currentChance;
      
      if (isDebug) isHeads = true;

      const result = isHeads ? 'H' : 'T';

      setGameState(prev => {
        const newStreak = isHeads ? prev.streak + 1 : 0;
        
        let earned = 0;
        if (isHeads) {
            earned = Math.floor(currentBaseValue * (newStreak > 1 ? (1 + (newStreak * (currentCombo - 1))) : 1));
        } else {
            const passiveLevel = prev.upgrades[UpgradeType.PASSIVE_INCOME] || 0;
            const standardPassive = UPGRADES[UpgradeType.PASSIVE_INCOME].getEffect(passiveLevel) * (1 + prev.prestigeLevel);
            const voidPassiveLevel = prev.upgrades[UpgradeType.PRESTIGE_PASSIVE] || 0;
            const voidPassive = UPGRADES[UpgradeType.PRESTIGE_PASSIVE].getEffect(voidPassiveLevel);
            if (standardPassive > 0 || voidPassive > 0) {
                earned = standardPassive + voidPassive;
            }
        }
        
        const edgingLevel = prev.upgrades[UpgradeType.EDGING] || 0;
        const voidEdgingLevel = prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0;
        if (edgingLevel > 0 || voidEdgingLevel > 0) earned *= 10;

        // Gold Digger Multiplier
        const goldDiggerLevel = prev.upgrades[UpgradeType.PRESTIGE_GOLD_DIGGER] || 0;
        const goldDiggerMulti = UPGRADES[UpgradeType.PRESTIGE_GOLD_DIGGER].getEffect(goldDiggerLevel);
        if (goldDiggerMulti > 1) earned *= goldDiggerMulti;
        
        earned = Math.floor(earned * prestigeMultiplier);
        
        const newMaxStreak = Math.max(prev.maxStreak, newStreak);
        const won = newStreak >= WINNING_STREAK;
        const finalMoney = prev.money + earned;

        // INVALIDATE PURIST RUN IF AUTO FLIP used
        // Spec: "No autoflipper was used at any point during that run"
        const nextIsPuristRun = isAuto ? false : prev.isPuristRun;

        let nextStats = { ...prev.stats };
        let nextTitles = { ...prev.unlockedTitles };
        let nextActiveTitle = prev.activeTitle;

        // --- WIN CONDITION HANDLER (STATE UPDATE) ---
        if (won && !hasWon) {
           // 1. PURIST LOGIC
           // Only increment if we are still in a purist run
           if (nextIsPuristRun) {
               nextStats.puristWins += 1;
               
               // Unlock Title
               nextTitles['PURIST'] = nextStats.puristWins;
               if (!nextActiveTitle) nextActiveTitle = 'PURIST';
           }

           // 2. RICH LOGIC
           // "Tracks the highest amount of cash held at the moment of round completion"
           if (finalMoney > nextStats.highestCash) {
               nextStats.highestCash = finalMoney;
           }
        }

        if (isHeads) {
             if (currentSpeed > 50 || newStreak % 10 === 0) {
                 AudioService.playHeads(newStreak);
             }
            if (newStreak >= 2) {
                if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
                let message = CELEBRATION_MESSAGES[Math.min(newStreak, CELEBRATION_MESSAGES.length - 1)] || "GODLIKE";
                if (newStreak > 10) message = "OVERACHIEVER";
                
                const autoFlipOwned = (prev.upgrades[UpgradeType.AUTO_FLIP] || 0) > 0 || (prev.upgrades[UpgradeType.PRESTIGE_AUTO] || 0) > 0;
                const passiveOwned = (prev.upgrades[UpgradeType.PASSIVE_INCOME] || 0) > 0 || (prev.upgrades[UpgradeType.PRESTIGE_PASSIVE] || 0) > 0;
                const edgingOwned = (prev.upgrades[UpgradeType.EDGING] || 0) > 0 || (prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0) > 0;
                const prestigeAutoOwned = (prev.upgrades[UpgradeType.PRESTIGE_AUTO] || 0) > 0;
                const prestigeEdgingOwned = (prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0) > 0;

                if (newStreak === 3 && prev.maxStreak < 3 && !passiveOwned) message = "PASSIVE INCOME UNLOCKED";
                if (newStreak === 5 && prev.maxStreak < 5 && !autoFlipOwned && !prestigeAutoOwned) message = "AUTO FLIP UNLOCKED";
                if (newStreak === 9 && prev.maxStreak < 9 && !edgingOwned && !prestigeEdgingOwned) message = "EDGING UNLOCKED";

                setCelebration({ text: message, level: newStreak, id: Date.now() });
                celebrationTimeoutRef.current = window.setTimeout(() => setCelebration(null), 2500) as any;
            }
        } else {
             if (currentSpeed > 50) AudioService.playTails();
        }

        return {
          ...prev,
          money: finalMoney,
          streak: newStreak,
          maxStreak: newMaxStreak,
          totalFlips: prev.totalFlips + 1,
          history: [result as 'H'|'T', ...prev.history].slice(0, 10),
          stats: nextStats,
          unlockedTitles: nextTitles,
          activeTitle: nextActiveTitle,
          isPuristRun: nextIsPuristRun // Apply invalidation
        };
      });

      setCoinSide(result);
      setIsFlipping(false);
    }, duration) as any;

  }, [isFlipping, hasWon, currentChance, currentSpeed, currentBaseValue, currentCombo, prestigeMultiplier, showMomModal, gameState.streak]);

  // --- Effect: Handle Win Side Effects (Once per run) ---
  useEffect(() => {
    if (gameState.streak >= 10 && !hasWon) {
        setHasWon(true);
        // Trigger Leaderboard / Name Entry
        if (!gameState.playerName) {
            setShowLeaderboard(true);
        }

        // Save Meta Data immediately on win
        saveMetaStats(gameState.stats);

        // Submit Leaderboard Scores
        if (gameState.playerName) {
            const name = gameState.hasCheated ? "cheater" : gameState.playerName;
            const now = Date.now();
            const title = gameState.activeTitle || undefined;
            
            const updates = [];
            // We check the stats object which was updated in handleFlip
            if (gameState.isPuristRun) {
                updates.push({ category: 'purist', entry: { name, score: gameState.stats.puristWins, date: now, title } });
            }
            if (gameState.money >= gameState.stats.highestCash) {
                updates.push({ category: 'rich', entry: { name, score: gameState.stats.highestCash, date: now, title } });
            }
            
            // @ts-ignore
            if (updates.length > 0) LeaderboardService.submitScores(updates);
        }
    }
  }, [gameState.streak, hasWon, gameState.isPuristRun, gameState.money, gameState.stats, gameState.playerName, gameState.hasCheated, gameState.activeTitle]);


  const triggerMomEvent = () => {
      // Get seen list
      let seen: string[] = [];
      try {
          const s = localStorage.getItem(SEEN_COMPLIMENTS_KEY);
          if (s) seen = JSON.parse(s);
      } catch (e) {
          console.error(e);
      }

      const available = COMPLIMENTS.filter(c => !seen.includes(c));
      const pool = available.length > 0 ? available : COMPLIMENTS;
      const text = pool[Math.floor(Math.random() * pool.length)];

      setShowMomModal({ show: true, text });
      AudioService.playWin(); 
  };

  const handleMomConfirm = () => {
      let seen: string[] = [];
      try {
          const s = localStorage.getItem(SEEN_COMPLIMENTS_KEY);
          if (s) seen = JSON.parse(s);
          if (!seen.includes(showMomModal.text)) {
              seen.push(showMomModal.text);
              localStorage.setItem(SEEN_COMPLIMENTS_KEY, JSON.stringify(seen));
          }
      } catch (e) { console.error(e); }

      // Reset
      localStorage.removeItem(SAVE_KEY); // Wipe game state
      setShowMomModal({ show: false, text: "" });
      
      // Load Meta Stats (Survives Reset)
      const metaStats = getMetaStats();

      // Preserve Leaderboard Identity but reset run
      const freshState = JSON.parse(JSON.stringify(INITIAL_STATE));
      freshState.playerName = gameState.playerName;
      freshState.stats = metaStats; // Restore meta stats
      freshState.unlockedTitles = gameState.unlockedTitles; // Keep titles? Spec implies reset except MOM logic, but titles are tied to meta stats usually. Let's keep them.
      freshState.activeTitle = gameState.activeTitle;
      freshState.hasCheated = false; // RESET CHEATER FLAG ON RESET

      setGameState(freshState);
      setHasWon(false);
      setCoinSide(null);
      setCelebration(null);
      window.location.reload(); 
  };

  const buyUpgrade = (type: UpgradeType, cost: number, isPrestige: boolean) => {
    // Intercept "Your Mom" upgrade
    if (type === UpgradeType.PRESTIGE_MOM) {
        if (gameState.money >= cost) {
            
            // 4. MOMMY LOGIC
            // Immediate meta-update before reset
            const nextStats = { ...gameState.stats, momPurchases: gameState.stats.momPurchases + 1 };
            saveMetaStats(nextStats);

            setGameState(prev => {
                // Unlock Title locally for visual continuity before reload
                const nextTitles = { ...prev.unlockedTitles };
                if (nextStats.momPurchases > 1) {
                     nextTitles['MOMMY'] = nextStats.momPurchases;
                }
                return {
                    ...prev,
                    money: prev.money - cost,
                    stats: nextStats,
                    unlockedTitles: nextTitles
                };
            });
            
            // Trigger Leaderboard Update immediately for Mom Purchase
            if (gameState.playerName) {
                const name = gameState.hasCheated ? "cheater" : gameState.playerName;
                const now = Date.now();
                const title = gameState.activeTitle || undefined;
                LeaderboardService.submitScores([
                    { category: 'mommy', entry: { name, score: nextStats.momPurchases, date: now, title } },
                ]);
            }

            triggerMomEvent();
        }
        return;
    }

    // SPECIAL CASE: Gold Digger is Prestige Category but Money Cost
    if (type === UpgradeType.PRESTIGE_GOLD_DIGGER) {
        if (gameState.money >= cost) {
            setGameState(prev => ({
                ...prev,
                money: prev.money - cost,
                upgrades: { ...prev.upgrades, [type]: (prev.upgrades[type] || 0) + 1 }
            }));
            AudioService.playFlip();
        }
        return;
    }

    if (isPrestige) {
        if (gameState.voidFragments >= cost) {
            setGameState((prev: GameState) => {
                let extraMoney = 0;
                if (type === UpgradeType.PRESTIGE_KARMA) {
                    const currentLevel = (prev.upgrades[type] as number) || 0;
                    const nextLevel = currentLevel + 1;
                    const prevEffect = UPGRADES[type].getEffect(currentLevel);
                    const nextEffect = UPGRADES[type].getEffect(nextLevel);
                    extraMoney = nextEffect - prevEffect;
                }

                if (extraMoney > 0) AudioService.playFlip(); 

                return {
                    ...prev,
                    voidFragments: prev.voidFragments - cost,
                    money: prev.money + extraMoney,
                    upgrades: { ...prev.upgrades, [type]: (prev.upgrades[type] || 0) + 1 }
                };
            });
        }
    } else {
        if (gameState.money >= cost) {
            setGameState(prev => ({
                ...prev,
                money: prev.money - cost,
                upgrades: { ...prev.upgrades, [type]: (prev.upgrades[type] || 0) + 1 }
            }));
        }
    }
  };
  
  const handleUpgradeSeen = useCallback((id: UpgradeType) => {
      setGameState(prev => {
          if (prev.seenUpgrades.includes(id)) return prev;
          return { ...prev, seenUpgrades: [...prev.seenUpgrades, id] };
      });
  }, []);

  const hardReset = () => {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(META_SAVE_KEY); // Full Wipe
    setGameState(JSON.parse(JSON.stringify(INITIAL_STATE)));
    setHasWon(false);
    setCoinSide(null);
    setCelebration(null);
    setDeleteConfirm(false);
  };

  const ascend = () => {
      const karmaLevel = gameState.upgrades[UpgradeType.PRESTIGE_KARMA] || 0;
      const startMoney = UPGRADES[UpgradeType.PRESTIGE_KARMA].getEffect(karmaLevel);

      const prestigeUpgrades: Record<string, number> = {};
      Object.keys(gameState.upgrades).forEach(key => {
          const k = key as UpgradeType;
          if (UPGRADES[k].isPrestige) {
              prestigeUpgrades[k] = gameState.upgrades[k];
          } else {
              prestigeUpgrades[k] = 0;
          }
      });

      // Fixed reward of 5 fragments per clear, removed prestige scaling
      const voidReward = FRAGMENTS_PER_WIN;

      // Unlock Prestiger Title
      const newPrestigeLevel = gameState.prestigeLevel + 1;
      const nextTitles = { ...gameState.unlockedTitles };
      if (newPrestigeLevel > 0) {
          nextTitles['PRESTIGE'] = newPrestigeLevel;
      }
      
      // 3. PRESTIGE LOGIC
      // "Check if currentPrestige > prestigeLeaderboardMax"
      const nextStats = { 
          ...gameState.stats, 
          totalPrestiges: gameState.stats.totalPrestiges + 1,
          maxPrestigeLevel: Math.max(gameState.stats.maxPrestigeLevel, newPrestigeLevel)
      };
      saveMetaStats(nextStats);

      const nextState: GameState = {
          ...INITIAL_STATE,
          money: startMoney,
          prestigeLevel: newPrestigeLevel,
          voidFragments: gameState.voidFragments + voidReward,
          upgrades: prestigeUpgrades as Record<UpgradeType, number>,
          totalFlips: 0, 
          seenUpgrades: gameState.seenUpgrades,
          // Preserve Identity
          playerName: gameState.playerName,
          stats: nextStats,
          unlockedTitles: nextTitles,
          activeTitle: gameState.activeTitle || (newPrestigeLevel === 1 ? 'PRESTIGE' : gameState.activeTitle),
          isPuristRun: true, // Reset Purist run eligibility on new run
          hasCheated: gameState.hasCheated, // Cheater status persists across prestige
          autoFlipEnabled: gameState.autoFlipEnabled, // PRESERVE AUTOFLIP PREFERENCE
          autoBuyEnabled: gameState.autoBuyEnabled // PRESERVE AUTOBUY PREFERENCE
      };

      // Submit Scores ON ASCEND (New Game Start)
      if (gameState.playerName) {
          const name = gameState.hasCheated ? "cheater" : gameState.playerName;
          const now = Date.now();
          const title = gameState.activeTitle || undefined;

          // Only submit Prestige score if we beat the max (which we checked above, or if its a new max)
          const updates: { category: keyof GlobalLeaderboard; entry: LeaderboardEntry }[] = [];
          
          if (newPrestigeLevel >= nextStats.maxPrestigeLevel) {
               updates.push({ category: 'prestige', entry: { name, score: newPrestigeLevel, date: now, title } });
          }
          
          if (updates.length > 0) {
              LeaderboardService.submitScores(updates);
          }
      }

      setGameState(nextState);
      setHasWon(false);
      setCoinSide(null);
      setCelebration(null);
  };

  const registerName = (name: string) => {
      if (name === "cheater") {
          LeaderboardService.wipeCheaters();
          setGameState(prev => ({ ...prev, playerName: "cheater" }));
          return;
      }

      // Force "cheater" if flag is set
      const finalName = gameState.hasCheated ? "cheater" : name;
      
      setGameState(prev => ({ ...prev, playerName: finalName }));
      
      const updates: { category: keyof GlobalLeaderboard; entry: LeaderboardEntry }[] = [];
      const now = Date.now();
      const title = gameState.activeTitle || undefined;

      // When registering name, submit everything we have so far
      // Note: prestigeLevel is current level.
      if (gameState.stats.highestCash > 0) {
          updates.push({ category: 'rich', entry: { name: finalName, score: gameState.stats.highestCash, date: now, title }});
      }
      
      if (gameState.stats.puristWins > 0) {
          updates.push({ category: 'purist', entry: { name: finalName, score: gameState.stats.puristWins, date: now, title }});
      }
      
      if (gameState.prestigeLevel > 0) {
          updates.push({ category: 'prestige', entry: { name: finalName, score: gameState.prestigeLevel, date: now, title }});
      }
      
      if (gameState.stats.momPurchases > 0) {
          updates.push({ category: 'mommy', entry: { name: finalName, score: gameState.stats.momPurchases, date: now, title }});
      }
      
      if (updates.length > 0) {
          LeaderboardService.submitScores(updates);
      }
  };

  const handleDeleteClick = () => {
    if (deleteConfirm) {
        hardReset();
    } else {
        setDeleteConfirm(true);
        deleteTimeoutRef.current = window.setTimeout(() => setDeleteConfirm(false), 3000) as any;
    }
  };

  const toggleMute = () => {
      const newMuted = AudioService.toggleMute();
      setMuted(newMuted);
  };
  
  const toggleAutoFlip = () => {
      setGameState(prev => ({
          ...prev,
          autoFlipEnabled: !prev.autoFlipEnabled,
          // Toggling OFF does not invalidate run. Only triggering 'isAuto' flip does.
      }));
  };

  const toggleAutoBuy = () => {
      setGameState(prev => ({
          ...prev,
          autoBuyEnabled: !prev.autoBuyEnabled
      }));
  };
  
  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Anti-Cheat: Don't trigger cheats OR flag as cheater if user is typing in an input (e.g. name field)
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault(); 
            handleFlip(false);
        }
        // DEBUG KEYS (Triggers Cheater Flag)
        if (e.code === 'KeyQ') {
            handleFlip(true); 
            setGameState(prev => ({ 
                ...prev, 
                voidFragments: prev.voidFragments + 5,
                hasCheated: true 
            }));
        }
        if (e.code === 'KeyZ') {
            setGameState(prev => ({ 
                ...prev, 
                money: prev.money + 10000,
                hasCheated: true
            }));
        }

        // HIDDEN CODE: ZEX (+5 Prestige)
        if (e.key) {
           cheatCodeBuffer.current = (cheatCodeBuffer.current + (e.key as string)).toUpperCase().slice(-3);
           if (cheatCodeBuffer.current === "ZEX") {
               setGameState((prev: GameState) => ({
                   ...prev,
                   prestigeLevel: (prev.prestigeLevel as number) + 5
               }));
               AudioService.playWin();
               cheatCodeBuffer.current = "";
           }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip]);


  // --- Auto Flip Effect ---
  useEffect(() => {
    let timer: number;
    const shouldAutoFlip = hasAutoFlip && gameState.autoFlipEnabled && gameState.streak < 10;
    
    if (shouldAutoFlip && !isFlipping && !hasWon && !showMomModal.show) {
        // CALL handleFlip with isAuto = true
        timer = window.setTimeout(() => handleFlip(false, true), 300) as any;
    }
    return () => { if (timer) window.clearTimeout(timer); };
  }, [hasAutoFlip, isFlipping, hasWon, handleFlip, showMomModal, gameState.autoFlipEnabled, gameState.streak]);

  // --- Auto Flip Failsafe ---
  useEffect(() => {
      const failsafeInterval = window.setInterval(() => {
          const shouldAutoFlip = hasAutoFlip && gameState.autoFlipEnabled && gameState.streak < 10;
          if (shouldAutoFlip && !isFlipping && !hasWon && !showMomModal.show) {
              // CALL handleFlip with isAuto = true
              handleFlip(false, true);
          }
      }, 2000) as any; 
      return () => window.clearInterval(failsafeInterval);
  }, [hasAutoFlip, gameState.autoFlipEnabled, gameState.streak, isFlipping, hasWon, showMomModal, handleFlip]);


  // --- Auto Buy Effect (Algorithmic Greed) ---
  useEffect(() => {
      if (!hasAlgorithmicGreed || !gameState.autoBuyEnabled) return;

      const interval = setInterval(() => {
          setGameState(prev => {
              if (prev.streak >= 10 || prev.money <= 0) return prev; // Stop if won or broke

              let currentMoney = prev.money;
              let updatedUpgrades = { ...prev.upgrades };
              let updatedSeen = [...prev.seenUpgrades];
              let madePurchase = false;

              const hasPhantomHand = (updatedUpgrades[UpgradeType.PRESTIGE_AUTO] || 0) > 0;
              const hasPrestigeEdging = (updatedUpgrades[UpgradeType.PRESTIGE_EDGING] || 0) > 0;

              // Check specific upgrades in order
              for (const upgradeId of AUTO_BUY_TARGETS) {
                  const config = UPGRADES[upgradeId];
                  const currentLevel = updatedUpgrades[upgradeId] || 0;
                  
                  const hasLimitless = (updatedUpgrades[UpgradeType.PRESTIGE_LIMITLESS] || 0) > 0;
                  const maxLevel = (hasLimitless && config.limitlessMaxLevel) 
                        ? config.limitlessMaxLevel 
                        : config.maxLevel;

                  // Skip if maxed
                  if (currentLevel >= maxLevel) continue;

                  // Special Unlock Logic (Match Shop.tsx logic roughly)
                  // Standard items unlock if: Owned OR (Streak Threshold Met OR Prestige >= 1)
                  
                  if (upgradeId === UpgradeType.PASSIVE_INCOME) {
                      if (currentLevel === 0 && prev.maxStreak < 3 && prev.prestigeLevel < 1) continue;
                  }

                  if (upgradeId === UpgradeType.AUTO_FLIP) {
                      if (hasPhantomHand) continue; // Skip if Phantom Hand owned (it's hidden in shop)
                      if (currentLevel === 0 && prev.maxStreak < 5 && prev.prestigeLevel < 1) continue;
                  }

                  if (upgradeId === UpgradeType.EDGING) {
                      if (hasPrestigeEdging) continue; // Skip if Prestige Edging owned
                      if (currentLevel === 0 && prev.maxStreak < 9 && prev.prestigeLevel < 1) continue;
                  }

                  const cost = config.costTiers[currentLevel] || config.costTiers[config.costTiers.length - 1];

                  if (currentMoney >= cost) {
                      currentMoney -= cost;
                      updatedUpgrades[upgradeId] = currentLevel + 1;
                      madePurchase = true;
                      
                      if (!updatedSeen.includes(upgradeId)) updatedSeen.push(upgradeId);
                  }
              }

              if (madePurchase) {
                  return {
                      ...prev,
                      money: currentMoney,
                      upgrades: updatedUpgrades,
                      seenUpgrades: updatedSeen
                  };
              }
              return prev;
          });
      }, 1000); // Run every second

      return () => clearInterval(interval);
  }, [hasAlgorithmicGreed, gameState.autoBuyEnabled]);

  useEffect(() => {
    return () => {
      if (flipTimeoutRef.current !== null) window.clearTimeout(flipTimeoutRef.current);
      if (celebrationTimeoutRef.current !== null) window.clearTimeout(celebrationTimeoutRef.current);
      if (deleteTimeoutRef.current !== null) window.clearTimeout(deleteTimeoutRef.current);
    };
  }, []);

  const getTitleDisplay = (key: string, level: number) => {
      let suffix = level > 1 ? ` x${level}` : '';
      if (key === 'PURIST') return `Purist${suffix}`;
      if (key === 'PRESTIGE') return `Prestiger${suffix}`;
      if (key === 'RICH') return `High Roller${suffix}`;
      if (key === 'MOMMY') return `Mommy Lover${suffix}`;
      return key;
  };

  return (
    <div className={`min-h-screen md:h-screen md:overflow-hidden overflow-y-auto bg-noir-950 text-noir-200 font-sans selection:bg-amber-900 selection:text-white flex flex-col md:flex-row relative transition-colors duration-200 ${celebration && celebration.level >= 8 ? 'bg-noir-900' : ''}`}>
      
      {/* Visual Overlays */}
      <div className="bg-noise pointer-events-none fixed inset-0 z-0" />
      <div className="bg-vignette pointer-events-none fixed inset-0 z-0" />
      <ConfettiSystem 
        streak={gameState.streak} 
        isRichMode={isRichMode} 
        activeTitle={gameState.activeTitle}
        momPurchases={gameState.stats.momPurchases}
      />
      
      {/* Title Bar (Top Overlay) */}
      {gameState.activeTitle && (
          <div 
            onClick={() => setShowTitleSelector(true)}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] cursor-pointer group"
          >
              <div className="flex items-center gap-2 px-3 py-1 bg-noir-900/80 border border-amber-500/30 rounded-full backdrop-blur hover:bg-noir-800 transition-all shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                  <Crown size={12} className="text-amber-500" />
                  <span className="text-xs font-mono font-bold text-amber-200 tracking-widest uppercase">
                    {getTitleDisplay(gameState.activeTitle, gameState.unlockedTitles[gameState.activeTitle] || 1)}
                  </span>
                  {gameState.playerName && <span className="text-xs text-noir-500 font-mono">| {gameState.hasCheated ? "cheater" : gameState.playerName}</span>}
              </div>
          </div>
      )}

      {/* Title Selector Modal */}
      {showTitleSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowTitleSelector(false)}>
              <div className="bg-noir-900 border border-noir-700 p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-mono font-bold text-white mb-4 flex items-center gap-2">
                      <Crown size={20} className="text-amber-500" /> Select Title
                  </h3>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {Object.entries(gameState.unlockedTitles).map(([key, level]) => (
                          <button
                            key={key}
                            onClick={() => {
                                setGameState(prev => ({ ...prev, activeTitle: key }));
                                setShowTitleSelector(false);
                            }}
                            className={`w-full text-left p-3 font-mono text-sm border transition-colors flex justify-between items-center
                                ${gameState.activeTitle === key 
                                    ? 'bg-amber-900/30 border-amber-500 text-amber-100' 
                                    : 'bg-black border-noir-800 text-noir-400 hover:border-noir-500 hover:text-white'
                                }
                            `}
                          >
                              <span>{getTitleDisplay(key, level)}</span>
                              {gameState.activeTitle === key && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}
      
      {/* Celebration Overlay */}
      {celebration && (
        <div className={`pointer-events-none fixed inset-0 z-[90] flex items-center justify-center flex-col overflow-hidden`}>
            {celebration.level >= 5 && <div className="absolute inset-0 bg-white/20 animate-flash mix-blend-overlay"></div>}
            <div className={`${celebration.level >= 8 ? 'animate-shake' : ''} flex flex-col items-center justify-center px-4`}>
                <h2 key={celebration.id} 
                    className={`
                        font-mono font-bold drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] text-center whitespace-nowrap 
                        transition-transform duration-300
                        ${celebration.level >= 9 ? 'text-7xl md:text-9xl text-amber-500 animate-scale-slam' : celebration.level >= 5 ? 'text-6xl md:text-8xl text-amber-400 animate-pop-up' : 'text-4xl md:text-6xl text-amber-200/80 animate-pop-in-up'}
                        ${celebration.text.length > 15 ? 'md:transform-none -rotate-12 scale-90 origin-center' : ''}
                    `}
                >
                    {celebration.text}
                </h2>
                <div className={`mt-2 md:mt-4 font-mono font-bold tracking-[0.5em] md:tracking-[1em] text-white/90 uppercase ${celebration.level >= 7 ? 'text-2xl animate-pulse' : 'text-sm'}`}>
                    {celebration.level}x STREAK
                </div>
            </div>
        </div>
      )}
      
      {/* Your Mom Modal */}
      {showMomModal.show && (
          <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6 animate-fade-in">
              <div className="max-w-md w-full text-center space-y-8">
                  <div className="mx-auto w-24 h-24 rounded-full bg-pink-500/20 flex items-center justify-center mb-6 animate-pulse">
                      <Heart size={48} className="text-pink-400" />
                  </div>
                  <h3 className="text-3xl font-mono font-bold text-white mb-4">A Message for You</h3>
                  <button 
                    onClick={handleMomConfirm}
                    className="text-xl md:text-2xl font-serif italic text-pink-300 hover:text-pink-100 transition-colors cursor-pointer border-b border-transparent hover:border-pink-500 pb-1"
                  >
                      "{showMomModal.text}"
                  </button>
                  <p className="text-noir-600 text-xs mt-12 font-mono">Click the message to accept it.</p>
              </div>
          </div>
      )}

      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-noir-900 via-noir-950 to-black animate-pulse-slow opacity-50"></div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col relative min-h-[600px] md:min-h-0 z-10">
        
        {/* Header */}
        <header className="p-6 border-b border-noir-800/50 flex justify-between items-end bg-noir-950/30 backdrop-blur-sm relative z-50">
            <div>
                <h1 className="text-3xl font-mono font-bold tracking-tighter text-white drop-shadow-md">
                    BEAT THE <span className="text-amber-500">ODDS</span>
                </h1>
                <div className="flex gap-6 mt-3 text-sm font-mono text-noir-400">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-noir-600 mb-0.5">Current Streak</span>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold leading-none ${gameState.streak > 0 ? 'text-amber-500' : 'text-noir-500'}`}>
                                {gameState.streak}
                            </span>
                            <span className="text-noir-600">/ {WINNING_STREAK}</span>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-noir-600 mb-0.5">Run Best</span>
                        <span className={`text-2xl font-bold leading-none ${gameState.maxStreak > 0 ? 'text-noir-300' : 'text-noir-500'}`}>
                            {gameState.maxStreak}
                        </span>
                    </div>

                    {gameState.prestigeLevel > 0 && (
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest text-purple-400 mb-0.5">Prestige</span>
                            <span className="text-2xl font-bold leading-none text-purple-300">{gameState.prestigeLevel}</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-noir-600 block mb-1">Funds</span>
                <span className="text-4xl font-mono font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                    {formatMoney(gameState.money)}
                </span>
            </div>
        </header>

        {/* Center Stage */}
        <main className="flex-1 flex flex-col items-center justify-center relative z-10 py-10 md:py-0">
            
            {hasWon ? (
                <div className="text-center animate-fade-in space-y-6 bg-noir-900/90 p-12 border-2 border-amber-500/30 rounded-xl backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden group max-w-lg mx-4">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    
                    <Trophy className="w-24 h-24 text-amber-500 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-bounce" />
                    
                    <h2 className="text-5xl font-mono font-bold text-white tracking-tight">IMPOSSIBLE.</h2>
                    
                    <div className="text-noir-300 font-mono leading-relaxed space-y-2">
                        <p>You defied the probability.</p>
                        <p className="text-amber-400 font-bold text-xl">10 Heads in a row.</p>
                        <div className="pt-4 border-t border-noir-800 mt-4">
                            <p className="text-sm">Total Attempts: {gameState.totalFlips.toLocaleString()}</p>
                            <p className="text-purple-400 font-bold text-lg mt-2 flex items-center justify-center gap-2">
                                <Sparkles size={16} /> REWARD: {FRAGMENTS_PER_WIN} VOID FRAGMENTS
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 pt-4 relative z-50">
                        <button 
                            onClick={ascend}
                            className="w-full px-8 py-4 bg-purple-600 text-white font-mono font-bold tracking-widest hover:bg-purple-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/40 transform hover:-translate-y-1 flex items-center justify-center gap-3"
                        >
                            <Sparkles size={20} />
                            ASCEND (NEW GAME+)
                        </button>
                        <p className="text-[10px] text-noir-500 font-mono uppercase tracking-widest">
                            Resets progress • Keeps Prestige Upgrades • Increases Difficulty? No, just Profit.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-16 w-full max-w-md z-10">
                    
                    {/* Coin Container */}
                    <div className="relative w-64 h-64 perspective-1000 flex items-center justify-center">
                        <div 
                           className="absolute bottom-10 w-32 h-4 bg-black/40 blur-xl rounded-[100%]"
                           style={{ animation: isFlipping ? `shadowScale ${currentSpeed}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none' }}
                        ></div>

                        <div 
                          className="w-48 h-48 relative preserve-3d"
                          style={{ animation: isFlipping ? `tossHeight ${currentSpeed}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none' }}
                        >
                            <div 
                                className="w-full h-full relative preserve-3d"
                                style={{ 
                                    animation: isFlipping ? `tossSpin ${currentSpeed}ms linear infinite` : 'none',
                                    transform: !isFlipping && coinSide ? (coinSide === 'T' ? 'rotateX(180deg)' : 'rotateX(0deg)') : undefined
                                }}
                            >
                                {/* Heads */}
                                <div className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 shadow-inner border-4 border-amber-600 flex items-center justify-center overflow-hidden" style={{ transform: 'rotateX(0deg)' }}>
                                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                                    <div className="absolute inset-2 border-2 border-dashed border-amber-300/30 rounded-full"></div>
                                    <span className="text-8xl font-serif font-bold text-amber-950 mix-blend-overlay drop-shadow-md relative z-10">$</span>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent rounded-full pointer-events-none"></div>
                                </div>
                                {/* Tails */}
                                <div className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 shadow-inner border-4 border-slate-500 flex items-center justify-center overflow-hidden" style={{ transform: 'rotateX(180deg)' }}>
                                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                                    <div className="absolute inset-2 border-2 border-dashed border-slate-300/30 rounded-full"></div>
                                    <div className="relative w-full h-full z-10 opacity-70">
                                        <div className="absolute top-[35%] left-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div>
                                        <div className="absolute top-[35%] right-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div>
                                        <div className="absolute top-[52%] left-1/2 -translate-x-1/2 w-[55%] h-[35%] border-t-[10px] border-slate-900 rounded-[50%] mix-blend-overlay"></div>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent rounded-full pointer-events-none"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="w-full flex flex-col gap-6 items-center">
                        <button
                            onClick={() => handleFlip(false)}
                            disabled={isFlipping}
                            className={`
                                group relative w-full max-w-[240px] py-5 text-xl font-mono font-bold tracking-[0.2em] border transition-all duration-200 overflow-hidden z-20 cursor-pointer
                                ${isFlipping 
                                    ? 'border-noir-800 text-noir-700 bg-black cursor-not-allowed scale-95' 
                                    : 'border-white text-white bg-transparent hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95'
                                }
                            `}
                        >
                            <span className="relative z-10">{isFlipping ? 'FLIPPING...' : 'FLIP COIN'}</span>
                        </button>
                        
                        <div className="flex flex-col items-center gap-1">
                             <div className="text-[10px] uppercase tracking-widest text-noir-500">Probability</div>
                             <div className="font-mono text-amber-500 text-lg font-bold">{(currentChance * 100).toFixed(0)}%</div>
                             {prestigeBaseChance > 0 && (
                                <div className="text-[10px] text-purple-400 font-mono">(+{(prestigeBaseChance * 100).toFixed(0)}% Base)</div>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </main>

        {/* Footer */}
        <footer className="h-20 bg-noir-950/80 backdrop-blur-md border-t border-noir-800/50 flex items-center justify-between px-6 relative z-50">
            <div className="flex gap-3 overflow-hidden mask-linear-fade items-center">
                <span className="text-[10px] uppercase tracking-widest text-noir-700 mr-2">History</span>
                {gameState.history.map((res, i) => (
                    <div key={i} className={`w-8 h-8 flex items-center justify-center font-mono font-bold rounded-sm text-xs shadow-lg transition-transform hover:scale-110 cursor-default ${res === 'H' ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white border border-amber-400' : 'bg-gradient-to-b from-noir-700 to-noir-800 text-noir-400 border border-noir-600'}`}>
                        {res === 'H' ? '$' : <span className="rotate-90 inline-block text-[8px] tracking-tighter font-sans scale-y-150 transform-gpu">:(</span>}
                    </div>
                ))}
            </div>
            
            <div className="flex gap-4">
                 {(gameState.playerName || hasWon) && (
                     <button onClick={() => setShowLeaderboard(true)} className="p-2 text-amber-500 hover:text-white transition-colors hover:bg-amber-900/50 rounded-full cursor-pointer animate-fade-in" title="Leaderboard">
                        <List size={20} />
                    </button>
                 )}
                 <button onClick={toggleMute} className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title={muted ? "Unmute" : "Mute"}>
                    {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                 <button onClick={() => setShowModal(true)} className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title="Math Analysis">
                    <HelpCircle size={20} />
                </button>
                 <button onClick={handleDeleteClick} className={`p-2 transition-colors rounded-full font-mono text-xs flex items-center justify-center cursor-pointer w-9 h-9 ${deleteConfirm ? 'bg-red-900 text-white hover:bg-red-800 ring-1 ring-red-500' : 'text-noir-500 hover:text-red-500 hover:bg-noir-900'}`} title="Delete Save & Reset">
                    {deleteConfirm ? '!' : <Trash2 size={20} />}
                </button>
            </div>
        </footer>

      </div>

      <Shop 
        money={gameState.money} 
        voidFragments={gameState.voidFragments}
        prestigeLevel={gameState.prestigeLevel}
        upgrades={gameState.upgrades} 
        onBuy={buyUpgrade}
        maxStreak={gameState.maxStreak}
        autoFlipEnabled={gameState.autoFlipEnabled}
        onToggleAutoFlip={toggleAutoFlip}
        autoBuyEnabled={gameState.autoBuyEnabled}
        onToggleAutoBuy={toggleAutoBuy}
        seenUpgrades={gameState.seenUpgrades}
        onSeen={handleUpgradeSeen}
        momPurchases={gameState.stats.momPurchases}
      />

      <div className="relative z-[100]">
        <ProbabilityModal isOpen={showModal} onClose={() => setShowModal(false)} currentChance={currentChance} />
        <LeaderboardModal 
            isOpen={showLeaderboard} 
            onClose={() => setShowLeaderboard(false)} 
            playerName={gameState.playerName}
            onRegisterName={registerName}
            currentStats={gameState.stats ? {
                purist: gameState.stats.puristWins,
                prestige: gameState.stats.maxPrestigeLevel,
                rich: gameState.stats.highestCash,
                mommy: gameState.stats.momPurchases
            } : undefined}
        />
      </div>

      <style>{`
        .rotate-x-180 { transform: rotateX(180deg); }
        .mask-linear-fade { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
        @keyframes popInUp { 0% { opacity: 0; transform: translateY(20px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-pop-in-up { animation: popInUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes popUp { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        .animate-pop-up { animation: popUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes scaleSlam { 0% { opacity: 0; transform: scale(5); } 60% { opacity: 1; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
        .animate-scale-slam { animation: scaleSlam 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
        @keyframes flash { 0%, 100% { opacity: 0; } 10%, 90% { opacity: 1; } }
        .animate-flash { animation: flash 0.3s ease-out forwards; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px) rotate(-1deg); } 20%, 40%, 60%, 80% { transform: translateX(5px) rotate(1deg); } }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        @keyframes particle { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--tw-translate-x, 100px), var(--tw-translate-y, 100px)) scale(0); opacity: 0; } }
        .animate-particle { animation: particle 1s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;