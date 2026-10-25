// Talams, nadai and kalam. Pure data and maths (unit tested).
//
// Kriyas (hand gestures): a laghu is a clap followed by finger counts (little,
// ring, middle...), a drutam is a clap followed by a wave (veechu), an
// anudrutam is a single clap. Chapu talams are counted by their groupings,
// with a gesture on the first beat of each group.

export const KRIYA = {
  clap: { label: 'Clap', tamil: 'தட்டு', short: 'clap' },
  f1: { label: 'Little finger', short: '1' },
  f2: { label: 'Ring finger', short: '2' },
  f3: { label: 'Middle finger', short: '3' },
  wave: { label: 'Wave', tamil: 'வீச்சு', short: 'wave' },
  rest: { label: 'Count silently', short: '·' },
};

export const TALAMS = [
  {
    id: 'adi', name: 'Adi', beats: 8, groups: [4, 2, 2], angas: 'laghu (4) + drutam + drutam',
    kriyas: ['clap', 'f1', 'f2', 'f3', 'clap', 'wave', 'clap', 'wave'],
  },
  {
    id: 'rupakam', name: 'Rupakam', beats: 6, groups: [2, 4], angas: 'drutam + laghu (4)',
    kriyas: ['clap', 'wave', 'clap', 'f1', 'f2', 'f3'],
  },
  {
    id: 'misra-chapu', name: 'Misra Chapu', beats: 7, groups: [3, 2, 2], angas: '3 + 2 + 2',
    kriyas: ['clap', 'rest', 'rest', 'clap', 'rest', 'clap', 'rest'],
  },
  {
    id: 'khanda-chapu', name: 'Khanda Chapu', beats: 5, groups: [2, 1, 2], angas: 'drutam + anudrutam + drutam',
    kriyas: ['clap', 'wave', 'clap', 'clap', 'wave'],
  },
  // Used by alankaram lessons.
  {
    id: 'tisra-eka', name: 'Tisra Eka', beats: 3, groups: [3], angas: 'laghu (3)', lessonOnly: true,
    kriyas: ['clap', 'f1', 'f2'],
  },
  {
    id: 'chatusra-eka', name: 'Chatusra Eka', beats: 4, groups: [4], angas: 'laghu (4)', lessonOnly: true,
    kriyas: ['clap', 'f1', 'f2', 'f3'],
  },
];

export const NADAIS = [
  { id: 'chatusram', name: 'Chatusram', per: 4, sollu: 'ta ka di mi' },
  { id: 'tisram', name: 'Tisram', per: 3, sollu: 'ta ki ta' },
  { id: 'khandam', name: 'Khandam', per: 5, sollu: 'ta ka ta ki ta' },
];

// Kalam: swaras per beat when practising (first, second, third speed).
export const KALAMS = [
  { id: 1, name: 'First kalam', short: '1st', perBeat: 1 },
  { id: 2, name: 'Second kalam', short: '2nd', perBeat: 2 },
  { id: 3, name: 'Third kalam', short: '3rd', perBeat: 4 },
];

export function talamById(id) { return TALAMS.find((t) => t.id === id) || TALAMS[0]; }
export function nadaiById(id) { return NADAIS.find((n) => n.id === id) || NADAIS[0]; }
export function kalamById(id) { return KALAMS.find((k) => k.id === Number(id)) || KALAMS[0]; }

// Which beats start a group (anga). Beat 0 is samam.
export function groupStarts(talam) {
  const starts = [];
  let b = 0;
  for (const g of talam.groups) { starts.push(b); b += g; }
  return starts;
}

// Percussion steps per beat: the nadai, doubled for each kalam above the first.
export function stepsPerBeat(nadai, kalam) { return nadai.per * kalam.perBeat; }

// Where are we, given elapsed seconds since samam?
export function positionAt(seconds, tempo, talam) {
  const beatDur = 60 / tempo;
  const totalBeats = seconds / beatDur;
  const cycle = Math.floor(totalBeats / talam.beats);
  const beatInCycle = Math.floor(totalBeats - cycle * talam.beats);
  return { cycle, beat: beatInCycle, fraction: totalBeats - Math.floor(totalBeats) };
}

// ---------- Percussion patterns ----------
// Built from beat-long cells of mridangam strokes, in the spirit of sarvalaghu
// (steady flowing accompaniment): a full stroke on samam, a bass stroke at the
// start of each anga, flowing nam/dhin strokes in between, a small fill on the
// last beat. '-' is a rest. Other drums map these strokes to their own.
const CELLS = {
  4: {
    sam: ['thom', '-', 'nam', 'ki'],
    group: ['gumki', '-', 'dhin', '-'],
    a: ['nam', '-', 'dhin', '-'],
    b: ['tha', 'ki', 'nam', '-'],
    last: ['thi', 'ki', 'nam', 'chapu'],
  },
  3: {
    sam: ['thom', 'nam', 'ki'],
    group: ['gumki', 'dhin', '-'],
    a: ['nam', 'dhin', '-'],
    b: ['tha', 'ki', 'nam'],
    last: ['thi', 'ki', 'chapu'],
  },
  5: {
    sam: ['thom', '-', 'nam', '-', 'ki'],
    group: ['gumki', '-', 'dhin', '-', 'nam'],
    a: ['nam', 'ki', 'dhin', '-', '-'],
    b: ['tha', 'ki', 'nam', '-', 'ki'],
    last: ['tha', 'ki', 'nam', 'thi', 'chapu'],
  },
};

export const MRIDANGAM_STROKES = ['tha', 'thi', 'thom', 'nam', 'dhin', 'chapu', 'gumki', 'ki'];

export function percussionPattern(talam, nadai) {
  const cells = CELLS[nadai.per];
  const starts = groupStarts(talam);
  const out = [];
  let alt = 0;
  for (let b = 0; b < talam.beats; b++) {
    let cell;
    if (b === 0) cell = cells.sam;
    else if (b === talam.beats - 1) cell = cells.last;
    else if (starts.includes(b)) cell = cells.group;
    else { cell = alt % 2 ? cells.b : cells.a; alt++; }
    out.push(...cell);
  }
  return out;
}
