import React, { useState, useMemo } from 'react';
import { Preset, LogEntry } from '../types';
import { X, Trash2, Search } from './Icons';

interface PresetsModalProps {
    isOpen: boolean;
    onClose: () => void;
    presets: Preset[];
    onSelect: (preset: Preset) => void;
    onDelete: (id: string) => void;
    history: LogEntry[];
}

const PresetsModal: React.FC<PresetsModalProps> = ({ isOpen, onClose, presets, onSelect, onDelete, history }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const sortedPresets = useMemo(() => {
        const counts = new Map<string, number>();
        const lastUsed = new Map<string, number>();

        // Analyze history for Frequency and Recency
        history.forEach(h => {
            if (h.label) {
                const key = h.label.trim().toLowerCase();
                
                // Frequency
                counts.set(key, (counts.get(key) || 0) + 1);
                
                // Recency (Timestamp)
                const currentLast = lastUsed.get(key) || 0;
                if (h.ts > currentLast) {
                    lastUsed.set(key, h.ts);
                }
            }
        });

        // Sort: Usage Descending -> Recency Descending -> Alphabetical
        return [...presets].sort((a, b) => {
            const keyA = a.label.trim().toLowerCase();
            const keyB = b.label.trim().toLowerCase();

            const countA = counts.get(keyA) || 0;
            const countB = counts.get(keyB) || 0;
            
            // 1. Most Used
            if (countB !== countA) {
                return countB - countA; 
            }
            
            // 2. Most Recently Used (Tie-breaker)
            const lastA = lastUsed.get(keyA) || 0;
            const lastB = lastUsed.get(keyB) || 0;
            
            if (lastB !== lastA) {
                return lastB - lastA;
            }

            // 3. Alphabetical (Final tie-breaker)
            return a.label.localeCompare(b.label);
        });
    }, [presets, history]);

    const isLargeList = presets.length > 20;

    const displayList = useMemo(() => {
        let result = sortedPresets;

        // Filter if searching
        if (searchQuery.trim()) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(p => p.label.toLowerCase().includes(lowerQ));
        } 
        // If large list and NOT searching, show top 20 popular
        else if (isLargeList) {
            result = result.slice(0, 20);
        }

        return result;
    }, [sortedPresets, searchQuery, isLargeList]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md animate-slide-up sm:animate-pop-in max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="text-xl font-bold text-gray-800">Saved Meals</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Search Bar - Only shows if more than 20 items */}
                {isLargeList && (
                    <div className="relative mb-4 shrink-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Search meals..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100/80 rounded-2xl py-3 pl-11 pr-4 font-bold text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-accent outline-none transition-all"
                        />
                    </div>
                )}
                
                <div className="overflow-y-auto no-scrollbar space-y-3 flex-1">
                    {displayList.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            {presets.length === 0 ? (
                                <>
                                    <p>No saved meals yet.</p>
                                    <p className="text-sm mt-2">Tap the bookmark icon on a history item to save it here!</p>
                                </>
                            ) : (
                                <p>No meals found matching "{searchQuery}"</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {displayList.map((preset, index) => (
                                <div key={preset.id} className="flex items-center gap-3">
                                    <div className="flex-1 flex gap-3">
                                        <button 
                                            onClick={() => onSelect(preset)}
                                            className="flex-1 text-left bg-white/50 hover:bg-white p-4 rounded-2xl border border-gray-100 transition shadow-sm flex justify-between items-center group relative overflow-hidden"
                                        >
                                            <div className="relative z-10">
                                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                                    {preset.label || "Unnamed Meal"}
                                                    {/* Top 3 Badge */}
                                                    {!searchQuery && index < 3 && (
                                                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-extrabold">
                                                            #{index + 1}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {preset.cal} kcal • <span className="text-protein">{preset.pro}g pro</span>
                                                </div>
                                            </div>
                                            <div className="text-accent font-bold opacity-0 group-hover:opacity-100 transition-opacity text-sm relative z-10">
                                                ADD +
                                            </div>
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => onDelete(preset.id)}
                                        className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                            
                            {/* Visual Hint for truncated list */}
                            {isLargeList && !searchQuery && (
                                <div className="text-center py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Showing Top 20 • Use search for more
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PresetsModal;