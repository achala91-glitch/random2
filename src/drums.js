// Synthesised drum kits and 16-step beats. No samples, so nothing to download.
import * as Tone from 'tone';

export const KITS = [
  { id: 'lofi', name: 'Lo-Fi', swing: 0.17 },
  { id: '80s', name: '80s', swing: 0 },
  { id: 'chill', name: 'Chill', swing: 0.08 },
];

// Steps 0-15 are 16th notes. Numbers are velocities.
const S = (steps, v = 1) => Object.fromEntries(steps.map((s) => [s, v]));
export const BEATS = [
  {
    id: 'pop', name: 'Pop',
    kick: S([0, 8, 10]), snare: S([4, 12]),
    hat: { ...S([0, 2, 4, 6, 8, 10, 12, 14], 0.8), ...S([3, 11], 0.35) }, open: {},
  },
  {
    id: 'drive', name: 'Drive', // four on the floor, the synthwave staple
    kick: S([0, 4, 8, 12]), snare: S([4, 12]),
    hat: { ...S([0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], 0.45) }, open: S([2, 6, 10, 14], 0.7),
  },
  {
    id: 'boombap', name: 'Boom Bap',
    kick: { ...S([0, 10]), ...S([7], 0.75) }, snare: { ...S([4, 12]), ...S([15], 0.25) },
    hat: { ...S([0, 2, 4, 6, 8, 10, 12, 14], 0.7), ...S([5, 13], 0.3) }, open: {},
  },
  {
    id: 'half', name: 'Half-time',
    kick: { ...S([0]), ...S([11], 0.8) }, snare: S([8]),
    hat: S([0, 2, 4, 6, 8, 10, 12], 0.6), open: S([14], 0.6),
  },
];

function buildKit(id, out) {
  const nodes = [];
  const add = (n) => { nodes.push(n); return n; };
  const bus = add(new Tone.Gain(1));
  bus.connect(out);
  let kick; let snare; let hat; let open;

  if (id === 'lofi') {
    const dark = add(new Tone.Filter({ type: 'lowpass', frequency: 3800, rolloff: -24 }));
    const crunch = add(new Tone.Distortion({ distortion: 0.2, wet: 0.35 }));
    dark.connect(crunch); crunch.connect(bus);
    const k = add(new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 5, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 }, volume: -3 }));
    k.connect(dark);
    const sn = add(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.2, sustain: 0 }, volume: -9 }));
    const snBand = add(new Tone.Filter({ type: 'bandpass', frequency: 1700, Q: 0.7 }));
    sn.connect(snBand); snBand.connect(dark);
    const h = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: -22 }));
    const hHp = add(new Tone.Filter({ type: 'highpass', frequency: 6500 }));
    h.connect(hHp); hHp.connect(dark);
    kick = (t, v) => k.triggerAttackRelease('C1', '8n', t, v);
    snare = (t, v) => sn.triggerAttackRelease('16n', t, v);
    hat = (t, v) => h.triggerAttackRelease('32n', t, v);
    open = (t, v) => h.triggerAttackRelease('8n', t, v * 0.8);
  } else if (id === '80s') {
    const k = add(new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.1 }, volume: -1 }));
    k.connect(bus);
    // Big snare with a short, bright "gated" room.
    const room = add(new Tone.Reverb({ decay: 0.9, preDelay: 0.005, wet: 0.5 }));
    const roomHp = add(new Tone.Filter({ type: 'highpass', frequency: 300 }));
    room.connect(roomHp); roomHp.connect(bus);
    const sn = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.24, sustain: 0 }, volume: -10 }));
    const snHp = add(new Tone.Filter({ type: 'highpass', frequency: 800 }));
    sn.connect(snHp); snHp.connect(room);
    const body = add(new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }, volume: -10 }));
    body.connect(room);
    const h = add(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5, volume: -30 }));
    h.connect(bus);
    kick = (t, v) => k.triggerAttackRelease('B0', '8n', t, v);
    snare = (t, v) => { sn.triggerAttackRelease('16n', t, v); body.triggerAttackRelease('G2', '32n', t, v); };
    hat = (t, v) => h.triggerAttackRelease(300, '32n', t, v);
    open = (t, v) => h.triggerAttackRelease(300, '8n', t, v * 0.9);
  } else {
    // chill: soft kick, woody rim, shaker
    const soft = add(new Tone.Filter({ type: 'lowpass', frequency: 5000, rolloff: -12 }));
    soft.connect(bus);
    const k = add(new Tone.MembraneSynth({ pitchDecay: 0.07, octaves: 3.5, envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.1 }, volume: -4 }));
    k.connect(soft);
    const rim = add(new Tone.MembraneSynth({ pitchDecay: 0.004, octaves: 1.5, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }, volume: -12 }));
    rim.connect(soft);
    const sh = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.012, decay: 0.07, sustain: 0 }, volume: -24 }));
    const shBand = add(new Tone.Filter({ type: 'bandpass', frequency: 7000, Q: 1.2 }));
    sh.connect(shBand); shBand.connect(soft);
    kick = (t, v) => k.triggerAttackRelease('D1', '8n', t, v);
    snare = (t, v) => rim.triggerAttackRelease('A4', '32n', t, v);
    hat = (t, v) => sh.triggerAttackRelease('32n', t, v);
    open = (t, v) => sh.triggerAttackRelease('16n', t, v);
  }
  return {
    kick, snare, hat, open,
    dispose() { nodes.forEach((n) => { try { n.dispose(); } catch { /* ignore */ } }); },
  };
}

export class DrumMachine {
  constructor(out) {
    this.out = out;
    this.kitId = 'lofi';
    this.beatId = 'pop';
    this.kit = buildKit(this.kitId, out);
    this.on = false;
  }

  setKit(id) {
    if (id === this.kitId) return;
    const old = this.kit;
    this.kitId = id;
    this.kit = buildKit(id, this.out);
    setTimeout(() => old.dispose(), 1500);
  }

  setBeat(id) { this.beatId = id; }

  // Called on every 16th note by the engine. `step` is 0-15 within the bar.
  tick(time, step, sixteenth) {
    if (!this.on) return;
    const beat = BEATS.find((b) => b.id === this.beatId) || BEATS[0];
    const kitInfo = KITS.find((k) => k.id === this.kitId);
    const t = step % 2 === 1 ? time + kitInfo.swing * sixteenth : time;
    for (const part of ['kick', 'snare', 'hat', 'open']) {
      const v = beat[part][step];
      if (v) this.kit[part](t, v);
    }
  }
}
