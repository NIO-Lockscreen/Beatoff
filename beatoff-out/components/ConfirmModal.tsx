import React from 'react';
import { X } from './Icons';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-pop-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                
                <p className="text-gray-600 mb-8 leading-relaxed">
                    {message}
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="flex-1 py-3 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition shadow-lg shadow-red-500/30"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;