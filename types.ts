export type TrackingMode = 'both' | 'cal' | 'pro';

export interface LogEntry {
    id: string;
    date: string; // YYYY-MM-DD
    cal: number;
    pro: number;
    ts: number;
    label?: string;
}

export interface Goals {
    cal: number;
    pro: number;
}

export interface Settings {
    goals: Goals;
    mode: TrackingMode;
    name?: string;
}

export interface Preset {
    id: string;
    label: string;
    cal: number;
    pro: number;
}

export interface AppData {
    history: LogEntry[];
    settings: Settings;
    presets: Preset[];
}