import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LogEntry, Settings, Preset, AppData } from './types';
import { ChevronLeft, ChevronRight, SettingsIcon, BookOpen, Trash2, Bookmark, Calculator, Dumbbell, Lock } from './components/Icons';
import ProgressRing from './components/ProgressRing';
import SettingsModal from './components/SettingsModal';
import PresetsModal from './components/PresetsModal';
import SavePresetModal from './components/SavePresetModal';
import NameModal from './components/NameModal';
import ConfirmModal from './components/ConfirmModal';
import CalendarModal from './components/CalendarModal';
import BackupReminderModal from './components/BackupReminderModal';
import Confetti from './components/Confetti';
import InstallPrompt from './components/InstallPrompt';
import FoodCalculatorModal from './components/FoodCalculatorModal';
import SuggestionModal from './components/SuggestionModal';
import DebugMenu from './components/DebugMenu';
import RecalculateReminderModal from './components/RecalculateReminderModal';
import CalculatorModal from './components/CalculatorModal';
import DoorAccessModal from './components/DoorAccessModal';

// FIX: Use local time construction to prevent timezone shifting (UTC vs Local)
const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const DEFAULT_SETTINGS: Settings = { 
    goals: { cal: 2000, pro: 150 },
    mode: 'both',
    name: ''
};

