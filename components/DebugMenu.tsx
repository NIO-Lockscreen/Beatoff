import React, { useState } from 'react';
import { Bug, X, Trophy, Zap, DollarSign, Gem, ChevronRight } from 'lucide-react';

interface DebugMenuProps {
  isOpen: boolean;
  onClose: () => void;
  prestigeLevel: number;
  money: number;
  voidFragments: number;
  forceHeads: boolean;
  onToggleForceHeads: () => void;
  onSetPrestige: (val: number) => void;
  onSetMoney: (val: number) => void;
  onSetFragments: (val: number) => void;
  onOpenLeaderboard: () => void;
}

const DebugMenu: React.FC<DebugMenuProps> = ({
  isOpen,
  onClose,
  prestigeLevel,
  money,
  voidFragments,
  forceHeads,
  onToggleForceHeads,
  onSetPrestige,
  onSetMoney,
  onSetFragments,
  onOpenLeaderboard,
}) => {
  const [prestigeInput, setPrestigeInput] = useState(String(prestigeLevel));
  const [moneyInput, setMoneyInput] = useState(String(money));
  const [fragmentsInput, setFragmentsInput] = useState(String(voidFragments));

  if (!isOpen) return null;

  const handleApply = (
    raw: string,
    setter: (v: number) => void,
    min = 0,
    max = 1e15,
  ) => {
    const val = parseFloat(raw.replace(/,/g, ''));
    if (!isNaN(val)) setter(Math.max(min, Math.min(max, Math.floor(val))));
  };

  return (
    <div
      data-no-flip
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-noir-950 border border-yellow-500/60 shadow-[0_0_40px_rgba(234,179,8,0.15)] relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-yellow-500/30 bg-yellow-950/20">
          <div className="flex items-center gap-2">
            <Bug size={18} className="text-yellow-400" />
            <span className="font-mono font-bold text-yellow-300 tracking-widest text-sm uppercase">Debug Menu</span>
          </div>
          <button onClick={onClose} className="text-noir-500 hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Warning banner */}
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-900/40 flex items-center gap-2">
          <span className="text-[10px] font-mono text-red-400 tracking-widest uppercase">
            ⚠ Run disqualified from leaderboard
          </span>
        </div>

        <div className="p-4 space-y-4">
          {/* Prestige Level */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-noir-500">
              <Trophy size={11} className="text-purple-400" /> Prestige Level
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={prestigeInput}
                onChange={e => setPrestigeInput(e.target.value)}
                className="flex-1 bg-black border border-noir-700 text-white font-mono text-sm px-3 py-2 focus:border-yellow-500 focus:outline-none"
                min={0}
                max={9999}
              />
              <button
                onClick={() => { handleApply(prestigeInput, onSetPrestige, 0, 9999); }}
                className="px-3 py-2 bg-purple-900/50 border border-purple-700 text-purple-300 font-mono text-xs hover:bg-purple-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight size={12} /> SET
              </button>
            </div>
          </div>

          {/* Cash */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-noir-500">
              <DollarSign size={11} className="text-amber-400" /> Cash
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={moneyInput}
                onChange={e => setMoneyInput(e.target.value)}
                className="flex-1 bg-black border border-noir-700 text-white font-mono text-sm px-3 py-2 focus:border-yellow-500 focus:outline-none"
                min={0}
              />
              <button
                onClick={() => { handleApply(moneyInput, onSetMoney, 0, 1e15); }}
                className="px-3 py-2 bg-amber-900/50 border border-amber-700 text-amber-300 font-mono text-xs hover:bg-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight size={12} /> SET
              </button>
            </div>
          </div>

          {/* Void Fragments */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-noir-500">
              <Gem size={11} className="text-purple-400" /> Void Fragments
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={fragmentsInput}
                onChange={e => setFragmentsInput(e.target.value)}
                className="flex-1 bg-black border border-noir-700 text-white font-mono text-sm px-3 py-2 focus:border-yellow-500 focus:outline-none"
                min={0}
              />
              <button
                onClick={() => { handleApply(fragmentsInput, onSetFragments, 0, 99999); }}
                className="px-3 py-2 bg-purple-900/50 border border-purple-700 text-purple-300 font-mono text-xs hover:bg-purple-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight size={12} /> SET
              </button>
            </div>
          </div>

          {/* Force Heads Toggle */}
          <div className="border border-noir-800 p-3 flex items-center justify-between bg-black/40">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-noir-400">
                <Zap size={11} className="text-yellow-400" /> Force Every Flip = Heads
              </div>
              <p className="text-[9px] text-noir-600 font-mono mt-0.5">100% heads, no RNG</p>
            </div>
            <button
              onClick={onToggleForceHeads}
              className={`px-4 py-2 font-mono text-sm font-bold border transition-colors cursor-pointer ${
                forceHeads
                  ? 'border-yellow-400 text-yellow-300 bg-yellow-900/30 hover:bg-yellow-900/50'
                  : 'border-noir-700 text-noir-500 bg-black hover:border-noir-500 hover:text-white'
              }`}
            >
              {forceHeads ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Leaderboard shortcut */}
          <button
            onClick={() => { onOpenLeaderboard(); onClose(); }}
            className="w-full py-3 border border-amber-700/50 text-amber-400 font-mono text-sm font-bold hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trophy size={14} /> View All Leaderboards
          </button>
        </div>

        <div className="px-4 pb-4">
          <p className="text-[9px] font-mono text-noir-700 tracking-wider text-center uppercase">
            Press ` (backtick) to toggle · P to preview edge
          </p>
        </div>
      </div>
    </div>
  );
};

export default DebugMenu;
