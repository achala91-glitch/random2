// Music theory core: keys, diatonic chords (Nashville numbers), joystick
// modifiers, correct note spelling, and voice-led voicings.
// Pure functions, no audio, so it can be tested in Node.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

// 12 major keys. Spelled the way most charts spell them.
export const KEYS = [
  { id: 'C', letter: 0, acc: 0 },
  { id: 'Db', letter: 1, acc: -1 },
  { id: 'D', letter: 1, acc: 0 },
  { id: 'Eb', letter: 2, acc: -1 },
  { id: 'E', letter: 2, acc: 0 },
  { id: 'F', letter: 3, acc: 0 },
  { id: 'F#', letter: 3, acc: 1 },
  { id: 'G', letter: 4, acc: 0 },
  { id: 'Ab', letter: 5, acc: -1 },
  { id: 'A', letter: 5, acc: 0 },
  { id: 'Bb', letter: 6, acc: -1 },
  { id: 'B', letter: 6, acc: 0 },
];

export const DIRECTIONS = ['c', 'u', 'd', 'l', 'r', 'ul', 'ur', 'dl', 'dr'];
export const DIRECTION_LABELS = {
  c: 'plain', u: '7th', d: 'flip maj/min', l: 'sus4', r: 'add9',
  ul: 'sus2', ur: '9th', dl: 'dim', dr: 'aug',
};

const DEGREE_QUALITY = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
export const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

// Chord tones as [semitones above root, letter steps above root].
const T = {
  R: [0, 0], M2: [2, 1], m3: [3, 2], M3: [4, 2], P4: [5, 3],
  d5: [6, 4], P5: [7, 4], A5: [8, 4], m7: [10, 6], M7: [11, 6], M9: [14, 1],
};

// Chord types: tones in stacking order and the suffix used in chord names.
const TYPES = {
  maj: { tones: ['R', 'M3', 'P5'], suffix: '' },
  min: { tones: ['R', 'm3', 'P5'], suffix: 'm' },
  dim: { tones: ['R', 'm3', 'd5'], suffix: 'dim' },
  aug: { tones: ['R', 'M3', 'A5'], suffix: 'aug' },
  maj7: { tones: ['R', 'M3', 'P5', 'M7'], suffix: 'maj7' },
  dom7: { tones: ['R', 'M3', 'P5', 'm7'], suffix: '7' },
  m7: { tones: ['R', 'm3', 'P5', 'm7'], suffix: 'm7' },
  m7b5: { tones: ['R', 'm3', 'd5', 'm7'], suffix: 'm7b5' },
  sus4: { tones: ['R', 'P4', 'P5'], suffix: 'sus4' },
  sus2: { tones: ['R', 'M2', 'P5'], suffix: 'sus2' },
  add9: { tones: ['R', 'M3', 'P5', 'M9'], suffix: 'add9' },
  madd9: { tones: ['R', 'm3', 'P5', 'M9'], suffix: 'm(add9)' },
  dimadd9: { tones: ['R', 'm3', 'd5', 'M9'], suffix: 'dim(add9)' },
  maj9: { tones: ['R', 'M3', 'P5', 'M7', 'M9'], suffix: 'maj9' },
  dom9: { tones: ['R', 'M3', 'P5', 'm7', 'M9'], suffix: '9' },
  m9: { tones: ['R', 'm3', 'P5', 'm7', 'M9'], suffix: 'm9' },
  m9b5: { tones: ['R', 'm3', 'd5', 'm7', 'M9'], suffix: 'm9b5' },
};

function mod(n, m) { return ((n % m) + m) % m; }

export function keyById(id) {
  return KEYS.find((k) => k.id === id) || KEYS[0];
}

function accidentalString(acc) {
  return { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' }[acc];
}

// Spell a pitch class given the letter it must use (e.g. pc 8 on letter G = G#).
export function spell(letter, pc) {
  let acc = mod(pc - LETTER_PC[letter], 12);
  if (acc > 6) acc -= 12;
  if (acc < -2 || acc > 2) throw new Error(`Cannot spell pc ${pc} on ${LETTERS[letter]}`);
  return LETTERS[letter] + accidentalString(acc);
}

// Pretty version for the screen: b -> ♭, # -> ♯.
export function pretty(name) {
  return name.replace(/##/g, '𝄪').replace(/#/g, '♯').replace(/(?<=[A-G])bb/g, '𝄫').replace(/(?<=[A-G]|m7|m9)b/g, '♭');
}

export function keyName(id) { return pretty(id); }

function keyPc(key) { return mod(LETTER_PC[key.letter] + key.acc, 12); }

// Diatonic root of a scale degree (1-7) in a key.
export function degreeRoot(keyId, degree) {
  const key = keyById(keyId);
  const letter = (key.letter + degree - 1) % 7;
  const pc = mod(keyPc(key) + MAJOR_SCALE[degree - 1], 12);
  return { letter, pc, name: spell(letter, pc) };
}

// Which chord type each joystick direction produces for a given diatonic quality.
export function chordType(degree, dir) {
  const q = DEGREE_QUALITY[degree - 1];
  switch (dir) {
    case 'c': return q;
    case 'u':
      if (q === 'maj') return degree === 5 ? 'dom7' : 'maj7';
      return q === 'min' ? 'm7' : 'm7b5';
    case 'd': return q === 'maj' ? 'min' : 'maj'; // minor and dim both flip to major
    case 'l': return 'sus4';
    case 'r': return { maj: 'add9', min: 'madd9', dim: 'dimadd9' }[q];
    case 'ul': return 'sus2';
    case 'ur':
      if (q === 'maj') return degree === 5 ? 'dom9' : 'maj9';
      return q === 'min' ? 'm9' : 'm9b5';
    case 'dl': return 'dim';
    case 'dr': return 'aug';
    default: throw new Error(`Unknown direction ${dir}`);
  }
}

// Full chord description: name, spelled notes, pitch classes, intervals.
export function buildChord(keyId, degree, dir = 'c') {
  const root = degreeRoot(keyId, degree);
  const typeId = chordType(degree, dir);
  const type = TYPES[typeId];
  const tones = type.tones.map((t) => {
    const [semi, steps] = T[t];
    const pc = mod(root.pc + semi, 12);
    return { tone: t, semi, pc, name: spell((root.letter + steps) % 7, pc) };
  });
  return {
    keyId, degree, dir, typeId,
    roman: ROMAN[degree - 1],
    root,
    name: root.name + type.suffix,
    display: pretty(root.name + type.suffix),
    tones,
  };
}

// Which pitch classes belong to the key (for "no wrong notes" checks).
export function keyPitchClasses(keyId) {
  const pc0 = keyPc(keyById(keyId));
  return MAJOR_SCALE.map((s) => mod(pc0 + s, 12));
}

// ---------- Voicing ----------
export const VOICING_LOW = 48; // C3
export const VOICING_HIGH = 76; // E5 (a little headroom for 9th chords)
export const BASS_LOW = 36; // C2
export const CENTER = 61;

// Extended chords (7ths, 9ths, add9) drop the root from the upper voices,
// the way keyboard players do: the bass already has it, and a root sitting a
// semitone above a major 7th sounds muddy.
export function upperTones(chord) {
  if (chord.tones.length >= 4) return chord.tones.filter((t) => t.tone !== 'R');
  return chord.tones;
}

function candidateVoicings(chord) {
  const order = upperTones(chord).map((t) => t.pc);
  const out = [];
  for (let r = 0; r < order.length; r++) {
    const rot = order.slice(r).concat(order.slice(0, r));
    for (let start = VOICING_LOW; start < VOICING_LOW + 24; start++) {
      if (start % 12 !== rot[0]) continue;
      const notes = [start];
      for (let i = 1; i < rot.length; i++) {
        let n = notes[i - 1] + 1;
        while (n % 12 !== rot[i]) n++;
        notes.push(n);
      }
      if (notes[notes.length - 1] <= VOICING_HIGH) out.push({ notes, inversion: r });
    }
  }
  return out;
}

function nearestSum(a, b) {
  let s = 0;
  for (const x of a) s += Math.min(...b.map((y) => Math.abs(x - y)));
  return s;
}

function mean(arr) { return arr.reduce((s, x) => s + x, 0) / arr.length; }

// Pick the voicing that moves least from the previous chord while staying
// in a comfortable middle register. Returns { bass, upper, all }.
export function voiceChord(chord, prevUpper = null) {
  const cands = candidateVoicings(chord);
  let best = null;
  let bestCost = Infinity;
  for (const c of cands) {
    const span = c.notes[c.notes.length - 1] - c.notes[0];
    const m = mean(c.notes);
    let cost = 0.6 * Math.max(0, span - 12);
    if (prevUpper && prevUpper.length) {
      cost += nearestSum(c.notes, prevUpper) + nearestSum(prevUpper, c.notes);
      cost += 0.8 * Math.max(0, Math.abs(m - CENTER) - 4); // keep it from drifting
    } else {
      cost += Math.abs(m - CENTER) + (c.inversion === 0 ? 0 : 1.5);
    }
    if (cost < bestCost - 1e-9) { bestCost = cost; best = c; }
  }
  const bass = BASS_LOW + chord.root.pc;
  return { bass, upper: best.notes, all: [bass, ...best.notes] };
}

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiToName(m) {
  return NOTE_NAMES_SHARP[m % 12] + (Math.floor(m / 12) - 1);
}
export function midiToFreq(m) { return 440 * 2 ** ((m - 69) / 12); }

// Name a voiced midi note using the chord's own spelling (so Caug shows G#, not Ab).
export function spellVoiced(chord, midi) {
  const t = chord.tones.find((x) => x.pc === midi % 12);
  const octave = Math.floor(midi / 12) - 1;
  // Octave numbers follow the letter (B#3 is the same pitch as C4).
  let name = t ? t.name : NOTE_NAMES_SHARP[midi % 12];
  let oct = octave;
  if (t) {
    const letter = name[0];
    const natPc = LETTER_PC[LETTERS.indexOf(letter)];
    const acc = mod(midi % 12 - natPc, 12) > 6 ? mod(midi % 12 - natPc, 12) - 12 : mod(midi % 12 - natPc, 12);
    oct = Math.floor((midi - acc) / 12) - 1;
  }
  return name + oct;
}
