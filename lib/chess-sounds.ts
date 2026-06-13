'use client';

// Chess board sounds synthesized via Web Audio API — wood-clack feel, no asset files.

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
  } catch {
    return null;
  }
  return audioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = ctx.sampleRate * 0.4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

function clack(opts: {
  noiseGain?: number;
  noiseDuration?: number;
  tonalFreq?: number;
  tonalGain?: number;
  tonalDuration?: number;
  filterFreq?: number;
  filterQ?: number;
  delay?: number;
}) {
  const ctx = getCtx();
  if (!ctx) return;
  const {
    noiseGain = 0.22,
    noiseDuration = 0.045,
    tonalFreq = 170,
    tonalGain = 0.14,
    tonalDuration = 0.12,
    filterFreq = 1800,
    filterQ = 2.5,
    delay = 0,
  } = opts;
  const start = ctx.currentTime + delay;

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = filterFreq;
  noiseFilter.Q.value = filterQ;
  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, start);
  noiseEnv.gain.linearRampToValueAtTime(noiseGain, start + 0.002);
  noiseEnv.gain.exponentialRampToValueAtTime(0.0001, start + noiseDuration);
  noise.connect(noiseFilter).connect(noiseEnv).connect(ctx.destination);
  noise.start(start);
  noise.stop(start + noiseDuration + 0.02);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(tonalFreq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(60, tonalFreq * 0.55), start + tonalDuration);
  const oscEnv = ctx.createGain();
  oscEnv.gain.setValueAtTime(0, start);
  oscEnv.gain.linearRampToValueAtTime(tonalGain, start + 0.005);
  oscEnv.gain.exponentialRampToValueAtTime(0.0001, start + tonalDuration);
  osc.connect(oscEnv).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + tonalDuration + 0.02);
}

export const chessSounds = {
  move: () =>
    clack({ noiseGain: 0.18, noiseDuration: 0.04, tonalFreq: 185, tonalGain: 0.12, tonalDuration: 0.1, filterFreq: 2000, filterQ: 2.2 }),
  capture: () => {
    clack({ noiseGain: 0.26, noiseDuration: 0.055, tonalFreq: 140, tonalGain: 0.16, tonalDuration: 0.13, filterFreq: 1500, filterQ: 3 });
    clack({ noiseGain: 0.12, noiseDuration: 0.035, tonalFreq: 110, tonalGain: 0.1, tonalDuration: 0.14, filterFreq: 900, filterQ: 3.5, delay: 0.035 });
  },
  castle: () => {
    clack({ noiseGain: 0.16, tonalFreq: 200, tonalGain: 0.11, tonalDuration: 0.09, filterFreq: 2100 });
    clack({ noiseGain: 0.2, tonalFreq: 165, tonalGain: 0.13, tonalDuration: 0.11, filterFreq: 1700, delay: 0.1 });
  },
  check: () => {
    const ctx = getCtx();
    if (!ctx) return;
    clack({ noiseGain: 0.14, tonalFreq: 240, tonalGain: 0.1, tonalDuration: 0.09, filterFreq: 2400 });
    const now = ctx.currentTime;
    for (const [offset, freq] of [
      [0.03, 880],
      [0.14, 660],
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + offset);
      g.gain.setValueAtTime(0, now + offset);
      g.gain.linearRampToValueAtTime(0.09, now + offset + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    }
  },
  gameEnd: () => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [offset, freq, dur] of [
      [0.0, 660, 0.2],
      [0.18, 523, 0.22],
      [0.38, 392, 0.3],
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + offset);
      g.gain.setValueAtTime(0, now + offset);
      g.gain.linearRampToValueAtTime(0.13, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + dur + 0.05);
    }
  },
  illegal: () =>
    clack({ noiseGain: 0.08, noiseDuration: 0.06, tonalFreq: 95, tonalGain: 0.12, tonalDuration: 0.2, filterFreq: 400, filterQ: 5 }),
};

export type ChessSoundName = keyof typeof chessSounds;
