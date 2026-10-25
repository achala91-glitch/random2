// Ragams: the 72 melakartas plus a curated, source-checked set of janya ragams,
// and the logic that turns a button press into the right swarasthana.
import { SWARAS, LETTERS } from './swaras.js';
import { MELAKARTAS, melakartaSwaras, MELA_NAMES } from './melakarta.js';

// Notation: S R1 ... N3. A trailing ' is mel sthayi (upper octave), a trailing
// . is mandra sthayi (lower octave). Sources are listed in docs/carnatic-design.md.
// `anya` lists swaras that are not in the parent mela (bhashanga ragams).
// `phrases` are characteristic phrases that use notes outside the plain scale.
export const JANYAS = [
  { name: 'Mohanam', parent: 28, aro: "S R2 G3 P D2 S'", avaro: "S' D2 P G3 R2 S" },
  { name: 'Hamsadhwani', parent: 29, aro: "S R2 G3 P N3 S'", avaro: "S' N3 P G3 R2 S" },
  { name: 'Hindolam', parent: 20, aro: "S G2 M1 D1 N2 S'", avaro: "S' N2 D1 M1 G2 S" },
  { name: 'Abhogi', parent: 22, aro: "S R2 G2 M1 D2 S'", avaro: "S' D2 M1 G2 R2 S" },
  { name: 'Madhyamavati', parent: 22, aro: "S R2 M1 P N2 S'", avaro: "S' N2 P M1 R2 S" },
  { name: 'Sriranjani', parent: 22, aro: "S R2 G2 M1 D2 N2 S'", avaro: "S' N2 D2 M1 G2 R2 S" },
  { name: 'Bilahari', parent: 29, aro: "S R2 G3 P D2 S'", avaro: "S' N3 D2 P M1 G3 R2 S", note: 'Kaisiki nishadam (N2) appears as an anya swara in some phrases.' },
  { name: 'Kedaragowla', parent: 28, aro: "S R2 M1 P N2 S'", avaro: "S' N2 D2 P M1 G3 R2 S" },
  { name: 'Anandabhairavi', parent: 22, aro: "S G2 R2 G2 M1 P D2 P S'", avaro: "S' N2 D2 P M1 G2 R2 S", note: 'Bhashanga. Often placed under 20 Natabhairavi; its scale notes match 22 Kharaharapriya. Anya swaras such as G3, D1 and N3 appear in phrases.' },
  { name: 'Begada', parent: 29, aro: "S G3 R2 G3 M1 P D2 P S'", avaro: "S' N3 D2 P M1 G3 R2 S", note: 'Vakra. The arohanam is confirmed by several sources; the avarohanam shown is the commonly taught one, and sources note that N2 also appears as an anya swara.', unverified: ['avaro'] },
  { name: 'Kambhoji', parent: 28, aro: "S R2 G3 M1 P D2 S'", avaro: "S' N2 D2 P M1 G3 R2 S", phrases: ['S N3. P. D2. S'], anya: ['N3'], note: 'Bhashanga: kakali nishadam (N3) appears in the phrase S N3 P D2 S.' },
  { name: 'Sahana', parent: 28, aro: "S R2 G3 M1 P M1 D2 N2 S'", avaro: "S' N2 D2 P M1 G3 M1 R2 G3 R2 S", note: 'Ubhaya vakra: zig-zag in both directions.' },
  { name: 'Hamir Kalyani', parent: 65, aro: "S P M2 P D2 N3 S'", avaro: "S' N3 D2 P M2 M1 G3 P M1 R2 S", anya: ['M1'], note: 'Bhashanga: uses both madhyamams. Scale from teaching sources; there is no reference-encyclopedia entry to cross-check.' },
  { name: 'Revati', parent: 2, aro: "S R1 M1 P N2 S'", avaro: "S' N2 P M1 R1 S" },
  { name: 'Shuddha Dhanyasi', parent: 22, aro: "S G2 M1 P N2 S'", avaro: "S' N2 P M1 G2 S" },
  { name: 'Shuddha Saveri', parent: 29, aro: "S R2 M1 P D2 S'", avaro: "S' D2 P M1 R2 S" },
  { name: 'Arabhi', parent: 29, aro: "S R2 M1 P D2 S'", avaro: "S' N3 D2 P M1 G3 R2 S" },
  { name: 'Sri', parent: 22, aro: "S R2 M1 P N2 S'", avaro: "S' N2 P M1 R2 G2 R2 S", aliases: ['Sriragam', 'Shree'], note: 'One of the five ghana ragams.' },
  { name: 'Kanada', parent: 22, aro: "S R2 G2 M1 D2 N2 S'", avaro: "S' N2 S' D2 P M1 G2 M1 R2 S", note: 'Vakra avarohanam.' },
  { name: 'Bhairavi', parent: 20, aro: "S R2 G2 M1 P D2 N2 S'", avaro: "S' N2 D1 P M1 G2 R2 S", anya: ['D2'], note: 'Bhashanga: chatushruti dhaivatam (D2) going up, shuddha dhaivatam (D1) coming down.' },
  { name: 'Saveri', parent: 15, aro: "S R1 M1 P D1 S'", avaro: "S' N3 D1 P M1 G3 R1 S" },
  { name: 'Malahari', parent: 15, aro: "S R1 M1 P D1 S'", avaro: "S' D1 P M1 G3 R1 S", note: 'The ragam of the first geethams.' },
  { name: 'Nattai', parent: 36, aro: "S R3 G3 M1 P D3 N3 S'", avaro: "S' N3 P M1 R3 S", note: 'One of the five ghana ragams.' },
  { name: 'Gowla', parent: 15, aro: "S R1 M1 P N3 S'", avaro: "S' N3 P M1 R1 G3 M1 R1 S", note: 'One of the five ghana ragams.' },
  { name: 'Kalyana Vasantam', parent: 21, aro: "S G2 M1 D1 N3 S'", avaro: "S' N3 D1 P M1 G2 R2 S" },
  { name: 'Vasanta', parent: 17, aro: "S M1 G3 M1 D2 N3 S'", avaro: "S' N3 D2 M1 G3 R1 S" },
  { name: 'Amritavarshini', parent: 66, aro: "S G3 M2 P N3 S'", avaro: "S' N3 P M2 G3 S" },
  { name: 'Hamsanandi', parent: 53, aro: "S R1 G3 M2 D2 N3 S'", avaro: "S' N3 D2 M2 G3 R1 S" },
  { name: 'Mukhari', parent: 22, aro: "S R2 M1 P N2 D2 S'", avaro: "S' N2 D1 P M1 G2 R2 S", anya: ['D1'] },
  { name: 'Kapi', parent: 22, aro: "S R2 M1 P N3 S'", avaro: "S' N2 D2 N2 P M1 G2 R2 S", anya: ['N3'], note: 'Bhashanga: kakali nishadam going up, kaisiki nishadam coming down.' },
  { name: 'Nalinakanti', parent: 27, aro: "S G3 R2 M1 P N3 S'", avaro: "S' N3 P M1 G3 R2 S" },
  { name: 'Atana', parent: 29, aro: "S R2 M1 P N3 S'", avaro: "S' N3 D2 P M1 P G3 R2 S" },
  { name: 'Kedaram', parent: 29, aro: "S M1 G3 M1 P N3 S'", avaro: "S' N3 P M1 G3 R2 S" },
  { name: 'Shivaranjani', parent: 22, aro: "S R2 G2 P D2 S'", avaro: "S' D2 P G2 R2 S" },
  { name: 'Valaji', parent: 16, aro: "S G3 P D2 N2 S'", avaro: "S' N2 D2 P G3 S" },
  { name: 'Yadukula Kambhoji', parent: 28, aro: "S R2 M1 P D2 S'", avaro: "S' N2 D2 P M1 G3 R2 S" },
  { name: 'Dhanyasi', parent: 8, aro: "S G2 M1 P N2 S'", avaro: "S' N2 D1 P M1 G2 R1 S" },
];

