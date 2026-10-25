// Offline sound rendering in plain JavaScript (no Web Audio), so it runs the
// same in the browser and in Node tests. Each function returns Float32Arrays
// that the engine copies into AudioBuffers.
//
//  - Veena: Karplus-Strong plucked string with a soft "bridge" nonlinearity.
//  - Tanpura: additive synthesis with a moving formant for the jivari sweep.
//  - Percussion: modal synthesis (decaying partials) plus shaped noise.
//  - Reverb: a smooth stereo impulse response.

// Small deterministic PRNG so renders are repeatable.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function normalize(buf, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) { const g = peak / m; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}

// ---------------------------------------------------------------- veena
// The veena is plucked with the fingernail near the bridge, which gives a
// bright attack; its flat brass bridge adds a gentle buzz. Gamakas are played
// by deflecting the string, which the engine does by changing playback rate.
export function renderVeena(freq, sr, { dur = 3.4, seed = 7, brightness = 0.72 } = {}) {
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const rand = rng(seed + Math.round(freq));
  const k = brightness; // one-pole loop lowpass coefficient
  // Phase delay of the loop lowpass at low frequency is about (1 - k) / k samples.
  const D = sr / freq - (1 - k) / k;
  const L = Math.ceil(D) + 4;
  const buf = new Float32Array(L);
  // Excitation: bright noise, shaped by the pluck position (near the bridge).
  const pluckPos = Math.max(2, Math.round(D / 7));
  const exc = new Float32Array(L);
  let lp = 0;
  for (let i = 0; i < L; i++) { lp += 0.7 * ((rand() * 2 - 1) - lp); exc[i] = lp; }
  for (let i = 0; i < L; i++) buf[i] = exc[i] - (i >= pluckPos ? exc[i - pluckPos] : 0);
  // Loss per sample so the note rings about T60 seconds (shorter when higher).
  const t60 = 4.6 * Math.pow(130 / freq, 0.35);
  const g = Math.pow(10, -3 / (t60 * sr));
  let w = 0; // write index
  let state = 0;
  for (let i = 0; i < n; i++) {
    let rp = w - D;
    while (rp < 0) rp += L;
    const i0 = Math.floor(rp); const fr = rp - i0;
    const y = buf[i0 % L] * (1 - fr) + buf[(i0 + 1) % L] * fr;
    state += k * (y - state);
    let s = state * g;
    s = s / (1 + 0.35 * Math.abs(s)); // bridge: brighter while loud, clean as it decays
    buf[w] = s;
    w = (w + 1) % L;
    out[i] = y;
  }
  // Short fade-out at the end of the buffer.
  const f = Math.floor(sr * 0.05);
  for (let i = 0; i < f; i++) out[n - 1 - i] *= i / f;
  return normalize(out, 0.85);
}

// ---------------------------------------------------------------- tanpura
// One string: harmonic partials whose balance is shaped by a formant that sweeps
// down from bright to warm as the note rings, the "moving overtone" sound of
// the jivari bridge and its cotton thread. Partials also breathe slowly.
export function renderTanpura(freq, sr, { dur = 7, seed = 3, jivari = 1 } = {}) {
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const rand = rng(seed * 977 + Math.round(freq * 10));
  const K = Math.max(8, Math.min(110, Math.floor(9500 / freq)));
  const block = 64;
  const parts = [];
  for (let k = 1; k <= K; k++) {
    const f = k * freq * (1 + (rand() - 0.5) * 0.0004);
    if (f > sr * 0.45) break;
    const ph = rand() * Math.PI * 2;
    parts.push({
      k, w: (2 * Math.PI * f) / sr,
      c: Math.cos(ph), s: Math.sin(ph),
      base: Math.pow(k, -1.05),
      decay: 7.5 / (1 + 0.035 * k),
      wobRate: 0.18 + rand() * 0.5, wobPh: rand() * Math.PI * 2,
      fk: f,
    });
  }
  for (let b = 0; b < n; b += block) {
    const t = b / sr;
    const formant = 900 + 5200 * Math.exp(-t / 1.6) + 250 * Math.sin(t * 1.3);
    const attack = Math.min(1, t / 0.006);
    const end = Math.min(n, b + block);
    for (const p of parts) {
      const x = Math.log2(p.fk / formant) / 0.6;
      const wgt = Math.exp(-0.5 * x * x);
      const a = p.base * (0.3 + 1.8 * jivari * wgt) * Math.exp(-t / p.decay) * attack
        * (1 + 0.14 * Math.sin(2 * Math.PI * p.wobRate * t + p.wobPh));
      const cw = Math.cos(p.w); const sw = Math.sin(p.w);
      let c = p.c; let s = p.s;
      for (let i = b; i < end; i++) {
        out[i] += a * s;
        const nc = c * cw - s * sw;
        s = s * cw + c * sw;
        c = nc;
      }
      // keep the oscillator on the unit circle
      const m = Math.hypot(c, s); p.c = c / m; p.s = s / m;
    }
  }
  // The pluck itself: a soft finger touch.
  const pl = Math.floor(sr * 0.012);
  let lp = 0;
  for (let i = 0; i < pl; i++) { lp += 0.3 * ((rand() * 2 - 1) - lp); out[i] += lp * 0.25 * (1 - i / pl); }
  const f = Math.floor(sr * 0.2);
  for (let i = 0; i < f; i++) out[n - 1 - i] *= i / f;
  return normalize(out, 0.8);
}

