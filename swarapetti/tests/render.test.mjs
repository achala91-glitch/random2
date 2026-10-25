// Checks the offline renderers: pitch accuracy, no clipping/NaN, sensible decay,
// and render speed. Run: node swarapetti/tests/render.test.mjs
import {
  renderVeena, renderTanpura, mridangamStrokes, tablaStrokes, kanjiraStrokes, ghatamStrokes,
  morsingStrokes, thavilStrokes, renderImpulse,
} from '../src/audio/render.js';

const SR = 48000;
let checks = 0; let fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL: ' + m); } };

// Pitch by normalised autocorrelation with parabolic refinement.
export function estimateF0(x, sr, from, len, fmin = 50, fmax = 1200) {
  const seg = x.subarray(from, from + len);
  let best = 0; let bestLag = 0;
  const minLag = Math.floor(sr / fmax); const maxLag = Math.floor(sr / fmin);
  const r = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0; let e1 = 0; let e2 = 0;
    for (let i = 0; i + lag < seg.length; i++) { s += seg[i] * seg[i + lag]; e1 += seg[i] * seg[i]; e2 += seg[i + lag] * seg[i + lag]; }
    r[lag] = s / Math.sqrt(e1 * e2 + 1e-12);
  }
  // first strong peak (avoids octave errors)
  const thresh = 0.9 * Math.max(...r.slice(minLag, maxLag + 1));
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (r[lag] >= thresh && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { bestLag = lag; best = r[lag]; break; }
  }
  const a = r[bestLag - 1]; const b = r[bestLag]; const c = r[bestLag + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { f0: sr / (bestLag + shift), clarity: best };
}
const cents = (a, b) => 1200 * Math.log2(a / b);
const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
const clean = (x) => x.every((v) => Number.isFinite(v) && Math.abs(v) <= 1);

console.log('--- Veena');
for (const f of [110, 138.59, 196, 261.63, 392, 587.33]) {
  const t = performance.now();
  const x = renderVeena(f, SR);
  const ms = performance.now() - t;
  const { f0, clarity } = estimateF0(x, SR, Math.floor(SR * 0.3), 4096);
  const err = cents(f0, f);
  console.log(`  ${f.toFixed(2)} Hz -> ${f0.toFixed(2)} Hz (${err.toFixed(1)} cents, clarity ${clarity.toFixed(2)}, ${ms.toFixed(1)} ms)`);
  ok(Math.abs(err) < 6, `veena ${f} Hz in tune (${err.toFixed(1)} cents)`);
  ok(clean(x), `veena ${f} Hz has no NaN or clipping`);
  ok(rms(x, 0, SR * 0.2) > 4 * rms(x, SR * 2.6, SR * 3.0), `veena ${f} Hz decays`);
  ok(ms < 150, `veena ${f} Hz renders fast enough to do on a key press (${ms.toFixed(1)} ms)`);
}

console.log('--- Tanpura');
for (const f of [65.4, 98.0, 130.81, 196]) {
  const t = performance.now();
  const x = renderTanpura(f, SR, { dur: 7 });
  const ms = performance.now() - t;
  const { f0 } = estimateF0(x, SR, Math.floor(SR * 1.0), 8192, 40, 600);
  const err = cents(f0, f);
  console.log(`  ${f.toFixed(2)} Hz -> ${f0.toFixed(2)} Hz (${err.toFixed(1)} cents, ${ms.toFixed(0)} ms)`);
  ok(Math.abs(err) < 4, `tanpura ${f} Hz in tune`);
  ok(clean(x), `tanpura ${f} Hz clean`);
  ok(ms < 2500, `tanpura renders in reasonable time (${ms.toFixed(0)} ms)`);
  // The jivari sweep: early sound is brighter than late sound.
  const bright = (a, b) => { let d = 0; let e = 0; for (let i = a + 1; i < b; i++) { d += (x[i] - x[i - 1]) ** 2; e += x[i] ** 2; } return d / e; };
  ok(bright(SR * 0.2, SR * 0.6) > 1.5 * bright(SR * 4, SR * 4.4), `tanpura ${f} Hz is brighter early (jivari sweep)`);
}

console.log('--- Percussion');
const sets = {
  mridangam: mridangamStrokes(138.59, SR), tabla: tablaStrokes(138.59, SR), kanjira: kanjiraStrokes(138.59, SR),
  ghatam: ghatamStrokes(138.59, SR), morsing: morsingStrokes(138.59, SR), thavil: thavilStrokes(138.59, SR),
};
for (const [inst, strokes] of Object.entries(sets)) {
  for (const [name, x] of Object.entries(strokes)) {
    const peak = Math.max(...x.map(Math.abs));
    ok(x.every(Number.isFinite), `${inst} ${name} finite`);
    ok(peak > 0.05, `${inst} ${name} is audible`);
  }
  console.log(`  ${inst}: ${Object.keys(strokes).join(', ')}`);
}
// The mridangam's ringing strokes sound at the drum's pitch (Sa, here 138.59 Hz).
{
  const m = sets.mridangam;
  const { f0 } = estimateF0(m.dhin, SR, Math.floor(SR * 0.1), 4096, 80, 400);
  ok(Math.abs(cents(f0, 138.59)) < 15, `mridangam dhin rings at Sa (${f0.toFixed(1)} Hz)`);
  const { f0: g0 } = estimateF0(m.gumki, SR, Math.floor(SR * 0.05), 1024, 40, 200);
  const { f0: g1 } = estimateF0(m.gumki, SR, Math.floor(SR * 0.5), 2048, 40, 200);
  ok(g1 > g0 * 1.15, `gumki bends upward (${g0.toFixed(1)} -> ${g1.toFixed(1)} Hz)`);
  ok(rms(m.thi, 0, 2400) > 0 && m.thi.length < SR * 0.3, 'thi is a short damped stroke');
}

console.log('--- Reverb');
const [L, Rr] = renderImpulse(SR);
ok(clean(L) && clean(Rr), 'impulse clean');
ok(rms(L, 0, SR * 0.2) > 10 * rms(L, SR * 2.0, SR * 2.3), 'impulse decays');

console.log(`\n${checks - fails}/${checks} render checks passed.`);
if (fails) process.exit(1);
