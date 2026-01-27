import React from 'react';
import { UpgradeType } from '../types';
import { UPGRADES } from '../constants';
import { Zap, TrendingUp, Clock, Coins, PlayCircle, ShieldCheck, Flame, Ghost, Sparkles, Hourglass, Infinity, Skull, Crown, Heart, Power } from 'lucide-react';

interface ShopProps {
  money: number;
  voidFragments: number;
  prestigeLevel: number;
  upgrades: Record<UpgradeType, number>;
  onBuy: (type: UpgradeType, cost: number, isPrestige: boolean) => void;
  maxStreak: number;
  autoFlipEnabled: boolean;
  onToggleAutoFlip: () => void;
}

const ICONS = {
  [UpgradeType.CHANCE]: TrendingUp,
  [UpgradeType.SPEED]: Clock,
  [UpgradeType.COMBO]: Zap,
  [UpgradeType.VALUE]: Coins,
  [UpgradeType.AUTO_FLIP]: PlayCircle,
  [UpgradeType.PASSIVE_INCOME]: ShieldCheck,
  [UpgradeType.EDGING]: Flame,
  // Prestige
  [UpgradeType.PRESTIGE_KARMA]: Sparkles,
  [UpgradeType.PRESTIGE_FATE]: Ghost,
  [UpgradeType.PRESTIGE_FLUX]: Hourglass,
  [UpgradeType.PRESTIGE_PASSIVE]: Infinity,
  [UpgradeType.PRESTIGE_AUTO]: PlayCircle,
  [UpgradeType.PRESTIGE_EDGING]: Skull,
  [UpgradeType.PRESTIGE_LIMITLESS]: Crown,
  [UpgradeType.PRESTIGE_MOM]: Heart,
};