// ---------------------------------------------------------------- percussion
// modes: [{ f, a, d, bend: [startRatio, endRatio, time] }], noise: { a, d, lp, hp }
export function modal(sr, { dur = 1, modes = [], noise = null, seed = 5, click = 0 }) {
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const rand = rng(seed);
  for (const m of modes) {
    let ph = 0;
    const [b0, b1, bt] = m.bend || [1, 1, 1];
    const atk = Math.max(1, Math.floor(sr * (m.attack || 0.0015)));
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.exp(-t / m.d) * (i < atk ? i / atk : 1);
      if (env < 1e-4 && i > atk) break;
      const bend = t < bt ? b0 + (b1 - b0) * (1 - Math.pow(1 - t / bt, 2)) : b1;
      ph += (2 * Math.PI * m.f * bend) / sr;
      out[i] += m.a * env * Math.sin(ph);
    }
  }
  if (noise) {
    let lp = 0; let hpPrev = 0; let hpOut = 0;
    const kl = noise.lp ? 1 - Math.exp(-2 * Math.PI * noise.lp / sr) : 1;
    const kh = noise.hp ? Math.exp(-2 * Math.PI * noise.hp / sr) : 0;
    const len = Math.min(n, Math.floor(sr * noise.d * 6));
    for (let i = 0; i < len; i++) {
      const x = rand() * 2 - 1;
      lp += kl * (x - lp);
      hpOut = kh * (hpOut + lp - hpPrev); hpPrev = lp;
      out[i] += noise.a * (noise.hp ? hpOut : lp) * Math.exp(-(i / sr) / noise.d);
    }
  }
  if (click) {
    const cl = Math.floor(sr * 0.002);
    for (let i = 0; i < cl; i++) out[i] += click * (1 - i / cl) * (rand() * 2 - 1);
  }
  const f = Math.floor(sr * 0.01);
  for (let i = 0; i < f; i++) out[n - 1 - i] *= i / f;
  return out;
}

// Keep drums in a sensible register for any Sa.
function drumPitch(sa, lo, hi) {
  let f = sa;
  while (f < lo) f *= 2;
  while (f > hi) f /= 2;
  return f;
}

