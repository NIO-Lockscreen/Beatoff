import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, UpgradeType, WINNING_STREAK } from './types';
import { UPGRADES } from './constants';
import Shop from './components/Shop';
import ProbabilityModal from './components/ProbabilityModal';
import { AudioService } from './services/audioService';
import { HelpCircle, Trash2, Trophy, Volume2, VolumeX } from 'lucide-react';

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
  },
  history: [],
};

const SAVE_KEY = 'beatTheOdds_save';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure upgrades object has the new key if loading old save
        if (typeof parsed.upgrades[UpgradeType.AUTO_FLIP] === 'undefined') {
            parsed.upgrades[UpgradeType.AUTO_FLIP] = 0;
        }
        return parsed;
      }
    } catch (e) {
      console.error("Failed to load save", e);
    }
    // Return a deep copy of INITIAL_STATE to avoid reference issues
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  });

  const [isFlipping, setIsFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState<'H' | 'T' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [celebration, setCelebration] = useState<{text: string, level: number, id: number} | null>(null);
  const [muted, setMuted] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const flipTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // --- Derived Values ---
  const currentChance = UPGRADES[UpgradeType.CHANCE].getEffect(gameState.upgrades[UpgradeType.CHANCE]);
  const currentSpeed = UPGRADES[UpgradeType.SPEED].getEffect(gameState.upgrades[UpgradeType.SPEED]);
  const currentCombo = UPGRADES[UpgradeType.COMBO].getEffect(gameState.upgrades[UpgradeType.COMBO]);
  const currentBaseValue = UPGRADES[UpgradeType.VALUE].getEffect(gameState.upgrades[UpgradeType.VALUE]);
  const hasAutoFlip = (gameState.upgrades[UpgradeType.AUTO_FLIP] || 0) > 0;

  // --- Actions ---

  const handleFlip = useCallback((forceHeads: boolean = false) => {
    // If called from an event handler, forceHeads might be an object, ignore it in that case
    const isDebug = typeof forceHeads === 'boolean' && forceHeads === true;

    if (isFlipping || hasWon) return;

    setIsFlipping(true);
    // Keep the previous side visual until the animation takes over
    AudioService.playFlip();

    const duration = currentSpeed;

    flipTimeoutRef.current = window.setTimeout(() => {
      // Probability Check
      let isHeads = Math.random() < currentChance;
      
      // Debug override
      if (isDebug) {
          isHeads = true;
      }

      const result = isHeads ? 'H' : 'T';

      setGameState(prev => {
        const newStreak = isHeads ? prev.streak + 1 : 0;
        const earned = isHeads 
          ? Math.floor(currentBaseValue * (newStreak > 1 ? (1 + (newStreak * (currentCombo - 1))) : 1))
          : 0;
        const newMaxStreak = Math.max(prev.maxStreak, newStreak);
        const won = newStreak >= WINNING_STREAK;
        
        if (won && !hasWon) {
           setTimeout(() => setHasWon(true), 500);
        }

        if (isHeads) {
            AudioService.playHeads(newStreak);
            
            // Trigger celebration for streaks 2+
            if (newStreak >= 2) {
                if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
                
                let message = CELEBRATION_MESSAGES[Math.min(newStreak, CELEBRATION_MESSAGES.length - 1)] || "GODLIKE";
                
                // Specific popup for streak 3
                if (newStreak === 3) {
                    message = "NEW STORE ITEM";
                }

                setCelebration({
                    text: message,
                    level: newStreak,
                    id: Date.now()
                });
                
                // Clear celebration after a short delay
                celebrationTimeoutRef.current = window.setTimeout(() => {
                    setCelebration(null);
                }, 2500);
            }
        } else {
            AudioService.playTails();
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

  }, [isFlipping, hasWon, currentChance, currentSpeed, currentBaseValue, currentCombo]);

  const buyUpgrade = (type: UpgradeType, cost: number) => {
    if (gameState.money >= cost) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - cost,
        upgrades: {
          ...prev.upgrades,
          [type]: prev.upgrades[type] + 1
        }
      }));
    }
  };

  const resetInternalState = () => {
    localStorage.removeItem(SAVE_KEY);
    // Deep copy INITIAL_STATE to ensure we have fresh references
    setGameState(JSON.parse(JSON.stringify(INITIAL_STATE)));
    setHasWon(false);
    setCoinSide(null);
    setCelebration(null);
    setDeleteConfirm(false);
  };

  const handleDeleteClick = () => {
    if (deleteConfirm) {
        resetInternalState();
    } else {
        setDeleteConfirm(true);
        // Auto-reset confirmation after 3 seconds
        deleteTimeoutRef.current = window.setTimeout(() => {
            setDeleteConfirm(false);
        }, 3000);
    }
  };

  const restartGame = () => {
    resetInternalState();
  };

  const toggleMute = () => {
      const newMuted = AudioService.toggleMute();
      setMuted(newMuted);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault(); // Prevent scrolling
            handleFlip(false);
        }
        if (e.code === 'KeyQ') {
            handleFlip(true); // Secret debug flip
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFlip]);


  // --- Auto Flip Effect ---
  useEffect(() => {
    let timer: number;
    if (hasAutoFlip && !isFlipping && !hasWon) {
        // Small delay to prevent instant loops and allow UI updates
        timer = window.setTimeout(() => {
            handleFlip(false);
        }, 300);
    }
    return () => {
        if (timer) window.clearTimeout(timer);
    };
  }, [hasAutoFlip, isFlipping, hasWon, handleFlip]);


  useEffect(() => {
    return () => {
      if (flipTimeoutRef.current) window.clearTimeout(flipTimeoutRef.current);
      if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
      if (deleteTimeoutRef.current) window.clearTimeout(deleteTimeoutRef.current);
    };
  }, []);

  return (
    <div className={`min-h-screen md:h-screen md:overflow-hidden overflow-y-auto bg-noir-950 text-noir-200 font-sans selection:bg-amber-900 selection:text-white flex flex-col md:flex-row relative transition-colors duration-200 ${celebration && celebration.level >= 8 ? 'bg-noir-900' : ''}`}>
      
      {/* Visual Overlays - Low Z-index */}
      <div className="bg-noise pointer-events-none fixed inset-0 z-0" />
      <div className="bg-vignette pointer-events-none fixed inset-0 z-0" />
      
      {/* Celebration Overlay - High Z-index */}
      {celebration && (
        <div className={`pointer-events-none fixed inset-0 z-[90] flex items-center justify-center flex-col overflow-hidden`}>
            {/* Flash Effect for high streaks */}
            {celebration.level >= 5 && (
                <div className="absolute inset-0 bg-white/20 animate-flash mix-blend-overlay"></div>
            )}
            
            {/* Shake Container */}
            <div className={`${celebration.level >= 8 ? 'animate-shake' : ''} flex flex-col items-center justify-center`}>
                <h2 
                    key={celebration.id} 
                    className={`
                        font-mono font-bold drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] text-center whitespace-nowrap
                        ${celebration.level >= 9 
                            ? 'text-7xl md:text-9xl text-amber-500 animate-scale-slam' 
                            : celebration.level >= 5 
                                ? 'text-6xl md:text-8xl text-amber-400 animate-pop-up' 
                                : 'text-4xl md:text-6xl text-amber-200/80 animate-pop-in-up'}
                    `}
                >
                    {celebration.text}
                </h2>
                <div className={`
                    mt-2 md:mt-4 font-mono font-bold tracking-[0.5em] md:tracking-[1em] text-white/90 uppercase
                    ${celebration.level >= 7 ? 'text-2xl animate-pulse' : 'text-sm'}
                `}>
                    {celebration.level}x STREAK
                </div>
            </div>
            
            {/* Particles */}
            {celebration.level >= 6 && (
                 <div className="absolute inset-0 overflow-hidden pointer-events-none">
                     {[...Array(20)].map((_, i) => (
                         <div 
                            key={i}
                            className="absolute w-1 h-1 bg-amber-400 rounded-full animate-particle"
                            style={{
                                left: `${50 + (Math.random() * 40 - 20)}%`,
                                top: `${50 + (Math.random() * 40 - 20)}%`,
                                animationDelay: `${Math.random() * 0.2}s`,
                                transform: `rotate(${Math.random() * 360}deg)`
                            }}
                         />
                     ))}
                 </div>
            )}
        </div>
      )}

      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-noir-900 via-noir-950 to-black animate-pulse-slow opacity-50"></div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col relative min-h-[600px] md:min-h-0 z-10">
        
        {/* Header / Stats */}
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
                        <span className="text-[10px] uppercase tracking-widest text-noir-600 mb-0.5">Best</span>
                        <span className="text-2xl font-bold leading-none text-noir-400">{gameState.maxStreak}</span>
                    </div>
                </div>
            </div>
            
            <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-noir-600 block mb-1">Funds</span>
                <span className="text-4xl font-mono font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                    ${gameState.money.toLocaleString()}
                </span>
            </div>
        </header>

        {/* Center Stage: The Coin */}
        <main className="flex-1 flex flex-col items-center justify-center relative z-10 py-10 md:py-0">
            
            {hasWon ? (
                <div className="text-center animate-fade-in space-y-6 bg-noir-900/80 p-12 border border-amber-500/20 rounded-xl backdrop-blur-md shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <Trophy className="w-20 h-20 text-amber-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                    <h2 className="text-5xl font-mono font-bold text-white tracking-tight">IMPOSSIBLE.</h2>
                    <p className="text-noir-300 max-w-md mx-auto font-mono leading-relaxed">
                        You defied the probability. <br/>
                        <span className="text-amber-400 font-bold">10 Heads</span> in a row. 
                        <br/><br/>
                        Total Attempts: {gameState.totalFlips.toLocaleString()}
                    </p>
                    <button 
                        onClick={restartGame}
                        className="px-8 py-3 bg-white text-black font-mono font-bold tracking-widest hover:bg-amber-400 transition-all duration-300 shadow-lg hover:shadow-amber-500/20 transform hover:-translate-y-1 relative z-50 cursor-pointer"
                    >
                        PLAY AGAIN
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-16 w-full max-w-md z-10">
                    
                    {/* Coin Container - 3D Perspective */}
                    <div className="relative w-64 h-64 perspective-1000 flex items-center justify-center">
                        
                        {/* Shadow - Animates scale */}
                        <div 
                           className="absolute bottom-10 w-32 h-4 bg-black/40 blur-xl rounded-[100%]"
                           style={{
                             animation: isFlipping ? `shadowScale ${currentSpeed}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none',
                           }}
                        ></div>

                        {/* Bouncing Wrapper (Y-axis translation) */}
                        <div 
                          className="w-48 h-48 relative preserve-3d"
                          style={{
                             animation: isFlipping ? `tossHeight ${currentSpeed}ms cubic-bezier(0.5, 0, 0.5, 1) forwards` : 'none',
                          }}
                        >
                            {/* Spinning Inner (X-axis rotation) */}
                            <div 
                                className="w-full h-full relative preserve-3d"
                                style={{ 
                                    animation: isFlipping ? `tossSpin ${currentSpeed}ms linear infinite` : 'none',
                                    transform: !isFlipping && coinSide ? (coinSide === 'T' ? 'rotateX(180deg)' : 'rotateX(0deg)') : undefined
                                }}
                            >
                                {/* Heads Side (Front) */}
                                <div className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 shadow-inner border-4 border-amber-600 flex items-center justify-center overflow-hidden">
                                    {/* Texture details */}
                                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                                    <div className="absolute inset-2 border-2 border-dashed border-amber-300/30 rounded-full"></div>
                                    {/* Updated to Dollar Sign */}
                                    <span className="text-8xl font-serif font-bold text-amber-950 mix-blend-overlay drop-shadow-md relative z-10">$</span>
                                    {/* Shine */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent rounded-full pointer-events-none"></div>
                                </div>
                                
                                {/* Tails Side (Back) - Pre-rotated to face back */}
                                <div 
                                    className="absolute inset-0 backface-hidden rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 shadow-inner border-4 border-slate-500 flex items-center justify-center overflow-hidden"
                                    style={{ transform: 'rotateX(180deg)' }}
                                >
                                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                                    <div className="absolute inset-2 border-2 border-dashed border-slate-300/30 rounded-full"></div>
                                    
                                    {/* Symmetrical Sad Smiley */}
                                    <div className="relative w-full h-full z-10 opacity-70">
                                        {/* Eyes */}
                                        <div className="absolute top-[35%] left-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div>
                                        <div className="absolute top-[35%] right-[28%] w-[14%] h-[14%] bg-slate-900 rounded-full mix-blend-overlay shadow-sm"></div>
                                        {/* Mouth: Semicircle with top border creates a perfect frown */}
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
                        </div>
                    </div>
                </div>
            )}
        </main>

        {/* Footer / Log - High Z-index to float above noise */}
        <footer className="h-20 bg-noir-950/80 backdrop-blur-md border-t border-noir-800/50 flex items-center justify-between px-6 relative z-50">
            <div className="flex gap-3 overflow-hidden mask-linear-fade items-center">
                <span className="text-[10px] uppercase tracking-widest text-noir-700 mr-2">History</span>
                {gameState.history.map((res, i) => (
                    <div 
                        key={i} 
                        className={`
                            w-8 h-8 flex items-center justify-center font-mono font-bold rounded-sm text-xs shadow-lg transition-transform hover:scale-110 cursor-default
                            ${res === 'H' 
                                ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white border border-amber-400' 
                                : 'bg-gradient-to-b from-noir-700 to-noir-800 text-noir-400 border border-noir-600'}
                        `}
                    >
                        {/* Display $ for Heads, :( for Tails */}
                        {res === 'H' ? '$' : (
                             <span className="rotate-90 inline-block text-[8px] tracking-tighter font-sans scale-y-150 transform-gpu">:(</span>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="flex gap-4">
                 <button 
                    onClick={toggleMute}
                    className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer"
                    title={muted ? "Unmute" : "Mute"}
                >
                    {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                 <button 
                    onClick={() => setShowModal(true)}
                    className="p-2 text-noir-500 hover:text-white transition-colors hover:bg-noir-900 rounded-full cursor-pointer"
                    title="Math Analysis"
                >
                    <HelpCircle size={20} />
                </button>
                 <button 
                    onClick={handleDeleteClick}
                    className={`
                        p-2 transition-colors rounded-full font-mono text-xs flex items-center justify-center cursor-pointer w-9 h-9
                        ${deleteConfirm 
                            ? 'bg-red-900 text-white hover:bg-red-800 ring-1 ring-red-500' 
                            : 'text-noir-500 hover:text-red-500 hover:bg-noir-900'
                        }
                    `}
                    title="Delete Save & Reset"
                >
                    {deleteConfirm ? '!' : <Trash2 size={20} />}
                </button>
            </div>
        </footer>

      </div>

      {/* Shop Sidebar */}
      <Shop 
        money={gameState.money} 
        upgrades={gameState.upgrades} 
        onBuy={buyUpgrade}
        maxStreak={gameState.maxStreak}
      />

      {/* Probability Modal - Max Z-index */}
      <div className="relative z-[100]">
        <ProbabilityModal 
            isOpen={showModal} 
            onClose={() => setShowModal(false)} 
            currentChance={currentChance} 
        />
      </div>

      <style>{`
        .rotate-x-180 { transform: rotateX(180deg); }
        .mask-linear-fade {
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
        
        /* New Celebration Animations */
        @keyframes popInUp {
            0% { opacity: 0; transform: translateY(20px) scale(0.9); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-pop-in-up { animation: popInUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        @keyframes popUp {
            0% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
        .animate-pop-up { animation: popUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

        @keyframes scaleSlam {
            0% { opacity: 0; transform: scale(5); }
            60% { opacity: 1; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
        }
        .animate-scale-slam { animation: scaleSlam 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }

        @keyframes flash {
            0%, 100% { opacity: 0; }
            10%, 90% { opacity: 1; }
        }
        .animate-flash { animation: flash 0.3s ease-out forwards; }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px) rotate(-1deg); }
            20%, 40%, 60%, 80% { transform: translateX(5px) rotate(1deg); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        
        @keyframes particle {
            0% { transform: translate(0, 0) scale(1); opacity: 1; }
            100% { transform: translate(var(--tw-translate-x, 100px), var(--tw-translate-y, 100px)) scale(0); opacity: 0; }
        }
        .animate-particle {
             animation: particle 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;