// Swaras, swarasthanas, notation and tuning. Pure functions (unit tested).
//
// 12 swarasthanas (positions, in semitones above Sa) carry 16 names: four
// positions have two names each (R2 = G1, R3 = G2, D2 = N1, D3 = N2).

export const LETTERS = ['S', 'R', 'G', 'M', 'P', 'D', 'N'];
export const LETTER_NAMES = ['Sa', 'Ri', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'];
export const LETTER_FULL = ['Shadjam', 'Rishabham', 'Gandharam', 'Madhyamam', 'Panchamam', 'Dhaivatam', 'Nishadam'];
// Tamil script, as used in Tamil Carnatic notation.
export const LETTER_TAMIL = ['ஸ', 'ரி', 'க', 'ம', 'ப', 'த', 'நி'];

// The 16 swara names. pos = semitones above Sa.
export const SWARAS = {
  S: { letter: 0, pos: 0, name: 'Shadjam' },
  R1: { letter: 1, pos: 1, name: 'Shuddha Rishabham' },
  R2: { letter: 1, pos: 2, name: 'Chatushruti Rishabham' },
  R3: { letter: 1, pos: 3, name: 'Shatshruti Rishabham' },
  G1: { letter: 2, pos: 2, name: 'Shuddha Gandharam' },
  G2: { letter: 2, pos: 3, name: 'Sadharana Gandharam' },
  G3: { letter: 2, pos: 4, name: 'Antara Gandharam' },
  M1: { letter: 3, pos: 5, name: 'Shuddha Madhyamam' },
  M2: { letter: 3, pos: 6, name: 'Prati Madhyamam' },
  P: { letter: 4, pos: 7, name: 'Panchamam' },
  D1: { letter: 5, pos: 8, name: 'Shuddha Dhaivatam' },
  D2: { letter: 5, pos: 9, name: 'Chatushruti Dhaivatam' },
  D3: { letter: 5, pos: 10, name: 'Shatshruti Dhaivatam' },
  N1: { letter: 6, pos: 9, name: 'Shuddha Nishadam' },
  N2: { letter: 6, pos: 10, name: 'Kaisiki Nishadam' },
  N3: { letter: 6, pos: 11, name: 'Kakali Nishadam' },
};

// The 12 positions with every name that sits on each.
export const SWARASTHANAS = Array.from({ length: 12 }, (_, pos) => ({
  pos,
  names: Object.keys(SWARAS).filter((k) => SWARAS[k].pos === pos),
}));

// Natural (5-limit just) ratios for each position, the usual reference for
// drone-based tuning. In practice Carnatic pitch is fluid and shaped by gamaka;
// these are the resting points.
export const JUST_RATIOS = [
  [1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3],
  [45, 32], [3, 2], [8, 5], [5, 3], [16, 9], [15, 8],
];

export function centsOf(ratio) { return 1200 * Math.log2(ratio[0] / ratio[1]); }

// Cents above Sa for a position (0-11) in a tuning ('just' | 'equal').
export function positionCents(pos, tuning = 'just') {
  const p = ((pos % 12) + 12) % 12;
  const oct = Math.floor(pos / 12);
  const base = tuning === 'equal' ? p * 100 : centsOf(JUST_RATIOS[p]);
  return base + oct * 1200;
}

// ---------- Shruti: kattai ----------
// Kattai numbering follows the harmonium keyboard: whole kattais are the white
// keys from C, half kattais the black keys between them. There is no 3½ or 7½
// because E-F and B-C have no black key between them.
export const KATTAIS = [
  { id: '1', label: '1', pc: 0 },
  { id: '1.5', label: '1½', pc: 1 },
  { id: '2', label: '2', pc: 2 },
  { id: '2.5', label: '2½', pc: 3 },
  { id: '3', label: '3', pc: 4 },
  { id: '4', label: '4', pc: 5 },
  { id: '4.5', label: '4½', pc: 6 },
  { id: '5', label: '5', pc: 7 },
  { id: '5.5', label: '5½', pc: 8 },
  { id: '6', label: '6', pc: 9 },
  { id: '6.5', label: '6½', pc: 10 },
  { id: '7', label: '7', pc: 11 },
];

export const WESTERN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const WESTERN_ASCII = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function kattaiById(id) { return KATTAIS.find((k) => k.id === String(id)) || KATTAIS[1]; }

// Sa frequency. octave: the Western octave number of Sa (3 = C3..B3, the usual
// range for male voices; 4 for higher voices). A4 = 440 Hz reference.
export function saFrequency(kattaiId, octave = 3, fineCents = 0) {
  const k = kattaiById(kattaiId);
  const midi = 12 * (octave + 1) + k.pc;
  return 440 * 2 ** ((midi - 69) / 12) * 2 ** (fineCents / 1200);
}

export function kattaiWestern(kattaiId, octave = 3) {
  const k = kattaiById(kattaiId);
  return `${WESTERN[k.pc]}${octave}`;
}

// Western note name for a swara, given the Sa pitch class.
export function westernName(saPc, pos, saOctave = 3, sthayi = 0) {
  const semis = saPc + pos + 12 * sthayi;
  const pc = ((semis % 12) + 12) % 12;
  const oct = saOctave + Math.floor(semis / 12);
  return `${WESTERN[pc]}${oct}`;
}

// ---------- Notation ----------
const DOT_ABOVE = '̇';
const DOT_BELOW = '̣';

// "S", "R2", "G3"... with a dot above for mel sthayi and below for mandra.
export function carnaticLabel(swaraId, sthayi = 0, { subscript = false } = {}) {
  const letter = swaraId[0];
  const num = swaraId.slice(1);
  const dot = sthayi > 0 ? DOT_ABOVE : sthayi < 0 ? DOT_BELOW : '';
  const n = subscript ? num.replace(/[0-9]/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]) : num;
  return letter + dot + n;
}

export function tamilLabel(swaraId, sthayi = 0) {
  const letter = SWARAS[swaraId].letter;
  const num = swaraId.slice(1).replace(/[0-9]/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  const dot = sthayi > 0 ? DOT_ABOVE : sthayi < 0 ? DOT_BELOW : '';
  return LETTER_TAMIL[letter] + dot + num;
}

export function swaraIdAt(letter, pos) {
  return Object.keys(SWARAS).find((k) => SWARAS[k].letter === letter && SWARAS[k].pos === pos) || null;
}