// Mridangam. The right head (valanthalai) with its black soru is tuned to Sa and
// rings with nearly harmonic overtones (C. V. Raman); the left head (thoppi)
// gives the bass, and gumki bends it upward with pressure from the wrist.
export function mridangamStrokes(sa, sr) {
  const f = drumPitch(sa, 120, 280);
  const b = f / 2; // left head roughly an octave lower
  const H = (amps, decays, extra = {}) => ({
    modes: amps.map((a, i) => ({ f: f * (i + 1) * (1 + i * 0.002), a, d: decays[i] })), ...extra,
  });
  return {
    // Nam: index finger on the rim, ringing at the tuned pitch.
    nam: modal(sr, { dur: 1.2, ...H([0.55, 1, 0.55, 0.3, 0.18], [0.55, 0.85, 0.6, 0.45, 0.35]), click: 0.25, seed: 11 }),
    // Dhin: open stroke on the soru, deep and sustained fundamental.
    dhin: modal(sr, { dur: 1.5, ...H([1, 0.45, 0.22, 0.1, 0.05], [1.1, 0.75, 0.5, 0.35, 0.25]), click: 0.12, seed: 12 }),
    // Chapu: little finger between soru and rim, a bright ringing overtone.
    chapu: modal(sr, { dur: 1.2, ...H([0.18, 0.35, 1, 0.75, 0.4], [0.35, 0.55, 0.85, 0.7, 0.5]), click: 0.3, seed: 13 }),
    // Thi (dhi): fingers on the centre, damped.
    thi: modal(sr, { dur: 0.25, ...H([0.8, 0.6, 0.45, 0.3, 0.2], [0.05, 0.04, 0.035, 0.03, 0.025]), noise: { a: 0.25, d: 0.012, lp: 3500 }, seed: 14 }),
    // Ki: a light middle-finger touch.
    ki: modal(sr, { dur: 0.15, ...H([0.35, 0.3, 0.2, 0.12, 0.08], [0.035, 0.03, 0.025, 0.02, 0.02]), noise: { a: 0.12, d: 0.008, lp: 4000 }, seed: 15 }),
    // Tha: the left palm, closed.
    tha: modal(sr, { dur: 0.3, modes: [{ f: b * 0.9, a: 0.9, d: 0.06 }, { f: b * 1.9, a: 0.25, d: 0.04 }], noise: { a: 0.5, d: 0.02, lp: 900 }, seed: 16 }),
    // Thom: open bass on the left head.
    thom: modal(sr, { dur: 1.1, modes: [{ f: b, a: 1, d: 0.42, bend: [1.12, 1, 0.12] }, { f: b * 2.02, a: 0.2, d: 0.2 }], noise: { a: 0.3, d: 0.015, lp: 600 }, seed: 17 }),
    // Gumki: bass that glides up as the wrist presses the skin.
    gumki: modal(sr, { dur: 1.3, modes: [{ f: b, a: 1, d: 0.55, bend: [0.86, 1.32, 0.38] }, { f: b * 2, a: 0.15, d: 0.25, bend: [0.86, 1.32, 0.38] }], noise: { a: 0.25, d: 0.015, lp: 500 }, seed: 18 }),
  };
}

// Tabla (for comparison and for people who know it): dayan tuned to Sa, bayan bass.
export function tablaStrokes(sa, sr) {
  const f = drumPitch(sa, 200, 420);
  const b = 95;
  const H = (amps, decays) => amps.map((a, i) => ({ f: f * (i + 1), a, d: decays[i] }));
  return {
    na: modal(sr, { dur: 1, modes: H([0.4, 1, 0.6, 0.35], [0.4, 0.7, 0.5, 0.35]), click: 0.35, seed: 21 }),
    tin: modal(sr, { dur: 1.2, modes: H([1, 0.4, 0.2, 0.1], [0.9, 0.6, 0.4, 0.3]), click: 0.15, seed: 22 }),
    tun: modal(sr, { dur: 1.2, modes: H([1, 0.25, 0.1, 0.05], [1.0, 0.5, 0.3, 0.2]), seed: 23 }),
    tit: modal(sr, { dur: 0.2, modes: H([0.7, 0.5, 0.35, 0.2], [0.04, 0.035, 0.03, 0.025]), noise: { a: 0.3, d: 0.01, lp: 5000 }, seed: 24 }),
    te: modal(sr, { dur: 0.15, modes: H([0.35, 0.3, 0.2, 0.1], [0.03, 0.025, 0.02, 0.02]), noise: { a: 0.15, d: 0.008, lp: 5000 }, seed: 25 }),
    ge: modal(sr, { dur: 1.2, modes: [{ f: b, a: 1, d: 0.5, bend: [0.95, 1.05, 0.2] }, { f: b * 2.1, a: 0.15, d: 0.2 }], noise: { a: 0.2, d: 0.01, lp: 500 }, seed: 26 }),
    geBend: modal(sr, { dur: 1.4, modes: [{ f: b, a: 1, d: 0.65, bend: [0.85, 1.4, 0.45] }], noise: { a: 0.2, d: 0.01, lp: 500 }, seed: 27 }),
    ke: modal(sr, { dur: 0.25, modes: [{ f: b * 1.1, a: 0.7, d: 0.04 }], noise: { a: 0.5, d: 0.025, lp: 1200 }, seed: 28 }),
  };
}

