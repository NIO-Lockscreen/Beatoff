import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Star } from './Icons';
import { LogEntry, Goals } from '../types';

interface CalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDate: Date;
    onSelectDate: (date: Date) => void;
    history: LogEntry[];
    goals: Goals;
}

const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, currentDate, onSelectDate, history, goals }) => {
    const [viewDate, setViewDate] = useState(new Date());

    useEffect(() => {
        if (isOpen) {
            setViewDate(new Date(currentDate));
        }
    }, [isOpen, currentDate]);

    if (!isOpen) return null;

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Standard getDay() is 0 (Sun) to 6 (Sat)
    // We want 0 (Mon) to 6 (Sun)
    // Formula for Mon start: (day + 6) % 7. 
    // Example: Sun(0) -> 6. Mon(1) -> 0.
    const startDay = new Date(year, month, 1).getDay();
    const firstDayOfMonth = (startDay === 0 ? 6 : startDay - 1); 

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Padding
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null);
    }
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const changeMonth = (offset: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    // Calculate daily status
    // Map: Day Number -> { cal: number, pro: number }
    const dailyData = new Map<number, { cal: number, pro: number }>();
    
    history.forEach(h => {
        const [entryYear, entryMonth, entryDay] = h.date.split('-').map(Number);
        // Ensure we only process this month's data
        if (entryYear === year && (entryMonth - 1) === month) {
            const existing = dailyData.get(entryDay) || { cal: 0, pro: 0 };
            dailyData.set(entryDay, {
                cal: existing.cal + h.cal,
                pro: existing.pro + h.pro
            });
        }
    });

    const getStatus = (day: number) => {
        const data = dailyData.get(day);
        if (!data) return 'none';

        // Logic Refinement:
        // Perfect (Star): Under/Equal Cal Limit AND At/Over Protein Goal
        // Goal Met (Indigo): At/Over Protein Goal (regardless of Cal Limit)
        // Logged (Gray): Logged data but missed Protein Goal

        const metCal = data.cal > 0 && data.cal <= (goals.cal || 2000);
        const metPro = data.pro >= (goals.pro || 150);

        if (metCal && metPro) return 'star'; 
        if (metPro) return 'good';           
        return 'logged';
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-pop-in">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Select Date</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Calendar Controls */}
                <div className="flex justify-between items-center mb-6 px-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="font-bold text-lg text-gray-800 w-32 text-center">
                        {monthNames[month]} {year}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Weekdays - Monday Start */}
                <div className="grid grid-cols-7 mb-2 text-center">
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                        <div key={d} className="text-xs font-bold text-gray-400 py-2">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 mb-6">
                    {days.map((d, i) => {
                        if (d === null) return <div key={`empty-${i}`} />;
                        
                        const isSelected = d === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear();
                        const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                        const status = getStatus(d as number);

                        return (
                            <button
                                key={d}
                                onClick={() => {
                                    const selected = new Date(year, month, d as number);
                                    onSelectDate(selected);
                                }}
                                className={`
                                    relative h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm font-medium transition-all
                                    ${isSelected ? 'bg-black text-white shadow-lg scale-105' : 'text-gray-700 hover:bg-gray-100'}
                                    ${isToday && !isSelected ? 'border-2 border-accent text-accent' : ''}
                                `}
                            >
                                {d}
                                
                                {/* Indicators */}
                                {!isSelected && status === 'star' && (
                                    <div className="absolute -bottom-1 text-yellow-500 drop-shadow-sm">
                                        <Star className="w-3 h-3" filled={true} />
                                    </div>
                                )}
                                {!isSelected && status === 'good' && (
                                    <div className="absolute bottom-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-sm"></div>
                                )}
                                {!isSelected && status === 'logged' && (
                                    <div className="absolute bottom-1.5 w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                                )}
                            </button>
                        );
                    })}
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-4 text-[10px] text-gray-500 font-medium">
                     <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500" filled={true} />
                        <span>Perfect</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                        <span>Protein Met</span>
                    </div>
                     <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                        <span>Logged</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarModal;