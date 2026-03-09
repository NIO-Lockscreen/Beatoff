import React from 'react';

interface ProgressRingProps {
    radius: number;
    stroke: number;
    progress: number;
    type: 'cal' | 'pro';
    label: string;
    subLabel: string;
    onClick?: () => void;
}

const ProgressRing: React.FC<ProgressRingProps> = ({ radius, stroke, progress, type, label, subLabel, onClick }) => {
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    
    const safeProgress = Number.isNaN(progress) || !Number.isFinite(progress) ? 0 : Math.min(Math.max(progress, 0), 1);
    const strokeDashoffset = circumference - (safeProgress * circumference);

    // Gradient Definitions
    const gradientId = `gradient-${type}`;
    const glowColor = type === 'cal' ? 'rgba(255, 126, 95, 0.5)' : 'rgba(118, 75, 162, 0.5)';

    return (
        <div 
            onClick={onClick}
            className={`relative flex flex-col items-center justify-center transition-transform duration-300 ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
        >
            <svg
                height={radius * 2}
                width={radius * 2}
                className="transform -rotate-90 overflow-visible relative z-10"
            >
                <defs>
                    {type === 'cal' ? (
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FF7E5F" />
                            <stop offset="100%" stopColor="#FFB75E" />
                        </linearGradient>
                    ) : (
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#764BA2" />
                            <stop offset="100%" stopColor="#667EEA" />
                        </linearGradient>
                    )}
                </defs>

                {/* Glow Filter */}
                <filter id={`glow-${type}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                {/* Background Ring */}
                <circle
                    stroke="rgba(0,0,0,0.06)"
                    strokeWidth={stroke}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    strokeLinecap="round"
                />
                
                {/* Progress Ring with Gradient & Glow */}
                <circle
                    stroke={`url(#${gradientId})`}
                    strokeWidth={stroke}
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{ 
                        strokeDashoffset,
                        filter: `drop-shadow(0 0 6px ${glowColor})`
                    }}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                />
            </svg>
            
            {/* Inner Content */}
            <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center flex flex-col items-center justify-center relative">
                    <span className={`block text-xl font-black ${type === 'cal' ? 'text-orange-500' : 'text-indigo-600'} relative z-30 drop-shadow-sm`}>
                        {label}
                    </span>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest opacity-80 mt-0.5 relative z-30">{subLabel}</span>
                </div>
            </div>
        </div>
    );
};

export default ProgressRing;