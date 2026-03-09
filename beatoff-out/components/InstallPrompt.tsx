import React, { useState, useEffect } from 'react';
import { X } from './Icons';

const InstallPrompt = () => {
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already in standalone mode (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) return;

        // Check if user has seen this before
        const hasSeen = localStorage.getItem('simplycal_install_prompt_seen');
        if (hasSeen) return;

        // Detect Platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);

        // Show prompt after a short delay for nice UX
        const timer = setTimeout(() => setShow(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('simplycal_install_prompt_seen', 'true');
    };

    if (!show) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[200] p-4 flex justify-center pointer-events-none">
            <div className="bg-white/95 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-5 w-full max-w-sm pointer-events-auto animate-slide-up relative">
                <button 
                    onClick={handleDismiss} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 bg-gray-100 rounded-full"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex gap-4 items-start">
                    <div className="bg-gradient-to-br from-accent to-yellow-400 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 text-white font-bold text-xl">
                        SC
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">Install SimplyCal</h3>
                        <p className="text-gray-600 text-sm leading-snug mt-1">
                            Add to your home screen for the best full-screen experience.
                        </p>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
                    {isIOS ? (
                        <div className="flex items-center gap-2">
                            <span>Tap</span>
                            <span className="inline-block"><svg width="20" height="24" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L10 18" stroke="#007AFF" stroke-width="2" stroke-linecap="round"/><path d="M4 8L10 2L16 8" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14V22C2 24.2091 3.79086 26 6 26H14C16.2091 26 18 24.2091 18 22V14" stroke="#007AFF" stroke-width="2" stroke-linecap="round"/></svg></span>
                            <span>then select <strong>Add to Home Screen</strong></span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span>Tap the menu icon, then select <strong>Add to Home Screen</strong> or <strong>Install App</strong>.</span>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleDismiss}
                    className="mt-4 w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl text-sm"
                >
                    Got it!
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;