// A cluster of thin metal discs: the kanjira's single jingle.
function jingle(sr, a, dur, seed) {
  const rand = rng(seed);
  const modes = [];
  for (let i = 0; i < 7; i++) modes.push({ f: 3200 + rand() * 4200, a: a * (0.5 + rand() * 0.5), d: 0.06 + rand() * 0.08 });
  return modal(sr, { dur, modes, noise: { a: a * 0.6, d: 0.04, hp: 5000 }, seed: seed + 1 });
}
function mix(...bufs) {
  const n = Math.max(...bufs.map((b) => b.length));
  const out = new Float32Array(n);
  for (const b of bufs) for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}

// Kanjira: lizard-skin frame drum with one jingle; famous for its bass bends.
export function kanjiraStrokes(sa, sr) {
  const f = drumPitch(sa, 180, 360);
  const mem = (a, d, bend) => [1, 1.59, 2.14, 2.3, 2.65].map((r, i) => ({ f: f * r, a: a * [1, 0.5, 0.3, 0.25, 0.15][i], d: d * [1, 0.7, 0.55, 0.5, 0.4][i], bend }));
  return {
    bass: mix(modal(sr, { dur: 0.9, modes: mem(1, 0.35) }), jingle(sr, 0.18, 0.5, 31)),
    bassOpen: mix(modal(sr, { dur: 1.1, modes: mem(1, 0.5) }), jingle(sr, 0.15, 0.5, 32)),
    bassBend: mix(modal(sr, { dur: 1.1, modes: mem(1, 0.5, [0.85, 1.35, 0.35]) }), jingle(sr, 0.15, 0.5, 33)),
    slap: mix(modal(sr, { dur: 0.3, modes: mem(0.6, 0.05), noise: { a: 0.5, d: 0.02, lp: 4000 } }), jingle(sr, 0.3, 0.4, 34)),
    tap: mix(modal(sr, { dur: 0.2, modes: mem(0.3, 0.03) }), jingle(sr, 0.22, 0.3, 35)),
    tapSoft: jingle(sr, 0.16, 0.3, 36),
    rim: mix(modal(sr, { dur: 0.4, modes: mem(0.5, 0.12).slice(1) }), jingle(sr, 0.25, 0.4, 37)),
    rimHigh: jingle(sr, 0.32, 0.45, 38),
  };
}

// Ghatam: a clay pot. The mouth against the belly gives the "gumm" bass; finger
// and nail strokes on the body and neck give bright, short rings.
export function ghatamStrokes(sa, sr) {
  const f = drumPitch(sa, 90, 160);
  const ring = (base, a, d, seed) => modal(sr, { dur: 0.5, modes: [{ f: base, a, d }, { f: base * 1.73, a: a * 0.5, d: d * 0.7 }, { f: base * 2.41, a: a * 0.3, d: d * 0.5 }], noise: { a: a * 0.4, d: 0.006, hp: 2500 }, seed });
  return {
    gum: modal(sr, { dur: 0.9, modes: [{ f, a: 1, d: 0.25, bend: [1.05, 1, 0.1] }, { f: f * 2.3, a: 0.2, d: 0.08 }], noise: { a: 0.3, d: 0.02, lp: 700 }, seed: 41 }),
    gumBend: modal(sr, { dur: 1, modes: [{ f, a: 1, d: 0.32, bend: [0.85, 1.25, 0.3] }], noise: { a: 0.25, d: 0.02, lp: 700 }, seed: 42 }),
    slap: modal(sr, { dur: 0.3, modes: [{ f: f * 1.5, a: 0.4, d: 0.04 }], noise: { a: 0.7, d: 0.025, lp: 3000 }, seed: 43 }),
    tap: ring(1350, 0.6, 0.06, 44),
    tapSoft: ring(1500, 0.35, 0.04, 45),
    neck: ring(950, 0.8, 0.12, 46),
    ring: ring(2100, 0.7, 0.1, 47),
  };
}

