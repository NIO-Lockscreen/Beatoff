import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Preset, TrackingMode } from '../types';
import { X, Flame } from './Icons';

interface SuggestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogSuggestions: (items: Preset[]) => void;
    remainingCal: number;
    remainingPro: number;
    presets: Preset[];
    mode: TrackingMode;
}

interface SuggestionItem {
    item: Preset;
    selected: boolean;
    uniqueKey: string;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({ 
    isOpen, 
    onClose, 
    onLogSuggestions, 
    remainingCal, 
    remainingPro, 
    presets,
    mode 
}) => {
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Track the signature of the currently displayed suggestion to avoid repeating it immediately
    const lastSignatureRef = useRef<string>('');

    // Derived totals based on SELECTED items
    const totals = useMemo(() => {
        return suggestions
            .filter(s => s.selected)
            .reduce((acc, s) => ({ 
                cal: acc.cal + s.item.cal, 
                pro: acc.pro + s.item.pro 
            }), { cal: 0, pro: 0 });
    }, [suggestions]);

    // Heuristic Configuration
    const CAL_TOLERANCE_LOWER = 50;
    const CAL_TOLERANCE_UPPER = 50;
    const MAX_OVERAGE_HARD = 300;
    
    // Penalties
    const PENALTY_PER_CAL_OVER = 10;
    const PENALTY_PER_CAL_OVER_SQ = 0.05;
    const PENALTY_MISSED_PRO = 30;
    const PENALTY_EXCESS_PRO = 15; // Increased: Penalty per gram of excess protein
    const PENALTY_EXCESS_PRO_HEAVY = 50; // Heavily increased: Penalty for massive overshoots (>10g)
    const PENALTY_DUPLICATE_2 = 300; 
    const PENALTY_DUPLICATE_3_PLUS = 5000;
    const PENALTY_SAME_AS_LAST = 10000;
    
    const generate = () => {
        setIsLoading(true);
        
        setTimeout(() => {
            if (presets.length === 0) {
                setSuggestions([]);
                setIsLoading(false);
                return;
            }

            // --- PRE-PROCESSING ---
            // Create a pool with efficiency pre-calculated
            const pool = presets.map(p => ({
                ...p,
                efficiency: p.pro / (Math.max(1, p.cal)) // Protein per 1 calorie
            }));

            // Pre-calculate subsets for faster access
            // Low Density: < 0.1g protein per kcal (e.g. < 10g pro in 100kcal)
            const lowDensityPool = pool.filter(p => p.efficiency < 0.12);
            // Fallback if no specific low density items exist: use the bottom 50%
            const sortedByDensity = [...pool].sort((a,b) => a.efficiency - b.efficiency);
            const bottomHalfPool = sortedByDensity.slice(0, Math.max(1, Math.ceil(pool.length / 2)));
            
            const effectiveLowDensityPool = lowDensityPool.length > 0 ? lowDensityPool : bottomHalfPool;

            let bestCombo: Preset[] = [];
            let bestScore = Infinity;

            const ITERATIONS = 5000; 

            for (let i = 0; i < ITERATIONS; i++) {
                const currentCombo: Preset[] = [];
                let currentCal = 0;
                let currentPro = 0;
                const counts: Record<string, number> = {};

                let attempts = 0;
                
                // Build a combo
                while (attempts < 30 && currentCombo.length < 15) {
                    attempts++;

                    const needCal = remainingCal - currentCal;
                    const needPro = remainingPro - currentPro;

                    // Stop conditions
                    if (mode !== 'cal' && needPro <= 0 && currentCal >= (remainingCal - CAL_TOLERANCE_LOWER)) break;
                    if (mode !== 'pro' && Math.abs(needCal) <= CAL_TOLERANCE_UPPER) break;
                    if (currentCal > remainingCal + MAX_OVERAGE_HARD) break;

                    let candidatePool = pool;

                    // --- INTELLIGENT POOL SELECTION ---
                    
                    // 1. OVERSHOOT PROTECTION / CALORIE FILLING MODE
                    // If we have met or are very close to protein goal (needPro <= 10g), 
                    // we STRICTLY switch to the low density pool to fill calories.
                    if (needPro <= 10) {
                         candidatePool = effectiveLowDensityPool;
                    } 
                    // 2. DENSITY MATCHING
                    // If we need protein, try to pick items that don't blow the calorie budget relative to protein needs
                    else {
                        // If we need HIGH density (lots of protein, few cals), maybe filter out super low density items?
                        // For now, random selection handles this via scoring, but strict low-density filtering is crucial for the overshoot case.
                    }

                    // Random Candidate from the selected pool
                    let candidate = candidatePool[Math.floor(Math.random() * candidatePool.length)];
                    
                    // 3. Variety Check (Hard constraint on 3rd duplicate)
                    if ((counts[candidate.id] || 0) >= 2) {
                         candidate = candidatePool[Math.floor(Math.random() * candidatePool.length)];
                         if ((counts[candidate.id] || 0) >= 2) continue; 
                    }

                    // 4. Hard Overage Check
                    if (currentCombo.length > 0 && (currentCal + candidate.cal > remainingCal + MAX_OVERAGE_HARD)) {
                        continue; 
                    }

                    currentCombo.push(candidate);
                    currentCal += candidate.cal;
                    currentPro += candidate.pro;
                    counts[candidate.id] = (counts[candidate.id] || 0) + 1;
                }

                if (currentCombo.length === 0) continue;

                // --- SCORING ---
                let score = 0;
                const finalCal = currentCal;
                const finalPro = currentPro;

                // 1. Protein Goal
                const missingPro = Math.max(0, remainingPro - finalPro);
                if (mode !== 'cal') {
                    score += missingPro * PENALTY_MISSED_PRO;
                    
                    // NEW: Penalty for Excess Protein
                    const excessPro = Math.max(0, finalPro - remainingPro);
                    if (excessPro > 0) {
                        // Base penalty for going over
                        score += excessPro * PENALTY_EXCESS_PRO;
                        // Heavy penalty for significant overshoots (>10g over)
                        if (excessPro > 10) {
                            score += (excessPro - 10) * PENALTY_EXCESS_PRO_HEAVY;
                        }
                    }
                }

                // 2. Calorie Goal
                const diffCal = finalCal - remainingCal;
                if (diffCal > 0) {
                    score += (diffCal * PENALTY_PER_CAL_OVER) + (Math.pow(diffCal, 2) * PENALTY_PER_CAL_OVER_SQ);
                } else {
                    score += Math.abs(diffCal) * 2; 
                }

                // 3. Variety / Duplicates
                Object.values(counts).forEach(count => {
                    if (count === 2) score += PENALTY_DUPLICATE_2;
                    if (count >= 3) score += PENALTY_DUPLICATE_3_PLUS * (count - 2);
                });
                
                // 4. Repetition Penalty (Regenerate Variety)
                const currentSig = currentCombo.map(i => i.id).sort().join('|');
                if (currentSig === lastSignatureRef.current) {
                    score += PENALTY_SAME_AS_LAST;
                }

                if (currentCombo.length === 0) score = Infinity;

                if (score < bestScore) {
                    bestScore = score;
                    bestCombo = currentCombo;
                }
            }

            // Save signature
            if (bestCombo.length > 0) {
                lastSignatureRef.current = bestCombo.map(i => i.id).sort().join('|');
            }

            setSuggestions(bestCombo.map((item, idx) => ({
                item,
                selected: true,
                uniqueKey: `${item.id}-${idx}-${Date.now()}`
            })));
            setIsLoading(false);
        }, 50);
    };

    const toggleItem = (index: number) => {
        setSuggestions(prev => prev.map((s, i) => 
            i === index ? { ...s, selected: !s.selected } : s
        ));
    };

    const handleLog = () => {
        const toLog = suggestions.filter(s => s.selected).map(s => s.item);
        if (toLog.length > 0) {
            onLogSuggestions(toLog);
            onClose();
        }
    };

    useEffect(() => {
        if (isOpen) {
            lastSignatureRef.current = ''; 
            generate();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl w-full max-w-sm animate-pop-in max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-yellow-100 p-2 rounded-xl text-yellow-600">
                            <Flame className="w-5 h-5" filled />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Smart Suggestion</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="mb-4 shrink-0">
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Remaining Goal</div>
                    <div className="flex items-center gap-4">
                        <div className="font-black text-2xl text-gray-800">{remainingCal > 0 ? remainingCal : 0} <span className="text-sm text-gray-400 font-bold">kcal</span></div>
                        <div className="w-px h-6 bg-gray-200"></div>
                        <div className="font-black text-2xl text-protein">{remainingPro > 0 ? remainingPro : 0} <span className="text-sm text-gray-400 font-bold">g</span></div>
                    </div>
                </div>

                {/* Suggestions List */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                        </div>
                    ) : suggestions.length > 0 ? (
                        suggestions.map((wrapper, idx) => (
                            <button 
                                key={wrapper.uniqueKey} 
                                onClick={() => toggleItem(idx)}
                                className={`w-full text-left bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border transition-all duration-200 group ${
                                    wrapper.selected 
                                    ? 'border-gray-100 opacity-100' 
                                    : 'border-transparent bg-gray-50 opacity-50 grayscale-[0.5]'
                                }`}
                            >
                                <div>
                                    <div className={`font-bold transition-colors ${wrapper.selected ? 'text-gray-800' : 'text-gray-500'}`}>
                                        {wrapper.item.label}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {wrapper.item.cal} kcal • {wrapper.item.pro}g pro
                                    </div>
                                </div>
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    wrapper.selected 
                                    ? 'bg-green-100 text-green-600 scale-100' 
                                    : 'bg-gray-200 text-gray-400 scale-90'
                                }`}>
                                    {wrapper.selected ? '✓' : ''}
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            Couldn't find a good combination from your saved meals to fit this gap. Try creating more presets!
                        </div>
                    )}
                </div>

                {/* Result Summary */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 shrink-0 border border-gray-100">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-500">SELECTED TOTAL</span>
                        <button onClick={generate} className="text-xs font-bold text-accent hover:underline">Regenerate</button>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-black ${totals.cal > remainingCal + 100 ? 'text-red-500' : 'text-gray-800'}`}>
                            {totals.cal}
                        </span>
                        <span className="text-xs font-bold text-gray-400">kcal</span>
                        
                        <span className="mx-2 text-gray-300">|</span>

                        <span className={`text-xl font-black ${Math.abs(remainingPro - totals.pro) > 10 ? 'text-indigo-400' : 'text-protein'}`}>
                            {totals.pro}
                        </span>
                        <span className="text-xs font-bold text-gray-400">pro</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 shrink-0">
                    <button 
                        onClick={onClose}
                        className="py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleLog}
                        disabled={suggestions.filter(s => s.selected).length === 0}
                        className={`py-3 rounded-2xl font-bold text-white transition shadow-lg ${
                            suggestions.filter(s => s.selected).length > 0 
                            ? 'bg-black active:scale-95' 
                            : 'bg-gray-300'
                        }`}
                    >
                        Log Selected
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuggestionModal;