// Simple synth to avoid external assets
let audioCtx: AudioContext | null = null;
let isMuted = true; // Default to true

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
};

const playTone = (freq: number, type: OscillatorType, duration: number, volume: number = 0.1) => {
  if (isMuted) return;
  if (!audioCtx) initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

// C Major Scale for streaks
const STREAK_NOTES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  698.46, // F5
];

export const AudioService = {
  setMuted: (muted: boolean) => {
    isMuted = muted;
  },
  toggleMute: () => {
    isMuted = !isMuted;
    return isMuted;
  },
  playFlip: () => {
    // Metallic click
    playTone(1200, 'triangle', 0.05, 0.05);
    setTimeout(() => playTone(1500, 'sine', 0.1, 0.02), 50);
  },
  playHeads: (streak: number) => {
    // Ascending notes based on streak
    const noteIndex = Math.min(streak - 1, STREAK_NOTES.length - 1);
    const freq = STREAK_NOTES[noteIndex];
    
    // Main note
    playTone(freq, 'sine', 0.8, 0.1);
    // Harmonics for a "chord" feel on higher streaks
    if (streak > 3) playTone(freq * 1.5, 'triangle', 0.6, 0.05);
    if (streak > 6) playTone(freq * 2, 'sine', 0.8, 0.05);
    
    // Winning chord
    if (streak >= 10) {
        setTimeout(() => {
            playTone(523.25, 'triangle', 2, 0.2);
            playTone(659.25, 'triangle', 2, 0.2);
            playTone(783.99, 'triangle', 2, 0.2);
        }, 200);
    }
  },
  playTails: () => {
    // Dissonant low thud
    playTone(100, 'sawtooth', 0.3, 0.1);
    playTone(85, 'square', 0.3, 0.05);
  },
  playWin: () => {
     // Victory fanfare handled in playHeads(10) partly, but extra effect here
  }
};