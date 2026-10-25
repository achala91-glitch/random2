// Percussion instruments. Patterns are written in mridangam strokes; every other
// drum maps each stroke to its own nearest equivalent.
import {
  mridangamStrokes, tablaStrokes, kanjiraStrokes, ghatamStrokes, morsingStrokes, thavilStrokes,
} from './render.js';

export const PERCUSSION = [
  { id: 'mridangam', name: 'Mridangam', render: mridangamStrokes, map: null, gain: 0.85 },
  { id: 'tabla', name: 'Tabla', render: tablaStrokes, gain: 0.8,
    map: { tha: 'ke', thi: 'tit', ki: 'te', thom: 'ge', gumki: 'geBend', nam: 'na', dhin: 'tin', chapu: 'tun' } },
  { id: 'kanjira', name: 'Kanjira', render: kanjiraStrokes, gain: 0.75,
    map: { tha: 'slap', thi: 'tap', ki: 'tapSoft', thom: 'bass', gumki: 'bassBend', nam: 'rim', dhin: 'bassOpen', chapu: 'rimHigh' } },
  { id: 'ghatam', name: 'Ghatam', render: ghatamStrokes, gain: 0.8,
    map: { tha: 'slap', thi: 'tap', ki: 'tapSoft', thom: 'gum', gumki: 'gumBend', nam: 'neck', dhin: 'gum', chapu: 'ring' } },
  { id: 'morsing', name: 'Morsing', render: morsingStrokes, gain: 0.6,
    map: { tha: 'short', thi: 'short', ki: 'tick', thom: 'low', gumki: 'sweep', nam: 'bright', dhin: 'mid', chapu: 'bright' } },
  { id: 'thavil', name: 'Thavil', render: thavilStrokes, gain: 0.55,
    map: { tha: 'stickMuted', thi: 'tap', ki: 'tapSoft', thom: 'stick', gumki: 'stick', nam: 'crack', dhin: 'crackOpen', chapu: 'crack' } },
];
export function percussionById(id) { return PERCUSSION.find((p) => p.id === id) || null; }

// Stroke accents: bass and ringing strokes louder, fills softer.
const ACCENT = { thom: 1, gumki: 1, dhin: 0.9, nam: 0.85, chapu: 0.85, tha: 0.75, thi: 0.6, ki: 0.45 };

export class Percussion {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.8;
    this.bus.connect(out);
    this.cache = new Map();
    this.sa = 138.59;
    this.instrument = 'mridangam';
    this.tick = null;
  }

  setVolume(v) { this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  buffers(instId) {
    const inst = percussionById(instId);
    if (!inst) return null;
    const key = `${instId}:${this.sa.toFixed(2)}`;
    if (!this.cache.has(key)) {
      const data = inst.render(this.sa, this.ctx.sampleRate);
      const out = {};
      for (const [name, arr] of Object.entries(data)) {
        const b = this.ctx.createBuffer(1, arr.length, this.ctx.sampleRate);
        b.getChannelData(0).set(arr);
        out[name] = b;
      }
      this.cache.set(key, out);
      if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
    }
    return this.cache.get(key);
  }

  // Render in advance so the first beat doesn't stall.
  prepare(instId = this.instrument) { if (instId && instId !== 'none') this.buffers(instId); }

  setSa(sa) { this.sa = sa; }

  play(stroke, time, velocity = 1, instId = this.instrument) {
    if (!stroke || stroke === '-') return;
    const inst = percussionById(instId);
    if (!inst) return;
    const bufs = this.buffers(instId);
    const name = inst.map ? inst.map[stroke] : stroke;
    const buf = bufs && bufs[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = inst.gain * (ACCENT[stroke] ?? 0.7) * velocity * (0.94 + Math.random() * 0.06);
    src.connect(g).connect(this.bus);
    src.start(time);
  }

  // A soft wood-like tick for counting when no drum is chosen.
  click(time, strong) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = strong ? 1650 : 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(strong ? 0.18 : 0.1, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    o.connect(g).connect(this.bus);
    o.start(time); o.stop(time + 0.08);
  }
}
