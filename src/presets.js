// Sound presets. Each build() returns a voice: a polyphonic synth plus its own
// little effect chain, ending in `out`. The engine handles reverb/delay sends.
import * as Tone from 'tone';

export const PRESETS = [
  { id: 'pad', name: 'Warm Pad', short: 'PAD' },
  { id: 'pluck', name: 'Pluck', short: 'PLUCK' },
  { id: 'keys', name: 'Electric Piano', short: 'E.PIANO' },
  { id: 'lead', name: 'Bright Saw', short: 'SAW' },
  { id: 'bell', name: 'Glass Bell', short: 'BELL' },
  { id: 'lofi', name: 'Lo-Fi Tape', short: 'LO-FI' },
];

export function presetIndex(id) {
  const i = PRESETS.findIndex((p) => p.id === id);
  return i < 0 ? 0 : i;
}

function voice(synth, chain, opts) {
  const out = new Tone.Gain(Tone.dbToGain(opts.gainDb ?? 0));
  const nodes = [synth, ...chain, out];
  // synth -> chain[0] -> ... -> out
  let prev = synth;
  for (const n of chain) { prev.connect(n); prev = n; }
  prev.connect(out);
  return {
    synth, out, nodes,
    reverb: opts.reverb ?? 0.3,
    delay: opts.delay ?? 0.15,
    vel: opts.vel ?? 0.7,
    bassVel: opts.bassVel ?? 0.55,
    extra: opts.extra || [],
    dispose() {
      for (const n of [...this.extra, ...nodes]) {
        try { if (n.stop && n.state === 'started') n.stop(); } catch { /* ignore */ }
        try { n.dispose(); } catch { /* ignore */ }
      }
    },
  };
}

const BUILDERS = {
  // Soft detuned saws through a lowpass, slow-ish attack, long release.
  pad() {
    const synth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 26 },
      envelope: { attack: 0.42, decay: 1.2, sustain: 0.85, release: 2.6 },
      filter: { type: 'lowpass', rolloff: -24, Q: 1.4 },
      filterEnvelope: {
        attack: 0.7, decay: 1.8, sustain: 0.55, release: 2.4,
        baseFrequency: 260, octaves: 2.7, exponent: 2,
      },
    });
    synth.maxPolyphony = 28;
    const chorus = new Tone.Chorus({ frequency: 0.45, delayTime: 4.5, depth: 0.55, spread: 180, wet: 0.55 }).start();
    const shelf = new Tone.Filter({ type: 'lowpass', frequency: 5200, rolloff: -12 });
    return voice(synth, [chorus, shelf], { gainDb: -15, reverb: 0.55, delay: 0.22, bassVel: 0.6 });
  },

  pluck() {
    const synth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
      envelope: { attack: 0.003, decay: 0.6, sustain: 0.12, release: 0.9 },
      filter: { type: 'lowpass', rolloff: -24, Q: 2.5 },
      filterEnvelope: {
        attack: 0.001, decay: 0.32, sustain: 0.06, release: 0.7,
        baseFrequency: 200, octaves: 4.3, exponent: 2,
      },
    });
    synth.maxPolyphony = 28;
    const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 3, depth: 0.3, spread: 160, wet: 0.35 }).start();
    return voice(synth, [chorus], { gainDb: -9, reverb: 0.35, delay: 0.38, bassVel: 0.5 });
  },

  // FM electric piano with stereo tremolo.
  keys() {
    const synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 2.4, sustain: 0.32, release: 1.3 },
      modulationEnvelope: { attack: 0.002, decay: 0.7, sustain: 0.12, release: 0.8 },
    });
    synth.maxPolyphony = 28;
    const tine = new Tone.Filter({ type: 'lowpass', frequency: 4200, rolloff: -12 });
    const trem = new Tone.Tremolo({ frequency: 3.6, depth: 0.32, spread: 140 }).start();
    const chorus = new Tone.Chorus({ frequency: 0.6, delayTime: 2.5, depth: 0.25, wet: 0.3 }).start();
    return voice(synth, [tine, trem, chorus], { gainDb: -7, reverb: 0.28, delay: 0.12, bassVel: 0.5, vel: 0.75 });
  },

  lead() {
    const synth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
      envelope: { attack: 0.008, decay: 0.4, sustain: 0.8, release: 0.45 },
      filter: { type: 'lowpass', rolloff: -12, Q: 1.2 },
      filterEnvelope: {
        attack: 0.004, decay: 0.5, sustain: 0.65, release: 0.5,
        baseFrequency: 1000, octaves: 2.4, exponent: 2,
      },
    });
    synth.maxPolyphony = 28;
    const chorus = new Tone.Chorus({ frequency: 1.1, delayTime: 2.8, depth: 0.35, spread: 180, wet: 0.4 }).start();
    const tame = new Tone.Filter({ type: 'lowpass', frequency: 7500, rolloff: -12 });
    return voice(synth, [chorus, tame], { gainDb: -17, reverb: 0.25, delay: 0.3, bassVel: 0.45 });
  },

  bell() {
    const synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 9,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 3.2, sustain: 0.12, release: 3.4 },
      modulationEnvelope: { attack: 0.002, decay: 1.6, sustain: 0.18, release: 2 },
    });
    synth.maxPolyphony = 30;
    const chorus = new Tone.Chorus({ frequency: 0.35, delayTime: 3.5, depth: 0.4, spread: 180, wet: 0.45 }).start();
    const low = new Tone.Filter({ type: 'highpass', frequency: 90 });
    return voice(synth, [chorus, low], { gainDb: -8, reverb: 0.6, delay: 0.32, bassVel: 0.3, vel: 0.6 });
  },

  // Warm saws, wobbly pitch (tape wow), dark tape filtering, a bit of grit and hiss.
  lofi() {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 9 },
      envelope: { attack: 0.03, decay: 1.4, sustain: 0.55, release: 1.5 },
    });
    synth.maxPolyphony = 28;
    const tape = new Tone.Filter({ type: 'lowpass', frequency: 1300, rolloff: -24, Q: 0.6 });
    const filterLfo = new Tone.LFO({ frequency: 0.13, min: 900, max: 1700 }).start();
    filterLfo.connect(tape.frequency);
    const wow = new Tone.Vibrato({ frequency: 0.9, depth: 0.09, wet: 1 });
    const grit = new Tone.Distortion({ distortion: 0.14, oversample: '2x', wet: 0.45 });
    const hp = new Tone.Filter({ type: 'highpass', frequency: 110 });
    const v = voice(synth, [tape, wow, grit, hp], { gainDb: -8, reverb: 0.28, delay: 0.16, bassVel: 0.55 });
    // Quiet tape hiss while this sound is selected.
    const hiss = new Tone.Noise({ type: 'pink', volume: -50 });
    const hissBand = new Tone.Filter({ type: 'bandpass', frequency: 3500, Q: 0.4 });
    hiss.connect(hissBand);
    hissBand.connect(v.out);
    hiss.start();
    v.extra = [filterLfo, hiss, hissBand];
    return v;
  },
};

export function buildPreset(id) {
  return (BUILDERS[id] || BUILDERS.pad)();
}
