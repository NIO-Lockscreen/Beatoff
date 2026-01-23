import React from 'react';
import { UpgradeType } from '../types';
import { UPGRADES } from '../constants';
import { Zap, TrendingUp, Clock, Coins, PlayCircle } from 'lucide-react';

interface ShopProps {
  money: number;
  upgrades: Record<UpgradeType, number>;
  onBuy: (type: UpgradeType, cost: number) => void;
  maxStreak: number;
}

const ICONS = {
  [UpgradeType.CHANCE]: TrendingUp,
  [UpgradeType.SPEED]: Clock,
  [UpgradeType.COMBO]: Zap,
  [UpgradeType.VALUE]: Coins,
  [UpgradeType.AUTO_FLIP]: PlayCircle,
};

const Shop: React.FC<ShopProps> = ({ money, upgrades, onBuy, maxStreak }) => {
  return (
    // Updated Layout:
    // - Desktop: h-full (fills sidebar), overflow-hidden (scrolling handled by child).
    // - Mobile: h-auto (fills content naturally), w-full.
    <div className="relative z-50 border-t md:border-t-0 md:border-l border-noir-800 bg-noir-900/50 w-full md:w-80 flex flex-col md:h-full h-auto overflow-hidden shrink-0">
      <div className="p-4 border-b border-noir-800 bg-noir-950">
        <h2 className="font-mono text-xl font-bold text-noir-200">The Fixer</h2>
        <p className="text-xs text-noir-500 font-mono mt-1">Spend your winnings to tilt the odds.</p>
      </div>

      {/* 
         - Desktop: overflow-y-auto (scrolls inside sidebar).
         - Mobile: overflow-visible (extends height, lets page scroll).
      */}
      <div className="flex-1 p-4 space-y-4 md:overflow-y-auto overflow-visible">
        {Object.values(UPGRADES).map((upgrade) => {
          // Hide Auto Flip if streak < 3 and not yet purchased
          if (upgrade.id === UpgradeType.AUTO_FLIP) {
              const owned = (upgrades[upgrade.id] || 0) > 0;
              if (!owned && maxStreak < 3) return null;
          }

          const currentLevel = upgrades[upgrade.id] || 0;
          const isMaxed = currentLevel >= upgrade.costTiers.length;
          const cost = isMaxed ? 0 : upgrade.costTiers[currentLevel];
          const canAfford = !isMaxed && money >= cost;
          
          const Icon = ICONS[upgrade.id] || Zap;
          const currentEffect = upgrade.formatEffect(upgrade.getEffect(currentLevel));
          const nextEffect = !isMaxed ? upgrade.formatEffect(upgrade.getEffect(currentLevel + 1)) : 'MAX';

          return (
            <div key={upgrade.id} className="bg-noir-950 border border-noir-800 p-3 group hover:border-noir-600 transition-colors animate-fade-in">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-noir-200">
                  <Icon size={16} />
                  <span className="font-bold font-mono text-sm">{upgrade.name}</span>
                </div>
                <span className="text-xs font-mono text-noir-500">Lvl {currentLevel}</span>
              </div>
              
              <p className="text-xs text-noir-400 mb-3 min-h-[2.5em] leading-relaxed">
                {upgrade.description}
              </p>

              <div className="flex justify-between items-center text-xs font-mono mb-3 bg-noir-900 p-2 rounded">
                 <span className="text-noir-400">{currentEffect}</span>
                 <span className="text-noir-600">→</span>
                 <span className={isMaxed ? 'text-amber-500' : 'text-white'}>{nextEffect}</span>
              </div>

              <button
                onClick={() => onBuy(upgrade.id, cost)}
                disabled={!canAfford || isMaxed}
                className={`
                  w-full py-2 px-3 font-mono text-sm font-bold border transition-all duration-100
                  ${isMaxed 
                    ? 'border-noir-800 text-noir-600 cursor-not-allowed bg-noir-900' 
                    : canAfford
                      ? 'border-noir-600 text-white hover:bg-noir-800 hover:border-white active:translate-y-0.5'
                      : 'border-noir-800 text-noir-600 cursor-not-allowed bg-noir-950/50'
                  }
                `}
              >
                {isMaxed ? 'SOLD OUT' : `$${cost.toLocaleString()}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Shop;