import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, UpgradeType, FRAGMENTS_PER_WIN, PlayerStats, GlobalLeaderboard, LeaderboardEntry } from './types';
import { UPGRADES, getWardPrice } from './constants';
import {
  getGoal, getHardGoal, getChance, getBaseChance, getClutchZoneStart, isInClutchZone, getHeatCap, getWardCap, getHardWinRewards, getPushMultiplier,
  getPushSuccessChance, inject, canInject, canWardAbsorb, shouldAutoInject, getHeatFloor, getClutchZoneSize, HEAT_PER_HEADS, HARD_BASE_CAP, HARD_CHANCE_CEILING,
  INJECTION_BOOST, INJECTION_FLIPS, MAX_PUSHES, PUSH_STEP, CLUTCH_PAUSE_MS, HARD_GOAL_STEP,
  HARD_EVENT_HOLD_MS, HARD_CONFETTI_BURST, HARD_CONFETTI_MAX, AUTO_BANK_DELAY_MS,
} from './hardMode';
import Shop from './components/Shop';
import ProbabilityModal from './components/ProbabilityModal';
import LeaderboardModal from './components/LeaderboardModal';
import ConfettiSystem from './components/ConfettiSystem';
import { AudioService } from './services/audioService';
import { LeaderboardService } from './services/leaderboardService';
import { HelpCircle, Trash2, Trophy, Volume2, VolumeX, Sparkles, Heart, List, Crown, Skull, Syringe, Shield, Flame, LogOut } from 'lucide-react';

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
    [UpgradeType.HARD_MODE_BUFF]: 0, [UpgradeType.HARD_WARD]: 0, [UpgradeType.HARD_BULWARK]: 0,
    [UpgradeType.HARD_MOMENTUM]: 0, [UpgradeType.HARD_STEADY]: 0, [UpgradeType.HARD_HEAD_START]: 0,
  },
  history: [],
  prestigeLevel: 0,
  voidFragments: 0,
  autoFlipEnabled: true,
  autoBuyEnabled: false,
  partyPooperEnabled: false,
  isHardMode: false,
  resolve: 0,
  hardHeat: 0,
  wardsHeld: 0,
  injectionFlipsLeft: 0,
  hardPushLevel: 0,
  hardPushBust: false,
  autoInjectEnabled: true,
  autoBankEnabled: false,
  seenUpgrades: [UpgradeType.CHANCE, UpgradeType.SPEED, UpgradeType.COMBO, UpgradeType.VALUE], 
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
        // Retroactive unlock: players at prestige 5+ automatically receive the Party Pooper upgrade
        if (typeof loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] === 'undefined') {
            loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] = 0;
        }
        if ((loaded.prestigeLevel || 0) >= 5 && loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] === 0) {
            loaded.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] = 1;
        }
        if (typeof loaded.isHardMode === 'undefined') loaded.isHardMode = false;
        if (typeof loaded.resolve === 'undefined') loaded.resolve = 0;
        if (typeof loaded.hardHeat === 'undefined') loaded.hardHeat = 0;
        if (typeof loaded.wardsHeld === 'undefined') loaded.wardsHeld = 0;
        if (typeof loaded.injectionFlipsLeft === 'undefined') loaded.injectionFlipsLeft = 0;
        if (typeof loaded.hardPushLevel === 'undefined') loaded.hardPushLevel = 0;
        if (typeof loaded.hardPushBust === 'undefined') loaded.hardPushBust = false;
        if (typeof loaded.autoInjectEnabled === 'undefined') loaded.autoInjectEnabled = true;
        if (typeof loaded.autoBankEnabled === 'undefined') loaded.autoBankEnabled = false;
        
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
  const [coinSide, setCoinSide] = useState<'H' | 'T' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMomModal, setShowMomModal] = useState<{show: boolean, text: string}>({show: false, text: ""});
  const [showHardModePrompt, setShowHardModePrompt] = useState(false);
  const [showRetreatConfirm, setShowRetreatConfirm] = useState(false);
  const [showHardRules, setShowHardRules] = useState(false);
  const [ascendToHard, setAscendToHard] = useState(true);
  const [clutchPauseUntil, setClutchPauseUntil] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  // tone/sub mark hard mode events, which get their own colour and caption
  const [celebration, setCelebration] = useState<{text: string, level: number, id: number, tone?: 'clutch' | 'ward' | 'inject', sub?: string} | null>(null);
  const [muted, setMuted] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showTitleSelector, setShowTitleSelector] = useState(false);
  
  const [isFundsVisible, setIsFundsVisible] = useState(true);
  const headerFundsRef = useRef<HTMLDivElement>(null);

  const flipTimeoutRef = useRef<number | undefined>(undefined);
  const celebrationTimeoutRef = useRef<number | undefined>(undefined);
  const deleteTimeoutRef = useRef<number | undefined>(undefined);
  const cheatCodeBuffer = useRef<string>("");
  const celebrationHoldUntilRef = useRef(0);
  const modalOpenRef = useRef(false);

  // Hard mode events outrank streak pops: hold them briefly so the next Heads can't overwrite them
  const showHardEvent = (text: string, tone: 'clutch' | 'ward' | 'inject', sub: string, level: number) => {
      if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
      celebrationHoldUntilRef.current = Date.now() + HARD_EVENT_HOLD_MS;
      setCelebration({ text, level, id: Date.now(), tone, sub });
      celebrationTimeoutRef.current = window.setTimeout(() => setCelebration(null), HARD_EVENT_HOLD_MS) as unknown as number;
  };

  const clearCelebration = () => {
      if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
      celebrationHoldUntilRef.current = 0;
      setCelebration(null);
  };

  // Latest state for the flip timeout, which resolves after the click that started it
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const currentGoal = getGoal(gameState);
  const clutchZoneStart = getClutchZoneStart(currentGoal);
  const inClutchZone = isInClutchZone(gameState);
  const isClutchPaused = clutchPauseUntil > 0;
  const hardDialogOpen = showRetreatConfirm || showHardRules || showHardModePrompt;

  // ── Derived: has the player ever won at least one round? ──────────────────
  // totalPrestiges increments on every ascend (which requires a win), and
  // hardModeWins also tracks wins, so either being > 0 means they've won.
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

  const currentChance = getChance(gameState);

  // Fresh run: dollar upgrades and run-scoped hard mode state reset, permanent progress kept
  const buildNewRun = (prev: GameState, overrides: Partial<GameState>): GameState => {
      const karmaLevel = prev.upgrades[UpgradeType.PRESTIGE_KARMA] || 0;
      const keptUpgrades = {} as Record<UpgradeType, number>;
      (Object.keys(prev.upgrades) as UpgradeType[]).forEach(k => {
          keptUpgrades[k] = (UPGRADES[k].isPrestige || k === UpgradeType.PRESTIGE_CARE_PACKAGE) ? prev.upgrades[k] : 0;
      });

      return {
          ...INITIAL_STATE,
          money: UPGRADES[UpgradeType.PRESTIGE_KARMA].getEffect(karmaLevel),
          prestigeLevel: prev.prestigeLevel,
          voidFragments: prev.voidFragments,
          resolve: prev.resolve,
          upgrades: keptUpgrades,
          seenUpgrades: prev.seenUpgrades,
          playerName: prev.playerName,
          stats: prev.stats,
          unlockedTitles: prev.unlockedTitles,
          activeTitle: prev.activeTitle,
          hasCheated: prev.hasCheated,
          autoFlipEnabled: prev.autoFlipEnabled,
          autoBuyEnabled: prev.autoBuyEnabled,
          partyPooperEnabled: prev.partyPooperEnabled,
          autoInjectEnabled: prev.autoInjectEnabled,
          autoBankEnabled: prev.autoBankEnabled,
          hardHeat: getHeatFloor(keptUpgrades),
          isHardMode: prev.isHardMode,
          ...overrides,
      };
  };

  const resetRunUi = () => {
      setHasWon(false);
      setCoinSide(null);
      setCelebration(null);
      setClutchPauseUntil(0);
      setAscendToHard(true);
  };

  // Only called from the win screen: pays out and starts the next run
  const ascend = (nextHardMode: boolean = gameState.isHardMode) => {
      const wasHardWin = gameState.isHardMode;
      const newPrestigeLevel = gameState.prestigeLevel + 1;
      const nextTitles = { ...gameState.unlockedTitles };
      if (newPrestigeLevel > 0) nextTitles['PRESTIGE'] = newPrestigeLevel;

      const nextStats = { 
          ...gameState.stats, 
          totalPrestiges: gameState.stats.totalPrestiges + 1,
          maxPrestigeLevel: Math.max(gameState.stats.maxPrestigeLevel, newPrestigeLevel)
      };

      let voidReward = FRAGMENTS_PER_WIN;
      let resolveReward = 0;
      if (wasHardWin) {
          // Counted here rather than on detection so the win screen keeps showing the goal just beaten
          const rewards = getHardWinRewards(gameState.stats.hardModeWins, gameState.hardPushLevel, gameState.hardPushBust);
          voidReward = rewards.voidFragments;
          resolveReward = rewards.resolve;
          nextStats.hardModeWins = gameState.stats.hardModeWins + 1;
      }
      if (wasHardWin || nextHardMode) nextTitles['HARD_MAN'] = Math.max(1, nextStats.hardModeWins);
      // Purist = the run was won without a single auto flip
      if (gameState.isPuristRun) nextStats.puristWins = gameState.stats.puristWins + 1;
      saveMetaStats(nextStats);
      
      let nextActiveTitle = gameState.activeTitle;
      if (!nextActiveTitle && newPrestigeLevel === 1) nextActiveTitle = 'PRESTIGE';

      const nextState = buildNewRun(gameState, {
          prestigeLevel: newPrestigeLevel,
          voidFragments: gameState.voidFragments + voidReward,
          resolve: gameState.resolve + resolveReward,
          stats: nextStats,
          unlockedTitles: nextTitles,
          activeTitle: nextActiveTitle,
          isHardMode: nextHardMode,
      });

      if (gameState.playerName && !gameState.hasCheated) {
          const name = gameState.playerName;
          const now = Date.now();
          const title = nextActiveTitle || undefined;
          
          const updates: { category: keyof GlobalLeaderboard, entry: LeaderboardEntry }[] = [];
          if (newPrestigeLevel >= nextStats.maxPrestigeLevel) updates.push({ category: 'prestige', entry: { name, score: newPrestigeLevel, date: now, title } });
          if (gameState.isPuristRun) updates.push({ category: 'purist', entry: { name, score: nextStats.puristWins, date: now, title } });
          if (updates.length > 0) LeaderboardService.submitScores(updates);
      }

      setGameState(nextState);
      resetRunUi();
  };

  // Abandons the current run with no rewards (entering hard mode mid-run, or retreating from it)
  const restartRun = (nextHardMode: boolean) => {
      const nextTitles = { ...gameState.unlockedTitles };
      if (nextHardMode) nextTitles['HARD_MAN'] = Math.max(1, gameState.stats.hardModeWins);
      setGameState(buildNewRun(gameState, { isHardMode: nextHardMode, unlockedTitles: nextTitles }));
      resetRunUi();
  };

  const enableHardMode = () => {
      if (hasWon) ascend(true);
      else restartRun(true);
      setShowHardModePrompt(false);
  };

  const closeHardModePrompt = () => setShowHardModePrompt(false);

  const confirmRetreat = () => {
      restartRun(false);
      setShowRetreatConfirm(false);
  };

  // Win screen: risk the banked win for 5 more Heads and double the reward
  const pushOnward = () => {
      setGameState(p => {
          if (!p.isHardMode || p.hardPushBust || p.hardPushLevel >= MAX_PUSHES || p.streak < getGoal(p)) return p;
          const next = { ...p, hardPushLevel: p.hardPushLevel + 1 };
          return shouldAutoInject(next) ? inject(next) : next;
      });
      setHasWon(false);
      setCelebration(null);
  };

  const fireInjection = () => {
      if (!canInject(gameState)) return;
      setGameState(p => inject(p));
      setClutchPauseUntil(0);
      AudioService.playFlip();
      showHardEvent("INJECTED", 'inject', `+${Math.round(INJECTION_BOOST * 100)}% FOR ${INJECTION_FLIPS} FLIPS`, gameState.streak);
  };

  const toggleAutoInject = () => setGameState(p => ({ ...p, autoInjectEnabled: !p.autoInjectEnabled }));
  const toggleAutoBank = () => setGameState(p => ({ ...p, autoBankEnabled: !p.autoBankEnabled }));

  // Auto-bank: idle players shouldn't lose time sitting on the win screen. A ref keeps the
  // latest ascend/next-run choice so the timer doesn't act on a stale closure.
  const autoBankRef = useRef(() => {});
  autoBankRef.current = () => ascend(ascendToHard);
  useEffect(() => {
      if (!hasWon || !gameState.isHardMode || !gameState.autoBankEnabled) return;
      const timer = window.setTimeout(() => autoBankRef.current(), AUTO_BANK_DELAY_MS) as unknown as number;
      return () => window.clearTimeout(timer);
  }, [hasWon, gameState.isHardMode, gameState.autoBankEnabled]);

  const handleFlip = useCallback((forceHeads: boolean = false, isAuto: boolean = false) => {
    if (isFlipping || hasWon || showMomModal.show) return;
    
    setIsFlipping(true);
    const speedLevel = gameState.upgrades[UpgradeType.SPEED] || 0;
    const fluxLevel = gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0;
    const hasLimitless = (gameState.upgrades[UpgradeType.PRESTIGE_LIMITLESS] || 0) > 0;
    
    let duration = UPGRADES[UpgradeType.SPEED].getEffect(speedLevel);
    duration = Math.max(hasLimitless ? 1 : 50, duration - (fluxLevel * 250));

    if (duration > 50) AudioService.playFlip();

    flipTimeoutRef.current = window.setTimeout(() => {
        const current = stateRef.current;
        const roll = Math.random();
        const isHeads = forceHeads || roll < getChance(current);
        const result = isHeads ? 'H' : 'T';
        
        setCoinSide(result);

        // Entering the clutch zone on auto with auto-inject off: hold briefly so the player can choose
        if (isHeads && isAuto && !current.autoInjectEnabled && canInject({ ...current, streak: current.streak + 1 }) &&
            current.streak + 1 === getClutchZoneStart(getGoal(current))) {
            setClutchPauseUntil(Date.now() + CLUTCH_PAUSE_MS);
        }

        setGameState(prev => {
            let newState = { ...prev, totalFlips: prev.totalFlips + 1, stats: { ...prev.stats } };
            const zoneStart = getClutchZoneStart(getGoal(prev));
            const wardSave = !isHeads && canWardAbsorb(prev);
            
            if (isAuto) newState.isPuristRun = false;

            if (isHeads) {
                const newStreak = prev.streak + 1;
                if (duration > 50 || newStreak % 10 === 0) AudioService.playHeads(newStreak);
                
                const comboLevel = prev.upgrades[UpgradeType.COMBO] || 0;
                const valueLevel = prev.upgrades[UpgradeType.VALUE] || 0;
                const edgingLevel = prev.upgrades[UpgradeType.EDGING] || 0;
                const pEdgingLevel = prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0;
                const goldDiggerLevel = prev.upgrades[UpgradeType.PRESTIGE_GOLD_DIGGER] || 0;
                const veteranLevel = prev.upgrades[UpgradeType.PRESTIGE_VETERAN] || 0;

                let baseVal = UPGRADES[UpgradeType.VALUE].getEffect(valueLevel);
                let comboMult = UPGRADES[UpgradeType.COMBO].getEffect(comboLevel);
                if (newStreak > 1) baseVal *= (1 + (newStreak * (comboMult - 1))); 

                let multiplier = 1;
                if (edgingLevel > 0) multiplier *= 10;
                if (pEdgingLevel > 0) multiplier *= 10;
                if (goldDiggerLevel > 0) multiplier *= UPGRADES[UpgradeType.PRESTIGE_GOLD_DIGGER].getEffect(goldDiggerLevel);
                if (veteranLevel > 0) multiplier *= Math.max(1, 1 + (prev.prestigeLevel * 0.10));
                if (prev.isHardMode) multiplier *= 10;
                
                const prestigeMult = 1 + (prev.prestigeLevel * 0.1);
                const gain = Math.floor(baseVal * multiplier * prestigeMult);
                
                newState.money += gain;
                newState.streak = newStreak;
                newState.maxStreak = Math.max(prev.maxStreak, newStreak);
                newState.stats.highestCash = Math.max(newState.stats.highestCash, newState.money);
                newState.history = ['H', ...prev.history].slice(0, 10) as GameState['history'];
                
                if (prev.isHardMode) {
                    newState.hardHeat = Math.min(getHeatCap(prev.upgrades), prev.hardHeat + HEAT_PER_HEADS);
                    newState.injectionFlipsLeft = Math.max(0, prev.injectionFlipsLeft - 1);
                    if (newStreak % 10 === 0) newState.voidFragments += 5;
                    if (newStreak === zoneStart && shouldAutoInject(newState)) newState = inject(newState);
                }
                
                const toGo = getGoal(prev) - newStreak;
                if (prev.isHardMode && newStreak === zoneStart && toGo > 0) {
                    const injected = newState.injectionFlipsLeft === INJECTION_FLIPS;
                    showHardEvent("CLUTCH ZONE", 'clutch', injected ? `${toGo} TO GO • INJECTED +${Math.round(INJECTION_BOOST * 100)}%` : `${toGo} TO GO`, newStreak);
                } else if (prev.isHardMode && toGo <= 0) {
                    clearCelebration();
                } else if (newStreak >= 2 && Date.now() >= celebrationHoldUntilRef.current) {
                    if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
                    // In the clutch zone the old normal-mode jokes ("WHY?", "NULL") read like a crash; count down instead
                    let message = prev.isHardMode && newStreak > zoneStart && toGo > 0
                        ? `${toGo} TO GO`
                        : CELEBRATION_MESSAGES[Math.min(newStreak, CELEBRATION_MESSAGES.length - 1)] || "GODLIKE";
                    setCelebration({ text: message, level: newStreak, id: Date.now() });
                    celebrationTimeoutRef.current = window.setTimeout(() => setCelebration(null), 2500) as unknown as number;
                }

            } else {
                if (duration > 50 || wardSave) AudioService.playTails();

                if (wardSave) {
                    // The Ward breaks instead of the streak; Heat takes the hit
                    const hasSteadyNerve = (prev.upgrades[UpgradeType.HARD_STEADY] || 0) > 0;
                    newState.wardsHeld = prev.wardsHeld - 1;
                    newState.hardHeat = Math.max(getHeatFloor(prev.upgrades), hasSteadyNerve ? Math.floor(prev.hardHeat / 2) : 0);
                    newState.injectionFlipsLeft = Math.max(0, prev.injectionFlipsLeft - 1);
                    newState.history = ['W', ...prev.history].slice(0, 10) as GameState['history'];
                    if (shouldAutoInject(newState)) newState = inject(newState);

                    const reinjected = newState.injectionFlipsLeft === INJECTION_FLIPS;
                    showHardEvent("WARD HELD", 'ward', reinjected ? `STREAK SAFE • INJECTED +${Math.round(INJECTION_BOOST * 100)}%` : `STREAK SAFE AT ${prev.streak}`, prev.streak);
                } else {
                    newState.streak = 0;
                    newState.history = ['T', ...prev.history].slice(0, 10) as GameState['history'];
                    const shortBy = getGoal(prev) - prev.streak;
                    if (prev.isHardMode && prev.hardPushLevel === 0 && prev.streak >= zoneStart && shortBy > 0) {
                        showHardEvent("BROKEN", 'clutch', `AT ${prev.streak} • ${shortBy} SHORT`, prev.streak);
                    } else if (prev.isHardMode) {
                        clearCelebration();
                    }
                    if (prev.isHardMode) {
                        newState.hardHeat = getHeatFloor(prev.upgrades);
                        newState.injectionFlipsLeft = 0;
                        if (prev.hardPushLevel > 0) newState.hardPushBust = true;
                    }
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

  }, [isFlipping, hasWon, showMomModal, gameState.upgrades]);

  // ── Click-anywhere-to-flip ─────────────────────────────────────────────────
  // Fires on clicks within the main game panel. Skipped if the click target
  // (or any of its ancestors) is an interactive element or a modal/overlay.
  const INTERACTIVE_SELECTOR =
    'button, a, input, select, textarea, label, [role="button"], [role="dialog"], [role="listbox"], [data-no-flip]';

  const handleGameAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Bail out when clicking anything interactive
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      handleFlip(false);
    },
    [handleFlip]
  );

  // Win Detection
  useEffect(() => {
    // A busted push also ends the run; the win still counts at a reduced reward
    if ((gameState.streak >= currentGoal || gameState.hardPushBust) && !hasWon) {
        setHasWon(true);
        setClutchPauseUntil(0);
        
        saveMetaStats(gameState.stats);
        
        if (gameState.prestigeLevel >= 50 && !gameState.isHardMode) {
            setShowHardModePrompt(true);
        }

        // Purist wins are counted and submitted on ascend, so reloading the win screen can't double-count
        if (gameState.playerName && !gameState.hasCheated) {
             LeaderboardService.submitScores([{ category: 'rich', entry: { name: gameState.playerName, score: gameState.stats.highestCash, date: Date.now() } }]);
        }
    }
  }, [gameState.streak, gameState.hardPushBust, currentGoal, hasWon, gameState.isHardMode, gameState.prestigeLevel, gameState.playerName, gameState.hasCheated, gameState.stats]);

  // Auto Flip
  useEffect(() => {
    const hasAuto = gameState.upgrades[UpgradeType.AUTO_FLIP] > 0 || gameState.upgrades[UpgradeType.PRESTIGE_AUTO] > 0;
    
    if (isClutchPaused) {
        const timer = window.setTimeout(() => setClutchPauseUntil(0), Math.max(0, clutchPauseUntil - Date.now())) as unknown as number;
        return () => window.clearTimeout(timer);
    }
    if (gameState.autoFlipEnabled && hasAuto && !isFlipping && !hasWon && gameState.streak < currentGoal && !gameState.hardPushBust && !showMomModal.show && !hardDialogOpen) {
        const timer = window.setTimeout(() => handleFlip(false, true), 100) as unknown as number;
        return () => window.clearTimeout(timer);
    }
  }, [gameState.autoFlipEnabled, isFlipping, hasWon, gameState.streak, gameState.hardPushBust, currentGoal, gameState.upgrades, handleFlip, showMomModal, isClutchPaused, clutchPauseUntil, hardDialogOpen]);

  // Auto Buy (keyed on the unlock only, so purchases and flips don't keep restarting the 1s interval)
  useEffect(() => {
    if (gameState.autoBuyEnabled && gameState.upgrades[UpgradeType.PRESTIGE_AUTO_BUY] > 0) {
        const interval = window.setInterval(() => {
            setGameState(prev => {
                if (prev.money <= 0 || prev.streak >= getGoal(prev) || prev.hardPushBust) return prev;
                let newState = { ...prev, upgrades: { ...prev.upgrades } };
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

                // Wards come last: only top up once the regular upgrades are handled
                const wardsBought = prev.upgrades[UpgradeType.HARD_WARD] || 0;
                const wardCost = getWardPrice(newState.upgrades, prev.prestigeLevel);
                if (prev.isHardMode && prev.hardPushLevel === 0 && wardCost !== undefined && newState.wardsHeld < getWardCap(prev.upgrades) && newState.money >= wardCost) {
                    newState.money -= wardCost;
                    newState.upgrades[UpgradeType.HARD_WARD] = wardsBought + 1;
                    newState.wardsHeld += 1;
                    if (!updatedSeen.includes(UpgradeType.HARD_WARD)) updatedSeen.push(UpgradeType.HARD_WARD);
                    bought = true;
                }
                if (bought) newState.seenUpgrades = updatedSeen;
                return bought ? newState : prev;
            });
        }, 1000) as unknown as number;
        return () => window.clearInterval(interval);
    }
  }, [gameState.autoBuyEnabled, gameState.upgrades[UpgradeType.PRESTIGE_AUTO_BUY]]);

  const handleManualSubmit = useCallback(async () => {
      if (!gameState.playerName || gameState.hasCheated) return;
      
      const updates: { category: keyof GlobalLeaderboard, entry: LeaderboardEntry }[] = [];
      const currentRichScore = Math.max(gameState.money, gameState.stats.highestCash);
      
      if (currentRichScore > 0) updates.push({ category: 'rich', entry: { name: gameState.playerName, score: currentRichScore, date: Date.now(), title: gameState.activeTitle || undefined } });
      if (gameState.stats.puristWins > 0) updates.push({ category: 'purist', entry: { name: gameState.playerName, score: gameState.stats.puristWins, date: Date.now(), title: gameState.activeTitle || undefined } });
      
      const bestP = Math.max(gameState.prestigeLevel, gameState.stats.maxPrestigeLevel);
      if (bestP > 0) updates.push({ category: 'prestige', entry: { name: gameState.playerName, score: bestP, date: Date.now(), title: gameState.activeTitle || undefined } });
      
      if (gameState.stats.momPurchases > 0) updates.push({ category: 'mommy', entry: { name: gameState.playerName, score: gameState.stats.momPurchases, date: Date.now(), title: gameState.activeTitle || undefined } });

      if (updates.length > 0) await LeaderboardService.submitScores(updates);
  }, [gameState]);

  const handleBuy = (id: UpgradeType, cost: number, isPrestige: boolean) => {
      setGameState(prev => {
          if (id === UpgradeType.PRESTIGE_CARE_PACKAGE) {
             if (prev.money < cost) return prev;
             const newState = { ...prev, upgrades: { ...prev.upgrades } };
             newState.money -= cost;
             newState.voidFragments += 25;
             newState.upgrades[id] = (prev.upgrades[id] || 0) + 1;
             AudioService.playFlip();
             return newState;
          }

          const level = prev.upgrades[id] || 0;
          // Void Injection charges and Abyss upgrades have hard limits (no Limitless tiers).
          // Their prices are read from the current state so two quick clicks can't both pay the old price.
          if (id === UpgradeType.HARD_MODE_BUFF) {
              const price = UPGRADES[id].costTiers[level];
              if (price === undefined || prev.voidFragments < price) return prev;
              return { ...prev, voidFragments: prev.voidFragments - price, upgrades: { ...prev.upgrades, [id]: level + 1 } };
          }

          if (UPGRADES[id].currency === 'resolve') {
              const price = UPGRADES[id].costTiers[level];
              if (price === undefined || prev.resolve < price) return prev;
              return { ...prev, resolve: prev.resolve - price, upgrades: { ...prev.upgrades, [id]: level + 1 } };
          }

          if (id === UpgradeType.HARD_WARD) {
              const price = getWardPrice(prev.upgrades, prev.prestigeLevel);
              if (price === undefined || prev.money < price || prev.wardsHeld >= getWardCap(prev.upgrades) || prev.hardPushLevel > 0) return prev;
              return { ...prev, money: prev.money - price, wardsHeld: prev.wardsHeld + 1, upgrades: { ...prev.upgrades, [id]: level + 1 } };
          }

          if (isPrestige && id !== UpgradeType.PRESTIGE_GOLD_DIGGER) {
              if (prev.voidFragments < cost) return prev;
          } else {
              if (prev.money < cost) return prev;
          }

          const newState = { ...prev, upgrades: { ...prev.upgrades }, stats: { ...prev.stats } };
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

          newState.upgrades[id] = (prev.upgrades[id] || 0) + 1;
          
          if (id === UpgradeType.PRESTIGE_MOM) {
              newState.stats.momPurchases++;
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
        if (e.code === 'Space') { e.preventDefault(); if (!modalOpenRef.current) handleFlip(false); }
        if (e.code === 'KeyQ') { handleFlip(true); setGameState(p => ({ ...p, hasCheated: true, voidFragments: p.voidFragments + 5 })); }
        if (e.key) {
           cheatCodeBuffer.current = (cheatCodeBuffer.current + e.key).toUpperCase().slice(-3);
           if (cheatCodeBuffer.current === "ZEX") {
               setGameState(p => ({ ...p, prestigeLevel: 199, hasCheated: true }));
               AudioService.playWin();
               cheatCodeBuffer.current = "";
           }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip]);

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

  const injectionCost = UPGRADES[UpgradeType.HARD_MODE_BUFF].costTiers[0];
  const buyInjectionCharge = () => handleBuy(UpgradeType.HARD_MODE_BUFF, injectionCost, true);

  const renderGauntletHud = () => {
      const heatCap = getHeatCap(gameState.upgrades);
      const wardCap = getWardCap(gameState.upgrades);
      const charges = gameState.upgrades[UpgradeType.HARD_MODE_BUFF] || 0;
      const baseShown = Math.min(HARD_BASE_CAP, getBaseChance(gameState.upgrades));
      const isPushing = gameState.hardPushLevel > 0;
      const injecting = gameState.injectionFlipsLeft > 0;
      const canBuyCharge = !injecting && charges === 0 && gameState.voidFragments >= injectionCost;
      return (
          <div data-no-flip className="mt-2 w-[280px] flex flex-col items-center gap-2 font-mono">
              <div className="flex items-center gap-2 text-[10px] text-red-400/90 tracking-wider">
                  <span>
                      {Math.round(baseShown * 100)}% BASE + <span className="text-orange-400">{gameState.hardHeat}/{heatCap}% HEAT</span>
                      {injecting && <span className="text-red-400"> + {Math.round(INJECTION_BOOST * 100)}% INJ</span>}
                  </span>
                  <button onClick={() => setShowHardRules(true)} className="text-noir-500 hover:text-white cursor-pointer" title="How hard mode works"><HelpCircle size={12} /></button>
              </div>
              <div className="w-full h-1.5 bg-noir-900 border border-noir-800 rounded-full overflow-hidden" title={`Heat ${gameState.hardHeat}/${heatCap}%`}>
                  <div className="h-full bg-gradient-to-r from-orange-600 to-red-500 transition-all duration-150" style={{ width: `${(gameState.hardHeat / heatCap) * 100}%` }} />
              </div>
              <div className={`text-[10px] font-bold tracking-widest ${inClutchZone ? 'text-red-400 animate-pulse' : 'text-noir-600'}`}>
                  {isPushing
                      ? `PUSH x${getPushMultiplier(gameState.hardPushLevel, false)} • NO WARDS • ${currentGoal - gameState.streak} TO GO`
                      : inClutchZone ? `CLUTCH ZONE • ${currentGoal - gameState.streak} TO GO` : `CLUTCH ZONE AT ${clutchZoneStart}`}
              </div>
              <div className="flex items-center justify-between w-full gap-2">
                  <div className={`flex items-center gap-1 ${isPushing ? 'opacity-30' : ''}`} title={isPushing ? 'Wards do not work during a Push' : 'Wards absorb a Tails in the clutch zone'}>
                      {Array.from({ length: wardCap }).map((_, i) => (
                          <Shield key={i} size={16} className={i < gameState.wardsHeld ? 'text-sky-400 fill-sky-400/30' : 'text-noir-700'} />
                      ))}
                  </div>
                  <div className="flex items-center gap-1">
                      {canBuyCharge ? (
                          <button onClick={buyInjectionCharge} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold border border-purple-600 text-purple-200 hover:bg-purple-950/50 cursor-pointer" title="Buy a Void Injection charge">
                              <Syringe size={12} /> BUY · {injectionCost} VF
                          </button>
                      ) : (
                          <button onClick={fireInjection} disabled={!canInject(gameState)} className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold border transition-colors ${injecting ? 'border-red-500 text-red-300 bg-red-950/50 animate-pulse' : canInject(gameState) ? 'border-red-700 text-red-300 hover:bg-red-950/50 cursor-pointer' : 'border-noir-800 text-noir-600 cursor-not-allowed'}`} title={`Void Injection: +${Math.round(INJECTION_BOOST * 100)}% for ${INJECTION_FLIPS} flips, past the cap. Usable in the Clutch Zone and during a Push.`}>
                              <Syringe size={12} /> {injecting ? `${gameState.injectionFlipsLeft} LEFT` : charges === 0 ? 'NO CHARGES' : canInject(gameState) ? `INJECT (${charges})` : `(${charges}) ZONE ONLY`}
                          </button>
                      )}
                      <button onClick={toggleAutoInject} className={`px-2 py-1 text-[10px] font-bold border transition-colors cursor-pointer ${gameState.autoInjectEnabled ? 'border-red-700 text-red-300 bg-red-950/30' : 'border-noir-700 text-noir-500 hover:text-white'}`} title="Auto-inject on clutch zone entry, after a Ward breaks, and when a Push starts">
                          AUTO-INJECT {gameState.autoInjectEnabled ? 'ON' : 'OFF'}
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  // Shared by the hard mode prompt and the in-game rules modal
  const renderHardModeRules = () => (
      <ul className="text-left text-sm font-mono text-noir-400 space-y-2 bg-black/50 p-4 border border-noir-800">
          <li className="flex items-start gap-2"><span className="text-red-500">-</span> Upgrades cap at {Math.round(HARD_BASE_CAP * 100)}% probability</li>
          <li className="flex items-start gap-2"><span className="text-red-500">-</span> Win Streak Requirement: {getHardGoal(gameState.stats.hardModeWins)} (+{HARD_GOAL_STEP} per Hard Win)</li>
          <li className="flex items-start gap-2"><span className="text-green-500">+</span> Heat: each Heads in a row adds +{HEAT_PER_HEADS}% (up to +{getHeatCap(gameState.upgrades)}%). A Tails wipes it.</li>
          <li className="flex items-start gap-2"><span className="text-green-500">+</span> Clutch Zone = the last {getClutchZoneSize(getHardGoal(gameState.stats.hardModeWins))} Heads (it grows with the goal). Wards ($) each save one Tails there, but not during a Push.</li>
          <li className="flex items-start gap-2"><span className="text-green-500">+</span> Void Injection ({injectionCost} VF a charge): +{Math.round(INJECTION_BOOST * 100)}% for {INJECTION_FLIPS} flips, past the cap. Usable in the Clutch Zone and during a Push. Nothing goes above {Math.round(HARD_CHANCE_CEILING * 100)}%.</li>
          <li className="flex items-start gap-2"><span className="text-green-500">+</span> At the goal: Bank the win, or Push {PUSH_STEP} more Heads for double rewards. A bust pays no Resolve.</li>
          <li className="flex items-start gap-2"><span className="text-green-500">+</span> Every 10-streak pays VF. Hard wins pay Resolve, which buys permanent upgrades in The Abyss.</li>
          <li className="flex items-start gap-2"><span className="text-green-500">+</span> Permanent 10x Cash Multiplier</li>
      </ul>
  );

  // Hard mode win screen: what banking pays now vs. what a push risks
  const bankedGoal = gameState.hardPushBust ? currentGoal - PUSH_STEP : currentGoal;
  const hardRewards = getHardWinRewards(gameState.stats.hardModeWins, gameState.hardPushLevel, gameState.hardPushBust);
  const canPush = hasWon && gameState.isHardMode && !gameState.hardPushBust && gameState.hardPushLevel < MAX_PUSHES;
  const pushOdds = canPush ? getPushSuccessChance(gameState) : 0;
  // With auto-inject off the player can still inject by hand once the Push starts
  const pushOddsIfInjected = canPush && !gameState.autoInjectEnabled ? getPushSuccessChance(gameState, true) : pushOdds;
  const pushRewards = getHardWinRewards(gameState.stats.hardModeWins, gameState.hardPushLevel + 1, false);
  const bustRewards = getHardWinRewards(gameState.stats.hardModeWins, gameState.hardPushLevel + 1, true);

  // Whether any blocking overlay is visible (prevents stray clicks from flipping)
  const anyModalOpen =
    showModal ||
    showLeaderboard ||
    showMomModal.show ||
    showHardModePrompt ||
    showRetreatConfirm ||
    showHardRules ||
    showTitleSelector;
  modalOpenRef.current = anyModalOpen;

  return (
    <div className={`min-h-screen md:h-screen md:overflow-hidden overflow-y-auto bg-noir-950 text-noir-200 font-sans flex flex-col md:flex-row relative transition-colors duration-200 ${celebration && celebration.level >= 8 ? 'bg-noir-900' : ''}`}>
      
      <div className="bg-noise pointer-events-none fixed inset-0 z-0" />
      <div className="bg-vignette pointer-events-none fixed inset-0 z-0" />
      <ConfettiSystem streak={gameState.streak} isRichMode={gameState.money > 1e6 && gameState.activeTitle === 'RICH'} activeTitle={gameState.activeTitle} momPurchases={gameState.stats.momPurchases} partyPooperEnabled={gameState.partyPooperEnabled} maxBurst={gameState.isHardMode ? HARD_CONFETTI_BURST : undefined} maxParticles={gameState.isHardMode ? HARD_CONFETTI_MAX : undefined} alwaysClearOnReset={gameState.isHardMode} />

      {/* Party Pooper dark overlay */}
      {gameState.partyPooperEnabled && (gameState.upgrades[UpgradeType.PRESTIGE_PARTY_POOPER] || 0) > 0 && (
        <div className="fixed inset-0 bg-black/30 pointer-events-none z-[55] transition-opacity duration-500" />
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

      {!isFundsVisible && (
        <div className="fixed top-4 right-4 z-[70] md:hidden animate-fade-in pointer-events-none">
             <div className="px-4 py-2 bg-noir-900/90 border border-amber-500/40 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md flex items-center gap-2">
                <span className="text-[10px] text-noir-400 font-mono uppercase tracking-widest">Funds</span>
                <span className="text-amber-400 font-mono font-bold text-sm">{formatMoney(gameState.money)}</span>
            </div>
        </div>
      )}

      {/* ── Title selector modal ───────────────────────────────────────────── */}
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
      
      {/* ── Hard mode prompt modal ─────────────────────────────────────────── */}
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
                  <div className="mb-4">{renderHardModeRules()}</div>
                  <p className="text-[10px] text-noir-500 font-mono uppercase tracking-widest mb-6">{hasWon ? 'Ascends into Hard Mode' : 'Restarts this run without rewards'} • Retreat anytime from the skull</p>
                  <div className="flex gap-4">
                      <button onClick={closeHardModePrompt} className="flex-1 py-3 border border-noir-700 text-noir-500 hover:bg-noir-900 hover:text-white transition-colors font-mono">DECLINE</button>
                      <button onClick={enableHardMode} className="flex-1 py-3 bg-red-900/50 border border-red-600 text-red-100 hover:bg-red-800 transition-colors font-mono font-bold tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)]">{hasWon ? 'ENABLE & ASCEND' : 'ENABLE & RESTART'}</button>
                  </div>
              </div>
          </div>
      )}

      {/* ── Hard mode rules (from the ? in the HUD) ─────────────────────────── */}
      {showHardRules && (
          <div data-no-flip className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-fade-in" onClick={() => setShowHardRules(false)}>
              <div className="max-w-lg w-full bg-noir-950 border border-red-900 p-6 md:p-8" onClick={e => e.stopPropagation()}>
                  <h2 className="text-2xl font-mono font-bold text-white mb-4 flex items-center gap-2"><Skull size={22} className="text-red-500" /> THE GAUNTLET</h2>
                  {renderHardModeRules()}
                  <button onClick={() => setShowHardRules(false)} className="mt-6 w-full py-3 border border-noir-700 text-noir-300 hover:bg-noir-900 hover:text-white transition-colors font-mono">GOT IT</button>
              </div>
          </div>
      )}

      {/* ── Clutch pause: fixed so it is on screen on phones too ──────────────── */}
      {isClutchPaused && gameState.isHardMode && !hasWon && (
          <div data-no-flip className="fixed inset-x-0 bottom-24 z-[95] flex justify-center px-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-[380px] flex items-center justify-between gap-3 border border-red-600 bg-red-950/95 px-4 py-3 shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-pop-in-up font-mono">
                  <span className="text-xs font-bold text-red-100 tracking-wider">CLUTCH ZONE! INJECT NOW?</span>
                  <div className="flex gap-2 shrink-0">
                      <button onClick={fireInjection} className="px-3 py-2 text-xs font-bold border border-red-400 text-white bg-red-800/60 hover:bg-red-700 cursor-pointer">INJECT</button>
                      <button onClick={() => setClutchPauseUntil(0)} className="px-3 py-2 text-xs font-bold border border-noir-500 text-noir-200 hover:text-white cursor-pointer">SAVE CHARGE</button>
                  </div>
              </div>
          </div>
      )}

      {/* ── Retreat from hard mode ─────────────────────────────────────────── */}
      {showRetreatConfirm && (
          <div data-no-flip className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-fade-in" onClick={() => setShowRetreatConfirm(false)}>
              <div className="max-w-md w-full bg-noir-950 border border-red-900 p-8 text-center" onClick={e => e.stopPropagation()}>
                  <LogOut size={40} className="text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-mono font-bold text-white mb-4">RETREAT?</h2>
                  <p className="text-noir-300 font-mono text-sm mb-6 leading-relaxed">
                      Abandon this run and return to normal mode. No rewards for this run.
                      <br/><br/>
                      <span className="text-noir-400">You keep your Hard Wins, Resolve, Abyss upgrades and Void Injection charges.</span>
                  </p>
                  <div className="flex gap-4">
                      <button onClick={() => setShowRetreatConfirm(false)} className="flex-1 py-3 border border-noir-700 text-noir-500 hover:bg-noir-900 hover:text-white transition-colors font-mono">STAY</button>
                      <button onClick={confirmRetreat} className="flex-1 py-3 bg-red-900/50 border border-red-600 text-red-100 hover:bg-red-800 transition-colors font-mono font-bold tracking-widest">RETREAT</button>
                  </div>
              </div>
          </div>
      )}

      {celebration && (
        <div className={`pointer-events-none fixed inset-0 z-[90] flex items-center justify-center flex-col overflow-hidden`}>
            {celebration.level >= 5 && !gameState.partyPooperEnabled && <div className="absolute inset-0 bg-white/20 animate-flash mix-blend-overlay"></div>}
            <div className={`${celebration.level >= 8 ? 'animate-shake' : ''} flex flex-col items-center justify-center px-4`}>
                <h2 key={celebration.id} className={`font-mono font-bold text-center transition-transform duration-300 max-w-[90vw] break-words leading-tight ${celebration.tone
                    ? `text-5xl md:text-7xl animate-pop-up ${celebration.tone === 'ward' ? 'text-sky-300 drop-shadow-[0_0_15px_rgba(56,189,248,0.7)]' : 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.7)]'}`
                    : `drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] ${celebration.level >= 9 ? 'text-7xl md:text-9xl text-amber-500 animate-scale-slam' : celebration.level >= 5 ? 'text-6xl md:text-8xl text-amber-400 animate-pop-up' : 'text-4xl md:text-6xl text-amber-200/80 animate-pop-in-up'}`}`}>
                    {celebration.text}
                </h2>
                <div className={`mt-2 md:mt-4 font-mono font-bold text-white/90 uppercase text-center ${celebration.tone ? 'tracking-[0.3em] text-sm md:text-lg' : `tracking-[0.5em] md:tracking-[1em] ${celebration.level >= 7 ? 'text-2xl animate-pulse' : 'text-sm'}`}`}>{celebration.sub ?? `${celebration.level}x STREAK`}</div>
            </div>
        </div>
      )}
      
      {/* ── Mom modal ─────────────────────────────────────────────────────── */}
      {showMomModal.show && (
          <div data-no-flip className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6 animate-fade-in">
              <div className="max-w-md w-full text-center space-y-8">
                  <div className="mx-auto w-24 h-24 rounded-full bg-pink-500/20 flex items-center justify-center mb-6 animate-pulse"><Heart size={48} className="text-pink-400" /></div>
                  <h3 className="text-3xl font-mono font-bold text-white mb-4">A Message for You</h3>
                  <button onClick={handleMomConfirm} className="text-xl md:text-2xl font-serif italic text-pink-300 hover:text-pink-100 transition-colors cursor-pointer border-b border-transparent hover:border-pink-500 pb-1">"{showMomModal.text}"</button>
              </div>
          </div>
      )}

      {/* ── Main game panel (click anywhere here to flip) ─────────────────── */}
      <div
        className="flex-1 flex flex-col relative min-h-[600px] md:min-h-0 z-10"
        onClick={anyModalOpen ? undefined : handleGameAreaClick}
      >
        <header className="p-6 border-b border-noir-800/50 flex justify-between items-end bg-noir-950/30 backdrop-blur-sm relative z-50">
            <div>
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl font-mono font-bold tracking-tighter text-white drop-shadow-md">BEAT THE <span className="text-amber-500">ODDS</span></h1>
                    {gameState.isHardMode && (
                        <div className="flex items-center gap-2 text-red-500 font-mono text-xs font-bold border border-red-900/50 bg-red-950/20 px-2 py-1 rounded animate-pulse-slow pointer-events-none">
                            <Skull size={14} /> HARD MODE
                        </div>
                    )}
                </div>
                <div className="flex gap-6 mt-3 text-sm font-mono text-noir-400">
                    <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-noir-600 mb-0.5">Current Streak</span><div className="flex items-baseline gap-1"><span className={`text-2xl font-bold leading-none ${gameState.streak > 0 ? 'text-amber-500' : 'text-noir-500'}`}>{gameState.streak}</span><span className="text-noir-600">/ {currentGoal}</span></div></div>
                    <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-noir-600 mb-0.5">Run Best</span><span className={`text-2xl font-bold leading-none ${gameState.maxStreak > 0 ? 'text-noir-300' : 'text-noir-500'}`}>{gameState.maxStreak}</span></div>
                    {gameState.prestigeLevel > 0 && (<div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-purple-400 mb-0.5">Prestige</span><span className="text-2xl font-bold leading-none text-purple-300">{gameState.prestigeLevel}</span></div>)}
                </div>
            </div>
            <div className="text-right" ref={headerFundsRef}>
                <span className="text-[10px] uppercase tracking-widest text-noir-600 block mb-1">Funds</span>
                <span className="text-4xl font-mono font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{formatMoney(gameState.money)}</span>
            </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center relative z-10 py-10 md:py-0">
            {hasWon ? (
                <div className="text-center animate-fade-in space-y-4 md:space-y-6 bg-noir-900/90 p-6 md:p-12 border-2 border-amber-500/30 rounded-xl backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden group max-w-lg mx-4">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    {gameState.hardPushBust
                        ? <Skull className="w-16 h-16 md:w-24 md:h-24 text-red-500 mx-auto mb-2 md:mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                        : <Trophy className="w-16 h-16 md:w-24 md:h-24 text-amber-500 mx-auto mb-2 md:mb-4 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-bounce" />}
                    <h2 className={`text-4xl md:text-5xl font-mono font-bold tracking-tight ${gameState.hardPushBust ? 'text-red-400' : 'text-white'}`}>{gameState.hardPushBust ? 'BUSTED.' : 'IMPOSSIBLE.'}</h2>
                    <div className="text-noir-300 font-mono leading-relaxed space-y-2">
                        <p>{gameState.hardPushBust ? 'Greed broke the streak. The win still counts.' : 'You defied the probability.'}</p>
                        <p className="text-amber-400 font-bold text-xl">{bankedGoal} Heads in a row.</p>
                        <div className="pt-4 border-t border-noir-800 mt-4">
                            <p className="text-sm">Total Attempts: {gameState.totalFlips.toLocaleString()}</p>
                            {gameState.isHardMode ? (
                                <p className="text-purple-400 font-bold text-lg mt-2 flex items-center justify-center gap-2 flex-wrap">
                                    <Sparkles size={16} /> REWARD: {hardRewards.voidFragments} VF + <span className="text-red-400">{hardRewards.resolve} RESOLVE</span>
                                    {(gameState.hardPushLevel > 0 || gameState.hardPushBust) && <span className={`text-xs ${gameState.hardPushBust ? 'text-red-500' : 'text-amber-400'}`}>(x{getPushMultiplier(gameState.hardPushLevel, gameState.hardPushBust)})</span>}
                                </p>
                            ) : (
                                <p className="text-purple-400 font-bold text-lg mt-2 flex items-center justify-center gap-2"><Sparkles size={16} /> REWARD: {FRAGMENTS_PER_WIN} VOID FRAGMENTS</p>
                            )}
                        </div>
                    </div>
                    {gameState.isHardMode ? (
                        <div className="flex flex-col gap-3 pt-4 relative z-50">
                            {canPush && (
                                <button onClick={pushOnward} className="w-full px-3 md:px-6 py-3 bg-red-950/60 border border-red-600 text-red-100 font-mono font-bold tracking-wider md:tracking-widest hover:bg-red-900/70 transition-all duration-300 flex flex-col items-center gap-1">
                                    <span className="flex items-center gap-2"><Flame size={18} /> PUSH +{PUSH_STEP} HEADS · x{getPushMultiplier(gameState.hardPushLevel + 1, false)}</span>
                                    <span className="text-xs font-normal tracking-wide text-red-200">{(pushOdds * 100).toFixed(0)}% odds{pushOddsIfInjected > pushOdds ? ` (${(pushOddsIfInjected * 100).toFixed(0)}% if you inject)` : ''} • win {pushRewards.voidFragments} VF + {pushRewards.resolve} Resolve • bust {bustRewards.voidFragments} VF + {bustRewards.resolve} Resolve</span>
                                </button>
                            )}
                            <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider">
                                <span className="text-noir-500">Next run:</span>
                                <button onClick={() => setAscendToHard(true)} className={`px-3 py-2 border cursor-pointer ${ascendToHard ? 'border-red-500 text-red-300 bg-red-950/40' : 'border-noir-700 text-noir-500 hover:text-white'}`}>Hard (goal {getHardGoal(gameState.stats.hardModeWins + 1)})</button>
                                <button onClick={() => setAscendToHard(false)} className={`px-3 py-2 border cursor-pointer ${!ascendToHard ? 'border-amber-500 text-amber-300 bg-amber-950/40' : 'border-noir-700 text-noir-500 hover:text-white'}`}>Normal</button>
                            </div>
                            <button onClick={toggleAutoBank} className={`text-[11px] font-mono uppercase tracking-wider cursor-pointer ${gameState.autoBankEnabled ? 'text-amber-300' : 'text-noir-500 hover:text-white'}`}>
                                {gameState.autoBankEnabled ? `Auto-bank ON: banking in ${AUTO_BANK_DELAY_MS / 1000}s (tap to turn off)` : 'Auto-bank future wins: OFF'}
                            </button>
                            <button onClick={() => ascend(ascendToHard)} className="w-full px-3 md:px-8 py-4 bg-purple-600 text-white font-mono font-bold tracking-wider md:tracking-widest hover:bg-purple-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/40 transform hover:-translate-y-1 flex items-center justify-center gap-3"><Sparkles size={20} /> {canPush ? 'BANK & ASCEND' : 'ASCEND'} → {ascendToHard ? 'HARD' : 'NORMAL'}</button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 pt-4 relative z-50">
                            <button onClick={() => ascend()} className="w-full px-8 py-4 bg-purple-600 text-white font-mono font-bold tracking-widest hover:bg-purple-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/40 transform hover:-translate-y-1 flex items-center justify-center gap-3"><Sparkles size={20} /> ASCEND (NEW GAME+)</button>
                            <p className="text-[10px] text-noir-500 font-mono uppercase tracking-widest">Resets progress • Keeps Prestige Upgrades • Increases Difficulty? No, just Profit.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className={`flex flex-col items-center w-full max-w-md z-10 ${gameState.isHardMode ? 'gap-8 md:gap-16' : 'gap-16'}`}>
                    <div className="relative w-64 h-64 perspective-1000 flex items-center justify-center">
                        <div className="absolute bottom-10 w-32 h-4 bg-black/40 blur-xl rounded-[100%]" style={{ animation: isFlipping ? `shadowScale ${Math.max(1, UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]) - (UPGRADES[UpgradeType.PRESTIGE_FLUX].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0) * 250))}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none' }}></div>
                        <div className="w-48 h-48 relative preserve-3d" style={{ animation: isFlipping ? `tossHeight ${Math.max(1, UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]) - (UPGRADES[UpgradeType.PRESTIGE_FLUX].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0) * 250))}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none' }}>
                            <div className="w-full h-full relative preserve-3d" style={{ animation: isFlipping ? `tossSpin ${Math.max(1, UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]) - (UPGRADES[UpgradeType.PRESTIGE_FLUX].getEffect(gameState.upgrades[UpgradeType.PRESTIGE_FLUX] || 0) * 250))}ms linear infinite` : 'none', transform: !isFlipping && coinSide ? (coinSide === 'T' ? 'rotateX(180deg)' : 'rotateX(0deg)') : undefined }}>
                                <div className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 shadow-inner border-4 border-amber-600 flex items-center justify-center overflow-hidden" style={{ transform: 'rotateX(0deg)' }}><div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div><span className="text-8xl font-serif font-bold text-amber-950 mix-blend-overlay drop-shadow-md relative z-10">$</span></div>
                                <div className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 shadow-inner border-4 border-slate-500 flex items-center justify-center overflow-hidden" style={{ transform: 'rotateX(180deg)' }}><div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div><div className="relative w-full h-full z-10 opacity-70"><div className="absolute top-[35%] left-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div><div className="absolute top-[35%] right-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div><div className="absolute top-[52%] left-1/2 -translate-x-1/2 w-[55%] h-[35%] border-t-[10px] border-slate-900 rounded-[50%] mix-blend-overlay"></div></div></div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-6 items-center">
                        <button onClick={() => handleFlip(false)} disabled={isFlipping} className={`group relative w-full max-w-[240px] py-5 text-xl font-mono font-bold tracking-[0.2em] border transition-all duration-200 overflow-hidden z-20 cursor-pointer ${isFlipping ? 'border-noir-800 text-noir-700 bg-black cursor-not-allowed scale-95' : 'border-white text-white bg-transparent hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95'}`}><span className="relative z-10">{isFlipping ? 'FLIPPING...' : 'FLIP COIN'}</span></button>
                        <div className="flex flex-col items-center gap-1">
                             <div className="text-[10px] uppercase tracking-widest text-noir-500">Probability</div>
                             <div className="font-mono text-amber-500 text-lg font-bold flex items-center gap-2">{(currentChance * 100).toFixed(0)}%{gameState.injectionFlipsLeft > 0 && <Syringe size={14} className="text-red-500 animate-pulse" />}{gameState.isHardMode && currentChance >= HARD_CHANCE_CEILING && <span className="text-[10px] text-red-400 border border-red-800 px-1" title="The hard mode ceiling">MAX</span>}</div>
                             {!gameState.isHardMode && (gameState.upgrades[UpgradeType.PRESTIGE_FATE] || 0) > 0 && <div className="text-[10px] text-purple-400 font-mono">(+{((gameState.upgrades[UpgradeType.PRESTIGE_FATE] || 0) * 2.5).toFixed(0)}% Base)</div>}
                             {gameState.isHardMode && renderGauntletHud()}
                        </div>
                    </div>
                </div>
            )}
        </main>

        <footer className="h-20 bg-noir-950/80 backdrop-blur-md border-t border-noir-800/50 flex items-center justify-between px-6 relative z-50">
            <div className="flex gap-3 overflow-hidden mask-linear-fade items-center">
                <span className="text-[10px] uppercase tracking-widest text-noir-700 mr-2">History</span>
                {gameState.history.map((res, i) => (
                    <div key={i} className={`w-8 h-8 flex items-center justify-center font-mono font-bold rounded-sm text-xs shadow-lg transition-transform hover:scale-110 cursor-default ${res === 'H' ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white border border-amber-400' : res === 'W' ? 'bg-gradient-to-b from-sky-700 to-sky-900 text-sky-200 border border-sky-500' : 'bg-gradient-to-b from-noir-700 to-noir-800 text-noir-400 border border-noir-600'}`}>{res === 'H' ? '$' : res === 'W' ? <Shield size={14} /> : <span className="rotate-90 inline-block text-[8px] tracking-tighter font-sans scale-y-150 transform-gpu">:(</span>}</div>
                ))}
            </div>
            
            <div className="flex gap-4">
                 {gameState.isHardMode ? !hasWon && gameState.hardPushLevel === 0 && (
                    <button onClick={() => setShowRetreatConfirm(true)} className="p-2 text-red-500 hover:text-white transition-colors hover:bg-red-950 rounded-full cursor-pointer" title="Retreat from Hard Mode">
                        <Skull size={20} />
                    </button>
                 ) : (gameState.prestigeLevel >= 50 || gameState.stats.hardModeWins > 0) && (
                    <button onClick={() => setShowHardModePrompt(true)} className="p-2 text-noir-500 hover:text-red-500 transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title="Enable Hard Mode">
                        <Skull size={20} />
                    </button>
                 )}
                 {/* ── Leaderboard button: visible once the player has ever won ── */}
                 {(gameState.playerName || hasEverWon) && (
                     <button onClick={() => setShowLeaderboard(true)} className="p-2 text-amber-500 hover:text-white transition-colors hover:bg-amber-900/50 rounded-full cursor-pointer animate-fade-in" title="Leaderboard"><List size={20} /></button>
                 )}
                 <button onClick={toggleMute} className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
                 <button onClick={() => setShowModal(true)} className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer" title="Math Analysis"><HelpCircle size={20} /></button>
                 <button onClick={handleDeleteClick} className={`p-2 transition-colors rounded-full font-mono text-xs flex items-center justify-center cursor-pointer w-9 h-9 ${deleteConfirm ? 'bg-red-900 text-white hover:bg-red-800 ring-1 ring-red-500' : 'text-noir-500 hover:text-red-500 hover:bg-noir-900'}`} title="Delete Save & Reset">{deleteConfirm ? '!' : <Trash2 size={20} />}</button>
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
        resolve={gameState.resolve}
        wardsHeld={gameState.wardsHeld}
        isPushing={gameState.hardPushLevel > 0}
      />

      <div className="relative z-[100]">
        <ProbabilityModal isOpen={showModal} onClose={() => setShowModal(false)} currentChance={currentChance} />
        <LeaderboardModal 
            isOpen={showLeaderboard} 
            onClose={() => setShowLeaderboard(false)} 
            playerName={gameState.playerName} 
            onRegisterName={registerName} 
            currentStats={{ purist: gameState.stats.puristWins, prestige: gameState.stats.maxPrestigeLevel, rich: gameState.stats.highestCash, mommy: gameState.stats.momPurchases }}
            onSubmitRun={handleManualSubmit}
        />
      </div>
      <style>{`.rotate-x-180 { transform: rotateX(180deg); } .mask-linear-fade { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); } @keyframes popInUp { 0% { opacity: 0; transform: translateY(20px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } } .animate-pop-in-up { animation: popInUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; } @keyframes popUp { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } } .animate-pop-up { animation: popUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; } @keyframes scaleSlam { 0% { opacity: 0; transform: scale(5); } 60% { opacity: 1; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } } .animate-scale-slam { animation: scaleSlam 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; } @keyframes flash { 0%, 100% { opacity: 0; } 10%, 90% { opacity: 1; } } .animate-flash { animation: flash 0.3s ease-out forwards; } @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px) rotate(-1deg); } 20%, 40%, 60%, 80% { transform: translateX(5px) rotate(1deg); } } .animate-shake { animation: shake 0.5s ease-in-out; } @keyframes particle { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--tw-translate-x, 100px), var(--tw-translate-y, 100px)) scale(0); opacity: 0; } } .animate-particle { animation: particle 1s ease-out forwards; }`}</style>
    </div>
  );
};

export default App;