const Shop: React.FC<ShopProps> = ({ money, voidFragments, prestigeLevel, upgrades, onBuy, maxStreak, autoFlipEnabled, onToggleAutoFlip }) => {
  
  const hasLimitless = (upgrades[UpgradeType.PRESTIGE_LIMITLESS] || 0) > 0;
  const hasPrestigeEdging = (upgrades[UpgradeType.PRESTIGE_EDGING] || 0) > 0;

  const renderUpgrade = (upgradeId: UpgradeType) => {
    const upgrade = UPGRADES[upgradeId];
    // Visibility checks for Standard Upgrades
    if (upgrade.id === UpgradeType.PASSIVE_INCOME) {
        const owned = (upgrades[upgrade.id] || 0) > 0;
        if (!owned && maxStreak < 3) return null;
    }
    if (upgrade.id === UpgradeType.AUTO_FLIP) {
        const owned = (upgrades[upgrade.id] || 0) > 0;
        if (!owned && maxStreak < 5) return null;
    }
    if (upgrade.id === UpgradeType.EDGING) {
        // Hide standard Edging if Prestige Edging is owned
        if (hasPrestigeEdging) return null;
        const owned = (upgrades[upgrade.id] || 0) > 0;
        if (!owned && maxStreak < 9) return null;
    }
    
    // Visibility checks for Prestige Upgrades
    if (upgrade.id === UpgradeType.PRESTIGE_PASSIVE && prestigeLevel < 2) return null;
    if (upgrade.id === UpgradeType.PRESTIGE_AUTO && prestigeLevel < 3) return null;
    if (upgrade.id === UpgradeType.PRESTIGE_EDGING && prestigeLevel < 5) return null;
    if (upgrade.id === UpgradeType.PRESTIGE_LIMITLESS && prestigeLevel < 10) return null;
    if (upgrade.id === UpgradeType.PRESTIGE_MOM && prestigeLevel < 15) return null;

    const currentLevel = upgrades[upgrade.id] || 0;
    
    // Determine the effective max level
    const effectiveMaxLevel = (hasLimitless && upgrade.limitlessMaxLevel) 
        ? upgrade.limitlessMaxLevel 
        : upgrade.maxLevel;

    const isMaxed = currentLevel >= effectiveMaxLevel;
    
    let cost = isMaxed ? 0 : (upgrade.costTiers[currentLevel] || upgrade.costTiers[upgrade.costTiers.length - 1]);
    
    const isPrestige = upgrade.isPrestige || false;
    
    // Cap Void Fragment costs at 50
    if (isPrestige && cost > 50) {
        cost = 50;
    }

    const currency = isPrestige ? voidFragments : money;
    const canAfford = !isMaxed && currency >= cost;
    
    const Icon = ICONS[upgrade.id] || Zap;
    
    // Calculate display effect (incorporating Prestige Buffs)
    let rawEffect = upgrade.getEffect(currentLevel);
    
    // Buff Passive Income display
    if (upgrade.id === UpgradeType.PASSIVE_INCOME) {
        rawEffect = rawEffect * (1 + prestigeLevel);
    }
    
    const currentEffect = upgrade.formatEffect(rawEffect);
    
    // Next effect preview
    let nextEffectRaw = upgrade.getEffect(currentLevel + 1);
    // Buff Passive Income next preview
    if (upgrade.id === UpgradeType.PASSIVE_INCOME) {
        nextEffectRaw = nextEffectRaw * (1 + prestigeLevel);
    }
    const nextEffect = !isMaxed ? upgrade.formatEffect(nextEffectRaw) : 'MAX';

    // Highlight Mom item
    const isMom = upgrade.id === UpgradeType.PRESTIGE_MOM;

    // Check if this is an Auto Flip upgrade that is owned (for Toggle)
    const isAutoFlipType = (upgrade.id === UpgradeType.AUTO_FLIP || upgrade.id === UpgradeType.PRESTIGE_AUTO);
    const showToggle = isAutoFlipType && currentLevel > 0;

    return (
      <div key={upgrade.id} className={`
        border p-3 group transition-colors animate-fade-in relative overflow-hidden
        ${isPrestige 
            ? 'bg-purple-950/20 border-purple-900/50 hover:border-purple-500/50' 
            : isMom 
                ? 'bg-pink-950/20 border-pink-900/50 hover:border-pink-500/50'
                : 'bg-noir-950 border-noir-800 hover:border-noir-600'
        }
        ${upgrade.id === UpgradeType.PRESTIGE_LIMITLESS ? 'border-amber-500/50 bg-amber-900/10' : ''}
      `}>
        {isPrestige && (
            <div className="absolute -right-4 -top-4 w-12 h-12 bg-purple-500/10 blur-xl rounded-full pointer-events-none"></div>
        )}
        
        {upgrade.id === UpgradeType.PRESTIGE_LIMITLESS && (
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent animate-pulse-slow pointer-events-none"></div>
        )}
        
        {isMom && (
             <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-transparent to-transparent pointer-events-none"></div>
        )}

        <div className="flex justify-between items-start mb-2 relative z-10">
          <div className={`flex items-center gap-2 ${isPrestige ? 'text-purple-300' : 'text-noir-200'} ${upgrade.id === UpgradeType.PRESTIGE_LIMITLESS ? 'text-amber-400' : ''} ${isMom ? 'text-pink-300' : ''}`}>
            <Icon size={16} />
            <span className="font-bold font-mono text-sm">{upgrade.name}</span>
          </div>
          <span className={`text-xs font-mono ${isPrestige ? 'text-purple-400' : 'text-noir-500'}`}>Lvl {currentLevel}</span>
        </div>
        
        <p className={`text-xs mb-3 min-h-[2.5em] leading-relaxed ${isPrestige ? 'text-purple-200/70' : 'text-noir-400'}`}>
          {upgrade.description}
        </p>

        <div className={`flex justify-between items-center text-xs font-mono mb-3 p-2 rounded ${isPrestige ? 'bg-black/40' : 'bg-noir-900'}`}>
            <span className={isPrestige ? 'text-purple-300' : 'text-noir-400'}>{currentEffect}</span>
            <span className="text-noir-600">→</span>
            <span className={isMaxed ? 'text-amber-500' : 'text-white'}>{nextEffect}</span>
        </div>
        
        <div className="flex gap-2 relative z-10">
            {showToggle && (
                <button
                    onClick={onToggleAutoFlip}
                    className={`
                        flex-1 py-2 px-3 font-mono text-sm font-bold border transition-colors flex items-center justify-center gap-2
                        ${autoFlipEnabled 
                            ? 'border-amber-500 text-amber-500 bg-amber-900/20 hover:bg-amber-900/40' 
                            : 'border-noir-600 text-noir-500 bg-black hover:border-noir-400 hover:text-noir-400'
                        }
                    `}
                    title={autoFlipEnabled ? "Disable Auto Flip" : "Enable Auto Flip"}
                >
                    <Power size={14} />
                    {autoFlipEnabled ? "ON" : "OFF"}
                </button>
            )}

            <button
            onClick={() => onBuy(upgrade.id, cost, isPrestige)}
            disabled={!canAfford || isMaxed}
            className={`
                flex-[2] py-2 px-3 font-mono text-sm font-bold border transition-all duration-100
                ${isMaxed 
                ? 'border-transparent text-noir-600 cursor-not-allowed bg-black/20' 
                : canAfford
                    ? isPrestige 
                        ? 'border-purple-500 text-purple-100 hover:bg-purple-900/50 hover:border-purple-300 hover:shadow-[0_0_10px_rgba(168,85,247,0.2)] active:translate-y-0.5'
                        : isMom
                            ? 'border-pink-500 text-pink-100 hover:bg-pink-900/50 hover:border-pink-300 hover:shadow-[0_0_10px_rgba(236,72,153,0.2)] active:translate-y-0.5'
                            : 'border-noir-600 text-white hover:bg-noir-800 hover:border-white active:translate-y-0.5'
                    : isPrestige 
                        ? 'border-purple-900/30 text-purple-700 cursor-not-allowed bg-black/20'
                        : 'border-noir-800 text-noir-600 cursor-not-allowed bg-noir-950/50'
                }
            `}
            >
            {isMaxed ? 'MAXED' : `${isPrestige ? '🟣 ' : '$'}${cost.toLocaleString()}`}
            </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative z-50 border-t md:border-t-0 md:border-l border-noir-800 bg-noir-900/50 w-full md:w-80 flex flex-col md:h-full h-auto overflow-hidden shrink-0">
      <div className="p-4 border-b border-noir-800 bg-noir-950">
        <h2 className="font-mono text-xl font-bold text-noir-200">The Fixer</h2>
        <p className="text-xs text-noir-500 font-mono mt-1">Spend winnings to tilt the odds.</p>
        
        {/* Void Fragment Display */}
        {prestigeLevel > 0 && (
             <div className="mt-3 flex items-center gap-2 text-purple-400 font-mono text-xs border border-purple-900/50 bg-purple-950/10 p-2 rounded">
                <Ghost size={12} />
                <span>VOID FRAGMENTS: {voidFragments}</span>
             </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4 md:overflow-y-auto overflow-visible scrollbar-thin scrollbar-thumb-noir-700 scrollbar-track-transparent">
        {/* Standard Upgrades - Filter out MOM explicitly */}
        <div className="space-y-4">
             {Object.values(UPGRADES)
                .filter(u => !u.isPrestige && u.id !== UpgradeType.PRESTIGE_MOM)
                .map(u => renderUpgrade(u.id))}
        </div>

        {/* Void Shop - Only visible after prestige. Include MOM here manually. */}
        {prestigeLevel > 0 && (
            <div className="pt-6 mt-6 border-t border-purple-900/30 relative">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
                <h3 className="text-purple-400 font-mono font-bold text-sm mb-4 flex items-center gap-2">
                    <Sparkles size={14} /> THE VOID
                </h3>
                <div className="space-y-4">
                     {Object.values(UPGRADES)
                        .filter(u => u.isPrestige || u.id === UpgradeType.PRESTIGE_MOM)
                        .map(u => renderUpgrade(u.id))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Shop;