export function slug(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

// "R2'" -> { id: 'R2', letter: 1, pos: 2, oct: 1 }
export function parseScale(str) {
  return str.trim().split(/\s+/).map((tok) => {
    let oct = 0;
    let t = tok;
    while (t.endsWith("'")) { oct += 1; t = t.slice(0, -1); }
    while (t.endsWith('.')) { oct -= 1; t = t.slice(0, -1); }
    const sw = SWARAS[t];
    if (!sw) throw new Error(`Unknown swara "${tok}"`);
    return { id: t, letter: sw.letter, pos: sw.pos, oct };
  });
}

function buildRagam(base) {
  const aro = parseScale(base.arohanam);
  const avaro = parseScale(base.avarohanam);
  const all = [...aro, ...avaro];
  const letters = LETTERS.map((L, i) => {
    const aroIds = [...new Set(aro.filter((t) => t.letter === i).map((t) => t.id))];
    const avaroIds = [...new Set(avaro.filter((t) => t.letter === i).map((t) => t.id))];
    return { letter: i, symbol: L, used: aroIds.length + avaroIds.length > 0, aroIds, avaroIds };
  });
  const ids = [...new Set(all.map((t) => t.id))];
  const distinct = letters.filter((l) => l.used).length;
  return {
    ...base,
    aro, avaro, letters, swaraIds: ids,
    // audava = 5, shadava = 6, sampurna = 7 (counted per direction)
    aroCount: new Set(aro.map((t) => t.letter)).size,
    avaroCount: new Set(avaro.map((t) => t.letter)).size,
    distinctLetters: distinct,
    vakra: isVakra(aro, 1) || isVakra(avaro, -1),
  };
}

// A scale is vakra (zig-zag) if it doesn't move steadily in its direction.
export function isVakra(tokens, direction) {
  for (let i = 1; i < tokens.length; i++) {
    const a = tokens[i - 1].letter + 7 * tokens[i - 1].oct;
    const b = tokens[i].letter + 7 * tokens[i].oct;
    if ((b - a) * direction <= 0) return true;
  }
  return false;
}

export function melakartaRagam(n) {
  const m = MELAKARTAS[n - 1];
  return buildRagam({
    id: m.id, kind: 'melakarta', name: m.name, number: n, chakra: m.chakra,
    chakraNumber: m.chakraNumber, aliases: m.aliases,
    arohanam: m.arohanam, avarohanam: m.avarohanam,
  });
}

export function janyaRagam(def) {
  const parentSwaras = melakartaSwaras(def.parent);
  return buildRagam({
    id: `janya-${slug(def.name)}`, kind: 'janya', name: def.name, parent: def.parent,
    parentName: MELA_NAMES[def.parent - 1], aliases: def.aliases || [],
    arohanam: def.aro, avarohanam: def.avaro, phrases: def.phrases || [],
    anya: def.anya || [], note: def.note || '', unverified: def.unverified || [],
    parentSwaras,
  });
}

export const RAGAMS = [
  ...MELAKARTAS.map((m) => melakartaRagam(m.number)),
  ...JANYAS.map(janyaRagam),
];

export function ragamById(id) {
  return RAGAMS.find((r) => r.id === id) || RAGAMS[14]; // default: Mayamalavagowla
}

export function searchRagams(query, filter = 'all') {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  return RAGAMS.filter((r) => {
    if (filter !== 'all' && r.kind !== filter) return false;
    if (!q) return true;
    const hay = [r.name, ...(r.aliases || []), r.number ? String(r.number) : '', r.parentName || '', r.chakra || '']
      .join('|').toLowerCase().replace(/\s+/g, '');
    return hay.includes(q);
  });
}

// ---------- Playing: which swarasthana does a button give? ----------
// A button is a letter (Sa..Ni). The ragam decides the swarasthana, and for
// ragams whose arohanam and avarohanam differ (Bhairavi's dha, Kapi's ni, Hamir
// Kalyani's two madhyamams), the direction of the phrase decides. We follow the
// path: going up we read the arohanam, going down the avarohanam, and we look
// for the next occurrence after where the phrase currently is, so vakra paths
// (Sahana, Begada) resolve to the right token.

const height = (letter, sthayi) => letter + 7 * sthayi;

function findAfter(list, letter, start) {
  for (let i = Math.max(0, start); i < list.length; i++) if (list[i].letter === letter) return i;
  return -1;
}
function findFirst(list, letter) { return list.findIndex((t) => t.letter === letter); }

export function isLetterInRagam(ragam, letter) { return ragam.letters[letter].used; }

/**
 * prev: the previous resolved note (or null). Returns null if the letter is not
 * in the ragam at all (that button is dimmed and silent).
 */
export function resolveNote(ragam, letter, sthayi = 0, prev = null) {
  if (!ragam.letters[letter].used) return null;
  const h = height(letter, sthayi);
  let dir = 'up';
  if (prev) {
    const ph = height(prev.letter, prev.sthayi);
    dir = h > ph ? 'up' : h < ph ? 'down' : prev.dir;
  }
  // Vakra continuation: if the swara is the very next token of the list the
  // phrase is already following, stay on that path even if the step goes the
  // other way (Kapi's "N2 D2 N2" coming down, Sahana's "P M1 D2" going up).
  if (prev && prev.path[prev.dir] >= 0) {
    const cur = prev.dir === 'up' ? ragam.aro : ragam.avaro;
    const nxt = cur[prev.path[prev.dir] + 1];
    if (nxt && nxt.letter === letter && h !== height(prev.letter, prev.sthayi)) {
      return {
        letter, sthayi, dir: prev.dir, offPath: false, id: nxt.id, pos: nxt.pos,
        path: { ...prev.path, [prev.dir]: prev.path[prev.dir] + 1 },
      };
    }
  }
  const otherDir = dir === 'up' ? 'down' : 'up';
  const list = dir === 'up' ? ragam.aro : ragam.avaro;
  const other = dir === 'up' ? ragam.avaro : ragam.aro;
  // Each list remembers where the phrase last was in it, so a vakra phrase
  // that turns around (Hamir Kalyani's "G3 P M1") picks the right occurrence.
  const last = prev ? prev.path : { up: -1, down: -1 };
  let idx = -1;
  if (!prev) {
    idx = findFirst(list, letter);
  } else {
    let anchor;
    if (prev.dir === dir && last[dir] >= 0) anchor = last[dir];
    else {
      anchor = findAfter(list, prev.letter, last[dir] + 1);
      if (anchor === -1) anchor = findFirst(list, prev.letter);
    }
    if (anchor >= 0) idx = findAfter(list, letter, anchor + 1);
    if (idx === -1) idx = findFirst(list, letter);
  }
  const path = { ...last };
  let token;
  let offPath = false;
  if (idx === -1) {
    // Not in this direction's scale (e.g. Ma going up in Bilahari): use the
    // other direction's swarasthana, marked as off the usual path.
    offPath = true;
    const j = findFirst(other, letter);
    token = other[j];
    path[otherDir] = j;
  } else {
    token = list[idx];
    path[dir] = idx;
  }
  return { letter, sthayi, dir, offPath, id: token.id, pos: token.pos, path };
}

// Which letters naturally come next from this note, going up and going down.
export function suggestNext(ragam, note) {
  if (!note) return { up: null, down: null };
  const nextIn = (list, dirKey) => {
    let i = note.path[dirKey] >= 0 && list[note.path[dirKey]].letter === note.letter ? note.path[dirKey] : findFirst(list, note.letter);
    if (i === -1) return null;
    const t = list[i + 1];
    return t ? { letter: t.letter, oct: t.oct } : null;
  };
  return { up: nextIn(ragam.aro, 'up'), down: nextIn(ragam.avaro, 'down') };
}

// Neighbouring swaras (for gamakas): the next ragam swara above (from the
// arohanam) and below (from the avarohanam), as absolute positions in semitones
// from madhya Sa.
export function neighbours(ragam, pos, sthayi = 0) {
  const abs = pos + 12 * sthayi;
  const up = [...new Set(ragam.aro.map((t) => t.pos))].sort((a, b) => a - b);
  const down = [...new Set(ragam.avaro.map((t) => t.pos))].sort((a, b) => a - b);
  const above = [];
  const below = [];
  for (const o of [-2, -1, 0, 1, 2]) {
    for (const p of up) above.push(p + 12 * o);
    for (const p of down) below.push(p + 12 * o);
  }
  const upper = above.filter((x) => x > abs).sort((a, b) => a - b);
  const lower = below.filter((x) => x < abs).sort((a, b) => b - a);
  return { upper: upper[0], upper2: upper[1], lower: lower[0], lower2: lower[1] };
}
