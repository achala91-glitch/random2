// Swarapetti theory tests. Run: npm run test:swarapetti
// Expected values are typed separately from the app data, from the sources
// listed in docs/carnatic-design.md, so a slip in either one shows up here.
import {
  SWARAS, SWARASTHANAS, JUST_RATIOS, centsOf, positionCents, KATTAIS, saFrequency,
  kattaiWestern, westernName, carnaticLabel, tamilLabel,
} from '../src/theory/swaras.js';
import { MELAKARTAS, melakartaSwaras, MELA_NAMES, CHAKRAS } from '../src/theory/melakarta.js';
import {
  RAGAMS, JANYAS, ragamById, resolveNote, suggestNext, neighbours, searchRagams, parseScale, isVakra,
} from '../src/theory/ragams.js';
import {
  TALAMS, NADAIS, KALAMS, talamById, nadaiById, kalamById, percussionPattern, MRIDANGAM_STROKES,
  groupStarts, positionAt, stepsPerBeat,
} from '../src/theory/talam.js';
import { GAMAKAS, gamakaContour, valueAt, kampitamCycle } from '../src/theory/gamaka.js';
import {
  parseExercise, SARALI, JANTA_1, DHATU_1, ALANKARAM_CHATUSRA_EKA, ALANKARAM_TISRA_EKA,
  GEETHAM_OPENING, GEETHAM_CADENCE,
} from '../src/theory/exercises.js';

let checks = 0; let fails = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log('  FAIL: ' + msg); } }
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b}`);
const section = (s) => console.log(`--- ${s}`);

// ---------------------------------------------------------------- swaras
section('Swaras and swarasthanas');
eq(Object.keys(SWARAS).length, 16, '16 swara names');
eq(SWARASTHANAS.length, 12, '12 swarasthanas');
// Shared positions: G1 = R2, R3 = G2, N1 = D2, D3 = N2.
eq(SWARAS.G1.pos, SWARAS.R2.pos, 'Shuddha gandharam shares chatushruti rishabham');
eq(SWARAS.R3.pos, SWARAS.G2.pos, 'Shatshruti rishabham shares sadharana gandharam');
eq(SWARAS.N1.pos, SWARAS.D2.pos, 'Shuddha nishadam shares chatushruti dhaivatam');
eq(SWARAS.D3.pos, SWARAS.N2.pos, 'Shatshruti dhaivatam shares kaisiki nishadam');
eq(SWARASTHANAS.filter((s) => s.names.length === 2).map((s) => s.pos), [2, 3, 9, 10], 'four positions carry two names');
const POS = { S: 0, R1: 1, R2: 2, R3: 3, G1: 2, G2: 3, G3: 4, M1: 5, M2: 6, P: 7, D1: 8, D2: 9, D3: 10, N1: 9, N2: 10, N3: 11 };
for (const [k, v] of Object.entries(POS)) eq(SWARAS[k].pos, v, `${k} position`);
near(centsOf(JUST_RATIOS[7]), 701.955, 0.01, 'Pa is a pure fifth');
near(centsOf(JUST_RATIOS[5]), 498.045, 0.01, 'M1 is a pure fourth');
near(positionCents(7, 'equal'), 700, 0, 'Pa equal tempered');
near(positionCents(12 + 7, 'just'), 1901.955, 0.01, 'mel sthayi Pa');
for (let i = 1; i < 12; i++) ok(positionCents(i) > positionCents(i - 1), `just positions rise (${i})`);
eq(carnaticLabel('R2'), 'R2', 'Carnatic label');
eq(carnaticLabel('S', 1), 'Ṡ', 'mel sthayi Sa has a dot above');
eq(carnaticLabel('N3', -1), 'Ṇ3', 'mandra Ni has a dot below');
eq(tamilLabel('G3'), 'க₃', 'Tamil Ga');
eq(tamilLabel('S'), 'ஸ', 'Tamil Sa');

// ---------------------------------------------------------------- kattai
section('Kattai and Sa pitch');
eq(KATTAIS.length, 12, '12 kattais (1 to 7 with halves)');
eq(KATTAIS.map((k) => k.id), ['1', '1.5', '2', '2.5', '3', '4', '4.5', '5', '5.5', '6', '6.5', '7'], 'no 3.5 or 7.5 kattai');
const KW = { 1: 'C3', 1.5: 'C♯3', 2: 'D3', 2.5: 'D♯3', 3: 'E3', 4: 'F3', 4.5: 'F♯3', 5: 'G3', 5.5: 'G♯3', 6: 'A3', 6.5: 'A♯3', 7: 'B3' };
for (const [k, w] of Object.entries(KW)) eq(kattaiWestern(k, 3), w, `${k} kattai = ${w}`);
near(saFrequency('1', 3), 130.81, 0.01, '1 kattai (C3) Hz');
near(saFrequency('5', 3), 196.0, 0.01, '5 kattai (G3) Hz');
near(saFrequency('1', 4), 261.63, 0.01, '1 kattai, higher octave (C4)');
near(saFrequency('6', 3), 220.0, 0.001, '6 kattai = A3 = 220 Hz');
near(saFrequency('1', 3, 100), saFrequency('1.5', 3), 0.001, '+100 cents fine tune = half kattai');
eq(westernName(1, 7, 3), 'G♯3', 'Pa at 1½ kattai is G♯');
eq(westernName(11, 2, 3), 'C♯4', 'R2 at 7 kattai crosses into the next octave');

// ---------------------------------------------------------------- melakartas
section('72 melakartas');
eq(MELAKARTAS.length, 72, '72 melakartas');
eq(new Set(MELA_NAMES).size, 72, 'names unique');
eq(new Set(MELAKARTAS.map((m) => m.swaras.join())).size, 72, 'every mela has a distinct scale');
eq(CHAKRAS.length, 12, '12 chakras');
for (const m of MELAKARTAS) {
  eq(m.chakra, CHAKRAS[Math.floor((m.number - 1) / 6)], `mela ${m.number} chakra`);
  eq(m.swaras[3], m.number <= 36 ? 'M1' : 'M2', `mela ${m.number} madhyamam`);
}
eq(MELAKARTAS[0].chakra, 'Indu', 'mela 1 in Indu');
eq(MELAKARTAS[71].chakra, 'Aditya', 'mela 72 in Aditya');
eq(MELAKARTAS[36].chakra, 'Rishi', 'mela 37 starts Rishi');
// Independent reference scales (from the sources, not computed).
const REF = {
  1: ['Kanakangi', 'S R1 G1 M1 P D1 N1'],
  2: ['Ratnangi', 'S R1 G1 M1 P D1 N2'],
  8: ['Hanumatodi', 'S R1 G2 M1 P D1 N2'],
  15: ['Mayamalavagowla', 'S R1 G3 M1 P D1 N3'],
  16: ['Chakravakam', 'S R1 G3 M1 P D2 N2'],
  17: ['Suryakantam', 'S R1 G3 M1 P D2 N3'],
  20: ['Natabhairavi', 'S R2 G2 M1 P D1 N2'],
  21: ['Keeravani', 'S R2 G2 M1 P D1 N3'],
  22: ['Kharaharapriya', 'S R2 G2 M1 P D2 N2'],
  27: ['Sarasangi', 'S R2 G3 M1 P D1 N3'],
  28: ['Harikambhoji', 'S R2 G3 M1 P D2 N2'],
  29: ['Dheerashankarabharanam', 'S R2 G3 M1 P D2 N3'],
  36: ['Chalanata', 'S R3 G3 M1 P D3 N3'],
  53: ['Gamanashrama', 'S R1 G3 M2 P D2 N3'],
  56: ['Shanmukhapriya', 'S R2 G2 M2 P D1 N2'],
  65: ['Mechakalyani', 'S R2 G3 M2 P D2 N3'],
  66: ['Chitrambari', 'S R2 G3 M2 P D3 N3'],
  72: ['Rasikapriya', 'S R3 G3 M2 P D3 N3'],
};
for (const [n, [name, scale]] of Object.entries(REF)) {
  eq(MELA_NAMES[n - 1], name, `mela ${n} name`);
  eq(melakartaSwaras(Number(n)).join(' '), scale, `mela ${n} (${name}) swaras`);
}
// Katapayadi cross-check: the first two syllables of the name, read in reverse,
// give the number. Only names whose first two syllables are simple
// consonant+vowel are checked (conjunct consonants have irregular readings).
const KTP = {
  k: 1, kh: 2, g: 3, gh: 4, c: 6, ch: 7, j: 8, jh: 9,
  T: 1, Th: 2, D: 3, Dh: 4, N: 5, t: 6, th: 7, d: 8, dh: 9, n: 0,
  p: 1, ph: 2, b: 3, bh: 4, m: 5,
  y: 1, r: 2, l: 3, v: 4, sh: 5, Sh: 6, s: 7, h: 8,
};
const KTP_NAMES = {
  1: 'k n', 3: 'g n', 4: 'v n', 5: 'm n', 6: 't n', 7: 's n', 8: 'h n', 9: 'dh n', 10: 'n T', 11: 'k k',
  12: 'r p', 13: 'g y', 14: 'v k', 15: 'm y', 16: 'c k', 18: 'h T', 21: 'k r', 22: 'kh r', 23: 'g r',
  24: 'v r', 25: 'm r', 26: 'c r', 27: 's r', 28: 'h r', 29: 'dh r', 30: 'n g', 31: 'y g', 32: 'r g',
  34: 'v g', 35: 'sh l', 36: 'c l', 37: 's l', 38: 'j l', 39: 'jh l', 40: 'n v', 41: 'p v', 42: 'r gh',
  43: 'g v', 44: 'bh v', 45: 'sh bh', 47: 's v', 49: 'dh v', 50: 'n m', 51: 'k m', 52: 'r m', 53: 'g m',
  55: 'sh m', 58: 'h m', 60: 'n t', 62: 'r Sh', 63: 'l t', 64: 'v c', 65: 'm c', 67: 's c', 69: 'dh t',
  70: 'n s', 71: 'k s', 72: 'r s',
};
for (const [n, cons] of Object.entries(KTP_NAMES)) {
  const [a, b] = cons.split(' ').map((c) => KTP[c]);
  eq(b * 10 + a, Number(n), `Katapayadi for ${n} ${MELA_NAMES[n - 1]}`);
}

// ---------------------------------------------------------------- janya ragams
section('Janya ragams');
ok(JANYAS.length >= 30, `at least 30 janya ragams (${JANYAS.length})`);
eq(new Set(RAGAMS.map((r) => r.name.toLowerCase())).size, RAGAMS.length, 'ragam names unique');
const REQUIRED = ['Mohanam', 'Hamsadhwani', 'Hindolam', 'Abhogi', 'Madhyamavati', 'Sriranjani', 'Bilahari',
  'Kedaragowla', 'Anandabhairavi', 'Begada', 'Kambhoji', 'Sahana', 'Hamir Kalyani', 'Revati', 'Shuddha Dhanyasi'];
for (const n of REQUIRED) ok(RAGAMS.some((r) => r.name === n), `${n} is included`);
// Reference scales, typed from the sources.
const JREF = {
  Mohanam: [28, "S R2 G3 P D2 S'", "S' D2 P G3 R2 S"],
  Hamsadhwani: [29, "S R2 G3 P N3 S'", "S' N3 P G3 R2 S"],
  Hindolam: [20, "S G2 M1 D1 N2 S'", "S' N2 D1 M1 G2 S"],
  Abhogi: [22, "S R2 G2 M1 D2 S'", "S' D2 M1 G2 R2 S"],
  Madhyamavati: [22, "S R2 M1 P N2 S'", "S' N2 P M1 R2 S"],
  Sriranjani: [22, "S R2 G2 M1 D2 N2 S'", "S' N2 D2 M1 G2 R2 S"],
  Bilahari: [29, "S R2 G3 P D2 S'", "S' N3 D2 P M1 G3 R2 S"],
  Kedaragowla: [28, "S R2 M1 P N2 S'", "S' N2 D2 P M1 G3 R2 S"],
  Anandabhairavi: [22, "S G2 R2 G2 M1 P D2 P S'", "S' N2 D2 P M1 G2 R2 S"],
  Begada: [29, "S G3 R2 G3 M1 P D2 P S'", "S' N3 D2 P M1 G3 R2 S"],
  Kambhoji: [28, "S R2 G3 M1 P D2 S'", "S' N2 D2 P M1 G3 R2 S"],
  Sahana: [28, "S R2 G3 M1 P M1 D2 N2 S'", "S' N2 D2 P M1 G3 M1 R2 G3 R2 S"],
  'Hamir Kalyani': [65, "S P M2 P D2 N3 S'", "S' N3 D2 P M2 M1 G3 P M1 R2 S"],
  Revati: [2, "S R1 M1 P N2 S'", "S' N2 P M1 R1 S"],
  'Shuddha Dhanyasi': [22, "S G2 M1 P N2 S'", "S' N2 P M1 G2 S"],
  'Shuddha Saveri': [29, "S R2 M1 P D2 S'", "S' D2 P M1 R2 S"],
  Arabhi: [29, "S R2 M1 P D2 S'", "S' N3 D2 P M1 G3 R2 S"],
  Bhairavi: [20, "S R2 G2 M1 P D2 N2 S'", "S' N2 D1 P M1 G2 R2 S"],
  Saveri: [15, "S R1 M1 P D1 S'", "S' N3 D1 P M1 G3 R1 S"],
  Malahari: [15, "S R1 M1 P D1 S'", "S' D1 P M1 G3 R1 S"],
  Nattai: [36, "S R3 G3 M1 P D3 N3 S'", "S' N3 P M1 R3 S"],
  Gowla: [15, "S R1 M1 P N3 S'", "S' N3 P M1 R1 G3 M1 R1 S"],
  Amritavarshini: [66, "S G3 M2 P N3 S'", "S' N3 P M2 G3 S"],
  Hamsanandi: [53, "S R1 G3 M2 D2 N3 S'", "S' N3 D2 M2 G3 R1 S"],
  Kapi: [22, "S R2 M1 P N3 S'", "S' N2 D2 N2 P M1 G2 R2 S"],
  Atana: [29, "S R2 M1 P N3 S'", "S' N3 D2 P M1 P G3 R2 S"],
  Kedaram: [29, "S M1 G3 M1 P N3 S'", "S' N3 P M1 G3 R2 S"],
  Valaji: [16, "S G3 P D2 N2 S'", "S' N2 D2 P G3 S"],
  Dhanyasi: [8, "S G2 M1 P N2 S'", "S' N2 D1 P M1 G2 R1 S"],
};
for (const [name, [parent, aro, avaro]] of Object.entries(JREF)) {
  const j = JANYAS.find((x) => x.name === name);
  ok(!!j, `${name} present`);
  if (!j) continue;
  eq(j.parent, parent, `${name} parent mela`);
  eq(j.aro, aro, `${name} arohanam`);
  eq(j.avaro, avaro, `${name} avarohanam`);
}
for (const r of RAGAMS.filter((x) => x.kind === 'janya')) {
  eq(r.aro[r.aro.length - 1].id + r.aro[r.aro.length - 1].oct, 'S1', `${r.name} arohanam ends on mel Sa`);
  eq(r.avaro[0].id + r.avaro[0].oct, 'S1', `${r.name} avarohanam starts on mel Sa`);
  eq(r.aro[0].id, 'S', `${r.name} arohanam starts on Sa`);
  eq(r.avaro[r.avaro.length - 1].id + r.avaro[r.avaro.length - 1].oct, 'S0', `${r.name} avarohanam ends on Sa`);
  // Every swara belongs to the parent mela unless declared as an anya swara.
  const parent = new Set(r.parentSwaras);
  const used = new Set([...r.swaraIds, ...r.phrases.flatMap((p) => parseScale(p).map((t) => t.id))]);
  for (const id of used) {
    ok(parent.has(id) || r.anya.includes(id), `${r.name}: ${id} is in mela ${r.parent} or declared anya`);
  }
  for (const id of r.anya) ok(!parent.has(id), `${r.name}: anya swara ${id} is really outside mela ${r.parent}`);
  // One swarasthana per letter per direction, except declared bhashanga cases.
  for (const l of r.letters) {
    if (l.aroIds.length > 1 || l.avaroIds.length > 1) ok(r.anya.length > 0, `${r.name}: letter ${l.symbol} has two swarasthanas in one direction`);
  }
}
// Classification spot checks.
const R = (name) => RAGAMS.find((x) => x.name === name);
eq([R('Mohanam').aroCount, R('Mohanam').avaroCount], [5, 5], 'Mohanam is audava-audava');
eq([R('Sriranjani').aroCount, R('Sriranjani').avaroCount], [6, 6], 'Sriranjani is shadava-shadava');
eq([R('Bilahari').aroCount, R('Bilahari').avaroCount], [5, 7], 'Bilahari is audava-sampurna');
eq([R('Nattai').aroCount, R('Nattai').avaroCount], [7, 5], 'Nattai is sampurna-audava');
ok(R('Sahana').vakra && R('Begada').vakra && R('Kanada').vakra, 'Sahana, Begada and Kanada are vakra');
ok(!R('Mohanam').vakra && !R('Mayamalavagowla').vakra, 'Mohanam and Mayamalavagowla are not vakra');
ok(isVakra(parseScale("S R2 G3 M1 P M1 D2 N2 S'"), 1), 'vakra detection');

// ---------------------------------------------------------------- playing logic
section('Buttons, direction and path');
function play(name, seq) {
  const r = R(name);
  let prev = null;
  return seq.map(([letter, sthayi = 0]) => {
    const n = resolveNote(r, letter, sthayi, prev);
    if (n) prev = n;
    return n ? n.id + (n.offPath ? '*' : '') : null;
  });
}
const [S, Ri, G, M, P, D, N] = [0, 1, 2, 3, 4, 5, 6];
// Bhairavi: Dha is D2 going up, D1 coming down.
eq(play('Bhairavi', [[P], [D], [N], [S, 1], [N], [D], [P]]), ['P', 'D2', 'N2', 'S', 'N2', 'D1', 'P'], 'Bhairavi dha by direction');
// Kapi: Ni is N3 going up, N2 coming down.
eq(play('Kapi', [[P], [N], [S, 1], [N], [D], [N], [P]]), ['P', 'N3', 'S', 'N2', 'D2', 'N2', 'P'], 'Kapi ni by direction');
// Mohanam: Ma and Ni are not in the ragam.
eq(play('Mohanam', [[S], [M], [N], [P]]), ['S', null, null, 'P'], 'Mohanam has no Ma or Ni');
ok(!R('Mohanam').letters[M].used && !R('Mohanam').letters[N].used, 'Mohanam dims Ma and Ni');
// Bilahari: Ma only appears coming down; going up it is off the usual path.
eq(play('Bilahari', [[G], [M], [P], [D], [N], [D], [P], [M], [G]]), ['G3', 'M1*', 'P', 'D2', 'N3*', 'D2', 'P', 'M1', 'G3'], 'Bilahari up and down');
// Hamir Kalyani: P M2 M1 coming down, then the vakra G3 P M1 R2 S.
eq(play('Hamir Kalyani', [[S, 1], [N], [D], [P], [M], [M], [G], [P], [M], [Ri], [S]]),
  ['S', 'N3', 'D2', 'P', 'M2', 'M1', 'G3', 'P', 'M1', 'R2', 'S'], 'Hamir Kalyani avarohanam with both madhyamams');
// Mayamalavagowla across sthayis.
eq(play('Mayamalavagowla', [[S], [N, -1], [D, -1], [N, -1], [S], [Ri]]), ['S', 'N3', 'D1', 'N3', 'S', 'R1'], 'mandra sthayi');
// Suggestions follow the vakra path: in Sahana, after Pa going up comes Ma.
{
  const r = R('Sahana');
  let n = null;
  for (const l of [S, Ri, G, M, P]) n = resolveNote(r, l, 0, n);
  eq(suggestNext(r, n).up, { letter: M, oct: 0 }, 'Sahana: after Pa going up, Ma (vakra)');
  const m = resolveNote(R('Mohanam'), G, 0, null);
  eq([suggestNext(R('Mohanam'), m).up.letter, suggestNext(R('Mohanam'), m).down.letter], [P, Ri], 'Mohanam: from Ga, up to Pa, down to Ri');
}
// Neighbours used by gamakas.
eq(neighbours(R('Mohanam'), 4), { upper: 7, upper2: 9, lower: 2, lower2: 0 }, 'Mohanam Ga neighbours');
eq(neighbours(R('Mohanam'), 0).lower, -3, 'Mohanam Sa: lower neighbour is mandra Dha');
eq(neighbours(R('Bilahari'), 4).upper, 7, 'Bilahari Ga going up: Pa (no Ma in arohanam)');
eq(neighbours(R('Bilahari'), 7).lower, 5, 'Bilahari Pa coming down: Ma');
// Search.
ok(searchRagams('kalyani').some((r) => r.number === 65), 'search finds Mechakalyani by its short name');
eq(searchRagams('hamsa').map((r) => r.name).sort(), ['Hamsadhwani', 'Hamsanandi'], 'search by part of a name');
ok(searchRagams('', 'janya').every((r) => r.kind === 'janya'), 'janya filter');
eq(searchRagams('', 'melakarta').length, 72, 'melakarta filter');
eq(ragamById('nope').name, 'Mayamalavagowla', 'default ragam');

// ---------------------------------------------------------------- talam
section('Talam');
eq(talamById('adi').kriyas, ['clap', 'f1', 'f2', 'f3', 'clap', 'wave', 'clap', 'wave'], 'Adi talam kriyas');
eq(talamById('rupakam').kriyas, ['clap', 'wave', 'clap', 'f1', 'f2', 'f3'], 'Rupakam: drutam then laghu');
eq(talamById('misra-chapu').groups, [3, 2, 2], 'Misra Chapu 3+2+2');
eq(talamById('misra-chapu').kriyas.map((k, i) => (k === 'clap' ? i + 1 : 0)).filter(Boolean), [1, 4, 6], 'Misra Chapu gestures on 1, 4, 6');
eq(talamById('khanda-chapu').beats, 5, 'Khanda Chapu has 5 beats');
for (const t of TALAMS) {
  eq(t.kriyas.length, t.beats, `${t.name} kriyas per beat`);
  eq(t.groups.reduce((a, b) => a + b, 0), t.beats, `${t.name} groups add up`);
  eq(t.kriyas[0], 'clap', `${t.name} starts with a clap on samam`);
}
eq(NADAIS.map((n) => n.per), [4, 3, 5], 'chatusram 4, tisram 3, khandam 5');
eq(KALAMS.map((k) => k.perBeat), [1, 2, 4], 'kalams: 1, 2 and 4 swaras per beat');
eq(groupStarts(talamById('adi')), [0, 4, 6], 'Adi angas start on beats 1, 5, 7');
eq(stepsPerBeat(nadaiById('tisram'), kalamById(2)), 6, 'tisram, second kalam: 6 steps a beat');
for (const t of TALAMS) for (const n of NADAIS) {
  const pat = percussionPattern(t, n);
  eq(pat.length, t.beats * n.per, `${t.name} ${n.name} pattern length`);
  eq(pat[0], 'thom', `${t.name} ${n.name} pattern lands on samam`);
  ok(pat.every((s) => s === '-' || MRIDANGAM_STROKES.includes(s)), `${t.name} ${n.name} uses known strokes`);
}
eq(positionAt(0, 60, talamById('adi')), { cycle: 0, beat: 0, fraction: 0 }, 'position at samam');
eq(positionAt(9.5, 60, talamById('adi')), { cycle: 1, beat: 1, fraction: 0.5 }, 'position in the second avartanam');

// ---------------------------------------------------------------- gamakas
section('Gamakas');
eq(Object.keys(GAMAKAS).sort(), ['dl', 'dr', 'l', 'r', 'ul', 'ur'], 'gamakas on the six side directions');
{
  const nb = { upper: 700, upper2: 900, lower: 200, lower2: 0 };
  const g = 400;
  for (const id of Object.values(GAMAKAS).map((x) => x.id)) {
    const c = gamakaContour(id, g, nb);
    const lastC = c.points[c.points.length - 1].c;
    ok(lastC === g, `${id} lands on the swara`);
    ok(c.points.every((p, i) => i === 0 || p.t >= c.points[i - 1].t), `${id} timings move forward`);
  }
  eq(gamakaContour('nokku', g, nb).points[0].c, 700, 'nokku starts from the swara above');
  eq(gamakaContour('etra-jaru', g, nb).points[0].c, 0, 'etra jaru slides up from two swaras below');
  eq(gamakaContour('irakka-jaru', g, nb).points[0].c, 900, 'irakka jaru slides down from two swaras above');
  const sph = gamakaContour('sphuritam', g, nb).points;
  eq(Math.min(...sph.map((p) => p.c)), 200, 'sphuritam dips to the swara below');
  const k = gamakaContour('kampitam', g, nb);
  eq([Math.min(...k.cycle.map((p) => p.c)), Math.max(...k.cycle.map((p) => p.c))], [400, 700], 'kampitam swings between the swara and the one above');
  eq(gamakaContour('orikkai', g, nb).release.slice(-1)[0].c, 700, 'orikkai flicks up on release');
  // A very wide neighbour is capped so gamakas stay musical.
  eq(gamakaContour('nokku', 400, { upper: 1000 }).points[0].c, 720, 'nokku from a distant swara is capped');
  near(valueAt([{ t: 0, c: 0, ease: 'step' }, { t: 1, c: 100, ease: 's' }], 0.5), 50, 1e-9, 'S-curve midpoint');
  near(valueAt(kampitamCycle(0, 100, 1).reduce((a, p) => [...a, p], [{ t: 0, c: 0, ease: 'step' }]), 0.41), 100, 1e-9, 'kampitam dwells on the upper swara');
}

// ---------------------------------------------------------------- exercises
section('Exercises');
const MMG = R('Mayamalavagowla');
function allInRagam(src, r) {
  return parseExercise(src).events.every((e) => r.letters[e.letter].used);
}
SARALI.forEach((s, i) => {
  const p = parseExercise(s);
  eq(p.units % 8, 0, `sarali varisai ${i + 1} fills whole Adi avartanams`);
  ok(allInRagam(s, MMG), `sarali ${i + 1} is in Mayamalavagowla`);
});
eq(parseExercise(SARALI[0]).events.map((e) => 'srgmpdn'[e.letter] + (e.sthayi ? "'" : '')).join(' '), "s r g m p d n s' s' n d p m g r s", 'sarali varisai 1');
eq(parseExercise(JANTA_1).units, 32, 'janta varisai 1 is 4 avartanams');
const dh = parseExercise(DHATU_1);
eq(dh.events.slice(0, 16).map((e) => 'srgmpdn'[e.letter]).join(' '), 's m g m r g s r s g r g s r g m', 'dhatu varisai 1 opens as published');
eq(dh.events.slice(16, 20).map((e) => 'srgmpdn'[e.letter]).join(''), 'rpmp', 'dhatu varisai 1, second line moves up one swara');
eq(dh.units % 8, 0, 'dhatu varisai fills whole avartanams');
eq(dh.events[dh.events.length - 1].letter, 0, 'dhatu varisai ends on Sa');
eq(parseExercise(ALANKARAM_CHATUSRA_EKA).units % 4, 0, 'chatusra eka alankaram fits 4-beat cycles');
eq(parseExercise(ALANKARAM_TISRA_EKA).units % 3, 0, 'tisra eka alankaram fits 3-beat cycles');
eq(parseExercise(ALANKARAM_TISRA_EKA).events.slice(0, 6).map((e) => 'srgmpdn'[e.letter]).join(''), 'srgrgm', 'tisra eka alankaram opens s r g | r g m');
eq(parseExercise(GEETHAM_OPENING).units, 12, 'geetham opening is two Rupakam avartanams');
eq(parseExercise(GEETHAM_CADENCE).units, 12, 'geetham cadence is two Rupakam avartanams');
ok(allInRagam(GEETHAM_OPENING, R('Malahari')) && allInRagam(GEETHAM_CADENCE, R('Malahari')), 'geetham phrases are in Malahari');
{
  // The cadence comes down through G3, which only exists in Malahari's avarohanam.
  const r = R('Malahari');
  let prev = null; const ids = [];
  for (const e of parseExercise(GEETHAM_CADENCE).events) { prev = resolveNote(r, e.letter, e.sthayi, prev); ids.push(prev.id + (prev.offPath ? '*' : '')); }
  eq(ids.join(' '), 'R1 M1 P D1 M1 P D1 P M1 G3 R1 S', 'geetham cadence resolves to Malahari swarasthanas');
}
eq(parseExercise("s r~r g, ,").events[1].gamaka, 'r', 'gamaka in notation');
eq(parseExercise("s r~r g, ,").events[2].units, 3, 'attached and separate karvai both count');
eq(parseExercise("s r~r g, ,").units, 5, 'karvai extends the swara');
let threw = false; try { parseExercise('x'); } catch { threw = true; }
ok(threw, 'bad notation is rejected');

console.log(`\n${checks - fails}/${checks} Swarapetti theory checks passed.`);
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }

// `node swarapetti/tests/theory.test.mjs --print` lists every ragam for review.
if (process.argv.includes('--print')) {
  console.log('\nAll ragams:');
  for (const r of RAGAMS) {
    const head = r.kind === 'melakarta' ? `${String(r.number).padStart(2)} ${r.name} (${r.chakra})` : `   ${r.name} (janya of ${r.parent} ${r.parentName})`;
    console.log(`${head.padEnd(48)} ${r.arohanam.padEnd(28)} | ${r.avarohanam}`);
  }
}
