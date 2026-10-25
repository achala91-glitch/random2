// Melody voices. Every voice is monophonic (Carnatic melody is one line) and
// exposes its pitch as AudioParams so gamakas glide continuously.
//
// Veena uses rendered plucks (Karplus-Strong) played with a moving playback
// rate, like deflecting the string. The others are live oscillators shaped by
// filters: bowed body resonances for violin, breath for flute, nasal formants
// for nadaswaram, double reeds for harmonium, vowel formants for the voice.
import { renderVeena, rng } from './render.js';
import { PitchTrack, holdAt } from './contour.js';

export const VOICES = [
  { id: 'veena', name: 'Veena', octave: 0, legato: 'slide', reverb: 0.2, gain: 1.5 },
  { id: 'violin', name: 'Violin', octave: 0, legato: 'glide', reverb: 0.22, gain: 0.4 },
  { id: 'venu', name: 'Flute (venu)', octave: 1, legato: 'glide', reverb: 0.26, gain: 0.5 },
  { id: 'nadaswaram', name: 'Nadaswaram', octave: 1, legato: 'glide', reverb: 0.18, gain: 0.26 },
  { id: 'harmonium', name: 'Harmonium', octave: 0, legato: 'glide', reverb: 0.14, gain: 0.3 },
  { id: 'keyboard', name: 'Keyboard', octave: 0, legato: 'glide', reverb: 0.22, gain: 0.32 },
  { id: 'vocal', name: 'Voice (aa)', octave: 0, legato: 'glide', reverb: 0.25, gain: 0.55 },
];
export function voiceById(id) { return VOICES.find((v) => v.id === id) || VOICES[0]; }

// ---------- shared resources (per AudioContext) ----------
const cache = new WeakMap();
function res(ctx) {
  if (!cache.has(ctx)) cache.set(ctx, { waves: {}, noise: null, veena: new Map() });
  return cache.get(ctx);
}

function wave(ctx, id, amps) {
  const r = res(ctx);
  if (!r.waves[id]) {
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => { imag[i + 1] = a; });
    r.waves[id] = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  return r.waves[id];
}
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));
const WAVES = {
  // Bowed string: sawtooth-like with a gentle roll-off.
  bowed: range(48, (n) => (1 / n) * (1 - 0.15 * Math.cos(n * 1.3)) * Math.exp(-n / 60)),
  // Flute: mostly fundamental.
  flute: [1, 0.32, 0.11, 0.055, 0.025, 0.012],
  // Double reed: every harmonic strong.
  reed: range(40, (n) => Math.pow(n, -0.62)),
  // Free reed (harmonium, shruti box): narrow pulse.
  pulse: range(40, (n) => Math.abs(Math.sin(Math.PI * n * 0.3)) / n),
  // Keyboard lead: soft square with a little even content.
  lead: range(24, (n) => (n % 2 ? 1 / n : 0.22 / n)),
  // Glottal source for the voice.
  glottal: range(64, (n) => Math.pow(n, -1.25) * (n === 1 ? 0.85 : 1)),
};

function noiseBuffer(ctx) {
  const r = res(ctx);
  if (!r.noise) {
    const len = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    const rand = rng(99);
    for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
    r.noise = b;
  }
  return r.noise;
}

function veenaBuffer(ctx, freq) {
  const r = res(ctx);
  const key = freq.toFixed(1);
  if (r.veena.has(key)) return r.veena.get(key);
  const data = renderVeena(freq, ctx.sampleRate);
  const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
  b.getChannelData(0).set(data);
  r.veena.set(key, b);
  if (r.veena.size > 48) r.veena.delete(r.veena.keys().next().value);
  return b;
}

function filter(ctx, type, frequency, Q = 0.7, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = frequency; f.Q.value = Q; f.gain.value = gain;
  return f;
}
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
function loopNoise(ctx, t, gainValue, dest, seedOffset = 0) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = gainValue;
  src.connect(g).connect(dest);
  src.start(t, (seedOffset * 0.37) % 1.5);
  return { src, g };
}

/**
 * Starts a note. hzOf(cents) converts cents above madhya Sa to Hz (including
 * the voice's octave). Returns a Note with .track (PitchTrack), .release(t).
 */
export function startNote(ctx, voiceId, out, hzOf, cents, t) {
  const def = voiceById(voiceId);
  const amp = ctx.createGain();
  amp.gain.value = 0;
  amp.connect(out);
  const srcs = [];
  const targets = [];
  let attack = 0.05; let release = 0.15; let sustain = 1;
  const freqParam = (p, mult = 1) => targets.push({ param: p, map: (c) => hzOf(c) * mult });
  const seed = Math.floor(Math.random() * 1000);

  switch (voiceId) {
    case 'veena': {
      const f0 = hzOf(cents);
      const src = ctx.createBufferSource();
      src.buffer = veenaBuffer(ctx, f0);
      targets.push({ param: src.playbackRate, map: (c) => hzOf(c) / f0 });
      const body = filter(ctx, 'peaking', 220, 1.1, 4.5);
      const air = filter(ctx, 'highshelf', 3200, 0.7, -2.5);
      const low = filter(ctx, 'highpass', 70, 0.7);
      chain(src, low, body, air, amp);
      src.start(t);
      srcs.push(src);
      attack = 0.002; release = 0.35;
      break;
    }
    case 'violin': {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave(ctx, 'bowed', WAVES.bowed));
      freqParam(osc.frequency);
      const lp = filter(ctx, 'lowpass', 7000, 0.5);
      const b1 = filter(ctx, 'peaking', 290, 1.4, 4);
      const b2 = filter(ctx, 'peaking', 1150, 1, -3);
      const b3 = filter(ctx, 'peaking', 2800, 1.2, 5);
      const hp = filter(ctx, 'highpass', 160, 0.7);
      chain(osc, lp, b1, b2, b3, hp, amp);
      // Bow hair noise, through the same body.
      const nb = filter(ctx, 'bandpass', 2600, 0.8);
      nb.connect(b1);
      const n = loopNoise(ctx, t, 0.018, nb, seed);
      // A slight bow-pressure shimmer.
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
      const lg = ctx.createGain(); lg.gain.value = 0.025;
      lfo.connect(lg).connect(amp.gain);
      osc.start(t); lfo.start(t);
      srcs.push(osc, n.src, lfo);
      attack = 0.09; release = 0.22;
      break;
    }
    case 'venu': {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave(ctx, 'flute', WAVES.flute));
      freqParam(osc.frequency);
      const lp = filter(ctx, 'lowpass', 5200, 0.5);
      chain(osc, lp, amp);
      // Breath: noise focused around the note (follows the pitch) plus air.
      const bp = filter(ctx, 'bandpass', 600, 7);
      freqParam(bp.frequency);
      bp.connect(amp);
      const breath = loopNoise(ctx, t, 0.22, bp, seed);
      const air = filter(ctx, 'highpass', 2500, 0.5);
      air.connect(amp);
      const hiss = loopNoise(ctx, t, 0.012, air, seed + 3);
      // Chiff at the start of the note.
      const chiff = ctx.createGain(); chiff.gain.setValueAtTime(0.0, t);
      chiff.gain.linearRampToValueAtTime(0.08, t + 0.008);
      chiff.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      const cbp = filter(ctx, 'bandpass', 1800, 1.5);
      chain(chiff, cbp, amp);
      const cn = loopNoise(ctx, t, 1, chiff, seed + 5);
      // Gentle breath movement.
      const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6;
      const lg = ctx.createGain(); lg.gain.value = 0.035;
      lfo.connect(lg).connect(amp.gain);
      osc.start(t); lfo.start(t);
      srcs.push(osc, breath.src, hiss.src, cn.src, lfo);
      attack = 0.07; release = 0.14;
      break;
    }
    case 'nadaswaram': {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave(ctx, 'reed', WAVES.reed));
      freqParam(osc.frequency);
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(1.8 * x) / Math.tanh(1.8); }
      shaper.curve = curve;
      const f1 = filter(ctx, 'peaking', 1150, 2, 6);
      const f2 = filter(ctx, 'peaking', 2500, 2.5, 5);
      const lp = filter(ctx, 'lowpass', 7500, 0.6);
      const hp = filter(ctx, 'highpass', 250, 0.7);
      chain(osc, shaper, hp, f1, f2, lp, amp);
      const nbp = filter(ctx, 'bandpass', 3000, 1);
      nbp.connect(amp);
      const n = loopNoise(ctx, t, 0.02, nbp, seed);
      osc.start(t);
      srcs.push(osc, n.src);
      attack = 0.035; release = 0.1;
      break;
    }
    case 'harmonium': {
      const o1 = ctx.createOscillator(); o1.setPeriodicWave(wave(ctx, 'pulse', WAVES.pulse));
      const o2 = ctx.createOscillator(); o2.setPeriodicWave(wave(ctx, 'pulse', WAVES.pulse));
      const o3 = ctx.createOscillator(); o3.setPeriodicWave(wave(ctx, 'pulse', WAVES.pulse));
      freqParam(o1.frequency); freqParam(o2.frequency, 1.0017); freqParam(o3.frequency, 0.5);
      const g3 = ctx.createGain(); g3.gain.value = 0.4; // the lower reed bank
      const lp = filter(ctx, 'lowpass', 3400, 0.6);
      o1.connect(lp); o2.connect(lp); o3.connect(g3).connect(lp);
      lp.connect(amp);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35;
      const lg = ctx.createGain(); lg.gain.value = 0.03;
      lfo.connect(lg).connect(amp.gain);
      [o1, o2, o3, lfo].forEach((o) => o.start(t));
      srcs.push(o1, o2, o3, lfo);
      sustain = 0.75;
      attack = 0.03; release = 0.09;
      break;
    }
    case 'keyboard': {
      const o1 = ctx.createOscillator(); o1.setPeriodicWave(wave(ctx, 'lead', WAVES.lead));
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
      freqParam(o1.frequency); freqParam(o2.frequency, 1.003);
      const g2 = ctx.createGain(); g2.gain.value = 0.18;
      const lp = filter(ctx, 'lowpass', 2400, 1.2);
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.setTargetAtTime(2200, t + 0.01, 0.18);
      o1.connect(lp); o2.connect(g2).connect(lp);
      lp.connect(amp);
      o1.start(t); o2.start(t);
      srcs.push(o1, o2);
      attack = 0.012; release = 0.18;
      break;
    }
    case 'vocal':
    default: {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave(ctx, 'glottal', WAVES.glottal));
      freqParam(osc.frequency);
      // A slight natural unsteadiness, a few cents.
      const jit = ctx.createOscillator(); jit.frequency.value = 0.7;
      const jg = ctx.createGain(); jg.gain.value = 3;
      jit.connect(jg).connect(osc.detune);
      const sum = ctx.createGain(); sum.gain.value = 1;
      // Formants of the vowel "aa".
      for (const [F, Q, g] of [[750, 8, 1], [1180, 11, 0.55], [2600, 18, 0.18], [3350, 14, 0.09]]) {
        const bp = filter(ctx, 'bandpass', F, Q);
        const gg = ctx.createGain(); gg.gain.value = g * 2.2;
        osc.connect(bp).connect(gg).connect(sum);
      }
      const body = filter(ctx, 'lowpass', 900, 0.7);
      const bg = ctx.createGain(); bg.gain.value = 0.25;
      osc.connect(body).connect(bg).connect(sum);
      const br = filter(ctx, 'bandpass', 1500, 0.8);
      br.connect(sum);
      const n = loopNoise(ctx, t, 0.012, br, seed);
      sum.connect(amp);
      osc.start(t); jit.start(t);
      srcs.push(osc, jit, n.src);
      attack = 0.11; release = 0.28;
      break;
    }
  }

  const level = def.gain * sustain;
  amp.gain.setValueAtTime(0, t);
  if (attack < 0.005) amp.gain.linearRampToValueAtTime(level, t + 0.003);
  else amp.gain.setTargetAtTime(level, t, attack / 3);

  const track = new PitchTrack(targets, cents, t);
  return {
    voiceId, def, track, amp, startedAt: t, released: false,
    release(at) {
      if (this.released) return at + release;
      this.released = true;
      holdAt(amp.gain, at, Math.max(0.0001, amp.gain.value));
      amp.gain.setTargetAtTime(0, at, release / 3);
      const end = at + release * 2.5;
      for (const s of srcs) { try { s.stop(end); } catch { /* already stopped */ } }
      setTimeout(() => { try { amp.disconnect(); } catch { /* ignore */ } }, (end - ctx.currentTime + 0.2) * 1000);
      return end;
    },
  };
}
