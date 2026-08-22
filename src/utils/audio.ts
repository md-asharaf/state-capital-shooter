let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

export const playShootSound = () => {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
};

export const playCorrectSound = () => {
  initAudio();
  playTone(523.25, 'sine', 0.15, 0.2);
  setTimeout(() => playTone(659.25, 'sine', 0.15, 0.2), 100);
  setTimeout(() => playTone(783.99, 'sine', 0.3, 0.2), 200);
};

export const playWrongSound = () => {
  initAudio();
  playTone(200, 'sawtooth', 0.3, 0.2);
  setTimeout(() => playTone(150, 'sawtooth', 0.4, 0.2), 150);
};
