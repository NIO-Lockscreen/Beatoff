import React from 'react';
import { X, Download } from './Icons';

interface BackupReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const BackupReminderModal: React.FC<BackupReminderModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-pop-in">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                         <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                            <Download className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Monthly Backup</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6 leading-relaxed">
                    You've been tracking your progress for a while! Would you like to save a backup of your data now?
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition"
                    >
                        Later
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="flex-1 py-3 rounded-2xl font-bold text-white bg-black active:scale-95 transition shadow-lg"
                    >
                        Export
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BackupReminderModal;