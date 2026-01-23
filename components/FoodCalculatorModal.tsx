import React, { useState, useEffect } from 'react';
import { X, Calculator } from './Icons';
import { TrackingMode } from '../types';

interface FoodCalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: TrackingMode;
    onApply: (cal: number, pro: number) => void;
}

const FoodCalculatorModal: React.FC<FoodCalculatorModalProps> = ({ isOpen, onClose, mode, onApply }) => {
    const [weight, setWeight] = useState('');
    const [cal100, setCal100] = useState('');
    const [pro100, setPro100] = useState('');

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setWeight('');
            setCal100('');
            setPro100('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const showCal = mode === 'both' || mode === 'cal';
    const showPro = mode === 'both' || mode === 'pro';

    // Calculation Logic
    const w = parseFloat(weight) || 0;
    const c100 = parseFloat(cal100) || 0;
    const p100 = parseFloat(pro100) || 0;

    const totalCal = Math.round((c100 * w) / 100);
    const totalPro = Math.round((p100 * w) / 100);

    const handleApply = () => {
        onApply(totalCal, totalPro);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl w-full max-w-sm animate-pop-in">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-2 rounded-xl text-orange-600">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Food Calculator</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Weight Input (Always Visible) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">WEIGHT (g)</label>
                        <input 
                            type="number" 
                            inputMode="decimal"
                            value={weight}
                            onChange={e => setWeight(e.target.value)}
                            autoFocus
                            className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-gray-400 outline-none text-lg"
                            placeholder="e.g., 150"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {showCal && (
                            <div className={!showPro ? "col-span-2" : ""}>
                                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">KCAL / 100g</label>
                                <input 
                                    type="number" 
                                    inputMode="decimal"
                                    value={cal100}
                                    onChange={e => setCal100(e.target.value)}
                                    className="w-full bg-orange-50 p-3 rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-accent outline-none"
                                    placeholder="0"
                                />
                            </div>
                        )}
                        {showPro && (
                            <div className={!showCal ? "col-span-2" : ""}>
                                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">PROTEIN / 100g</label>
                                <input 
                                    type="number" 
                                    inputMode="decimal"
                                    value={pro100}
                                    onChange={e => setPro100(e.target.value)}
                                    className="w-full bg-indigo-50 p-3 rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-protein outline-none"
                                    placeholder="0"
                                />
                            </div>
                        )}
                    </div>

                    {/* Live Result Preview */}
                    <div className="bg-gray-100/50 rounded-2xl p-4 mt-2 flex justify-around items-center border border-gray-100">
                        {showCal && (
                            <div className="text-center">
                                <span className="block text-2xl font-black text-gray-800">{totalCal}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Total Kcal</span>
                            </div>
                        )}
                        {showCal && showPro && <div className="w-px h-8 bg-gray-300/50"></div>}
                        {showPro && (
                            <div className="text-center">
                                <span className="block text-2xl font-black text-protein">{totalPro}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Total Protein</span>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleApply}
                        disabled={!weight || (showCal && !cal100 && !pro100) || (showPro && !pro100 && !cal100)}
                        className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all shadow-lg mt-2 ${
                            (!weight) 
                            ? 'bg-gray-300 cursor-not-allowed' 
                            : 'bg-black hover:scale-[1.02] active:scale-95 shadow-gray-300'
                        }`}
                    >
                        Use Values
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FoodCalculatorModal;