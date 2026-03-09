import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, UpgradeType, WINNING_STREAK, HARD_MODE_WINNING_STREAK, FRAGMENTS_PER_WIN, PlayerStats, GlobalLeaderboard, LeaderboardEntry } from './types';
import { UPGRADES } from './constants';
import Shop from './components/Shop';
import ProbabilityModal from './components/ProbabilityModal';
import LeaderboardModal from './components/LeaderboardModal';
import ConfettiSystem from './components/ConfettiSystem';
import { AudioService } from './services/audioService';
import { LeaderboardService } from './services/leaderboardService';
import { HelpCircle, Trash2, Trophy, Volume2, VolumeX, Sparkles, Heart, List, Crown, Skull, Syringe, Bug } from 'lucide-react';
import DebugMenu from './components/DebugMenu';

const CELEBRATION_MESSAGES = [
  "", "", "LUCKY", "HEATING UP", "UNREAL", "DEFYING ODDS", "SYSTEM ERROR", "IMPOSSIBLE", 
  "DESTINY", "DIVINE", "LEGENDARY", "BEYOND", "TRANSCENDENT", "OMNISCIENT", "THE END?", 
  "VOID MASTER", "INFINITE", "SINGULARITY", "ABSOLUTE", "FINALITY", "...", "WHY?", "GO HOME", 
  "PLEASE", "ERROR", "NULL"
];

const COMPLIMENTS = [
    "You have a wonderful smile.", "Your persistence is admirable.", "You bring light to those around you.",
    "You are capable of amazing things.", "Your creative instincts are sharp.", "You are a great listener.",
    "You have a unique perspective.", "Your kindness is a gift.", "You are stronger than you know.",
    "Your potential is limitless."
];

const INITIAL_STATS: PlayerStats = {
    puristWins: 0,
    momPurchases: 0,
    highestCash: 0,
    totalPrestiges: 0,
    maxPrestigeLevel: 0,
    hardModeWins: 0,
};

const INITIAL_STATE: GameState = {
  money: 0,
  streak: 0,
  maxStreak: 0,
  totalFlips: 0,
  upgrades: {
    [UpgradeType.CHANCE]: 0, [UpgradeType.SPEED]: 0, [UpgradeType.COMBO]: 0, [UpgradeType.VALUE]: 0,
    [UpgradeType.AUTO_FLIP]: 0, [UpgradeType.PASSIVE_INCOME]: 0, [UpgradeType.EDGING]: 0,
    [UpgradeType.PRESTIGE_KARMA]: 0, [UpgradeType.PRESTIGE_FATE]: 0, [UpgradeType.PRESTIGE_FLUX]: 0,
    [UpgradeType.PRESTIGE_PASSIVE]: 0, [UpgradeType.PRESTIGE_AUTO]: 0, [UpgradeType.PRESTIGE_AUTO_BUY]: 0, 
    [UpgradeType.PRESTIGE_EDGING]: 0, [UpgradeType.PRESTIGE_GOLD_DIGGER]: 0, [UpgradeType.PRESTIGE_LIMITLESS]: 0,
    [UpgradeType.PRESTIGE_MOM]: 0, [UpgradeType.PRESTIGE_CARE_PACKAGE]: 0, [UpgradeType.PRESTIGE_VETERAN]: 0,
    [UpgradeType.PRESTIGE_PARTY_POOPER]: 0,
    [UpgradeType.HARD_MODE_BUFF]: 0,
    [UpgradeType.HARD_MODE_MULTI_FLIP]: 0,
    [UpgradeType.HARD_MODE_FORGIVENESS]: 0,
    [UpgradeType.HARD_MODE_MORE_FRAGMENTS]: 0,
    [UpgradeType.HARD_MODE_NICKEL]: 0,
  },
  history: [],
  prestigeLevel: 0,
  voidFragments: 0,
  autoFlipEnabled: true,
  autoBuyEnabled: false,
  partyPooperEnabled: false,
  isHardMode: false,
  seenUpgrades: [UpgradeType.CHANCE, UpgradeType.SPEED, UpgradeType.COMBO, UpgradeType.VALUE], 
  flipSpeedMultiplier: 1.0,
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
const AUTO_BUY_TARGETS = [
    UpgradeType.CHANCE, UpgradeType.SPEED, UpgradeType.COMBO, UpgradeType.VALUE,
    UpgradeType.PASSIVE_INCOME, UpgradeType.EDGING, UpgradeType.AUTO_FLIP
];
const SALT = "VOID_SALT_8923_DO_NOT_TAMPER_WITH_FATE";

const generateHash = (str: string) => {
    let hash = 0;
    const s = str + SALT;
    for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash.toString(16);
};

const toBase64 = (str: string) => {
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => 
            String.fromCharCode(parseInt(p1, 16))
        ));
    } catch (e) { return btoa(str); }
};

const fromBase64 = (str: string) => {
    try {
        return decodeURIComponent(Array.prototype.map.call(atob(str), (c: any) => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
    } catch (e) { return atob(str); }
};

const secureSave = (key: string, data: any) => {
    try {
        const json = JSON.stringify(data);
        const encoded = toBase64(json);
        const hash = generateHash(json);
        localStorage.setItem(key, JSON.stringify({ d: encoded, h: hash }));
    } catch (e) { console.error("Save failed", e); }
};

const secureLoad = (key: string): any | null => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        let parsed;
        try { parsed = JSON.parse(raw); } catch { return null; }
        if (parsed && typeof parsed.d === 'string' && typeof parsed.h === 'string') {
            const json = fromBase64(parsed.d);
            const calculatedHash = generateHash(json);
            if (calculatedHash !== parsed.h) return null;
            return JSON.parse(json);
        } else { return parsed; }
    } catch (e) { return null; }
};

const App: React.FC = () => {
  const getMetaStats = (): PlayerStats => {
      const loaded = secureLoad(META_SAVE_KEY);
      if (loaded) {
          const s = { ...INITIAL_STATS, ...loaded };
          if (typeof s.hardModeWins === 'undefined') s.hardModeWins = 0;
          return s;
      }
      return INITIAL_STATS;
  };

  const saveMetaStats = (stats: PlayerStats) => {
      secureSave(META_SAVE_KEY, stats);
  };

  const [gameState, setGameState] = useState<GameState>(() => {
    const loaded = secureLoad(SAVE_KEY);
    if (loaded) {
        const defaults = INITIAL_STATE.upgrades;
        for (const key of Object.keys(defaults) as UpgradeType[]) {
             if (typeof loaded.upgrades[key] === 'undefined') loaded.upgrades[key] = 0;
        }
        if (typeof loaded.prestigeLevel === 'undefined') loaded.prestigeLevel = 0;
        if (typeof loaded.voidFragments === 'undefined') loaded.voidFragments = 0;
        if (typeof loaded.autoFlipEnabled === 'undefined') loaded.autoFlipEnabled = true;
        if (typeof loaded.autoBuyEnabled === 'undefined') loaded.autoBuyEnabled = false;
        if (typeof loaded.partyPooperEnabled === 'undefined') loaded.partyPooperEnabled = false;
        if (typeof loaded.flipSpeedMultiplier === 'undefined') loaded.flipSpeedMultiplier = 1.0;
        if (typeof loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] === 'undefined') {
            loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] = 0;
        }
        if ((loaded.prestigeLevel || 0) >= 5 && loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] === 0) {
            loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] = 1;
        }
        if (typeof loaded.isHardMode === 'undefined') loaded.isHardMode = false;
        
        if (!loaded.seenUpgrades) {
            loaded.seenUpgrades = [UpgradeType.CHANCE, UpgradeType.SPEED, UpgradeType.COMBO, UpgradeType.VALUE];
            Object.keys(loaded.upgrades).forEach((key) => {
                const k = key as UpgradeType;
                if (loaded.upgrades[k] > 0 && !loaded.seenUpgrades.includes(k)) loaded.seenUpgrades.push(k);
            });
        }
        
        const metaStats = getMetaStats();
        loaded.stats = metaStats; 

        if (!loaded.unlockedTitles) loaded.unlockedTitles = {};
        if (typeof loaded.isPuristRun === 'undefined') loaded.isPuristRun = true;
        if (typeof loaded.hasCheated === 'undefined') loaded.hasCheated = false;

        return loaded;
    }
    const metaStats = getMetaStats();
    return { ...INITIAL_STATE, stats: metaStats };
  });

  const [isFlipping, setIsFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState<'H' | 'T' | 'E' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMomModal, setShowMomModal] = useState<{show: boolean, text: string}>({show: false, text: ""});
  const [showHardModePrompt, setShowHardModePrompt] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  // Track the goal value at the moment of winning so the congrats popup shows the correct number
  const [wonAtGoal, setWonAtGoal] = useState<number>(0);
  const [celebration, setCelebration] = useState<{text: string, level: number, id: number} | null>(null);
  const [edgeLanding, setEdgeLanding] = useState(false); // triggers edge-landing overlay
  const [muted, setMuted] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showTitleSelector, setShowTitleSelector] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [forceHeadsDebug, setForceHeadsDebug] = useState(false);
  
  const [isFundsVisible, setIsFundsVisible] = useState(true);
  const headerFundsRef = useRef<HTMLDivElement>(null);

  const flipTimeoutRef = useRef<number | undefined>(undefined);
  const celebrationTimeoutRef = useRef<number | undefined>(undefined);
  const deleteTimeoutRef = useRef<number | undefined>(undefined);

  const getHardModeGoal = useCallback(() => {
      return HARD_MODE_WINNING_STREAK + (gameState.stats.hardModeWins * 5);
  }, [gameState.stats.hardModeWins]);

  const currentGoal = gameState.isHardMode ? getHardModeGoal() : WINNING_STREAK;

  const hasEverWon =
    hasWon ||
    gameState.stats.totalPrestiges > 0 ||
    gameState.stats.hardModeWins > 0;

  useEffect(() => {
    secureSave(SAVE_KEY, gameState);
    saveMetaStats(gameState.stats);
  }, [gameState]);

  useEffect(() => {
    AudioService.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const observer = new IntersectionObserver(
        ([entry]) => setIsFundsVisible(entry.isIntersecting),
        { threshold: 0.1 }
    );
    if (headerFundsRef.current) observer.observe(headerFundsRef.current);
    return () => observer.disconnect();
  }, []);

  const calculateChance = useCallback(() => {
      const chanceLevel = gameState.upgrades[UpgradeType.CHANCE] || 0;
      const fateLevel = gameState.upgrades[UpgradeType.PRESTIGE_FATE] || 0;
      const buffActive = gameState.upgrades[UpgradeType.HARD_MODE_BUFF] > 0;
      
      let chance = 0.20 + (chanceLevel * 0.05) + (fateLevel * 0.025);
      
      if (gameState.isHardMode) {
          chance = Math.min(0.60, chance);
      } else {
          chance = Math.min(0.99, chance);
      }

      if (buffActive) {
          chance += 0.2;
      }
      
      return Math.min(0.99, chance);
  }, [gameState.upgrades, gameState.isHardMode]);

  const ascend = (forceHardMode: boolean = false) => {
      const karmaLevel = gameState.upgrades[UpgradeType.PRESTIGE_KARMA] || 0;
      const startMoney = UPGRADES[UpgradeType.PRESTIGE_KARMA].getEffect(karmaLevel);

      const prestigeUpgrades: Record<string, number> = {};
      Object.keys(gameState.upgrades).forEach(key => {
          const k = key as UpgradeType;
          if (UPGRADES[k].isPrestige || k === UpgradeType.PRESTIGE_CARE_PACKAGE) {
              prestigeUpgrades[k] = gameState.upgrades[k];
          } else {
              prestigeUpgrades[k] = 0;
          }
          // Reset one-time hard mode consumables on ascend
          if (k === UpgradeType.HARD_MODE_BUFF || k === UpgradeType.HARD_MODE_MULTI_FLIP || k === UpgradeType.HARD_MODE_FORGIVENESS) {
              prestigeUpgrades[k] = 0;
          }
      });

      const voidReward = FRAGMENTS_PER_WIN;
      const newPrestigeLevel = gameState.prestigeLevel + 1;
      const nextTitles = { ...gameState.unlockedTitles };
      if (newPrestigeLevel > 0) nextTitles['PRESTIGE'] = newPrestigeLevel;
      if (forceHardMode || gameState.isHardMode) nextTitles['HARD_MAN'] = 1;
      
      const nextStats = { 
          ...gameState.stats, 
          totalPrestiges: gameState.stats.totalPrestiges + 1,
          maxPrestigeLevel: Math.max(gameState.stats.maxPrestigeLevel, newPrestigeLevel)
      };
      saveMetaStats(nextStats);
      
      let nextActiveTitle = gameState.activeTitle;
      if (!nextActiveTitle && newPrestigeLevel === 1) nextActiveTitle = 'PRESTIGE';

      const nextState: GameState = {
          ...INITIAL_STATE,
          money: startMoney,
          prestigeLevel: newPrestigeLevel,
          voidFragments: gameState.voidFragments + voidReward,
          upgrades: prestigeUpgrades as Record<UpgradeType, number>,
          totalFlips: 0, 
          seenUpgrades: gameState.seenUpgrades,
          playerName: gameState.playerName,
          stats: nextStats,
          unlockedTitles: nextTitles,
          activeTitle: nextActiveTitle,
          isPuristRun: true,
          hasCheated: gameState.hasCheated,
          autoFlipEnabled: gameState.autoFlipEnabled,
          autoBuyEnabled: gameState.autoBuyEnabled,
          partyPooperEnabled: gameState.partyPooperEnabled, // ── FIX: persist across runs
          flipSpeedMultiplier: gameState.flipSpeedMultiplier, // ── persist across runs
          isHardMode: forceHardMode || gameState.isHardMode
      };

      if (gameState.playerName && !gameState.hasCheated) {
          const name = gameState.playerName;
          const now = Date.now();
          const title = nextActiveTitle || undefined;
          
          if (newPrestigeLevel >= nextStats.maxPrestigeLevel) {
               LeaderboardService.submitScores([{ category: 'prestige', entry: { name, score: newPrestigeLevel, date: now, title } }]);
          }
      }

      setGameState(nextState);
      setHasWon(false);
      setWonAtGoal(0);
      setCoinSide(null);
      setCelebration(null);
  };

  const enableHardMode = () => {
      ascend(true);
      setShowHardModePrompt(false);
  };

  const closeHardModePrompt = () => setShowHardModePrompt(false);

  const handleFlip = useCallback((forceHeads: boolean = false, isAuto: boolean = false) => {
    if (isFlipping || hasWon || showMomModal.show) return;
    
    setIsFlipping(true);
    const speedLevel = gameState.upgrades[UpgradeType.SPEED] || 0;
    const fluxLevel = gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0;
    const hasLimitless = (gameState.upgrades[UpgradeType.PRESTIGE_LIMITLESS] || 0) > 0;
    const speedMult = gameState.flipSpeedMultiplier || 1.0;
    
    let duration = UPGRADES[UpgradeType.SPEED].getEffect(speedLevel);
    duration = Math.max(hasLimitless ? 1 : 50, duration - (fluxLevel * 250));
    // Apply the user's speed multiplier (higher value = slower = more reaction time)
    duration = Math.round(duration / speedMult);
    duration = Math.max(hasLimitless ? 1 : 50, duration);

    if (duration > 50) AudioService.playFlip();

    flipTimeoutRef.current = window.setTimeout(() => {
        const chance = calculateChance();
        const roll = Math.random();
        
        // Edge landing: 1% chance in hard mode only
        const isEdge = gameState.isHardMode && !forceHeadsDebug && roll > 0.99;
        const isHeads = isEdge ? false : (forceHeads || forceHeadsDebug || roll < chance);
        const result: 'H' | 'T' | 'E' = isEdge ? 'E' : (isHeads ? 'H' : 'T');
        
        setCoinSide(result);
        if (isEdge) setEdgeLanding(true);

        setGameState(prev => {
            let newState = { ...prev, totalFlips: prev.totalFlips + 1 };
            
            // Reset one-time-use consumable buffs after any flip
            if (newState.upgrades[UpgradeType.HARD_MODE_BUFF] > 0) {
                newState.upgrades = { ...newState.upgrades, [UpgradeType.HARD_MODE_BUFF]: 0 };
            }
            if (isAuto) newState.isPuristRun = false;

            if (isEdge) {
                // ── EDGE LANDING ─────────────────────────────────────────────
                // Worth 10 heads! Add to streak directly.
                const nickelActive = (prev.upgrades[UpgradeType.HARD_MODE_NICKEL] || 0) > 0;
                const edgeWorth = nickelActive ? 20 : 10;
                const newStreak = prev.streak + edgeWorth;
                
                AudioService.playWin();
                
                const comboLevel = prev.upgrades[UpgradeType.COMBO] || 0;
                const valueLevel = prev.upgrades[UpgradeType.VALUE] || 0;
                const edgingLevel = prev.upgrades[UpgradeType.EDGING] || 0;
                const pEdgingLevel = prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0;
                const goldDiggerLevel = prev.upgrades[UpgradeType.PRESTIGE_GOLD_DIGGER] || 0;
                const veteranLevel = prev.upgrades[UpgradeType.PRESTIGE_VETERAN] || 0;

                // Earn money for each of the edgeWorth heads
                let totalGain = 0;
                for (let i = 0; i < edgeWorth; i++) {
                    const streakAtStep = prev.streak + i + 1;
                    let baseVal = UPGRADES[UpgradeType.VALUE].getEffect(valueLevel);
                    let comboMult = UPGRADES[UpgradeType.COMBO].getEffect(comboLevel);
                    if (streakAtStep > 1) baseVal *= (1 + (streakAtStep * (comboMult - 1)));
                    let mult = 1;
                    if (edgingLevel > 0) mult *= 10;
                    if (pEdgingLevel > 0) mult *= 10;
                    if (goldDiggerLevel > 0) mult *= UPGRADES[UpgradeType.PRESTIGE_GOLD_DIGGER].getEffect(goldDiggerLevel);
                    if (veteranLevel > 0) mult *= Math.max(1, 1 + (prev.prestigeLevel * 0.10));
                    if (prev.isHardMode) mult *= 10;
                    const prestigeMult = 1 + (prev.prestigeLevel * 0.1);
                    totalGain += Math.floor(baseVal * mult * prestigeMult);
                }
                
                newState.money += totalGain;
                newState.streak = newStreak;
                newState.maxStreak = Math.max(prev.maxStreak, newStreak);
                newState.stats = { ...newState.stats, highestCash: Math.max(newState.stats.highestCash, newState.money) };
                newState.history = ['E', ...prev.history].slice(0, 10) as ('H'|'T'|'E')[];

                // Bonus fragment at milestone via magnet
                if (prev.isHardMode) {
                    const magnetActive = (prev.upgrades[UpgradeType.HARD_MODE_MORE_FRAGMENTS] || 0) > 0;
                    // Milestones crossed
                    for (let i = 1; i <= edgeWorth; i++) {
                        if ((prev.streak + i) % 10 === 0) {
                            newState.voidFragments += 5 + (magnetActive ? 3 : 0);
                        }
                    }
                }
                
                // Consume multi-flip if active (edge supersedes it)
                if (newState.upgrades[UpgradeType.HARD_MODE_MULTI_FLIP] > 0) {
                    newState.upgrades = { ...newState.upgrades, [UpgradeType.HARD_MODE_MULTI_FLIP]: 0 };
                }

                setCelebration({ text: "⬡ EDGE LANDING ⬡", level: 15, id: Date.now() });
                if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
                celebrationTimeoutRef.current = window.setTimeout(() => {
                    setCelebration(null);
                    setEdgeLanding(false);
                }, 4000) as unknown as number;

            } else if (isHeads) {
                // ── HEADS ─────────────────────────────────────────────────────
                const multiFlipActive = (prev.upgrades[UpgradeType.HARD_MODE_MULTI_FLIP] || 0) > 0;
                const nickelActive = (prev.upgrades[UpgradeType.HARD_MODE_NICKEL] || 0) > 0;
                
                const headsWorth = multiFlipActive ? 5 : (nickelActive ? 2 : 1);
                const newStreak = prev.streak + headsWorth;
                
                if (duration > 50 || newStreak % 10 === 0) AudioService.playHeads(newStreak);
                
                // Consume quantum collapse if used
                if (multiFlipActive) {
                    newState.upgrades = { ...newState.upgrades, [UpgradeType.HARD_MODE_MULTI_FLIP]: 0 };
                }
                
                const comboLevel = prev.upgrades[UpgradeType.COMBO] || 0;
                const valueLevel = prev.upgrades[UpgradeType.VALUE] || 0;
                const edgingLevel = prev.upgrades[UpgradeType.EDGING] || 0;
                const pEdgingLevel = prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0;
                const goldDiggerLevel = prev.upgrades[UpgradeType.PRESTIGE_GOLD_DIGGER] || 0;
                const veteranLevel = prev.upgrades[UpgradeType.PRESTIGE_VETERAN] || 0;

                let totalGain = 0;
                for (let i = 0; i < headsWorth; i++) {
                    const streakAtStep = prev.streak + i + 1;
                    let baseVal = UPGRADES[UpgradeType.VALUE].getEffect(valueLevel);
                    let comboMult = UPGRADES[UpgradeType.COMBO].getEffect(comboLevel);
                    if (streakAtStep > 1) baseVal *= (1 + (streakAtStep * (comboMult - 1)));
                    let mult = 1;
                    if (edgingLevel > 0) mult *= 10;
                    if (pEdgingLevel > 0) mult *= 10;
                    if (goldDiggerLevel > 0) mult *= UPGRADES[UpgradeType.PRESTIGE_GOLD_DIGGER].getEffect(goldDiggerLevel);
                    if (veteranLevel > 0) mult *= Math.max(1, 1 + (prev.prestigeLevel * 0.10));
                    if (prev.isHardMode) mult *= 10;
                    const prestigeMult = 1 + (prev.prestigeLevel * 0.1);
                    totalGain += Math.floor(baseVal * mult * prestigeMult);
                }
                
                newState.money += totalGain;
                newState.streak = newStreak;
                newState.maxStreak = Math.max(prev.maxStreak, newStreak);
                newState.stats = { ...newState.stats, highestCash: Math.max(newState.stats.highestCash, newState.money) };
                newState.history = ['H', ...prev.history].slice(0, 10) as ('H'|'T'|'E')[];
                
                if (prev.isHardMode) {
                    const magnetActive = (prev.upgrades[UpgradeType.HARD_MODE_MORE_FRAGMENTS] || 0) > 0;
                    // Check milestones crossed
                    for (let i = 1; i <= headsWorth; i++) {
                        if ((prev.streak + i) % 10 === 0) {
                            newState.voidFragments += 5 + (magnetActive ? 3 : 0);
                        }
                    }
                }
                
                if (newStreak >= 2) {
                    if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
                    let message = CELEBRATION_MESSAGES[Math.min(newStreak, CELEBRATION_MESSAGES.length - 1)] || "GODLIKE";
                    setCelebration({ text: message, level: newStreak, id: Date.now() });
                    celebrationTimeoutRef.current = window.setTimeout(() => setCelebration(null), 2500) as unknown as number;
                }

            } else {
                // ── TAILS ─────────────────────────────────────────────────────
                if (duration > 50) AudioService.playTails();
                
                const forgivenessActive = (prev.upgrades[UpgradeType.HARD_MODE_FORGIVENESS] || 0) > 0;
                
                if (forgivenessActive) {
                    // Safety Net absorbs the tail — consume it, don't reset streak
                    newState.upgrades = { ...newState.upgrades, [UpgradeType.HARD_MODE_FORGIVENESS]: 0 };
                    // But we still play tails sound + show in history
                    newState.history = ['T', ...prev.history].slice(0, 10) as ('H'|'T'|'E')[];
                } else {
                    newState.streak = 0;
                    newState.history = ['T', ...prev.history].slice(0, 10) as ('H'|'T'|'E')[];
                }
                
                const passiveLevel = prev.upgrades[UpgradeType.PASSIVE_INCOME] || 0;
                const voidSiphonLevel = prev.upgrades[UpgradeType.PRESTIGE_PASSIVE] || 0;
                
                let passiveGain = 0;
                if (passiveLevel > 0) {
                     passiveGain += UPGRADES[UpgradeType.PASSIVE_INCOME].getEffect(passiveLevel) * (1 + prev.prestigeLevel);
                }
                if (voidSiphonLevel > 0) {
                     passiveGain += UPGRADES[UpgradeType.PRESTIGE_PASSIVE].getEffect(voidSiphonLevel);
                }
                
                const edgingLevel = prev.upgrades[UpgradeType.EDGING] || 0;
                const pEdgingLevel = prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0;
                if (edgingLevel > 0 || pEdgingLevel > 0) passiveGain *= 10;
                if (prev.isHardMode) passiveGain *= 10;

                if (passiveGain > 0) {
                    newState.money += passiveGain;
                }
            }
            return newState;
        });
        
        setIsFlipping(false);
    }, duration) as unknown as number;

  }, [isFlipping, hasWon, showMomModal, calculateChance, gameState.upgrades, gameState.prestigeLevel, gameState.isHardMode, gameState.flipSpeedMultiplier]);

  const INTERACTIVE_SELECTOR =
    'button, a, input, select, textarea, label, [role="button"], [role="dialog"], [role="listbox"], [data-no-flip]';

  const handleGameAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      handleFlip(false);
    },
    [handleFlip]
  );

  // Win Detection
  useEffect(() => {
    const goal = gameState.isHardMode ? HARD_MODE_WINNING_STREAK + (gameState.stats.hardModeWins * 5) : WINNING_STREAK;
    
    if (gameState.streak >= goal && !hasWon) {
        // ── FIX: capture goal BEFORE incrementing hardModeWins ──────────────
        setWonAtGoal(goal);
        setHasWon(true);
        setGameState(prev => {
             const newStats = { ...prev.stats };
             if (prev.isHardMode) newStats.hardModeWins++;
             return { ...prev, stats: newStats };
        });
        
        saveMetaStats(gameState.stats);
        
        if (gameState.prestigeLevel >= 50 && !gameState.isHardMode) {
            setShowHardModePrompt(true);
        }

        if (gameState.playerName && !gameState.hasCheated) {
             const updates: { category: keyof GlobalLeaderboard, entry: LeaderboardEntry }[] = [];
             if (gameState.isPuristRun) updates.push({ category: 'purist', entry: { name: gameState.playerName, score: gameState.stats.puristWins + 1, date: Date.now() } });
             updates.push({ category: 'rich', entry: { name: gameState.playerName, score: gameState.stats.highestCash, date: Date.now() } });
             
             // Hard Mode leaderboard: score = total hard mode wins (after this win)
             if (gameState.isHardMode) {
                 updates.push({ 
                     category: 'hardMode', 
                     entry: { 
                         name: gameState.playerName, 
                         score: gameState.stats.hardModeWins + 1, 
                         date: Date.now(),
                         title: gameState.activeTitle || undefined
                     }
                 });
             }
             
             if (updates.length > 0) LeaderboardService.submitScores(updates);
        }
    }
  }, [gameState.streak, hasWon, gameState.isHardMode, gameState.prestigeLevel, gameState.playerName, gameState.hasCheated, gameState.isPuristRun, gameState.stats]);

  // Auto Flip
  useEffect(() => {
    const hasAuto = gameState.upgrades[UpgradeType.AUTO_FLIP] > 0 || gameState.upgrades[UpgradeType.PRESTIGE_AUTO] > 0;
    const goal = gameState.isHardMode ? HARD_MODE_WINNING_STREAK + (gameState.stats.hardModeWins * 5) : WINNING_STREAK;
    
    if (gameState.autoFlipEnabled && hasAuto && !isFlipping && !hasWon && gameState.streak < goal && !showMomModal.show) {
        const timer = window.setTimeout(() => handleFlip(false, true), 100) as unknown as number;
        return () => window.clearTimeout(timer);
    }
  }, [gameState.autoFlipEnabled, isFlipping, hasWon, gameState.streak, gameState.isHardMode, gameState.upgrades, handleFlip, showMomModal, gameState.stats.hardModeWins]);

  // Auto Buy
  useEffect(() => {
    if (gameState.autoBuyEnabled && gameState.upgrades[UpgradeType.PRESTIGE_AUTO_BUY] > 0) {
        const interval = window.setInterval(() => {
            setGameState(prev => {
                const goal = prev.isHardMode ? HARD_MODE_WINNING_STREAK + (prev.stats.hardModeWins * 5) : WINNING_STREAK;
                if (prev.money <= 0 || prev.streak >= goal) return prev;
                let newState = { ...prev };
                let bought = false;
                let updatedSeen = [...prev.seenUpgrades];
                
                for (const type of AUTO_BUY_TARGETS) {
                    const upgrade = UPGRADES[type];
                    const currentLevel = prev.upgrades[type] || 0;
                    const hasLimitless = (prev.upgrades[UpgradeType.PRESTIGE_LIMITLESS] || 0) > 0;
                    const maxLevel = (hasLimitless && upgrade.limitlessMaxLevel) ? upgrade.limitlessMaxLevel : upgrade.maxLevel;
                    
                    if (currentLevel >= maxLevel) continue;
                    
                    if (type === UpgradeType.PASSIVE_INCOME && currentLevel === 0 && prev.maxStreak < 3 && prev.prestigeLevel < 1) continue;
                    if (type === UpgradeType.AUTO_FLIP && currentLevel === 0 && prev.maxStreak < 5 && prev.prestigeLevel < 1 && !prev.upgrades[UpgradeType.PRESTIGE_AUTO]) continue;

                    const cost = upgrade.costTiers[currentLevel] || upgrade.costTiers[upgrade.costTiers.length - 1];
                    if (newState.money >= cost) {
                        newState.money -= cost;
                        newState.upgrades[type] = currentLevel + 1;
                        if (!updatedSeen.includes(type)) updatedSeen.push(type);
                        bought = true;
                    }
                }
                if (bought) newState.seenUpgrades = updatedSeen;
                return bought ? newState : prev;
            });
        }, 1000) as unknown as number;
        return () => window.clearInterval(interval);
    }
  }, [gameState.autoBuyEnabled, gameState.upgrades]);

  const handleManualSubmit = useCallback(async () => {
      if (!gameState.playerName || gameState.hasCheated) return;
      
      const updates: { category: keyof GlobalLeaderboard, entry: LeaderboardEntry }[] = [];
      const currentRichScore = Math.max(gameState.money, gameState.stats.highestCash);
      
      if (currentRichScore > 0) updates.push({ category: 'rich', entry: { name: gameState.playerName, score: currentRichScore, date: Date.now(), title: gameState.activeTitle || undefined } });
      if (gameState.stats.puristWins > 0) updates.push({ category: 'purist', entry: { name: gameState.playerName, score: gameState.stats.puristWins, date: Date.now(), title: gameState.activeTitle || undefined } });
      
      const bestP = Math.max(gameState.prestigeLevel, gameState.stats.maxPrestigeLevel);
      if (bestP > 0) updates.push({ category: 'prestige', entry: { name: gameState.playerName, score: bestP, date: Date.now(), title: gameState.activeTitle || undefined } });
      
      if (gameState.stats.momPurchases > 0) updates.push({ category: 'mommy', entry: { name: gameState.playerName, score: gameState.stats.momPurchases, date: Date.now(), title: gameState.activeTitle || undefined } });
      
      if (gameState.stats.hardModeWins > 0) updates.push({ category: 'hardMode', entry: { name: gameState.playerName, score: gameState.stats.hardModeWins, date: Date.now(), title: gameState.activeTitle || undefined } });

      if (updates.length > 0) await LeaderboardService.submitScores(updates);
  }, [gameState]);

  const handleBuy = (id: UpgradeType, cost: number, isPrestige: boolean) => {
      setGameState(prev => {
          if (id === UpgradeType.PRESTIGE_CARE_PACKAGE) {
             if (prev.money < cost) return prev;
             const newState = { ...prev };
             newState.money -= cost;
             newState.voidFragments += 25;
             newState.upgrades = { ...newState.upgrades, [id]: (prev.upgrades[id] || 0) + 1 };
             AudioService.playFlip();
             return newState;
          }

          if (isPrestige && id !== UpgradeType.PRESTIGE_GOLD_DIGGER) {
              if (prev.voidFragments < cost) return prev;
          } else {
              if (prev.money < cost) return prev;
          }

          const newState = { ...prev };
          if (isPrestige) {
               if (id === UpgradeType.PRESTIGE_GOLD_DIGGER) {
                   if (prev.money < cost) return prev;
                   newState.money -= cost;
               } else {
                   newState.voidFragments -= cost;
               }
          } else {
              newState.money -= cost;
          }
          
          if (id === UpgradeType.PRESTIGE_KARMA) {
             const oldVal = UPGRADES[id].getEffect(prev.upgrades[id] || 0);
             const newVal = UPGRADES[id].getEffect((prev.upgrades[id] || 0) + 1);
             newState.money += (newVal - oldVal);
          }

          newState.upgrades = { ...newState.upgrades, [id]: (prev.upgrades[id] || 0) + 1 };
          
          if (id === UpgradeType.PRESTIGE_MOM) {
              newState.stats = { ...newState.stats, momPurchases: newState.stats.momPurchases + 1 };
          }
          
          return newState;
      });
      
      if (id === UpgradeType.PRESTIGE_MOM) triggerMomEvent();
  };

  const triggerMomEvent = () => {
      let seen: string[] = [];
      try {
          const s = localStorage.getItem(SEEN_COMPLIMENTS_KEY);
          if (s) seen = JSON.parse(s);
      } catch (e) { console.error(e); }

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

      localStorage.removeItem(SAVE_KEY); 
      setShowMomModal({ show: false, text: "" });
      window.location.reload(); 
  };

  const toggleAutoFlip = () => setGameState(p => ({ ...p, autoFlipEnabled: !p.autoFlipEnabled }));
  const toggleAutoBuy = () => setGameState(p => ({ ...p, autoBuyEnabled: !p.autoBuyEnabled }));
  const togglePartyPooper = () => setGameState(p => ({ ...p, partyPooperEnabled: !p.partyPooperEnabled }));
  const setFlipSpeedMultiplier = (val: number) => setGameState(p => ({ ...p, flipSpeedMultiplier: val }));

  // Debug menu actions — all mark run as cheated
  const debugSetPrestige = (val: number) => setGameState(p => ({ ...p, prestigeLevel: val, hasCheated: true }));
  const debugSetMoney = (val: number) => setGameState(p => ({ ...p, money: val, hasCheated: true }));
  const debugSetFragments = (val: number) => setGameState(p => ({ ...p, voidFragments: val, hasCheated: true }));
  const debugToggleForceHeads = () => setForceHeadsDebug(p => !p);
  const handleSeen = (id: UpgradeType) => {
      if (!gameState.seenUpgrades.includes(id)) {
          setGameState(p => ({ ...p, seenUpgrades: [...p.seenUpgrades, id] }));
      }
  };

  const registerName = (name: string) => {
      if (name.toLowerCase() === "cheater") {
          LeaderboardService.wipeCheaters().finally(() => setGameState(p => ({ ...p, playerName: "cheater" })));
          return;
      }
      if (gameState.hasCheated) {
          setGameState(p => ({ ...p, playerName: "cheater" }));
          return;
      }
      setGameState(p => ({ ...p, playerName: name }));
      const updates: { category: keyof GlobalLeaderboard, entry: LeaderboardEntry }[] = [];
      const title = gameState.activeTitle || undefined;
      
      if (gameState.stats.highestCash > 0) updates.push({ category: 'rich', entry: { name, score: gameState.stats.highestCash, date: Date.now(), title }});
      if (gameState.stats.puristWins > 0) updates.push({ category: 'purist', entry: { name, score: gameState.stats.puristWins, date: Date.now(), title }});
      const bestP = Math.max(gameState.prestigeLevel, gameState.stats.maxPrestigeLevel);
      if (bestP > 0) updates.push({ category: 'prestige', entry: { name, score: bestP, date: Date.now(), title: gameState.activeTitle || undefined } });
      if (gameState.stats.hardModeWins > 0) updates.push({ category: 'hardMode', entry: { name, score: gameState.stats.hardModeWins, date: Date.now(), title }});
      
      if (updates.length > 0) LeaderboardService.submitScores(updates);
  };

  const handleDeleteClick = () => {
    if (deleteConfirm) {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(META_SAVE_KEY);
        window.location.reload();
    } else {
        setDeleteConfirm(true);
        deleteTimeoutRef.current = window.setTimeout(() => setDeleteConfirm(false), 3000) as unknown as number;
    }
  };

  const toggleMute = () => {
      const newMuted = AudioService.toggleMute();
      setMuted(newMuted);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        // Space to flip
        if (e.code === 'Space') { e.preventDefault(); handleFlip(false); }
        // Backtick to toggle debug menu (marks run as cheated/disqualified)
        if (e.key === '`' || e.key === '~') {
            setShowDebugMenu(prev => {
                if (!prev) {
                    // Opening debug menu disqualifies the run
                    setGameState(p => ({ ...p, hasCheated: true }));
                }
                return !prev;
            });
        }
        // P = preview edge landing animation (debug only, no game effect)
        if (e.code === 'KeyP' && !isFlipping && !hasWon) {
            setCoinSide('E');
            setEdgeLanding(true);
            AudioService.playWin();
            setCelebration({ text: '⬡ EDGE LANDING ⬡', level: 15, id: Date.now() });
            if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
            celebrationTimeoutRef.current = window.setTimeout(() => {
                setCelebration(null);
                setEdgeLanding(false);
            }, 4000) as unknown as number;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, isFlipping, hasWon]);

  useEffect(() => {
      return () => {
          if (flipTimeoutRef.current) window.clearTimeout(flipTimeoutRef.current);
          if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
          if (deleteTimeoutRef.current) window.clearTimeout(deleteTimeoutRef.current);
      };
  }, []);

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

  const getTitleDisplay = (key: string, level: number) => {
      let suffix = level > 1 ? ` x${level}` : '';
      const map: Record<string, string> = { 'PURIST': 'Purist', 'PRESTIGE': 'Prestiger', 'RICH': 'High Roller', 'MOMMY': 'Mommy Lover', 'HARD_MAN': 'Hard-Man' };
      return (map[key] || key) + suffix;
  };

  const anyModalOpen =
    showModal ||
    showLeaderboard ||
    showMomModal.show ||
    showHardModePrompt ||
    showTitleSelector ||
    showDebugMenu;

  // Coin display transform
  const getCoinTransform = () => {
    if (isFlipping) return undefined;
    if (!coinSide) return undefined;
    if (coinSide === 'H') return 'rotateY(0deg)';
    if (coinSide === 'T') return 'rotateY(180deg)';
    return undefined; // 'E' handled by animation
  };

  return (
    <div className={`min-h-screen md:h-screen md:overflow-hidden overflow-y-auto bg-noir-950 text-noir-200 font-sans flex flex-col md:flex-row relative transition-colors duration-200 ${celebration && celebration.level >= 8 ? 'bg-noir-900' : ''}`}>
      
      <div className="bg-noise pointer-events-none fixed inset-0 z-0" />
      <div className="bg-vignette pointer-events-none fixed inset-0 z-0" />
      <ConfettiSystem streak={gameState.streak} isRichMode={gameState.money > 1e6 && gameState.activeTitle === 'RICH'} activeTitle={gameState.activeTitle} momPurchases={gameState.stats.momPurchases} partyPooperEnabled={gameState.partyPooperEnabled} />

      {gameState.partyPooperEnabled && (gameState.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] || 0) > 0 && (
        <div className="fixed inset-0 bg-black/30 pointer-events-none z-[55] transition-opacity duration-500" />
      )}
      
      {/* Edge Landing Dramatic Overlay */}
      {edgeLanding && (
        <div className="fixed inset-0 z-[85] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-cyan-500/10 animate-edge-glow" />
          <div className="absolute inset-0 border-4 border-amber-400/40 animate-edge-border-pulse" />
        </div>
      )}
      
      {gameState.activeTitle && (
          <div onClick={() => setShowTitleSelector(true)} className={`fixed md:top-4 top-28 left-1/2 -translate-x-1/2 z-[60] cursor-pointer group transition-opacity duration-300 ${!isFundsVisible ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'}`}>
              <div className="flex items-center gap-2 px-3 py-1 bg-noir-900/80 border border-amber-500/30 rounded-full backdrop-blur hover:bg-noir-800 transition-all shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                  <Crown size={12} className="text-amber-500" />
                  <span className="text-xs font-mono font-bold text-amber-200 tracking-widest uppercase">{getTitleDisplay(gameState.activeTitle, gameState.unlockedTitles[gameState.activeTitle] || 1)}</span>
                  {gameState.playerName && <span className="text-xs text-noir-500 font-mono">| {gameState.hasCheated ? "cheater" : gameState.playerName}</span>}
              </div>
          </div>
      )}

      {gameState.isHardMode && (
          <div className="fixed top-20 left-4 z-50 pointer-events-none">
              <div className="flex items-center gap-2 text-red-500 font-mono text-xs font-bold border border-red-900/50 bg-red-950/20 px-2 py-1 rounded animate-pulse-slow">
                  <Skull size={14} /> HARD MODE
              </div>
          </div>
      )}

      {!isFundsVisible && (
        <div className="fixed top-4 right-4 z-[70] md:hidden animate-fade-in pointer-events-none">
             <div className="px-4 py-2 bg-noir-900/90 border border-amber-500/40 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md flex items-center gap-2">
                <span className="text-[10px] text-noir-400 font-mono uppercase tracking-widest">Funds</span>
                <span className="text-amber-400 font-mono font-bold text-sm">{formatMoney(gameState.money)}</span>
            </div>
        </div>
      )}

      {showTitleSelector && (
          <div data-no-flip className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowTitleSelector(false)}>
              <div className="bg-noir-900 border border-noir-700 p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-mono font-bold text-white mb-4 flex items-center gap-2"><Crown size={20} className="text-amber-500" /> Select Title</h3>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {Object.entries(gameState.unlockedTitles).map(([key, level]) => (
                          <button key={key} onClick={() => { setGameState(p => ({ ...p, activeTitle: key })); setShowTitleSelector(false); }} className={`w-full text-left p-3 font-mono text-sm border transition-colors flex justify-between items-center ${gameState.activeTitle === key ? 'bg-amber-900/30 border-amber-500 text-amber-100' : 'bg-black border-noir-800 text-noir-400 hover:border-noir-500 hover:text-white'}`}>
                              <span>{getTitleDisplay(key, level)}</span>
                              {gameState.activeTitle === key && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}
      
      {showHardModePrompt && (
          <div data-no-flip className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-fade-in">
              <div className="max-w-lg w-full bg-noir-950 border border-red-900 p-8 shadow-[0_0_50px_rgba(220,38,38,0.2)] text-center">
                  <Skull size={48} className="text-red-500 mx-auto mb-6 animate-pulse" />
                  <h2 className="text-3xl font-mono font-bold text-white mb-4">ESCALATION PROTOCOL</h2>
                  <p className="text-noir-300 font-mono mb-6 leading-relaxed">
                      You have mastered the void. Now the void stares back.
                      <br/><br/>
                      <span className="text-red-400 font-bold block">HARD MODE AVAILABLE</span>
                  </p>
                  <ul className="text-left text-sm font-mono text-noir-400 space-y-2 mb-8 bg-black/50 p-4 border border-noir-800">
                      <li className="flex items-center gap-2"><span className="text-red-500">-</span> Max Probability Capped at 60%</li>
                      <li className="flex items-center gap-2"><span className="text-red-500">-</span> Win Streak Requirement: {HARD_MODE_WINNING_STREAK + (gameState.stats.hardModeWins * 5)} (+5 per Hard Win)</li>
                      <li className="flex items-center gap-2"><span className="text-green-500">+</span> Access to Void Injection (+20% Buff)</li>
                      <li className="flex items-center gap-2"><span className="text-green-500">+</span> Permanent 10x Cash Multiplier</li>
                      <li className="flex items-center gap-2"><span className="text-amber-500">⬡</span> Edge Landing: 1% chance = 10 Heads!</li>
                  </ul>
                  <div className="flex gap-4">
                      <button onClick={closeHardModePrompt} className="flex-1 py-3 border border-noir-700 text-noir-500 hover:bg-noir-900 hover:text-white transition-colors font-mono">DECLINE</button>
                      <button onClick={enableHardMode} className="flex-1 py-3 bg-red-900/50 border border-red-600 text-red-100 hover:bg-red-800 transition-colors font-mono font-bold tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)]">ENABLE & RESTART</button>
                  </div>
              </div>
          </div>
      )}

      {celebration && (
        <div className={`pointer-events-none fixed inset-0 z-[90] flex items-center justify-center flex-col overflow-hidden`}>
            {celebration.level >= 5 && !gameState.partyPooperEnabled && <div className="absolute inset-0 bg-white/20 animate-flash mix-blend-overlay"></div>}
            {/* Edge landing special flash */}
            {celebration.text.includes('EDGE') && !gameState.partyPooperEnabled && (
              <div className="absolute inset-0 bg-amber-400/30 animate-flash mix-blend-overlay"></div>
            )}
            <div className={`${celebration.level >= 8 ? 'animate-shake' : ''} flex flex-col items-center justify-center px-4`}>
                <h2 key={celebration.id} className={`font-mono font-bold drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] text-center transition-transform duration-300 max-w-[90vw] break-words leading-tight ${celebration.text.includes('EDGE') ? 'text-5xl md:text-7xl text-amber-300 animate-edge-text' : celebration.level >= 9 ? 'text-7xl md:text-9xl text-amber-500 animate-scale-slam' : celebration.level >= 5 ? 'text-6xl md:text-8xl text-amber-400 animate-pop-up' : 'text-4xl md:text-6xl text-amber-200/80 animate-pop-in-up'}`}>
                    {celebration.text}
                </h2>
                {!celebration.text.includes('EDGE') && (
                  <div className={`mt-2 md:mt-4 font-mono font-bold tracking-[0.5em] md:tracking-[1em] text-white/90 uppercase ${celebration.level >= 7 ? 'text-2xl animate-pulse' : 'text-sm'}`}>{celebration.level}x STREAK</div>
                )}
                {celebration.text.includes('EDGE') && (
                  <div className="mt-4 font-mono font-bold tracking-[0.3em] text-amber-300/90 text-lg animate-pulse">+10 HEADS • WORTH $$$</div>
                )}
            </div>
        </div>
      )}
      
      {showMomModal.show && (
          <div data-no-flip className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6 animate-fade-in">
              <div className="max-w-md w-full text-center space-y-8">
                  <div className="mx-auto w-24 h-24 rounded-full bg-pink-500/20 flex items-center justify-center mb-6 animate-pulse"><Heart size={48} className="text-pink-400" /></div>
                  <h3 className="text-3xl font-mono font-bold text-white mb-4">A Message for You</h3>
                  <button onClick={handleMomConfirm} className="text-xl md:text-2xl font-serif italic text-pink-300 hover:text-pink-100 transition-colors cursor-pointer border-b border-transparent hover:border-pink-500 pb-1">"{showMomModal.text}"</button>
              </div>
          </div>
      )}

      <div
        className="flex-1 flex flex-col relative min-h-[600px] md:min-h-0 z-10"
        onClick={anyModalOpen ? undefined : handleGameAreaClick}
      >
        <header className="p-6 border-b border-noir-800/50 flex justify-between items-end bg-noir-950/30 backdrop-blur-sm relative z-50">
            <div>
                <h1 className="text-3xl font-mono font-bold tracking-tighter text-white drop-shadow-md">BEAT THE <span className="text-amber-500">ODDS</span></h1>
                <div className="flex gap-6 mt-3 text-sm font-mono text-noir-400">
                    <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-noir-600 mb-0.5">Current Streak</span><div className="flex items-baseline gap-1"><span className={`text-2xl font-bold leading-none ${gameState.streak > 0 ? 'text-amber-500' : 'text-noir-500'}`}>{gameState.streak}</span><span className="text-noir-600">/ {currentGoal}</span></div></div>
                    <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-noir-600 mb-0.5">Run Best</span><span className={`text-2xl font-bold leading-none ${gameState.maxStreak > 0 ? 'text-noir-300' : 'text-noir-500'}`}>{gameState.maxStreak}</span></div>
                    {gameState.prestigeLevel > 0 && (<div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-purple-400 mb-0.5">Prestige</span><span className="text-2xl font-bold leading-none text-purple-300">{gameState.prestigeLevel}</span></div>)}
                    {gameState.stats.hardModeWins > 0 && (<div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-red-400 mb-0.5">Hard Wins</span><span className="text-2xl font-bold leading-none text-red-300">{gameState.stats.hardModeWins}</span></div>)}
                </div>
            </div>
            <div className="text-right" ref={headerFundsRef}>
                <span className="text-[10px] uppercase tracking-widest text-noir-600 block mb-1">Funds</span>
                <span className="text-4xl font-mono font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{formatMoney(gameState.money)}</span>
            </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center relative z-10 py-10 md:py-0">
            {hasWon ? (
                <div className="text-center animate-fade-in space-y-6 bg-noir-900/90 p-12 border-2 border-amber-500/30 rounded-xl backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden group max-w-lg mx-4">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <Trophy className="w-24 h-24 text-amber-500 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-bounce" />
                    <h2 className="text-5xl font-mono font-bold text-white tracking-tight">IMPOSSIBLE.</h2>
                    <div className="text-noir-300 font-mono leading-relaxed space-y-2">
                        <p>You defied the probability.</p>
                        {/* ── FIX: use wonAtGoal instead of currentGoal ── */}
                        <p className="text-amber-400 font-bold text-xl">{wonAtGoal} Heads in a row.</p>
                        <div className="pt-4 border-t border-noir-800 mt-4">
                            <p className="text-sm">Total Attempts: {gameState.totalFlips.toLocaleString()}</p>
                            <p className="text-purple-400 font-bold text-lg mt-2 flex items-center justify-center gap-2"><Sparkles size={16} /> REWARD: {FRAGMENTS_PER_WIN} VOID FRAGMENTS</p>
                            {gameState.isHardMode && <p className="text-red-400 font-bold text-sm mt-1 flex items-center justify-center gap-2"><Skull size={14} /> Hard Mode Win #{gameState.stats.hardModeWins}</p>}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 pt-4 relative z-50">
                        <button onClick={() => ascend()} className="w-full px-8 py-4 bg-purple-600 text-white font-mono font-bold tracking-widest hover:bg-purple-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/40 transform hover:-translate-y-1 flex items-center justify-center gap-3"><Sparkles size={20} /> ASCEND (NEW GAME+)</button>
                        <p className="text-[10px] text-noir-500 font-mono uppercase tracking-widest">Resets progress • Keeps Prestige Upgrades • Increases Difficulty? No, just Profit.</p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-16 w-full max-w-md z-10">
                    {/* Coin */}
                    <div className="relative w-64 h-64 perspective-1000 flex items-center justify-center">
                        <div className="absolute bottom-10 w-32 h-4 bg-black/40 blur-xl rounded-[100%]" style={{ animation: isFlipping ? `shadowScale ${Math.max(1, UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]) - (UPGRADES[UpgradeType.PRESTIGE_FLUX].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0) * 250))}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none' }}></div>
                        <div className="w-48 h-48 relative preserve-3d" style={{ animation: isFlipping ? `tossHeight ${Math.max(1, UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]) - (UPGRADES[UpgradeType.PRESTIGE_FLUX].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0) * 250))}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none' }}>
                            <div className="w-full h-full relative preserve-3d" style={{
                                // During flip: normal tossSpin
                                // After landing edge: rotateY spin (coin standing on edge, spinning like a wheel)
                                // After landing H/T: static transform
                                animation: isFlipping
                                    ? `tossSpin ${Math.max(1, UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]) - (UPGRADES[UpgradeType.PRESTIGE_FLUX].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0) * 250))}ms linear infinite`
                                    : (coinSide === 'E' ? 'edgeLandSpin 1.8s linear infinite' : 'none'),
                                transform: (!isFlipping && coinSide && coinSide !== 'E') ? getCoinTransform() : undefined,
                            }}>
                                {/* Heads face */}
                                <div className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 shadow-inner border-4 border-amber-600 flex items-center justify-center overflow-hidden" style={{ transform: 'rotateY(0deg)' }}><div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div><span className="text-8xl font-serif font-bold text-amber-950 mix-blend-overlay drop-shadow-md relative z-10">$</span></div>
                                {/* Tails face */}
                                <div className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 shadow-inner border-4 border-slate-500 flex items-center justify-center overflow-hidden" style={{ transform: 'rotateY(180deg)' }}><div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div><div className="relative w-full h-full z-10 opacity-70"><div className="absolute top-[35%] left-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div><div className="absolute top-[35%] right-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div><div className="absolute top-[52%] left-1/2 -translate-x-1/2 w-[55%] h-[35%] border-t-[10px] border-slate-900 rounded-[50%] mix-blend-overlay"></div></div></div>
                                {/* Edge rim band — only rendered after an edge landing, not during spin */}
                                {coinSide === 'E' && !isFlipping && (
                                    <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                                        background: 'transparent',
                                        boxShadow: '0 0 0 6px rgba(251,191,36,0.25), inset 0 0 0 6px rgba(251,191,36,0.15)',
                                    }} />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-6 items-center">
                        <button onClick={() => handleFlip(false)} disabled={isFlipping} className={`group relative w-full max-w-[240px] py-5 text-xl font-mono font-bold tracking-[0.2em] border transition-all duration-200 overflow-hidden z-20 cursor-pointer ${isFlipping ? 'border-noir-800 text-noir-700 bg-black cursor-not-allowed scale-95' : 'border-white text-white bg-transparent hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95'}`}><span className="relative z-10">{isFlipping ? 'FLIPPING...' : 'FLIP COIN'}</span></button>
                        <div className="flex flex-col items-center gap-1">
                             <div className="text-[10px] uppercase tracking-widest text-noir-500">Probability</div>
                             <div className="font-mono text-amber-500 text-lg font-bold flex items-center gap-2">{(calculateChance() * 100).toFixed(0)}%{gameState.upgrades[UpgradeType.HARD_MODE_BUFF] > 0 && <Syringe size={14} className="text-red-500 animate-pulse" />}</div>
                             {(gameState.upgrades[UpgradeType.PRESTIGE_FATE] || 0) > 0 && <div className="text-[10px] text-purple-400 font-mono">(+{((gameState.upgrades[UpgradeType.PRESTIGE_FATE] || 0) * 2.5).toFixed(0)}% Base)</div>}
                             {gameState.isHardMode && <div className="text-[10px] text-red-500 font-mono font-bold mt-1">CAP: 60% · EDGE: 1%</div>}
                        </div>
                    </div>
                </div>
            )}
        </main>

        <footer className="h-20 bg-noir-950/80 backdrop-blur-md border-t border-noir-800/50 flex items-center justify-between px-6 relative z-50">
            <div className="flex gap-3 overflow-hidden mask-linear-fade items-center">
                <span className="text-[10px] uppercase tracking-widest text-noir-700 mr-2">History</span>
                {gameState.history.map((res, i) => (
                    <div key={i} className={`w-8 h-8 flex items-center justify-center font-mono font-bold rounded-sm text-xs shadow-lg transition-transform hover:scale-110 cursor-default ${res === 'H' ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white border border-amber-400' : res === 'E' ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 border border-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.6)]' : 'bg-gradient-to-b from-noir-700 to-noir-800 text-noir-400 border border-noir-600'}`}>{res === 'H' ? '$' : res === 'E' ? '⬡' : <span className="rotate-90 inline-block text-[8px] tracking-tighter font-sans scale-y-150 transform-gpu">:(</span>}</div>
                ))}
            </div>
            
            <div className="flex gap-4">
                 {gameState.prestigeLevel >= 50 && !gameState.isHardMode && (
                    <button onClick={() => setShowHardModePrompt(true)} className="p-2 text-noir-500 hover:text-red-500 transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title="Enable Hard Mode">
                        <Skull size={20} />
                    </button>
                 )}
                 {(gameState.playerName || hasEverWon) && (
                     <button onClick={() => setShowLeaderboard(true)} className="p-2 text-amber-500 hover:text-white transition-colors hover:bg-amber-900/50 rounded-full cursor-pointer animate-fade-in" title="Leaderboard"><List size={20} /></button>
                 )}
                 <button onClick={toggleMute} className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
                 <button onClick={() => setShowModal(true)} className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title="Math Analysis"><HelpCircle size={20} /></button>
                 <button onClick={handleDeleteClick} className={`p-2 transition-colors rounded-full font-mono text-xs flex items-center justify-center cursor-pointer w-9 h-9 ${deleteConfirm ? 'bg-red-900 text-white hover:bg-red-800 ring-1 ring-red-500' : 'text-noir-500 hover:text-red-500 hover:bg-noir-900'}`} title="Delete Save & Reset">{deleteConfirm ? '!' : <Trash2 size={20} />}</button>
                 <button onClick={() => { setShowDebugMenu(true); setGameState(p => ({ ...p, hasCheated: true })); }} className="p-2 text-noir-700 hover:text-yellow-500 transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title="Debug Menu (` key)">{<Bug size={18} />}</button>
            </div>
        </footer>

      </div>

      <Shop 
        money={gameState.money} 
        voidFragments={gameState.voidFragments}
        prestigeLevel={gameState.prestigeLevel}
        upgrades={gameState.upgrades} 
        onBuy={handleBuy}
        maxStreak={gameState.maxStreak}
        autoFlipEnabled={gameState.autoFlipEnabled}
        onToggleAutoFlip={toggleAutoFlip}
        autoBuyEnabled={gameState.autoBuyEnabled}
        onToggleAutoBuy={toggleAutoBuy}
        partyPooperEnabled={gameState.partyPooperEnabled}
        onTogglePartyPooper={togglePartyPooper}
        seenUpgrades={gameState.seenUpgrades}
        onSeen={handleSeen}
        momPurchases={gameState.stats.momPurchases}
        isHardMode={gameState.isHardMode}
        playerStats={gameState.stats}
        flipSpeedMultiplier={gameState.flipSpeedMultiplier}
        onSetFlipSpeed={setFlipSpeedMultiplier}
      />

      <div className="relative z-[100]">
        <ProbabilityModal isOpen={showModal} onClose={() => setShowModal(false)} currentChance={calculateChance()} />
        <LeaderboardModal 
            isOpen={showLeaderboard} 
            onClose={() => setShowLeaderboard(false)} 
            playerName={gameState.playerName} 
            onRegisterName={registerName} 
            currentStats={{ purist: gameState.stats.puristWins, prestige: gameState.stats.maxPrestigeLevel, rich: gameState.stats.highestCash, mommy: gameState.stats.momPurchases, hardMode: gameState.stats.hardModeWins }}
            onSubmitRun={handleManualSubmit}
        />
        <DebugMenu
            isOpen={showDebugMenu}
            onClose={() => setShowDebugMenu(false)}
            prestigeLevel={gameState.prestigeLevel}
            money={gameState.money}
            voidFragments={gameState.voidFragments}
            forceHeads={forceHeadsDebug}
            onToggleForceHeads={debugToggleForceHeads}
            onSetPrestige={debugSetPrestige}
            onSetMoney={debugSetMoney}
            onSetFragments={debugSetFragments}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      </div>
      <style>{`
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
        @keyframes edgeGlow { 0%, 100% { opacity: 0; } 20%, 80% { opacity: 1; } }
        .animate-edge-glow { animation: edgeGlow 3s ease-in-out; }
        @keyframes edgeBorderPulse { 0% { opacity: 0; transform: scale(0.95); } 30% { opacity: 1; transform: scale(1.02); } 60% { opacity: 0.6; transform: scale(1); } 100% { opacity: 0; } }
        .animate-edge-border-pulse { animation: edgeBorderPulse 3s ease-out forwards; }
        @keyframes edgeText { 0% { opacity: 0; transform: scale(0.3) rotateY(90deg); } 40% { opacity: 1; transform: scale(1.1) rotateY(0deg); } 70% { transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        .animate-edge-text { animation: edgeText 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        /* Edge landing: coin stands on its rim and spins like a wheel (rotateY = horizontal axis spin) */
        @keyframes edgeLandSpin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
      `}</style>
    </div>
  );
};

export default App;
