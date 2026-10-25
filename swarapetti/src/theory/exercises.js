// Exercise notation and the traditional beginner exercises (varisais,
// alankarams, a geetham). Pure data + parser (unit tested).
//
// Notation: swara letters s r g m p d n (any case). A trailing ' is mel sthayi,
// a trailing . is mandra sthayi. "," holds the previous swara one more unit
// (karvai). "|" and "||" are bar lines (display only). A gamaka can follow a
// swara as ~r, ~l, ~ur, ~dr, ~ul, ~dl (the joystick direction).
import { LETTERS } from './swaras.js';

const LETTER_INDEX = { s: 0, r: 1, g: 2, m: 3, p: 4, d: 5, n: 6 };

export function parseExercise(src) {
  const events = [];
  const bars = [];
  let unit = 0;
  for (const raw of src.trim().split(/\s+/)) {
    if (raw === '|' || raw === '||') { bars.push({ at: unit, kind: raw }); continue; }
    if (raw === ',') {
      if (!events.length) throw new Error('Karvai before any swara');
      events[events.length - 1].units += 1;
      unit += 1;
      continue;
    }
    const m = raw.match(/^([srgmpdnSRGMPDN])('*|\.*)(?:~(r|l|ur|dr|ul|dl))?(,*)$/);
    if (!m) throw new Error(`Cannot read "${raw}"`);
    const letter = LETTER_INDEX[m[1].toLowerCase()];
    const sthayi = m[2].startsWith("'") ? m[2].length : -m[2].length;
    const units = 1 + m[4].length; // "g," = g held for an extra unit
    events.push({ letter, sthayi, gamaka: m[3] || 'c', units, at: unit });
    unit += units;
  }
  return { events, bars, units: unit };
}

export function formatEvent(ev) {
  return LETTERS[ev.letter] + (ev.sthayi > 0 ? "'" : ev.sthayi < 0 ? '.' : '');
}

// ---------- Sarali varisai (Mayamalavagowla, Adi) ----------
export const SARALI = [
  "s r g m | p d | n s' || s' n d p | m g | r s ||",
  "s r s r | s r | g m || s r g m | p d | n s' || s' n s' n | s' n | d p || s' n d p | m g | r s ||",
  "s r g s | r g | s r || s r g m | p d | n s' || s' n d s' | n d | s' n || s' n d p | m g | r s ||",
  "s r g m | s r | g m || s r g m | p d | n s' || s' n d p | s' n | d p || s' n d p | m g | r s ||",
];

// ---------- Janta varisai 1 ----------
export const JANTA_1 = "s s r r | g g | m m || p p d d | n n | s' s' || s' s' n n | d d | p p || m m g g | r r | s s ||";

// ---------- Dhatu varisai 1 ----------
// The first line ("s m g m | r g | s r || s g r g | s r | g m") is from the
// published notation; the rest of the exercise moves the same two shapes up
// one swara at a time, then mirrors them coming down.
const ORDER = ['s', 'r', 'g', 'm', 'p', 'd', 'n', "s'", "r'", "g'", "m'"];
const DOWN = ["s'", 'n', 'd', 'p', 'm', 'g', 'r', 's', 'n.', 'd.', 'p.'];
function shape(list, i, offsets) { return offsets.map((o) => list[i + o]); }
export function dhatuVarisai1() {
  const lines = [];
  const A = [0, 3, 2, 3, 1, 2, 0, 1];
  const B = [0, 2, 1, 2, 0, 1, 2, 3];
  for (let i = 0; i <= 4; i++) lines.push(shape(ORDER, i, A), shape(ORDER, i, B));
  for (let i = 0; i <= 4; i++) lines.push(shape(DOWN, i, A), shape(DOWN, i, B));
  return lines.map((l) => `${l.slice(0, 4).join(' ')} | ${l.slice(4, 6).join(' ')} | ${l.slice(6).join(' ')} ||`).join(' ');
}
export const DHATU_1 = dhatuVarisai1();

// ---------- Alankarams ----------
// Chatusra jati eka talam: four-swara groups, each starting one swara higher.
function stepped(len) {
  const up = []; const down = [];
  for (let i = 0; i + len - 1 < ORDER.length && i <= 7 - len + 1; i++) {
    up.push(`${ORDER.slice(i, i + len).join(' ')} |`);
  }
  for (let i = 0; i + len - 1 < DOWN.length && i <= 7 - len + 1; i++) {
    down.push(`${DOWN.slice(i, i + len).join(' ')} |`);
  }
  return `${up.join(' ')} ${down.join(' ')}`.replace(/\|$/, '||');
}
export const ALANKARAM_CHATUSRA_EKA = stepped(4);
export const ALANKARAM_TISRA_EKA = stepped(3);

// ---------- Geetham: Sri Gananatha (Lambodara) ----------
// Purandara Dasa (16th century), Malahari, Rupakam. Public domain.
// Only the phrases we could confirm against published notation are included:
// the opening line of the pallavi and a cadence phrase that closes lines.
export const GEETHAM_OPENING = "m p | d s' s' r' || r' s' | d p m p ||";
export const GEETHAM_CADENCE = 'r m | p d m p || d p | m g r s ||';
