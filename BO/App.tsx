import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, UpgradeType, WINNING_STREAK, FRAGMENTS_PER_WIN } from './types';
import { UPGRADES } from './constants';
import Shop from './components/Shop';
import ProbabilityModal from './components/ProbabilityModal';
import ConfettiSystem from './components/ConfettiSystem';
import { AudioService } from './services/audioService';
import { HelpCircle, Trash2, Trophy, Volume2, VolumeX, Sparkles, AlertCircle, Heart } from 'lucide-react';

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
  "ONE MORE"
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
    [UpgradeType.PRESTIGE_EDGING]: 0,
    [UpgradeType.PRESTIGE_LIMITLESS]: 0,
    [UpgradeType.PRESTIGE_MOM]: 0,
  },
  history: [],
  prestigeLevel: 0,
  voidFragments: 0,
};

const SAVE_KEY = 'beatTheOdds_save';
const SEEN_COMPLIMENTS_KEY = 'beatTheOdds_seen_compliments';

const App: React.FC = () => {
  // --- State ---
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
        return parsed;
      }
    } catch (e) {
      console.error("Failed to load save", e);
    }
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  });

  const [isFlipping, setIsFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState<'H' | 'T' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showMomModal, setShowMomModal] = useState<{show: boolean, text: string}>({show: false, text: ""});
  const [hasWon, setHasWon] = useState(false);
  const [celebration, setCelebration] = useState<{text: string, level: number, id: number} | null>(null);
  const [muted, setMuted] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const flipTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);

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

  // --- Actions ---

  const handleFlip = useCallback((forceHeads: boolean = false) => {
    const isDebug = typeof forceHeads === 'boolean' && forceHeads === true;

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
            // Formula: Base * (1 + (Streak * ComboBonus))
            earned = Math.floor(currentBaseValue * (newStreak > 1 ? (1 + (newStreak * (currentCombo - 1))) : 1));
        } else {
            // Passive Income Calculation (Standard + Prestige)
            const passiveLevel = prev.upgrades[UpgradeType.PASSIVE_INCOME] || 0;
            const standardPassive = UPGRADES[UpgradeType.PASSIVE_INCOME].getEffect(passiveLevel);
            
            const voidPassiveLevel = prev.upgrades[UpgradeType.PRESTIGE_PASSIVE] || 0;
            const voidPassive = UPGRADES[UpgradeType.PRESTIGE_PASSIVE].getEffect(voidPassiveLevel);
            
            if (standardPassive > 0 || voidPassive > 0) {
                earned = standardPassive + voidPassive;
            }
        }
        
        // Edging Multiplier
        const edgingLevel = prev.upgrades[UpgradeType.EDGING] || 0;
        const voidEdgingLevel = prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0;
        
        if (edgingLevel > 0 || voidEdgingLevel > 0) earned *= 10;
        
        // Apply Prestige Multiplier
        earned = Math.floor(earned * prestigeMultiplier);
        
        const newMaxStreak = Math.max(prev.maxStreak, newStreak);
        const won = newStreak >= WINNING_STREAK;
        
        if (won && !hasWon) {
           setTimeout(() => setHasWon(true), 500);
        }

        if (isHeads) {
             // Audio throttle
             if (currentSpeed > 50 || newStreak % 10 === 0) {
                 AudioService.playHeads(newStreak);
             }
            
            if (newStreak >= 2) {
                if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
                
                let message = CELEBRATION_MESSAGES[Math.min(newStreak, CELEBRATION_MESSAGES.length - 1)] || "GODLIKE";
                
                const autoFlipOwned = (prev.upgrades[UpgradeType.AUTO_FLIP] || 0) > 0 || (prev.upgrades[UpgradeType.PRESTIGE_AUTO] || 0) > 0;
                const passiveOwned = (prev.upgrades[UpgradeType.PASSIVE_INCOME] || 0) > 0 || (prev.upgrades[UpgradeType.PRESTIGE_PASSIVE] || 0) > 0;
                const edgingOwned = (prev.upgrades[UpgradeType.EDGING] || 0) > 0 || (prev.upgrades[UpgradeType.PRESTIGE_EDGING] || 0) > 0;

                if (newStreak === 3 && prev.maxStreak < 3 && !passiveOwned) message = "PASSIVE INCOME UNLOCKED";
                if (newStreak === 5 && prev.maxStreak < 5 && !autoFlipOwned) message = "AUTO FLIP UNLOCKED";
                if (newStreak === 9 && prev.maxStreak < 9 && !edgingOwned) message = "EDGING UNLOCKED";

                setCelebration({ text: message, level: newStreak, id: Date.now() });
                celebrationTimeoutRef.current = window.setTimeout(() => setCelebration(null), 2500);
            }
        } else {
             if (currentSpeed > 50) AudioService.playTails();
        }

        return {
          ...prev,
          money: prev.money + earned,
          streak: newStreak,
          maxStreak: newMaxStreak,
          totalFlips: prev.totalFlips + 1,
          history: [result as 'H'|'T', ...prev.history].slice(0, 10),
        };
      });

      setCoinSide(result);
      setIsFlipping(false);
    }, duration);

  }, [isFlipping, hasWon, currentChance, currentSpeed, currentBaseValue, currentCombo, prestigeMultiplier, showMomModal]);

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
      
      // If all seen, maybe reset or just pick random? Let's just pick random if exhausted.
      const pool = available.length > 0 ? available : COMPLIMENTS;
      const text = pool[Math.floor(Math.random() * pool.length)];

      setShowMomModal({ show: true, text });
      AudioService.playWin(); // Fanfare for the trap
  };

  const handleMomConfirm = () => {
      // 1. Record seen
      let seen: string[] = [];
      try {
          const s = localStorage.getItem(SEEN_COMPLIMENTS_KEY);
          if (s) seen = JSON.parse(s);
          if (!seen.includes(showMomModal.text)) {
              seen.push(showMomModal.text);
              localStorage.setItem(SEEN_COMPLIMENTS_KEY, JSON.stringify(seen));
          }
      } catch (e) { console.error(e); }

      // 2. Wipe Save
      localStorage.removeItem(SAVE_KEY);

      // 3. Visual glitch effect then reset
      setShowMomModal({ show: false, text: "" });
      
      // Just hard reset state
      setGameState(JSON.parse(JSON.stringify(INITIAL_STATE)));
      setHasWon(false);
      setCoinSide(null);
      setCelebration(null);
      window.location.reload(); // Hardest reset
  };

  const buyUpgrade = (type: UpgradeType, cost: number, isPrestige: boolean) => {
    // Intercept "Your Mom" upgrade
    if (type === UpgradeType.PRESTIGE_MOM) {
        if (gameState.money >= cost) {
            setGameState(prev => ({
                ...prev,
                money: prev.money - cost
            }));
            triggerMomEvent();
        }
        return;
    }

    if (isPrestige) {
        if (gameState.voidFragments >= cost) {
            setGameState(prev => {
                let extraMoney = 0;
                // Immediate payout for Karma Upgrade
                if (type === UpgradeType.PRESTIGE_KARMA) {
                    const currentLevel = prev.upgrades[type] || 0;
                    const nextLevel = currentLevel + 1;
                    const prevEffect = UPGRADES[type].getEffect(currentLevel);
                    const nextEffect = UPGRADES[type].getEffect(nextLevel);
                    extraMoney = nextEffect - prevEffect;
                }

                if (extraMoney > 0) {
                     AudioService.playFlip(); 
                }

                return {
                    ...prev,
                    voidFragments: prev.voidFragments - cost,
                    money: prev.money + extraMoney,
                    upgrades: {
                        ...prev.upgrades,
                        [type]: (prev.upgrades[type] || 0) + 1
                    }
                };
            });
        }
    } else {
        if (gameState.money >= cost) {
            setGameState(prev => ({
                ...prev,
                money: prev.money - cost,
                upgrades: {
                    ...prev.upgrades,
                    [type]: (prev.upgrades[type] || 0) + 1
                }
            }));
        }
    }
  };

  // HARD RESET (Delete Save)
  const hardReset = () => {
    localStorage.removeItem(SAVE_KEY);
    setGameState(JSON.parse(JSON.stringify(INITIAL_STATE)));
    setHasWon(false);
    setCoinSide(null);
    setCelebration(null);
    setDeleteConfirm(false);
  };

  // ASCEND (Prestige Reset)
  const ascend = () => {
      // 1. Calculate Start Money based on Karma
      const karmaLevel = gameState.upgrades[UpgradeType.PRESTIGE_KARMA] || 0;
      const startMoney = UPGRADES[UpgradeType.PRESTIGE_KARMA].getEffect(karmaLevel);

      // 2. Preserve Prestige Upgrades
      const prestigeUpgrades: Record<string, number> = {};
      Object.keys(gameState.upgrades).forEach(key => {
          const k = key as UpgradeType;
          if (UPGRADES[k].isPrestige) {
              prestigeUpgrades[k] = gameState.upgrades[k];
          } else {
              prestigeUpgrades[k] = 0;
          }
      });

      // 3. New State
      // SCALING VOID REWARDS: Base + (PrestigeLevel * 5)
      const voidReward = FRAGMENTS_PER_WIN + (gameState.prestigeLevel * 5);

      const nextState: GameState = {
          ...INITIAL_STATE,
          money: startMoney,
          prestigeLevel: gameState.prestigeLevel + 1,
          voidFragments: gameState.voidFragments + voidReward,
          upgrades: prestigeUpgrades as Record<UpgradeType, number>,
          totalFlips: 0, 
      };

      setGameState(nextState);
      setHasWon(false);
      setCoinSide(null);
      setCelebration(null);
  };

  const handleDeleteClick = () => {
    if (deleteConfirm) {
        hardReset();
    } else {
        setDeleteConfirm(true);
        deleteTimeoutRef.current = window.setTimeout(() => setDeleteConfirm(false), 3000);
    }
  };

  const toggleMute = () => {
      const newMuted = AudioService.toggleMute();
      setMuted(newMuted);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault(); 
            handleFlip(false);
        }
        // DEBUG KEYS
        if (e.code === 'KeyQ') {
            handleFlip(true); // Force Heads
            // DEBUG: Add Void Fragments
            setGameState(prev => ({ ...prev, voidFragments: prev.voidFragments + 5 }));
        }
        if (e.code === 'KeyZ') {
            // DEBUG: Add Money
            setGameState(prev => ({ ...prev, money: prev.money + 10000 }));
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip]);


  // --- Auto Flip Effect ---
  useEffect(() => {
    let timer: number;
    if (hasAutoFlip && !isFlipping && !hasWon && !showMomModal.show) {
        timer = window.setTimeout(() => handleFlip(false), 300);
    }
    return () => { if (timer) window.clearTimeout(timer); };
  }, [hasAutoFlip, isFlipping, hasWon, handleFlip, showMomModal]);


  useEffect(() => {
    return () => {
      if (flipTimeoutRef.current) window.clearTimeout(flipTimeoutRef.current);
      if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
      if (deleteTimeoutRef.current) window.clearTimeout(deleteTimeoutRef.current);
    };
  }, []);

  return (
    <div className={`min-h-screen md:h-screen md:overflow-hidden overflow-y-auto bg-noir-950 text-noir-200 font-sans selection:bg-amber-900 selection:text-white flex flex-col md:flex-row relative transition-colors duration-200 ${celebration && celebration.level >= 8 ? 'bg-noir-900' : ''}`}>
      
      {/* Visual Overlays */}
      <div className="bg-noise pointer-events-none fixed inset-0 z-0" />
      <div className="bg-vignette pointer-events-none fixed inset-0 z-0" />
      <ConfettiSystem streak={gameState.streak} />
      
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
                    ${gameState.money.toLocaleString()}
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
                                <Sparkles size={16} /> REWARD: {FRAGMENTS_PER_WIN + (gameState.prestigeLevel * 5)} VOID FRAGMENTS
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
      />

      <div className="relative z-[100]">
        <ProbabilityModal isOpen={showModal} onClose={() => setShowModal(false)} currentChance={currentChance} />
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