import React, { useState } from 'react';
import { GameState, UpgradeType } from '../types';
import { UPGRADES } from '../constants';
import {
  getChance, getEdgeChance, getGoal, getHardGoal, getClutchZoneStart, getHeatCap, getWardCap, getPushSuccessChance,
  INJECTION_FLIPS, INJECTION_METER_PER_CHARGE, MAX_INJECTION_CHARGES,
} from '../hardMode';
import { Bug, X } from 'lucide-react';

// ── Debug panel (debug branch only) ─────────────────────────────────────────
// Opened with Q (or the DBG button on touch screens). Every change it makes marks the
// save as cheated, so nothing from a debug session reaches the leaderboard.

export type DebugOutcome = 'H' | 'T' | 'E';

export interface DebugControls {
  forceNext: DebugOutcome | null; // One-shot outcome for the next flip
  rig: DebugOutcome | null;       // Outcome for every flip until turned off
  speed: number;                  // Game speed multiplier for flips, auto-flip, auto-buy and holds
  pauseAuto: boolean;             // Stop auto-flip without touching the save's toggle
}

export interface DebugEvent { id: number; at: number; text: string; sub: string; }

interface DebugPanelProps {
  state: GameState;
  controls: DebugControls;
  onControls: (patch: Partial<DebugControls>) => void;
  mutate: (fn: (s: GameState) => GameState) => void;
  events: DebugEvent[];
  onClearEvents: () => void;
  onClose: () => void;
}

const ABYSS = [UpgradeType.HARD_BULWARK, UpgradeType.HARD_MOMENTUM, UpgradeType.HARD_STEADY, UpgradeType.HARD_HEAD_START, UpgradeType.HARD_EDGE];
const SPEEDS = [1, 2, 5, 10, 25];
const OUTCOMES: { id: DebugOutcome; label: string }[] = [{ id: 'H', label: 'Heads' }, { id: 'T', label: 'Tails' }, { id: 'E', label: 'Edge' }];

// The prestige-50 player who has just entered hard mode (same profile the balance simulations use)
const ENTRY_UPGRADES: Partial<Record<UpgradeType, number>> = {
  [UpgradeType.PRESTIGE_KARMA]: 8, [UpgradeType.PRESTIGE_FATE]: 5, [UpgradeType.PRESTIGE_FLUX]: 5,
  [UpgradeType.PRESTIGE_AUTO]: 1, [UpgradeType.PRESTIGE_AUTO_BUY]: 1, [UpgradeType.PRESTIGE_EDGING]: 1,
  [UpgradeType.PRESTIGE_LIMITLESS]: 1, [UpgradeType.PRESTIGE_CARE_PACKAGE]: 1, [UpgradeType.PRESTIGE_PARTY_POOPER]: 1,
  [UpgradeType.HARD_MODE_BUFF]: MAX_INJECTION_CHARGES,
};

const fmt = (n: number) => (Math.abs(n) >= 1e6 ? n.toExponential(2).replace('e+', 'e') : Math.round(n).toLocaleString());
const pct = (p: number) => {
  const s = (p * 100).toFixed(p > 0 && p < 0.1 ? 2 : 0);
  return `${s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s}%`;
};

const Btn: React.FC<{ onClick: () => void; active?: boolean; title?: string; disabled?: boolean; children: React.ReactNode }> = ({ onClick, active, title, disabled, children }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`px-2 py-1 text-[10px] font-mono font-bold border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-emerald-400 text-emerald-200 bg-emerald-900/40' : 'border-noir-700 text-noir-300 hover:border-noir-400 hover:text-white bg-black/40'}`}
  >
    {children}
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-t border-noir-800 pt-2">
    <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80 mb-1.5">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-1 flex-wrap">
    <span className="w-16 shrink-0 text-[10px] font-mono text-noir-500 uppercase">{label}</span>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-2 text-[10px] font-mono">
    <span className="text-noir-500 uppercase">{label}</span>
    <span className="text-noir-100 text-right">{value}</span>
  </div>
);

