// Gamakas: the joystick's left, right and diagonal directions. Up and down
// change sthayi. Each gamaka is a pitch contour in cents (relative to madhya
// Sa), built from the swara and its neighbours in the ragam. Pure functions.
//
// Points are { t, c, ease } where t is seconds from the note start, c is cents,
// and ease says how to travel from the previous point: 'step' (jump), 'lin' or
// 's' (smooth S-curve, what a finger sliding on a string or a voice does).

export const GAMAKAS = {
  r: { id: 'kampitam', name: 'Kampitam', arrow: '→', desc: 'Oscillates between the swara and the next swara above, for as long as you hold it. The defining gamaka of Carnatic music.' },
  l: { id: 'nokku', name: 'Nokku', arrow: '←', desc: 'A stress from above: the swara above is touched briefly, then you land on the swara.' },
  ur: { id: 'etra-jaru', name: 'Etra jaru', arrow: '↗', desc: 'A slide up into the swara from two swaras below.' },
  dr: { id: 'irakka-jaru', name: 'Irakka jaru', arrow: '↘', desc: 'A slide down into the swara from two swaras above.' },
  ul: { id: 'orikkai', name: 'Orikkai', arrow: '↖', desc: 'The swara is held, then flicks up to the next swara as you let go.' },
  dl: { id: 'sphuritam', name: 'Sphuritam', arrow: '↙', desc: 'A quick pressure from the swara below. On repeated swaras (janta) this gives the sphuritam stress.' },
};

export const STHAYI_DIRS = { u: 1, d: -1 };

export function gamakaFor(dir) { return GAMAKAS[dir] || null; }

// The ragam's neighbour swaras in cents. nb: { upper, upper2, lower, lower2 }.
function cap(target, other, maxCents) {
  if (other === undefined) return target;
  const d = other - target;
  return Math.abs(d) > maxCents ? target + Math.sign(d) * maxCents : other;
}

/**
 * Onset contour for a gamaka. Returns { points, cycle, release }:
 *  - points: played from the note start
 *  - cycle: (kampitam) a repeating cycle appended while the key is held
 *  - release: (orikkai) a short contour played when the key is let go
 * speed scales all the timings (1 = natural, 0.7 = quicker).
 */
export function gamakaContour(gamakaId, target, nb, speed = 1) {
  const k = speed;
  const up = cap(target, nb.upper, 320);
  const lo = cap(target, nb.lower, 320);
  const up2 = cap(target, nb.upper2 ?? nb.upper, 520);
  const lo2 = cap(target, nb.lower2 ?? nb.lower, 520);
  switch (gamakaId) {
    case 'kampitam': {
      const period = 0.24 * k;
      return {
        points: [{ t: 0, c: target, ease: 'step' }, { t: 0.07 * k, c: target, ease: 'lin' }],
        cycle: kampitamCycle(target, up, period),
        release: null,
      };
    }
    case 'nokku':
      return {
        points: [
          { t: 0, c: up, ease: 'step' },
          { t: 0.055 * k, c: up, ease: 'lin' },
          { t: 0.14 * k, c: target, ease: 's' },
        ],
        cycle: null, release: null,
      };
    case 'etra-jaru':
      return {
        points: [
          { t: 0, c: lo2, ease: 'step' },
          { t: 0.03 * k, c: lo2, ease: 'lin' },
          { t: 0.26 * k, c: target, ease: 's' },
        ],
        cycle: null, release: null,
      };
    case 'irakka-jaru':
      return {
        points: [
          { t: 0, c: up2, ease: 'step' },
          { t: 0.03 * k, c: up2, ease: 'lin' },
          { t: 0.26 * k, c: target, ease: 's' },
        ],
        cycle: null, release: null,
      };
    case 'sphuritam':
      return {
        points: [
          { t: 0, c: target, ease: 'step' },
          { t: 0.04 * k, c: target, ease: 'lin' },
          { t: 0.085 * k, c: lo, ease: 's' },
          { t: 0.17 * k, c: target, ease: 's' },
        ],
        cycle: null, release: null,
      };
    case 'orikkai':
      return {
        points: [{ t: 0, c: target, ease: 'step' }],
        cycle: null,
        release: [{ t: 0, c: target, ease: 'step' }, { t: 0.07 * k, c: up, ease: 's' }],
      };
    default:
      return { points: [{ t: 0, c: target, ease: 'step' }], cycle: null, release: null };
  }
}

// One kampitam cycle: dwell on the swara, rise to the upper swara, dwell, fall.
// Real kampitam spends time at both ends rather than moving like a sine wave.
export function kampitamCycle(target, upper, period) {
  return [
    { t: 0.32 * period, c: upper, ease: 's' },
    { t: 0.5 * period, c: upper, ease: 'lin' },
    { t: 0.82 * period, c: target, ease: 's' },
    { t: period, c: target, ease: 'lin' },
  ];
}

export function smoothstep(x) { return x * x * (3 - 2 * x); }

// Value of a point list at time t (used to take over smoothly mid-gesture).
export function valueAt(points, t) {
  if (!points.length) return 0;
  if (t <= points[0].t) return points[0].c;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]; const b = points[i];
    if (t <= b.t) {
      if (b.ease === 'step') return a.c;
      const x = (t - a.t) / Math.max(1e-9, b.t - a.t);
      return a.c + (b.c - a.c) * (b.ease === 's' ? smoothstep(x) : x);
    }
  }
  return points[points.length - 1].c;
}

// A legato glide between swaras (no gamaka): an S-curve of length dur.
export function glidePoints(from, to, dur) {
  return [{ t: 0, c: from, ease: 'step' }, { t: dur, c: to, ease: 's' }];
}
