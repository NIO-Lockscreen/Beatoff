import React, { useState } from 'react';
import { X, Calculator } from './Icons';

interface CalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (cal: number, pro: number) => void;
}

const ACTIVITY_LEVELS = [
    { label: 'Sedentary (Office job)', value: 1.2 },
    { label: 'Lightly Active (1-3 days/week)', value: 1.375 },
    { label: 'Moderately Active (3-5 days/week)', value: 1.55 },
    { label: 'Very Active (6-7 days/week)', value: 1.725 },
    { label: 'Extra Active (Physical job)', value: 1.9 },
];

const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose, onApply }) => {
    const [sex, setSex] = useState<'male' | 'female'>('male');
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState(''); // kg
    const [height, setHeight] = useState(''); // cm
    const [activity, setActivity] = useState(1.2);

    if (!isOpen) return null;

    const handleCalculate = () => {
        const w = parseFloat(weight);
        const h = parseFloat(height);
        const a = parseFloat(age);

        if (!w || !h || !a) return;

        // Mifflin-St Jeor Equation
        // Men: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
        // Women: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161
        let bmr = (10 * w) + (6.25 * h) - (5 * a);
        bmr += sex === 'male' ? 5 : -161;

        const tdee = bmr * activity;
        
        // Goals: Maintenance - 500, Protein 1.6g/kg
        const rawTargetCal = tdee - 500;
        const rawTargetPro = w * 1.6;

        // Round calories to nearest 10 (e.g., 2118 -> 2120, 2114 -> 2110)
        const targetCal = Math.round(rawTargetCal / 10) * 10;

        // Round protein to nearest 5 (e.g., 149 -> 150, 163 -> 165)
        const targetPro = Math.round(rawTargetPro / 5) * 5;

        onApply(Math.max(1200, targetCal), targetPro);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl w-full max-w-sm animate-pop-in max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Auto Calculate</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Sex */}
                    <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                        <button 
                            onClick={() => setSex('male')}
                            className={`py-3 rounded-lg text-sm font-bold transition-all ${sex === 'male' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Male
                        </button>
                        <button 
                            onClick={() => setSex('female')}
                            className={`py-3 rounded-lg text-sm font-bold transition-all ${sex === 'female' ? 'bg-white shadow-sm text-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Female
                        </button>
                    </div>

                    {/* Inputs Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">AGE</label>
                            <input 
                                type="number" 
                                value={age}
                                onChange={e => setAge(e.target.value)}
                                className="w-full bg-gray-50 p-3 rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-accent outline-none"
                                placeholder="30"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">WEIGHT (kg)</label>
                            <input 
                                type="number" 
                                value={weight}
                                onChange={e => setWeight(e.target.value)}
                                className="w-full bg-gray-50 p-3 rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-accent outline-none"
                                placeholder="70"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">HEIGHT (cm)</label>
                        <input 
                            type="number" 
                            value={height}
                            onChange={e => setHeight(e.target.value)}
                            className="w-full bg-gray-50 p-3 rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-accent outline-none"
                            placeholder="175"
                        />
                    </div>

                    {/* Activity */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">ACTIVITY LEVEL</label>
                        <div className="space-y-2">
                            {ACTIVITY_LEVELS.map((lvl) => (
                                <button
                                    key={lvl.value}
                                    onClick={() => setActivity(lvl.value)}
                                    className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all border ${
                                        activity === lvl.value 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                                        : 'bg-white border-transparent hover:bg-gray-50 text-gray-600'
                                    }`}
                                >
                                    {lvl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button 
                            onClick={handleCalculate}
                            disabled={!age || !weight || !height}
                            className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all shadow-lg ${
                                (!age || !weight || !height) 
                                ? 'bg-gray-300 cursor-not-allowed' 
                                : 'bg-black hover:scale-[1.02] active:scale-95 shadow-indigo-200'
                            }`}
                        >
                            Calculate & Apply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculatorModal;