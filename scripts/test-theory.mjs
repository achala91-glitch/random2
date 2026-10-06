// Prints every button x joystick direction in several keys and checks them
// against a hand-written reference (written from music theory, not from the code).
// Run: npm run test:theory
import {
  KEYS, DIRECTIONS, DIRECTION_LABELS, buildChord, voiceChord, keyPitchClasses,
  spellVoiced, VOICING_LOW, VOICING_HIGH,
} from '../src/theory.js';

let failures = 0;
let checks = 0;
function check(cond, msg) {
  checks++;
  if (!cond) { failures++; console.log('  FAIL: ' + msg); }
}
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// ---------- 1. Full reference table for C major (all 63 combinations) ----------
const C_MAJOR = {
  1: { c: ['C', 'C E G'], u: ['Cmaj7', 'C E G B'], d: ['Cm', 'C Eb G'], l: ['Csus4', 'C F G'],
    r: ['Cadd9', 'C E G D'], ul: ['Csus2', 'C D G'], ur: ['Cmaj9', 'C E G B D'],
    dl: ['Cdim', 'C Eb Gb'], dr: ['Caug', 'C E G#'] },
  2: { c: ['Dm', 'D F A'], u: ['Dm7', 'D F A C'], d: ['D', 'D F# A'], l: ['Dsus4', 'D G A'],
    r: ['Dm(add9)', 'D F A E'], ul: ['Dsus2', 'D E A'], ur: ['Dm9', 'D F A C E'],
    dl: ['Ddim', 'D F Ab'], dr: ['Daug', 'D F# A#'] },
  3: { c: ['Em', 'E G B'], u: ['Em7', 'E G B D'], d: ['E', 'E G# B'], l: ['Esus4', 'E A B'],
    r: ['Em(add9)', 'E G B F#'], ul: ['Esus2', 'E F# B'], ur: ['Em9', 'E G B D F#'],
    dl: ['Edim', 'E G Bb'], dr: ['Eaug', 'E G# B#'] },
  4: { c: ['F', 'F A C'], u: ['Fmaj7', 'F A C E'], d: ['Fm', 'F Ab C'], l: ['Fsus4', 'F Bb C'],
    r: ['Fadd9', 'F A C G'], ul: ['Fsus2', 'F G C'], ur: ['Fmaj9', 'F A C E G'],
    dl: ['Fdim', 'F Ab Cb'], dr: ['Faug', 'F A C#'] },
  5: { c: ['G', 'G B D'], u: ['G7', 'G B D F'], d: ['Gm', 'G Bb D'], l: ['Gsus4', 'G C D'],
    r: ['Gadd9', 'G B D A'], ul: ['Gsus2', 'G A D'], ur: ['G9', 'G B D F A'],
    dl: ['Gdim', 'G Bb Db'], dr: ['Gaug', 'G B D#'] },
  6: { c: ['Am', 'A C E'], u: ['Am7', 'A C E G'], d: ['A', 'A C# E'], l: ['Asus4', 'A D E'],
    r: ['Am(add9)', 'A C E B'], ul: ['Asus2', 'A B E'], ur: ['Am9', 'A C E G B'],
    dl: ['Adim', 'A C Eb'], dr: ['Aaug', 'A C# E#'] },
  7: { c: ['Bdim', 'B D F'], u: ['Bm7b5', 'B D F A'], d: ['B', 'B D# F#'], l: ['Bsus4', 'B E F#'],
    r: ['Bdim(add9)', 'B D F C#'], ul: ['Bsus2', 'B C# F#'], ur: ['Bm9b5', 'B D F A C#'],
    dl: ['Bdim', 'B D F'], dr: ['Baug', 'B D# F##'] },
};

// ---------- 2. Spot references in other keys ----------
const OTHER = {
  G: {
    c: ['G:G B D', 'Am:A C E', 'Bm:B D F#', 'C:C E G', 'D:D F# A', 'Em:E G B', 'F#dim:F# A C'],
    u: ['Gmaj7:G B D F#', 'Am7:A C E G', 'Bm7:B D F# A', 'Cmaj7:C E G B', 'D7:D F# A C', 'Em7:E G B D', 'F#m7b5:F# A C E'],
  },
  F: {
    c: ['F:F A C', 'Gm:G Bb D', 'Am:A C E', 'Bb:Bb D F', 'C:C E G', 'Dm:D F A', 'Edim:E G Bb'],
    u: ['Fmaj7:F A C E', 'Gm7:G Bb D F', 'Am7:A C E G', 'Bbmaj7:Bb D F A', 'C7:C E G Bb', 'Dm7:D F A C', 'Em7b5:E G Bb D'],
  },
  Eb: {
    c: ['Eb:Eb G Bb', 'Fm:F Ab C', 'Gm:G Bb D', 'Ab:Ab C Eb', 'Bb:Bb D F', 'Cm:C Eb G', 'Ddim:D F Ab'],
    ur: ['Ebmaj9:Eb G Bb D F', 'Fm9:F Ab C Eb G', 'Gm9:G Bb D F A', 'Abmaj9:Ab C Eb G Bb', 'Bb9:Bb D F Ab C', 'Cm9:C Eb G Bb D', 'Dm9b5:D F Ab C E'],
  },
  'F#': {
    c: ['F#:F# A# C#', 'G#m:G# B D#', 'A#m:A# C# E#', 'B:B D# F#', 'C#:C# E# G#', 'D#m:D# F# A#', 'E#dim:E# G# B'],
    d: ['F#m:F# A C#', 'G#:G# B# D#', 'A#:A# C## E#', 'Bm:B D F#', 'C#m:C# E G#', 'D#:D# F## A#', 'E#:E# G## B#'],
  },
  A: {
    c: ['A:A C# E', 'Bm:B D F#', 'C#m:C# E G#', 'D:D F# A', 'E:E G# B', 'F#m:F# A C#', 'G#dim:G# B D'],
    l: ['Asus4:A D E', 'Bsus4:B E F#', 'C#sus4:C# F# G#', 'Dsus4:D G A', 'Esus4:E A B', 'F#sus4:F# B C#', 'G#sus4:G# C# D#'],
    r: ['Aadd9:A C# E B', 'Bm(add9):B D F# C#', 'C#m(add9):C# E G# D#', 'Dadd9:D F# A E', 'Eadd9:E G# B F#', 'F#m(add9):F# A C# G#', 'G#dim(add9):G# B D A#'],
  },
};

function printKey(keyId) {
  console.log(`\n=== Key of ${keyId} major ===`);
  let prev = null;
  for (let deg = 1; deg <= 7; deg++) {
    for (const dir of DIRECTIONS) {
      const ch = buildChord(keyId, deg, dir);
      const v = voiceChord(ch, null);
      const notes = ch.tones.map((t) => t.name).join(' ');
      const voiced = v.all.map((m) => spellVoiced(ch, m)).join(' ');
      console.log(
        `${deg} ${ch.roman.padEnd(4)} ${dir.padEnd(2)} ${DIRECTION_LABELS[dir].padEnd(12)} ` +
        `${ch.name.padEnd(12)} ${notes.padEnd(16)} voiced: ${voiced}`,
      );
    }
  }
  return prev;
}

console.log('JahanChord chord theory test');
for (const k of ['C', 'G', 'F', 'Eb', 'A', 'F#']) printKey(k);

console.log('\n--- Checking C major against the reference table ---');
for (const deg of Object.keys(C_MAJOR)) {
  for (const dir of DIRECTIONS) {
    const [name, notes] = C_MAJOR[deg][dir];
    const ch = buildChord('C', Number(deg), dir);
    check(ch.name === name, `C deg ${deg} ${dir}: name ${ch.name} expected ${name}`);
    check(sameSet(ch.tones.map((t) => t.name), notes.split(' ')),
      `C deg ${deg} ${dir}: notes ${ch.tones.map((t) => t.name).join(' ')} expected ${notes}`);
  }
}

console.log('--- Checking other keys against spot references ---');
for (const [keyId, byDir] of Object.entries(OTHER)) {
  for (const [dir, list] of Object.entries(byDir)) {
    list.forEach((entry, i) => {
      const [name, notes] = entry.split(':');
      const ch = buildChord(keyId, i + 1, dir);
      check(ch.name === name, `${keyId} deg ${i + 1} ${dir}: name ${ch.name} expected ${name}`);
      check(sameSet(ch.tones.map((t) => t.name), notes.split(' ')),
        `${keyId} deg ${i + 1} ${dir}: notes ${ch.tones.map((t) => t.name).join(' ')} expected ${notes}`);
    });
  }
}

console.log('--- Structural checks in all 12 keys ---');
const C_INTERVALS = {};
for (let deg = 1; deg <= 7; deg++) for (const dir of DIRECTIONS) {
  C_INTERVALS[deg + dir] = buildChord('C', deg, dir).tones.map((t) => t.semi).join();
}
const offKey = new Map();
for (const key of KEYS) {
  const inKey = keyPitchClasses(key.id);
  for (let deg = 1; deg <= 7; deg++) {
    for (const dir of DIRECTIONS) {
      const ch = buildChord(key.id, deg, dir);
      // Same chord shapes in every key (transposition invariance).
      check(ch.tones.map((t) => t.semi).join() === C_INTERVALS[deg + dir], `${key.id} ${deg}${dir} intervals differ from C`);
      // Button chords (plain) and their 7ths must be 100% in key: no wrong notes.
      const outside = ch.tones.filter((t) => !inKey.includes(t.pc)).map((t) => t.name);
      if (dir === 'c' || dir === 'u') check(outside.length === 0, `${key.id} ${ch.name} has out-of-key notes ${outside}`);
      else if (outside.length && key.id === 'C') offKey.set(`${deg}${dir}`, `${ch.name} (${outside.join(',')})`);

      // Voicing rules.
      const v = voiceChord(ch, null);
      check(v.upper.every((m) => m >= VOICING_LOW && m <= VOICING_HIGH), `${key.id} ${ch.name} voicing out of range ${v.upper}`);
      // Every chord tone sounds, and no pitch class is doubled in the upper voices.
      check(sameSet([...new Set(v.all.map((m) => m % 12))], ch.tones.map((t) => t.pc)), `${key.id} ${ch.name} voicing missing tones`);
      check(new Set(v.upper.map((m) => m % 12)).size === v.upper.length, `${key.id} ${ch.name} voicing doubles a note`);
      check(v.bass % 12 === ch.root.pc && v.bass >= 36 && v.bass <= 47, `${key.id} ${ch.name} bass ${v.bass} wrong`);
      check(v.bass < Math.min(...v.upper), `${key.id} ${ch.name} bass not below voicing`);
    }
  }
}

console.log('--- Voice leading on common progressions ---');
const PROGS = { 'pop 1-5-6-4': [1, 5, 6, 4], 'sad 6-4-1-5': [6, 4, 1, 5], 'ii-V-I': [2, 5, 1], 'all 7': [1, 2, 3, 4, 5, 6, 7, 1] };
for (const keyId of ['C', 'G', 'Eb', 'F#']) {
  for (const [label, prog] of Object.entries(PROGS)) {
    let prev = null;
    const out = [];
    let maxMove = 0;
    for (const deg of [...prog, ...prog]) { // twice round, so the loop back is tested too
      const ch = buildChord(keyId, deg, 'c');
      const v = voiceChord(ch, prev);
      if (prev) {
        for (const n of v.upper) maxMove = Math.max(maxMove, Math.min(...prev.map((p) => Math.abs(p - n))));
      }
      prev = v.upper;
      out.push(`${ch.name}[${v.upper.map((m) => spellVoiced(ch, m)).join(' ')}]`);
    }
    console.log(`${keyId.padEnd(2)} ${label.padEnd(12)} max voice move ${maxMove} st: ${out.slice(0, prog.length + 1).join(' -> ')}`);
    check(maxMove <= 5, `${keyId} ${label}: a voice jumped ${maxMove} semitones`);
  }
}
// 7th and 9th chords should also lead smoothly.
{
  let prev = null; let maxMove = 0;
  for (const [deg, dir] of [[2, 'u'], [5, 'u'], [1, 'u'], [6, 'u'], [4, 'ur'], [3, 'u'], [2, 'ur'], [1, 'u']]) {
    const v = voiceChord(buildChord('C', deg, dir), prev);
    if (prev) for (const n of v.upper) maxMove = Math.max(maxMove, Math.min(...prev.map((p) => Math.abs(p - n))));
    prev = v.upper;
  }
  console.log(`C  7ths/9ths progression max voice move ${maxMove} st`);
  check(maxMove <= 5, `7th/9th progression jumped ${maxMove}`);
}

console.log('\nFor reference, joystick moves that step outside the key in C (expected, these are colour chords):');
for (const [k, v] of offKey) console.log(`  ${k.padEnd(4)} ${v}`);

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures) { console.log(`${failures} FAILED`); process.exit(1); }
