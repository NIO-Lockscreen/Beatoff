import React, { useState, useEffect } from 'react';
import { X } from './Icons';

interface SavePresetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
}

const SavePresetModal: React.FC<SavePresetModalProps> = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (isOpen) setName('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-pop-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Name this Meal</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Morning Oatmeal"
                    autoFocus
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-accent outline-none text-lg mb-6"
                />

                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            if (name.trim()) onSave(name);
                        }}
                        disabled={!name.trim()}
                        className={`flex-1 py-3 rounded-2xl font-bold text-white transition shadow-lg ${name.trim() ? 'bg-black active:scale-95' : 'bg-gray-300'}`}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SavePresetModal;