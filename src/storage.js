// Everything persistent lives in one localStorage entry.
const KEY = 'jahanchord:v1';

const DEFAULTS = {
  settings: {
    key: 'C',
    preset: 'pad',
    arp: 'off',
    arpRate: '16n',
    bpm: 92,
    volume: 0.8,
    kit: 'lofi',
    beat: 'pop',
    commentary: true,
    showNotes: true,
  },
  lessons: { done: [], current: null },
  stats: {
    firstVisit: null,
    lastVisitDay: null,
    visits: 0,
    totalSeconds: 0,
    chords: 0,
  },
  toastsOnce: [], // lines that only ever fire once (e.g. "first chord")
};

function merge(def, val) {
  if (typeof def !== 'object' || def === null || Array.isArray(def)) return val ?? def;
  const out = { ...def };
  for (const k of Object.keys(val || {})) out[k] = k in def ? merge(def[k], val[k]) : val[k];
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(DEFAULTS, raw ? JSON.parse(raw) : {});
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const store = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private mode etc. */ }
  }, 250);
}

export function saveNow() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

export function dayString(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
