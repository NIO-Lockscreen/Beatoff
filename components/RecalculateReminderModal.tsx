import React from 'react';
import { X, Calculator } from './Icons';

interface RecalculateReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecalculate: () => void;
}

const RecalculateReminderModal: React.FC<RecalculateReminderModalProps> = ({ isOpen, onClose, onRecalculate }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl w-full max-w-sm animate-pop-in">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Check Your Goals</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6 leading-relaxed font-medium">
                    You've logged quite a few meals! If your weight has changed, you might need to update your calorie and protein targets to keep making progress.
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition"
                    >
                        I'm Good
                    </button>
                    <button 
                        onClick={onRecalculate}
                        className="flex-1 py-3 rounded-2xl font-bold text-white bg-black active:scale-95 transition shadow-lg"
                    >
                        Recalculate
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecalculateReminderModal;