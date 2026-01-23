import React, { useState, useEffect } from 'react';
import { X, Lock } from './Icons';

interface DoorAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DoorAccessModal: React.FC<DoorAccessModalProps> = ({ isOpen, onClose }) => {
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Check if user has previously authenticated on this device
            const savedAuth = localStorage.getItem('simplycal_door_auth');
            const authorized = savedAuth === 'true';
            setIsAuthorized(authorized);
            
            setPassword('');
            setStatus('idle');
            setStatusMessage('');
        }
    }, [isOpen]);

    const handleUnlock = async () => {
        // If not already authorized, validate password
        if (!isAuthorized) {
            if (password !== 'Blank') {
                setStatus('error');
                setStatusMessage('Incorrect Password');
                return;
            }
            // Save authorization for future uses
            localStorage.setItem('simplycal_door_auth', 'true');
            setIsAuthorized(true);
        }

        setStatus('processing');
        
        // 1. Target URL
        const targetUrl = 'https://crm.nidaro.no/api/member/checkin';
        
        // 2. Wrap with CORS Proxy to bypass browser "Network Error"
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
        
        // 3. Add token to body (Browsers block manual 'Cookie' headers in fetch)
        const payload = new URLSearchParams({
            "ActorUUID": "f53ee762-3cc7-4929-a062-21304e993c25", 
            "InstanceUUID": "8c5553c6097149099bb9d66534977262", 
            "Location": "2",
            "MemberSessionToken": "8ec43e57c02642c7bdf863903047e6c2" 
        });

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: payload
            });

            if (response.ok) {
                setStatus('success');
                setStatusMessage('Door Unlocked!');
                setTimeout(onClose, 2000);
            } else {
                setStatus('error');
                setStatusMessage(`Failed: ${response.status}`);
            }
        } catch (error) {
            console.error("Network error:", error);
            setStatus('error');
            setStatusMessage('Network Error (Proxy Failed)');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-pop-in">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                         <div className="bg-gray-100 p-2 rounded-xl text-gray-700">
                            <Lock className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Gym Access</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                
                {status === 'success' ? (
                    <div className="py-8 text-center animate-pop-in">
                         <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                            🔓
                         </div>
                         <h4 className="text-xl font-bold text-green-600">Door Opened!</h4>
                    </div>
                ) : (
                    <>
                        {!isAuthorized ? (
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter Password"
                                autoFocus
                                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-accent outline-none text-lg mb-4 text-center font-bold"
                            />
                        ) : (
                            <div className="mb-6 p-4 bg-green-50 rounded-2xl text-center border border-green-100">
                                <span className="text-green-700 font-bold text-sm">✓ Device Authorized</span>
                            </div>
                        )}
                        
                        {status === 'error' && (
                            <div className="mb-4 text-center text-red-500 font-bold text-sm bg-red-50 py-2 rounded-xl">
                                {statusMessage}
                            </div>
                        )}

                        <button 
                            onClick={handleUnlock}
                            disabled={(!isAuthorized && !password) || status === 'processing'}
                            className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg ${
                                status === 'processing' 
                                ? 'bg-gray-400 cursor-wait' 
                                : 'bg-black active:scale-95'
                            }`}
                        >
                            {status === 'processing' ? 'Opening...' : 'Unlock Door'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default DoorAccessModal;