// Morsing: a jaw harp. A buzzing reed at Sa shaped by the mouth: each stroke is
// a different mouth shape, so we render it as a reed through moving formants.
export function morsingStrokes(sa, sr) {
  const f = drumPitch(sa, 90, 180);
  function twang(dur, f1a, f1b, f2a, f2b, decay, seed) {
    const n = Math.floor(sr * dur);
    const out = new Float32Array(n);
    let ph = 0;
    // two resonators (formants) implemented as state-variable filters
    const svf = () => ({ lp: 0, bp: 0 });
    const r1 = svf(); const r2 = svf();
    const rand = rng(seed);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += f / sr; if (ph >= 1) ph -= 1;
      const src = (ph < 0.12 ? 1 : -0.14) + (rand() - 0.5) * 0.02; // narrow pulse, reed-like
      const x = Math.min(1, t / 0.15);
      const F1 = f1a + (f1b - f1a) * x; const F2 = f2a + (f2b - f2a) * x;
      for (const [r, F, q] of [[r1, F1, 0.08], [r2, F2, 0.06]]) {
        const g = 2 * Math.sin(Math.PI * F / sr);
        r.lp += g * r.bp;
        const hp = src - r.lp - q * 4 * r.bp;
        r.bp += g * hp;
      }
      out[i] = (r1.bp * 0.6 + r2.bp * 0.4) * Math.exp(-t / decay) * Math.min(1, t / 0.004);
    }
    return normalize(out, 0.7);
  }
  return {
    low: twang(0.9, 450, 650, 1100, 1300, 0.35, 51),
    mid: twang(0.9, 650, 750, 1500, 1700, 0.3, 52),
    bright: twang(0.8, 800, 700, 2200, 1800, 0.28, 53),
    short: twang(0.3, 600, 600, 1600, 1600, 0.07, 54),
    tick: twang(0.2, 700, 700, 2000, 2000, 0.04, 55),
    sweep: twang(1.1, 400, 900, 900, 2400, 0.45, 56),
  };
}

// Thavil: played with a stick on the left head (a deep boom) and with
// thimble-covered fingers on the right (a sharp crack). Loud and bright.
export function thavilStrokes(sa, sr) {
  const f = drumPitch(sa, 70, 120);
  const crack = (a, d, seed) => modal(sr, { dur: 0.4, modes: [{ f: 880, a: a * 0.5, d }, { f: 1460, a: a * 0.4, d: d * 0.8 }, { f: 2350, a: a * 0.3, d: d * 0.6 }], noise: { a: a * 0.9, d: 0.012, hp: 1800 }, click: a * 0.5, seed });
  return {
    stick: modal(sr, { dur: 0.9, modes: [{ f, a: 1, d: 0.3, bend: [1.25, 1, 0.08] }, { f: f * 1.6, a: 0.35, d: 0.12 }], noise: { a: 0.6, d: 0.02, lp: 1500 }, click: 0.5, seed: 61 }),
    stickMuted: modal(sr, { dur: 0.3, modes: [{ f: f * 1.1, a: 0.8, d: 0.06 }], noise: { a: 0.6, d: 0.02, lp: 1500 }, click: 0.4, seed: 62 }),
    crack: crack(1, 0.08, 63),
    crackOpen: crack(0.9, 0.16, 64),
    tap: crack(0.45, 0.04, 65),
    tapSoft: crack(0.25, 0.03, 66),
  };
}

// ---------------------------------------------------------------- reverb
// A gentle hall: early reflections plus a smooth decaying tail that darkens
// over time. Returns [left, right].
export function renderImpulse(sr, { dur = 2.4, decay = 2.2, seed = 9 } = {}) {
  const n = Math.floor(sr * dur);
  const rand = rng(seed);
  const ch = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const k = 0.6 * Math.exp(-t / 1.1) + 0.08; // darker as it decays
      lp += k * ((rand() * 2 - 1) - lp);
      ch[c][i] = lp * Math.exp((-3 * t) / decay) * Math.min(1, t / 0.008);
    }
    // a few early reflections
    for (const [ms, a] of [[11, 0.5], [17, 0.35], [23, 0.3], [31, 0.25], [43, 0.2]]) {
      const idx = Math.floor((ms + c * 3) * sr / 1000);
      if (idx < n) ch[c][idx] += a * (c ? -1 : 1);
    }
    normalize(ch[c], 0.5);
  }
  return ch;
}
