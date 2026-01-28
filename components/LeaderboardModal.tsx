import React, { useEffect, useState } from 'react';
import { GlobalLeaderboard, LeaderboardEntry } from '../types';
import { LeaderboardService } from '../services/leaderboardService';
import { X, Trophy, DollarSign, Ban, Heart, Loader2, Info } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playerName: string | null;
  onRegisterName: (name: string) => void;
  currentStats?: {
      purist: number;
      prestige: number;
      rich: number;
      mommy: number;
  };
}

const LeaderboardModal: React.FC<Props> = ({ isOpen, onClose, playerName, onRegisterName, currentStats }) => {
  const [board, setBoard] = useState<GlobalLeaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof GlobalLeaderboard>('purist');
  const [tempName, setTempName] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchBoard();
    }
  }, [isOpen]);

  const fetchBoard = async () => {
    setLoading(true);
    const data = await LeaderboardService.getLeaderboard();
    setBoard(data);
    setLoading(false);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim().length > 0) {
        onRegisterName(tempName.trim().substring(0, 15));
    }
  };

  const formatScore = (val: number, type: 'count' | 'money') => {
      if (type === 'count') return val.toString();
      
      if (val >= 1e33) return '$' + (val / 1e33).toFixed(1).replace(/\.0$/, '') + 'Dc';
      if (val >= 1e30) return '$' + (val / 1e30).toFixed(1).replace(/\.0$/, '') + 'No';
      if (val >= 1e27) return '$' + (val / 1e27).toFixed(1).replace(/\.0$/, '') + 'Oc';
      if (val >= 1e24) return '$' + (val / 1e24).toFixed(1).replace(/\.0$/, '') + 'Sp';
      if (val >= 1e21) return '$' + (val / 1e21).toFixed(1).replace(/\.0$/, '') + 'Sx';
      if (val >= 1e18) return '$' + (val / 1e18).toFixed(1).replace(/\.0$/, '') + 'Qi';
      if (val >= 1e15) return '$' + (val / 1e15).toFixed(1).replace(/\.0$/, '') + 'Qa';
      if (val >= 1e12) return '$' + (val / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
      if (val >= 1e9) return '$' + (val / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      if (val >= 1e6) return '$' + (val / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (val >= 1e3) return '$' + (val / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
      return '$' + val.toLocaleString();
  };

  // If user hasn't registered a name yet, show registration
  if (isOpen && !playerName) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-md bg-noir-900 border border-noir-700 p-8 shadow-2xl relative">
                <h2 className="text-2xl font-mono font-bold text-white mb-2">Identify Yourself</h2>
                <p className="text-noir-400 font-mono text-sm mb-6">
                    You've beaten the odds. The house needs a name for the ledger.
                </p>
                <form onSubmit={handleRegister} className="space-y-4">
                    <input 
                        autoFocus
                        type="text" 
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        placeholder="ENTER ALIAS"
                        className="w-full bg-black border-2 border-noir-700 text-white font-mono text-xl p-4 focus:border-amber-500 focus:outline-none uppercase tracking-widest placeholder:text-noir-800"
                        maxLength={15}
                    />
                    <button 
                        type="submit"
                        disabled={tempName.length === 0}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold font-mono py-4 uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Sign Ledger
                    </button>
                </form>
            </div>
        </div>
      );
  }

  if (!isOpen) return null;

  const renderEntry = (entry: LeaderboardEntry, index: number, formatter: (val: number) => string) => (
    <div key={index} className={`flex justify-between items-center p-3 border-b border-noir-800 ${entry.name === playerName ? 'bg-amber-900/20' : ''}`}>
        <div className="flex items-center gap-3">
            <span className={`font-mono font-bold w-6 text-right ${index < 3 ? 'text-amber-500' : 'text-noir-600'}`}>
                {index + 1}.
            </span>
            <div className="flex flex-col">
                <span className={`font-mono ${entry.name === playerName ? 'text-amber-200' : 'text-noir-300'}`}>
                    {entry.name}
                </span>
                {entry.title && (
                    <span className="text-[10px] text-noir-500 font-mono uppercase tracking-tighter">
                        {entry.title}
                    </span>
                )}
            </div>
        </div>
        <span className="font-mono text-white font-bold">
            {formatter(entry.score)}
        </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-noir-950 border border-noir-700 w-full max-w-2xl shadow-2xl relative h-[80vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-noir-500 hover:text-white z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6 border-b border-noir-800">
          <h2 className="text-2xl font-mono font-bold text-white flex items-center gap-3">
            <Trophy className="text-amber-500" />
            The High Rollers
          </h2>
          <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
            <TabButton 
                active={activeTab === 'purist'} 
                onClick={() => setActiveTab('purist')} 
                icon={Ban} 
                label="Purist" 
            />
            <TabButton 
                active={activeTab === 'prestige'} 
                onClick={() => setActiveTab('prestige')} 
                icon={Trophy} 
                label="Prestige" 
            />
            <TabButton 
                active={activeTab === 'rich'} 
                onClick={() => setActiveTab('rich')} 
                icon={DollarSign} 
                label="Rich" 
            />
            {currentStats && currentStats.mommy > 1 && (
                <TabButton 
                    active={activeTab === 'mommy'} 
                    onClick={() => setActiveTab('mommy')} 
                    icon={Heart} 
                    label="Mommy" 
                    secret 
                />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-noir-900/50 relative">
            {activeTab === 'purist' && (
                <div className="bg-noir-950/50 p-4 border-b border-noir-800 flex items-start gap-3">
                    <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-mono text-noir-400 leading-relaxed">
                        <strong className="text-amber-500">PURIST RUNS:</strong> Victories achieved without ever purchasing or enabling the Auto Flipper. 
                        A test of manual endurance.
                    </p>
                </div>
            )}

            {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-amber-500">
                    <Loader2 className="animate-spin" size={32} />
                </div>
            ) : (
                <div className="divide-y divide-noir-800">
                    {board && board[activeTab].length === 0 && (
                        <div className="p-8 text-center text-noir-500 font-mono">
                            No records found. Be the first.
                        </div>
                    )}
                    {board && activeTab === 'purist' && board.purist.map((e, i) => renderEntry(e, i, (v) => `${v} Wins`))}
                    {board && activeTab === 'prestige' && board.prestige.map((e, i) => renderEntry(e, i, (v) => `Lvl ${v}`))}
                    {board && activeTab === 'rich' && board.rich.map((e, i) => renderEntry(e, i, (v) => formatScore(v, 'money')))}
                    {board && activeTab === 'mommy' && board.mommy.map((e, i) => renderEntry(e, i, (v) => `${v} purchases`))}
                </div>
            )}
        </div>

        {/* User Stats Footer */}
        {playerName && currentStats && (
            <div className="p-4 bg-black border-t border-noir-800 flex justify-between items-center text-xs font-mono text-noir-400">
                <span>YOU: {playerName}</span>
                <span className="text-amber-500">
                    {activeTab === 'purist' && `${currentStats.purist} Wins`}
                    {activeTab === 'prestige' && `Lvl ${currentStats.prestige}`}
                    {activeTab === 'rich' && formatScore(currentStats.rich, 'money')}
                    {activeTab === 'mommy' && `${currentStats.mommy}`}
                </span>
            </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label, secret }: any) => (
    <button
        onClick={onClick}
        className={`
            flex items-center gap-2 px-4 py-2 font-mono text-sm font-bold border transition-all whitespace-nowrap
            ${active 
                ? 'bg-amber-600 text-black border-amber-600' 
                : secret 
                    ? 'bg-pink-950/20 text-pink-500 border-pink-900/30 hover:bg-pink-900/40' 
                    : 'bg-black text-noir-500 border-noir-700 hover:border-noir-500 hover:text-white'
            }
        `}
    >
        <Icon size={14} />
        {label}
    </button>
);

export default LeaderboardModal;