import React, { useState, useEffect } from 'react';
import { X } from './Icons';

interface NameModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentName: string;
    onSave: (name: string) => void;
}

const NameModal: React.FC<NameModalProps> = ({ isOpen, onClose, currentName, onSave }) => {
    const [name, setName] = useState(currentName);

    useEffect(() => {
        if (isOpen) setName(currentName || '');
    }, [isOpen, currentName]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-pop-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">What should we call you?</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    autoFocus
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-accent outline-none text-lg mb-6 font-bold text-center"
                />

                <button 
                    onClick={() => {
                        onSave(name);
                        onClose();
                    }}
                    className="w-full py-3 rounded-2xl font-bold text-white transition shadow-lg bg-black active:scale-95"
                >
                    Save Name
                </button>
            </div>
        </div>
    );
};

export default NameModal;