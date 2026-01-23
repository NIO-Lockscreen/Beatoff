import React from 'react';
import { X, Calculator, Flame, Download, Star, BookOpen } from './Icons';

interface DebugMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onTestConfetti: () => void;
    onOpenGoalCalculator: () => void;
    onOpenFoodCalculator: () => void;
    onOpenSuggestion: () => void;
    onOpenBackup: () => void;
    onOpenRecalculate: () => void;
}

const DebugMenu: React.FC<DebugMenuProps> = ({ 
    isOpen, onClose, 
    onTestConfetti, 
    onOpenGoalCalculator, 
    onOpenFoodCalculator,
    onOpenSuggestion,
    onOpenBackup,
    onOpenRecalculate
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl w-full max-w-sm animate-pop-in border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">Debug Tools</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                
                <div className="grid grid-cols-1 gap-3 max-h-[70vh] overflow-y-auto no-scrollbar">
                    <button onClick={onTestConfetti} className="p-4 bg-gray-50 hover:bg-yellow-50 rounded-2xl text-left font-bold text-gray-700 transition flex items-center gap-3 group border border-gray-100">
                        <span className="text-2xl group-hover:scale-125 transition-transform">🎉</span> Test Confetti
                    </button>
                    
                    <button onClick={onOpenGoalCalculator} className="p-4 bg-gray-50 hover:bg-indigo-50 rounded-2xl text-left font-bold text-gray-700 transition flex items-center gap-3 group border border-gray-100">
                        <div className="p-1 bg-indigo-100 text-indigo-600 rounded-lg"><Calculator className="w-4 h-4" /></div>
                        Goal Calculator
                    </button>

                     <button onClick={onOpenFoodCalculator} className="p-4 bg-gray-50 hover:bg-orange-50 rounded-2xl text-left font-bold text-gray-700 transition flex items-center gap-3 group border border-gray-100">
                        <div className="p-1 bg-orange-100 text-orange-600 rounded-lg"><Calculator className="w-4 h-4" /></div>
                        Food Calculator
                    </button>

                    <button onClick={onOpenSuggestion} className="p-4 bg-gray-50 hover:bg-yellow-50 rounded-2xl text-left font-bold text-gray-700 transition flex items-center gap-3 group border border-gray-100">
                         <div className="p-1 bg-yellow-100 text-yellow-600 rounded-lg"><Flame className="w-4 h-4" /></div>
                        Suggestion AI
                    </button>

                    <button onClick={onOpenBackup} className="p-4 bg-gray-50 hover:bg-blue-50 rounded-2xl text-left font-bold text-gray-700 transition flex items-center gap-3 group border border-gray-100">
                        <div className="p-1 bg-blue-100 text-blue-600 rounded-lg"><Download className="w-4 h-4" /></div>
                        Backup Reminder
                    </button>
                     
                    <button onClick={onOpenRecalculate} className="p-4 bg-gray-50 hover:bg-green-50 rounded-2xl text-left font-bold text-gray-700 transition flex items-center gap-3 group border border-gray-100">
                        <div className="p-1 bg-green-100 text-green-600 rounded-lg"><Star className="w-4 h-4" /></div>
                        Recalculate Reminder
                    </button>
                </div>
                
                <div className="mt-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Press 'D' to toggle
                </div>
            </div>
        </div>
    );
};

export default DebugMenu;