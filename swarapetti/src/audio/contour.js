// Schedules pitch contours (cents over time) onto AudioParams, and keeps a copy
// of what was scheduled so a new gesture can take over from the exact pitch the
// note is at, without jumps.
import { smoothstep, valueAt } from '../theory/gamaka.js';

const S_STEPS = 7; // linear segments per S-curve

// Freeze a param at time t (cancelAndHoldAtTime where supported).
export function holdAt(param, t, value) {
  if (param.cancelAndHoldAtTime) {
    try { param.cancelAndHoldAtTime(t); } catch { param.cancelScheduledValues(t); }
  } else {
    param.cancelScheduledValues(t);
  }
  param.setValueAtTime(value, t);
}

export class PitchTrack {
  // targets: [{ param, map: (cents) => value }]
  constructor(targets, startCents, t0) {
    this.targets = targets;
    this.points = [{ t: t0, c: startCents, ease: 'step' }];
    for (const tg of targets) tg.param.setValueAtTime(tg.map(startCents), t0);
  }

  valueAt(t) { return valueAt(this.points, t); }

  get end() { return this.points[this.points.length - 1].t; }

  // Replace everything from time t with a new contour. pts use relative times.
  replace(t, pts) {
    const from = this.valueAt(t);
    this.points = this.points.filter((p) => p.t < t);
    this.points.push({ t, c: from, ease: 'step' });
    for (const tg of this.targets) holdAt(tg.param, t, tg.map(from));
    this.append(t, pts, from);
  }

  // Add points after the current end (used for repeating kampitam cycles).
  append(t0, pts, fromCents = this.points[this.points.length - 1].c) {
    let prevC = fromCents;
    let prevT = this.end;
    for (const p of pts) {
      const T = Math.max(t0 + p.t, prevT);
      for (const tg of this.targets) {
        const prm = tg.param;
        if (p.ease === 'step') prm.setValueAtTime(tg.map(p.c), T);
        else if (p.ease === 'lin' || T - prevT < 0.012) prm.linearRampToValueAtTime(tg.map(p.c), T);
        else {
          for (let j = 1; j <= S_STEPS; j++) {
            const x = j / S_STEPS;
            prm.linearRampToValueAtTime(tg.map(prevC + (p.c - prevC) * smoothstep(x)), prevT + (T - prevT) * x);
          }
        }
      }
      this.points.push({ t: T, c: p.c, ease: p.ease });
      prevC = p.c; prevT = T;
    }
    // keep the history short
    if (this.points.length > 400) this.points = this.points.slice(-200);
  }
}