function App() {
    // --- State ---
    const [history, setHistory] = useState<LogEntry[]>([]);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    
    // Inputs
    const [inputCal, setInputCal] = useState('');
    const [inputPro, setInputPro] = useState('');

    // UI Toggle State
    const [statsPeriod, setStatsPeriod] = useState<'weekly' | 'monthly'>('weekly');
    const [showStatusText, setShowStatusText] = useState(false);
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modals & UI State
    const [showSettings, setShowSettings] = useState(false);
    const [showPresets, setShowPresets] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showBackupReminder, setShowBackupReminder] = useState(false);
    const [showFoodCalculator, setShowFoodCalculator] = useState(false);
    const [showSuggestion, setShowSuggestion] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    
    // New Feature State
    const [showDebugMenu, setShowDebugMenu] = useState(false);
    const [showRecalculateReminder, setShowRecalculateReminder] = useState(false);
    const [showStandaloneCalculator, setShowStandaloneCalculator] = useState(false);
    const [showDoorModal, setShowDoorModal] = useState(false);
    
    // Logic State
    const [hasCelebrated, setHasCelebrated] = useState(false);
    
    // Staging Data
    const [entryToSave, setEntryToSave] = useState<LogEntry | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

    // --- Persistence ---
    useEffect(() => {
        const stored = localStorage.getItem('glowTracker');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.history) setHistory(parsed.history);
                if (parsed.presets) setPresets(parsed.presets);
                if (parsed.settings) {
                    // Merge with DEFAULT_SETTINGS to ensure new fields (like name) are not lost if missing in old data
                    setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
                } else if (parsed.goals) {
                    // Legacy migration
                    setSettings({ ...DEFAULT_SETTINGS, goals: parsed.goals });
                }
            } catch (e) {
                console.error("Failed to load data", e);
            }
        }
        setIsDataLoaded(true);
    }, []);

    useEffect(() => {
        if (!isDataLoaded) return;
        localStorage.setItem('glowTracker', JSON.stringify({ 
            history, 
            settings, 
            presets 
        }));
    }, [history, settings, presets, isDataLoaded]);

    // --- Keyboard Listeners (Debug) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Prevent debug menu toggle if user is typing in an input
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            
            if (!isInput && e.key.toLowerCase() === 'd') {
                setShowDebugMenu(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- Reminders Logic (Backup & Recalculate) ---
    useEffect(() => {
        if (!isDataLoaded || history.length === 0) return;

        const checkReminders = () => {
            const now = new Date();
            const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // 1. Backup Reminder (Last day of month)
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            if (tomorrow.getDate() === 1) { // Today is last day
                const lastShown = localStorage.getItem('simplycal_backup_reminder_seen');
                if (lastShown !== currentMonthKey) {
                    // Check usage duration > 20 days
                    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
                    const [y, m, d] = sortedHistory[0].date.split('-').map(Number);
                    const startDate = new Date(y, m - 1, d);
                    const diffDays = Math.ceil(Math.abs(now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays >= 20) {
                        setShowBackupReminder(true);
                    }
                }
            }

            // 2. Recalculate Reminder (15+ unique days logged & only at start of month)
            const uniqueDaysLogged = new Set(history.map(h => h.date)).size;
            const isStartOfMonth = now.getDate() <= 5; // Only trigger in the first 5 days

            if (uniqueDaysLogged >= 15 && isStartOfMonth) {
                const lastRecalcShown = localStorage.getItem('simplycal_recalc_reminder_seen');
                if (lastRecalcShown !== currentMonthKey) {
                    setShowRecalculateReminder(true);
                }
            }
        };

        checkReminders();
    }, [isDataLoaded, history.length]);

    // --- Check if goal met on load to prevent duplicate celebration ---
    useEffect(() => {
        const dateKey = formatDateKey(new Date());
        const todaysLogs = history.filter(h => h.date === dateKey);
        const totalPro = todaysLogs.reduce((sum, item) => sum + item.pro, 0);
        
        if (totalPro >= settings.goals.pro && settings.goals.pro > 0) {
            setHasCelebrated(true);
        }
    }, [history.length]); // Simple check on mount/load

    // --- Derived Data ---
    const dateKey = formatDateKey(currentDate);
    const isToday = dateKey === formatDateKey(new Date());

    const todaysLogs = useMemo(() => {
        return history.filter(h => h.date === dateKey).sort((a, b) => b.ts - a.ts);
    }, [history, dateKey]);

    const stats = useMemo(() => {
        return todaysLogs.reduce((acc, log) => ({
            cal: acc.cal + log.cal,
            pro: acc.pro + log.pro
        }), { cal: 0, pro: 0 });
    }, [todaysLogs]);

    const periodStats = useMemo(() => {
        let startStr: string;
        let endStr: string;

        // Clone current date to avoid mutation issues
        const curr = new Date(currentDate);

        if (statsPeriod === 'weekly') {
            // Monday - Sunday logic
            const day = curr.getDay(); // 0 is Sunday
            const dayAdjusted = day === 0 ? 7 : day; // Convert to 1 (Mon) - 7 (Sun)
            const diff = curr.getDate() - dayAdjusted + 1; // Calculate Monday
            
            const startOfWeek = new Date(curr);
            startOfWeek.setDate(diff);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Sunday

            startStr = formatDateKey(startOfWeek);
            endStr = formatDateKey(endOfWeek);
        } else {
            // Get Month (Calendar Month)
            const startOfMonth = new Date(curr.getFullYear(), curr.getMonth(), 1);
            const endOfMonth = new Date(curr.getFullYear(), curr.getMonth() + 1, 0); // Last day of month

            startStr = formatDateKey(startOfMonth);
            endStr = formatDateKey(endOfMonth);
        }

        // Filter history based on range strings (inclusive)
        const relevantLogs = history.filter(h => h.date >= startStr && h.date <= endStr);
        
        // Group by day to calculate average daily intake
        const daysMap: Record<string, {cal: number, pro: number}> = {};
        
        relevantLogs.forEach(h => {
            if (!daysMap[h.date]) daysMap[h.date] = { cal: 0, pro: 0 };
            daysMap[h.date].cal += h.cal;
            daysMap[h.date].pro += h.pro;
        });

        const daysLogged = Object.keys(daysMap).length || 1;
        const total = Object.values(daysMap).reduce((acc, d) => ({ cal: acc.cal + d.cal, pro: acc.pro + d.pro }), { cal: 0, pro: 0 });

        return {
            cal: Math.round(total.cal / daysLogged),
            pro: Math.round(total.pro / daysLogged)
        };
    }, [history, statsPeriod, currentDate]);

    const getStatusMessage = (avgCal: number, goalCal: number) => {
        const diff = avgCal - goalCal; // Positive means OVER goal, Negative means UNDER goal
        
        // "200 cals under goal" -> diff <= -200
        if (diff <= -200) return "Eat some more?";
        
        // "199 under to 100 over" -> -199 <= diff <= 100
        if (diff > -200 && diff <= 100) return "On track ❤️";
        
        // "101 over til 300 over" -> 101 <= diff <= 300
        if (diff > 100 && diff <= 300) return "Slowly losing weight";
        
        // "301 over to 600 over" -> 301 <= diff <= 600
        if (diff > 300 && diff <= 600) return "Maintaining weight";
        
        // "over 601" -> diff >= 601
        if (diff > 600) return "Gaining weight";

        return "";
    };

    const statusMessage = useMemo(() => {
        if (!settings.goals.cal) return "";
        return getStatusMessage(periodStats.cal, settings.goals.cal);
    }, [periodStats.cal, settings.goals.cal]);


    // --- Actions ---
    const handleToggleStats = () => {
        setStatsPeriod(prev => prev === 'weekly' ? 'monthly' : 'weekly');
        
        // Reset and start timer for text visibility
        setShowStatusText(true);
        if (statusTimerRef.current) {
            clearTimeout(statusTimerRef.current);
        }
        statusTimerRef.current = setTimeout(() => {
            setShowStatusText(false);
        }, 10000); // 10 seconds
    };

    const handleConfettiComplete = useCallback(() => {
        setShowConfetti(false);
    }, []);

    const handleAdd = (c?: number, p?: number, label?: string) => {
        const cVal = c !== undefined ? c : parseInt(inputCal);
        const pVal = p !== undefined ? p : parseInt(inputPro);

        const cleanCal = isNaN(cVal) ? 0 : cVal;
        const cleanPro = isNaN(pVal) ? 0 : pVal;

        if (cleanCal === 0 && cleanPro === 0) return;

        // 1. Check for Celebration (Goal Met Today)
        if (isToday) {
            const currentPro = stats.pro;
            const goalPro = settings.goals.pro;
            if (!hasCelebrated && currentPro < goalPro && (currentPro + cleanPro) >= goalPro) {
                setShowConfetti(true);
                setHasCelebrated(true);
            }
        }

        const newEntry: LogEntry = {
            id: Date.now().toString() + Math.random().toString(),
            date: dateKey,
            ts: Date.now(),
            cal: cleanCal,
            pro: cleanPro,
            label: label
        };

        setHistory(prev => [...prev, newEntry]);
        setInputCal('');
        setInputPro('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleLogSuggestions = (items: Preset[]) => {
        // Log all suggested items
        const newEntries: LogEntry[] = items.map(item => ({
            id: Date.now().toString() + Math.random().toString(),
            date: dateKey,
            ts: Date.now(),
            cal: item.cal,
            pro: item.pro,
            label: item.label
        }));

        setHistory(prev => [...prev, ...newEntries]);
        
        // Check celebration for suggestions
        if (isToday) {
            const addedPro = items.reduce((sum, item) => sum + item.pro, 0);
            const currentPro = stats.pro;
            const goalPro = settings.goals.pro;
            if (!hasCelebrated && currentPro < goalPro && (currentPro + addedPro) >= goalPro) {
                setShowConfetti(true);
                setHasCelebrated(true);
            }
        }
    };

    const initiateDelete = (id: string) => {
        setEntryToDelete(id);
        setShowConfirmModal(true);
    };

    const confirmDelete = () => {
        if (entryToDelete) {
            setHistory(prev => prev.filter(h => h.id !== entryToDelete));
            setEntryToDelete(null);
        }
    };

    const initiateSavePreset = (entry: LogEntry) => {
        setEntryToSave(entry);
        setShowSaveModal(true);
    };

    const finalizeSavePreset = (name: string) => {
        if (entryToSave && name) {
            const newPreset: Preset = {
                id: Date.now().toString(),
                label: name,
                cal: entryToSave.cal,
                pro: entryToSave.pro
            };
            setPresets(prev => [...prev, newPreset]);
            setHistory(prev => prev.map(item => 
                item.id === entryToSave.id ? { ...item, label: name } : item
            ));
            setShowSaveModal(false);
            setEntryToSave(null);
        }
    };

    const handleDeletePreset = (id: string) => {
        setPresets(prev => prev.filter(p => p.id !== id));
    };

    const handleSelectPreset = (preset: Preset) => {
        handleAdd(preset.cal, preset.pro, preset.label);
        setShowPresets(false);
    };

    const handleApplyFoodCalculation = (c: number, p: number) => {
        handleAdd(c, p);
    };

    const handleApplyGoalCalculation = (cal: number, pro: number) => {
        setSettings(prev => ({
            ...prev,
            goals: { cal, pro }
        }));
        setShowStandaloneCalculator(false);
    };

    const changeDate = (days: number) => {
        const next = new Date(currentDate);
        next.setDate(currentDate.getDate() + days);
        setCurrentDate(next);
    };
    
    const handleDateSelect = (date: Date) => {
        setCurrentDate(date);
        setShowCalendar(false);
    };

    const handleNameSave = (name: string) => {
        setSettings(prev => ({ ...prev, name }));
    };

    const handleImportData = (data: AppData, mode: 'full' | 'presets_only' = 'full') => {
        // ... (existing import logic preserved) ...
        // Re-implementing briefly for XML integrity
        if (!data || typeof data !== 'object') { alert("Invalid data"); return; }
        const incomingPresets = Array.isArray(data.presets) ? data.presets : [];
        const existingPresetsMap = new Map(presets.map(p => [p.id, p]));
        
        incomingPresets.forEach(p => {
             if (!p || (!p.label && !p.cal && !p.pro)) return;
             let safeId = p.id || `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
             const cleanPreset: Preset = {
                id: safeId,
                label: p.label || 'Unnamed Meal',
                cal: Number(p.cal) || 0,
                pro: Number(p.pro) || 0
            };
            existingPresetsMap.set(safeId, cleanPreset);
        });
        
        const newPresets = Array.from(existingPresetsMap.values());
        let newHistory = history;
        let newSettings = settings;

        if (mode === 'full') {
            const incomingHistory = Array.isArray(data.history) ? data.history : [];
            const existingHistoryMap = new Map(history.map(h => [h.id, h]));
            incomingHistory.forEach(h => {
                if (!h) return;
                let safeId = h.id || `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                existingHistoryMap.set(safeId, { ...h, id: safeId });
            });
            newHistory = Array.from(existingHistoryMap.values());
            if (data.settings && typeof data.settings === 'object') {
                 newSettings = {
                    ...settings, ...data.settings,
                    goals: { ...settings.goals, ...(data.settings.goals || {}) }
                };
            }
        }
        
        setHistory(newHistory);
        setPresets(newPresets);
        setSettings(newSettings);
        localStorage.setItem('glowTracker', JSON.stringify({ history: newHistory, presets: newPresets, settings: newSettings }));
        
        if (mode === 'full') alert(`Restored!`);
        else alert(`Imported ${newPresets.length} meals.`);
    };

    const markBackupSeen = () => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        localStorage.setItem('simplycal_backup_reminder_seen', currentMonthKey);
        setShowBackupReminder(false);
    };

    const handleBackupConfirm = () => {
        // Simple export logic reused
        const data: AppData = { history, presets, settings };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simplycal_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        markBackupSeen();
    };

    const markRecalcSeen = () => {
         const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        localStorage.setItem('simplycal_recalc_reminder_seen', currentMonthKey);
        setShowRecalculateReminder(false);
    }

    const handleRecalculateConfirm = () => {
        markRecalcSeen();
        setShowStandaloneCalculator(true);
    };

    const handleRingClick = () => {
        const remCal = settings.goals.cal - stats.cal;
        const remPro = settings.goals.pro - stats.pro;
        if (remCal > 0 || remPro > 0) {
            setShowSuggestion(true);
        }
    };

    // --- Render Helpers ---
    const showCal = settings.mode === 'both' || settings.mode === 'cal';
    const showPro = settings.mode === 'both' || settings.mode === 'pro';
    const textPositionClass = settings.mode === 'both' ? 'left-[77%] -translate-x-1/2' : 'left-1/2 -translate-x-1/2';

    return (
        <div className="min-h-screen pb-10 max-w-[480px] mx-auto px-5 pt-14">
            {showConfetti && <Confetti onComplete={handleConfettiComplete} />}
            <InstallPrompt />
            
            <DebugMenu 
                isOpen={showDebugMenu}
                onClose={() => setShowDebugMenu(false)}
                onTestConfetti={() => { setShowConfetti(true); setShowDebugMenu(false); }}
                onOpenGoalCalculator={() => { setShowStandaloneCalculator(true); setShowDebugMenu(false); }}
                onOpenFoodCalculator={() => { setShowFoodCalculator(true); setShowDebugMenu(false); }}
                onOpenSuggestion={() => { setShowSuggestion(true); setShowDebugMenu(false); }}
                onOpenBackup={() => { setShowBackupReminder(true); setShowDebugMenu(false); }}
                onOpenRecalculate={() => { setShowRecalculateReminder(true); setShowDebugMenu(false); }}
            />

            {/* Header */}
            <header className="flex justify-between items-center py-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                        Hey! {settings.name} 
                        <button 
                            onClick={() => setShowNameModal(true)}
                            className="hover:scale-110 transition-transform active:scale-90"
                        >
                            ✨
                        </button>
                    </h1>
                    <div className="flex items-center gap-2 mt-1 text-gray-500 text-sm font-medium">
                        <button onClick={() => changeDate(-1)} className="p-1 hover:bg-gray-200 rounded-full transition">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        <button 
                            onClick={() => setShowCalendar(true)}
                            className="px-2 py-1 -mx-2 hover:bg-white/50 rounded-lg transition active:scale-95 flex items-center gap-1"
                        >
                            <span>{isToday ? "Today, " : ""}{getDisplayDate(currentDate)}</span>
                        </button>

                        <button 
                            onClick={() => changeDate(1)} 
                            disabled={isToday}
                            className={`p-1 rounded-full transition ${isToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-200'}`}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Feature for 'Davis': Link to LiftLog */}
                    {settings.name?.toLowerCase().trim() === 'davis' && (
                        <>
                            <a 
                                href="https://liftlog-davis.vercel.app/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-3 bg-white/50 rounded-2xl hover:bg-white transition shadow-sm active:scale-95 text-gray-700"
                                aria-label="Open LiftLog"
                            >
                                <Dumbbell className="w-6 h-6" />
                            </a>
                            <button 
                                onClick={() => setShowDoorModal(true)}
                                className="p-3 bg-white/50 rounded-2xl hover:bg-white transition shadow-sm active:scale-95 text-gray-700"
                            >
                                <Lock className="w-6 h-6" />
                            </button>
                        </>
                    )}
                    
                    <button 
                        onClick={() => setShowSettings(true)} 
                        className="p-3 bg-white/50 rounded-2xl hover:bg-white transition shadow-sm active:scale-95"
                    >
                        <SettingsIcon className="text-gray-700 w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Stats Card */}
            <div className="bg-white/60 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white/50 mb-6 animate-pop-in relative">
                <div className="flex items-center justify-between mb-4 relative min-h-[32px]">
                    <button 
                        onClick={handleToggleStats}
                        className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:opacity-90 transition-opacity uppercase tracking-wide z-10"
                    >
                        {statsPeriod} AVERAGE
                    </button>
                    
                    {statusMessage && (
                        <span 
                            className={`text-xs font-bold text-gray-500 transition-opacity duration-1000 absolute ${textPositionClass} top-1/2 -translate-y-1/2 whitespace-nowrap ${showStatusText ? 'opacity-100' : 'opacity-0'}`}
                        >
                            {statusMessage}
                        </span>
                    )}
                </div>
                
                <div className={`flex justify-around items-center ${!showCal || !showPro ? 'justify-center' : ''}`}>
                    {showCal && (
                        <div className="text-center min-w-[80px]">
                            <span className="block text-3xl font-black text-gray-800">{periodStats.cal}</span>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kcal</span>
                        </div>
                    )}
                    {showCal && showPro && <div className="w-px h-10 bg-gray-200"></div>}
                    {showPro && (
                        <div className="text-center min-w-[80px]">
                            <span className="block text-3xl font-black text-protein">{periodStats.pro}</span>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Protein</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Rings & Input */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-6 shadow-lg shadow-gray-200/50 mb-8 border border-white animate-pop-in [animation-delay:100ms]">
                <h2 className="text-center text-gray-400 text-sm font-bold uppercase tracking-widest mb-6">
                    {isToday ? "Today" : getDisplayDate(currentDate)}
                </h2>
                <div className={`grid gap-4 mb-8 ${settings.mode === 'both' ? 'grid-cols-2' : 'grid-cols-1 justify-items-center'}`}>
                    {showCal && (
                        <ProgressRing 
                            radius={settings.mode === 'both' ? 55 : 70} 
                            stroke={settings.mode === 'both' ? 10 : 12} 
                            progress={stats.cal / (settings.goals.cal || 1)} 
                            type="cal"
                            label={stats.cal.toString()} 
                            subLabel="kcal"
                            onClick={handleRingClick}
                        />
                    )}
                    {showPro && (
                        <ProgressRing 
                            radius={settings.mode === 'both' ? 55 : 70} 
                            stroke={settings.mode === 'both' ? 10 : 12} 
                            progress={stats.pro / (settings.goals.pro || 1)} 
                            type="pro"
                            label={stats.pro.toString()} 
                            subLabel="protein"
                            onClick={handleRingClick}
                        />
                    )}
                </div>

                <div className="flex gap-3">
                    <div className={`flex-1 grid gap-3 ${settings.mode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {showCal && (
                            <input 
                                type="number" 
                                inputMode="numeric" 
                                placeholder="Cal" 
                                value={inputCal}
                                onChange={(e) => setInputCal(e.target.value)}
                                className="w-full bg-gray-100/50 rounded-2xl px-4 py-4 text-center font-bold text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        )}
                        {showPro && (
                            <input 
                                type="number" 
                                inputMode="numeric" 
                                placeholder="Pro" 
                                value={inputPro}
                                onChange={(e) => setInputPro(e.target.value)}
                                className="w-full bg-gray-100/50 rounded-2xl px-4 py-4 text-center font-bold text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-protein outline-none transition-all"
                            />
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => handleAdd()} 
                            className="h-full bg-gray-900 text-white rounded-2xl px-5 font-bold text-2xl active:scale-95 transition-transform shadow-lg shadow-gray-900/20"
                        >
                            +
                        </button>
                    </div>
                </div>
                
                {/* Secondary Actions Grid */}
                <div className="mt-3 flex gap-3">
                     <button 
                        onClick={() => setShowPresets(true)}
                        className="flex-1 py-3 px-2 flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:text-accent hover:bg-white/50 rounded-2xl transition"
                    >
                        <BookOpen className="w-4 h-4" /> Use Saved Meal
                    </button>
                    <button 
                        onClick={() => setShowFoodCalculator(true)}
                        className="flex-1 py-3 px-2 flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:text-accent hover:bg-white/50 rounded-2xl transition"
                    >
                        <Calculator className="w-4 h-4" /> Calculate
                    </button>
                </div>
            </div>

            {/* History */}
            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 ml-2">History</h3>
                <div className="bg-white/60 backdrop-blur-lg rounded-[32px] p-2 border border-white/50 min-h-[100px] animate-slide-up">
                    {todaysLogs.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            No magic added for this date yet ✨
                        </div>
                    ) : (
                        todaysLogs.map((log) => (
                            <div key={log.id} className="relative flex justify-between items-center p-4 mb-1 last:mb-0 rounded-2xl bg-white/40 hover:bg-white/80 transition-colors">
                                <div>
                                    <div className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-2">
                                        <span>{new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {log.label && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span className="text-gray-700 font-semibold truncate max-w-[120px]">{log.label}</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        {showCal && <span className="font-bold text-lg text-gray-800">{log.cal} kcal</span>}
                                        {showPro && <span className="text-sm font-bold text-protein">{log.pro}g pro</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 z-10 relative">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            initiateSavePreset(log);
                                        }}
                                        className="p-3 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-xl transition active:scale-90 cursor-pointer"
                                        aria-label="Save to presets"
                                    >
                                        <Bookmark className="w-5 h-5" filled={!!log.label} />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            initiateDelete(log.id);
                                        }}
                                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition active:scale-90 cursor-pointer"
                                        aria-label="Delete entry"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-xs text-gray-400 font-medium">
                Project by <a href="https://x.com/DiemetriX" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Thomas Davis</a>
            </div>

            {/* Modals */}
            <SettingsModal 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)} 
                settings={settings}
                onSave={setSettings}
                history={history}
                presets={presets}
                onImportData={handleImportData}
            />

            <PresetsModal 
                isOpen={showPresets} 
                onClose={() => setShowPresets(false)} 
                presets={presets}
                onSelect={handleSelectPreset}
                onDelete={handleDeletePreset}
                history={history}
            />

            <SavePresetModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onSave={finalizeSavePreset}
            />

            <NameModal 
                isOpen={showNameModal}
                onClose={() => setShowNameModal(false)}
                currentName={settings.name || ''}
                onSave={handleNameSave}
            />

            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={confirmDelete}
                title="Delete Entry?"
                message="Are you sure you want to remove this logged meal? This action cannot be undone."
            />

            <BackupReminderModal
                isOpen={showBackupReminder}
                onClose={markBackupSeen}
                onConfirm={handleBackupConfirm}
            />
            
            <RecalculateReminderModal 
                isOpen={showRecalculateReminder}
                onClose={markRecalcSeen}
                onRecalculate={handleRecalculateConfirm}
            />
            
            <CalculatorModal 
                isOpen={showStandaloneCalculator}
                onClose={() => setShowStandaloneCalculator(false)}
                onApply={handleApplyGoalCalculation}
            />

            <CalendarModal
                isOpen={showCalendar}
                onClose={() => setShowCalendar(false)}
                currentDate={currentDate}
                onSelectDate={handleDateSelect}
                history={history}
                goals={settings.goals}
            />

            <FoodCalculatorModal 
                isOpen={showFoodCalculator}
                onClose={() => setShowFoodCalculator(false)}
                mode={settings.mode}
                onApply={handleApplyFoodCalculation}
            />

            <SuggestionModal 
                isOpen={showSuggestion} 
                onClose={() => setShowSuggestion(false)}
                onLogSuggestions={handleLogSuggestions}
                remainingCal={settings.goals.cal - stats.cal}
                remainingPro={settings.goals.pro - stats.pro}
                presets={presets}
                mode={settings.mode}
            />

            <DoorAccessModal 
                isOpen={showDoorModal} 
                onClose={() => setShowDoorModal(false)} 
            />
        </div>
    );
}

export default App;