const DebugPanel: React.FC<DebugPanelProps> = ({ state, controls, onControls, mutate, events, onClearEvents, onClose }) => {
  const [copied, setCopied] = useState(false);

  const goal = getGoal(state);
  const zoneStart = getClutchZoneStart(goal);
  const heatCap = getHeatCap(state.upgrades);
  const wardCap = getWardCap(state.upgrades);
  const charges = state.upgrades[UpgradeType.HARD_MODE_BUFF] || 0;
  const atGoal = state.isHardMode && state.streak >= goal && !state.hardPushBust;

  const setUpgrade = (id: UpgradeType, level: number) =>
    mutate(s => ({ ...s, upgrades: { ...s.upgrades, [id]: Math.max(0, Math.min(UPGRADES[id].maxLevel, level)) } }));
  const setStreak = (n: number) => mutate(s => ({ ...s, streak: Math.max(0, n), maxStreak: Math.max(s.maxStreak, n) }));
  const setHardWins = (n: number) => mutate(s => ({ ...s, stats: { ...s.stats, hardModeWins: Math.max(0, n) } }));

  const toggleHard = () => mutate(s => ({
    ...s, isHardMode: !s.isHardMode, streak: 0, hardHeat: 0, injectionFlipsLeft: 0, wardsHeld: 0, hardPushLevel: 0, hardPushBust: false,
  }));

  const freshEntry = () => mutate(s => {
    const upgrades = { ...s.upgrades };
    (Object.keys(upgrades) as UpgradeType[]).forEach(k => { upgrades[k] = ENTRY_UPGRADES[k] ?? 0; });
    return {
      ...s, upgrades, isHardMode: true, prestigeLevel: Math.max(50, s.prestigeLevel), money: 800, streak: 0, maxStreak: 0, totalFlips: 0,
      history: [], hardHeat: 0, wardsHeld: 0, injectionFlipsLeft: 0, hardPushLevel: 0, hardPushBust: false, resolve: 0, injectionMeter: 0,
      hardStarterGranted: true, autoFlipEnabled: true, autoBuyEnabled: true, stats: { ...s.stats, hardModeWins: 0 },
    };
  });

  const veteran = () => mutate(s => ({
    ...s, isHardMode: true, money: Math.max(s.money, 1e20), resolve: Math.max(s.resolve, 500), streak: 0,
    stats: { ...s.stats, hardModeWins: 10 },
    upgrades: {
      ...s.upgrades, [UpgradeType.HARD_BULWARK]: 2, [UpgradeType.HARD_MOMENTUM]: 2, [UpgradeType.HARD_STEADY]: 1,
      [UpgradeType.HARD_HEAD_START]: 1, [UpgradeType.HARD_EDGE]: 2, [UpgradeType.HARD_MODE_BUFF]: MAX_INJECTION_CHARGES,
    },
  }));

  const resetHardProgress = () => mutate(s => {
    const upgrades = { ...s.upgrades, [UpgradeType.HARD_MODE_BUFF]: 0, [UpgradeType.HARD_WARD]: 0 };
    ABYSS.forEach(id => { upgrades[id] = 0; });
    return {
      ...s, upgrades, isHardMode: false, streak: 0, resolve: 0, injectionMeter: 0, hardStarterGranted: false, hardHeat: 0,
      wardsHeld: 0, injectionFlipsLeft: 0, hardPushLevel: 0, hardPushBust: false, stats: { ...s.stats, hardModeWins: 0 },
    };
  });

  const copySave = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: nothing to do */ }
  };

  return (
    <div data-no-flip className="fixed z-[180] left-2 right-2 bottom-2 md:right-auto md:top-2 md:w-[380px] max-h-[70vh] md:max-h-[calc(100vh-1rem)] overflow-y-auto bg-noir-950/95 border border-emerald-700/60 shadow-[0_0_30px_rgba(16,185,129,0.15)] backdrop-blur p-3 space-y-2 font-mono text-noir-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm"><Bug size={14} /> DEBUG <span className="text-[10px] text-noir-500 font-normal">Q to toggle</span></div>
        <button onClick={onClose} className="text-noir-500 hover:text-white cursor-pointer" title="Close (Q / Esc)"><X size={16} /></button>
      </div>
      <p className="text-[10px] text-amber-400/80 leading-snug">Any change here flags this save as cheated (no leaderboard). Use a test save.</p>

      {/* Live readout */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 bg-black/40 border border-noir-800 p-2">
        <Stat label="Mode" value={state.isHardMode ? <span className="text-red-400">HARD</span> : 'normal'} />
        <Stat label="Hard wins" value={state.stats.hardModeWins} />
        <Stat label="Streak" value={`${state.streak} / ${goal}`} />
        <Stat label="Zone from" value={state.isHardMode ? zoneStart : '-'} />
        <Stat label="Heads" value={pct(getChance(state))} />
        <Stat label="Edge" value={pct(getEdgeChance(state))} />
        <Stat label="Heat" value={`${state.hardHeat}/${heatCap}`} />
        <Stat label="Wards" value={`${state.wardsHeld}/${wardCap}`} />
        <Stat label="Charges" value={`${charges}/${MAX_INJECTION_CHARGES}`} />
        <Stat label="Meter" value={`${state.injectionMeter}/${INJECTION_METER_PER_CHARGE}`} />
        <Stat label="Inject" value={state.injectionFlipsLeft > 0 ? `${state.injectionFlipsLeft} left` : 'off'} />
        <Stat label="Push" value={state.hardPushBust ? 'BUST' : state.hardPushLevel > 0 ? `x${2 ** state.hardPushLevel}` : '-'} />
        <Stat label="Resolve" value={fmt(state.resolve)} />
        <Stat label="VF" value={fmt(state.voidFragments)} />
        <Stat label="Money" value={`$${fmt(state.money)}`} />
        <Stat label="Flips" value={fmt(state.totalFlips)} />
        {atGoal && <Stat label="Push odds" value={pct(getPushSuccessChance(state))} />}
      </div>

      <Section title="Flips">
        <Row label="Next">
          {OUTCOMES.map(o => <Btn key={o.id} active={controls.forceNext === o.id} onClick={() => onControls({ forceNext: controls.forceNext === o.id ? null : o.id })} title="Applies to the next flip only">{o.label}</Btn>)}
        </Row>
        <Row label="Rig all">
          <Btn active={controls.rig === null} onClick={() => onControls({ rig: null })}>Off</Btn>
          {OUTCOMES.map(o => <Btn key={o.id} active={controls.rig === o.id} onClick={() => onControls({ rig: o.id })}>{o.label}</Btn>)}
        </Row>
        <Row label="Speed">
          {SPEEDS.map(x => <Btn key={x} active={controls.speed === x} onClick={() => onControls({ speed: x })}>{x}x</Btn>)}
        </Row>
        <Row label="Auto">
          <Btn active={controls.pauseAuto} onClick={() => onControls({ pauseAuto: !controls.pauseAuto })} title="Holds auto-flip without changing the save">{controls.pauseAuto ? 'Paused' : 'Pause'}</Btn>
          <Btn active={state.autoFlipEnabled} onClick={() => mutate(s => ({ ...s, autoFlipEnabled: !s.autoFlipEnabled, upgrades: { ...s.upgrades, [UpgradeType.PRESTIGE_AUTO]: Math.max(1, s.upgrades[UpgradeType.PRESTIGE_AUTO] || 0) } }))}>Flip</Btn>
          <Btn active={state.autoBuyEnabled} onClick={() => mutate(s => ({ ...s, autoBuyEnabled: !s.autoBuyEnabled, upgrades: { ...s.upgrades, [UpgradeType.PRESTIGE_AUTO_BUY]: Math.max(1, s.upgrades[UpgradeType.PRESTIGE_AUTO_BUY] || 0) } }))}>Buy</Btn>
          <Btn active={state.autoInjectEnabled} onClick={() => mutate(s => ({ ...s, autoInjectEnabled: !s.autoInjectEnabled }))}>Inject</Btn>
          <Btn active={state.autoBankEnabled} onClick={() => mutate(s => ({ ...s, autoBankEnabled: !s.autoBankEnabled }))}>Bank</Btn>
        </Row>
      </Section>

      <Section title="Run">
        <Row label="Mode">
          <Btn active={state.isHardMode} onClick={toggleHard} title="Switches instantly and resets the streak">{state.isHardMode ? 'Hard: ON' : 'Hard: OFF'}</Btn>
        </Row>
        <Row label="Hard wins">
          <Btn onClick={() => setHardWins(state.stats.hardModeWins - 1)}>-1</Btn>
          <Btn onClick={() => setHardWins(state.stats.hardModeWins + 1)}>+1</Btn>
          {[0, 5, 10, 19].map(w => <Btn key={w} active={state.stats.hardModeWins === w} onClick={() => setHardWins(w)} title={`Goal ${getHardGoal(w)}`}>{w}</Btn>)}
        </Row>
        <Row label="Streak">
          <Btn onClick={() => setStreak(0)}>0</Btn>
          <Btn onClick={() => setStreak(zoneStart - 1)} title="One Heads from the clutch zone">Zone-1</Btn>
          <Btn onClick={() => setStreak(zoneStart)}>Zone</Btn>
          <Btn onClick={() => setStreak(goal - 1)}>Goal-1</Btn>
          <Btn onClick={() => setStreak(goal)} title="Jumps straight to the win screen">Win</Btn>
          <Btn onClick={() => setStreak(state.streak + 5)}>+5</Btn>
        </Row>
        <Row label="Heat">
          <Btn onClick={() => mutate(s => ({ ...s, hardHeat: 0 }))}>0</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, hardHeat: Math.min(10, heatCap) }))}>10</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, hardHeat: heatCap }))}>Cap</Btn>
        </Row>
        <Row label="Inject">
          <Btn onClick={() => mutate(s => ({ ...s, injectionFlipsLeft: INJECTION_FLIPS }))} title="Ignores the clutch zone rule">Now ({INJECTION_FLIPS})</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, injectionFlipsLeft: 0 }))}>Stop</Btn>
        </Row>
        <Row label="Push">
          <Btn disabled={state.hardPushLevel === 0 || state.hardPushBust} onClick={() => mutate(s => ({ ...s, hardPushBust: true, streak: 0 }))}>Bust now</Btn>
        </Row>
      </Section>

      <Section title="Resources">
        <Row label="Charges">
          {Array.from({ length: MAX_INJECTION_CHARGES + 1 }).map((_, n) => <Btn key={n} active={charges === n} onClick={() => setUpgrade(UpgradeType.HARD_MODE_BUFF, n)}>{n}</Btn>)}
        </Row>
        <Row label="Meter">
          <Btn onClick={() => mutate(s => ({ ...s, injectionMeter: Math.min(INJECTION_METER_PER_CHARGE, s.injectionMeter + 5) }))}>+5</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, injectionMeter: INJECTION_METER_PER_CHARGE - 1 }))}>Almost full</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, injectionMeter: 0 }))}>0</Btn>
        </Row>
        <Row label="Wards">
          <Btn onClick={() => mutate(s => ({ ...s, wardsHeld: Math.min(getWardCap(s.upgrades), s.wardsHeld + 1) }))}>+1</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, wardsHeld: 0 }))}>0</Btn>
          <Btn onClick={() => setUpgrade(UpgradeType.HARD_WARD, 0)} title="Resets this run's Ward price ladder">Reset price</Btn>
        </Row>
        <Row label="Resolve">
          <Btn onClick={() => mutate(s => ({ ...s, resolve: s.resolve + 100 }))}>+100</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, resolve: s.resolve + 1000 }))}>+1k</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, resolve: 0 }))}>0</Btn>
        </Row>
        <Row label="VF">
          <Btn onClick={() => mutate(s => ({ ...s, voidFragments: s.voidFragments + 100 }))}>+100</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, voidFragments: s.voidFragments + 1000 }))}>+1k</Btn>
        </Row>
        <Row label="Money">
          <Btn onClick={() => mutate(s => ({ ...s, money: s.money * 1000 + 1000 }))}>x1000</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, money: 1e19 }))} title="Enough for the first few Wards">$10Qi</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, money: 1e22 }))}>$10Sx</Btn>
          <Btn onClick={() => mutate(s => ({ ...s, money: 0 }))}>0</Btn>
        </Row>
      </Section>

      <Section title="Abyss">
        {ABYSS.map(id => {
          const level = state.upgrades[id] || 0;
          return (
            <Row key={id} label={UPGRADES[id].name.split(' ')[0]}>
              <Btn onClick={() => setUpgrade(id, level - 1)} disabled={level === 0}>-</Btn>
              <span className="w-10 text-center text-[10px]">{level}/{UPGRADES[id].maxLevel}</span>
              <Btn onClick={() => setUpgrade(id, level + 1)} disabled={level >= UPGRADES[id].maxLevel}>+</Btn>
              <span className="text-[10px] text-noir-500 truncate">{UPGRADES[id].formatEffect(UPGRADES[id].getEffect(level))}</span>
            </Row>
          );
        })}
        <Row label="All">
          <Btn onClick={() => mutate(s => { const u = { ...s.upgrades }; ABYSS.forEach(id => { u[id] = UPGRADES[id].maxLevel; }); return { ...s, upgrades: u }; })}>Max</Btn>
          <Btn onClick={() => mutate(s => { const u = { ...s.upgrades }; ABYSS.forEach(id => { u[id] = 0; }); return { ...s, upgrades: u }; })}>Reset</Btn>
        </Row>
      </Section>

      <Section title="Presets">
        <div className="flex flex-wrap gap-1">
          <Btn onClick={freshEntry} title="Prestige 50, just entered hard mode, auto-flip and auto-buy on">Fresh hard entry</Btn>
          <Btn onClick={veteran} title="10 hard wins, most of the Abyss, 500 Resolve">Veteran</Btn>
          <Btn onClick={resetHardProgress} title="Back to normal mode with no hard progress">Reset hard progress</Btn>
        </div>
      </Section>

      <Section title={`Hard mode events (${events.length})`}>
        {events.length === 0 ? (
          <div className="text-[10px] text-noir-600">Clutch zone entries, Ward saves, edges, injections, breaks and wins show up here.</div>
        ) : (
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {events.slice(0, 15).map(ev => (
              <div key={ev.id} className="flex gap-2 text-[10px]">
                <span className="text-noir-600 shrink-0">{new Date(ev.at).toLocaleTimeString([], { hour12: false })}</span>
                <span className="text-emerald-300 shrink-0">{ev.text}</span>
                <span className="text-noir-400 truncate">{ev.sub}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <Btn onClick={onClearEvents} disabled={events.length === 0}>Clear log</Btn>
          <Btn onClick={copySave}>{copied ? 'Copied' : 'Copy save JSON'}</Btn>
        </div>
      </Section>
    </div>
  );
};

export default DebugPanel;
