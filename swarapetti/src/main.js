import './style.css';
import {
  SWARAS, SWARASTHANAS, LETTER_NAMES, KATTAIS, kattaiById, saFrequency, WESTERN, westernName,
  positionCents, carnaticLabel, tamilLabel, LETTER_TAMIL,
} from './theory/swaras.js';
import { CHAKRAS } from './theory/melakarta.js';
import { RAGAMS, ragamById, resolveNote, suggestNext, neighbours, searchRagams } from './theory/ragams.js';
import { TALAMS, NADAIS, KALAMS, KRIYA, talamById, nadaiById, kalamById, groupStarts } from './theory/talam.js';
import { GAMAKAS } from './theory/gamaka.js';
import { parseExercise } from './theory/exercises.js';
import { Engine } from './audio/engine.js';
import { VOICES } from './audio/voices.js';
import { PERCUSSION } from './audio/percussion.js';
import { SHRUTI_SETTINGS } from './audio/drone.js';
import { LESSONS, tipOfTheDay } from './lessons.js';
import { createJoystick, DIR_ANGLE } from '../../shared/joystick.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- settings
const STORE_KEY = 'swarapetti:v1';
const DEFAULTS = {
  kattai: '1.5', octave: 3, fine: 0, ragam: 'mela-15', voice: 'veena', tuning: 'just',
  notation: 'carnatic', western: false, path: true,
  droneOn: true, droneType: 'tanpura', shruti: 'sa-pa-sa', firstString: 'auto', droneVol: 0.6,
  talam: 'adi', nadai: 'chatusram', kalam: 1, tempo: 70, perc: 'mridangam',
};
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { settings: { ...DEFAULTS, ...(raw.settings || {}) }, lessons: { done: [], ...(raw.lessons || {}) } };
  } catch { return { settings: { ...DEFAULTS }, lessons: { done: [] } }; }
}
const store = load();
const S = store.settings;
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ } }, 200);
}

const engine = new Engine();
window.__sp = { engine, store }; // for debugging and tests
let started = false;
let ragam = ragamById(S.ragam);

// ---------------------------------------------------------------- pitch helpers
const saHz = () => saFrequency(S.kattai, Number(S.octave), Number(S.fine));
const centsOf = (absPos) => positionCents(absPos, S.tuning);
function nbCents(note) {
  const nb = neighbours(ragam, note.pos, note.sthayi);
  const out = {};
  for (const k of Object.keys(nb)) if (nb[k] !== undefined) out[k] = centsOf(nb[k]);
  return out;
}

// ---------------------------------------------------------------- swara keys
const keysEl = $('#keys');
const keyEls = [];
for (let d = 0; d < 8; d++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swara-key' + (d === 7 ? ' upper' : '');
  b.dataset.deg = d;
  b.innerHTML = '<span class="k-hint"></span><span class="k-letter"></span><span class="k-sthana"></span><span class="k-name"></span><span class="k-path"></span>';
  keysEl.appendChild(b);
  keyEls.push(b);
}

function sub(n) { return n.replace(/[0-9]/g, (x) => '₀₁₂₃₄₅₆₇₈₉'[x]); }
function renderKeys() {
  keyEls.forEach((b, d) => {
    const letter = d % 7;
    const info = ragam.letters[letter];
    b.classList.toggle('off', !info.used);
    b.setAttribute('aria-disabled', String(!info.used));
    const L = b.querySelector('.k-letter');
    if (S.notation === 'tamil') { L.textContent = LETTER_TAMIL[letter] + (d === 7 ? '̇' : ''); L.classList.add('tamil'); }
    else { L.textContent = LETTER_NAMES[letter] + (d === 7 ? '̇' : ''); L.classList.remove('tamil'); }
    if (d === 7) L.innerHTML = S.notation === 'tamil' ? `${LETTER_TAMIL[0]}̇` : 'Ṡa';
    const ids = [...new Set([...info.aroIds, ...info.avaroIds])];
    let sth = '';
    if (!info.used) sth = 'not in ragam';
    else if (letter === 0 || letter === 4) sth = '';
    else if (info.aroIds.length === 1 && info.avaroIds.length === 1 && info.aroIds[0] !== info.avaroIds[0]) sth = `${sub(info.aroIds[0])}↑ ${sub(info.avaroIds[0])}↓`;
    else sth = ids.map(sub).join(' ');
    b.querySelector('.k-sthana').textContent = sth;
    b.querySelector('.k-name').textContent = info.used && ids.length === 1 ? SWARAS[ids[0]].name : '';
    b.querySelector('.k-hint').textContent = String(d + 1);
    b.setAttribute('aria-label', `${LETTER_NAMES[letter]}${d === 7 ? ' (upper)' : ''}${info.used ? '' : ', not in this ragam'}`);
  });
  renderPath();
}

function renderPath() {
  keyEls.forEach((b) => { b.querySelector('.k-path').textContent = ''; });
  if (!S.path || !lastNote) return;
  const sug = suggestNext(ragam, lastNote);
  const mark = (s, sym) => {
    if (!s) return;
    let d = s.letter;
    if (s.letter === 0 && s.oct > 0 && lastNote.sthayi === 0) d = 7;
    const el = keyEls[d].querySelector('.k-path');
    el.textContent += sym;
  };
  mark(sug.up, '▲');
  mark(sug.down, '▼');
}

// ---------------------------------------------------------------- playing
let stickDir = 'c';
let lastNote = null; // last resolved note (for direction and path)
const held = []; // [{ deg, id, note }]
let current = null; // { deg, note, cents, nb }

const stickSthayi = () => (stickDir === 'u' ? 1 : stickDir === 'd' ? -1 : 0);
const stickGamaka = () => (GAMAKAS[stickDir] ? stickDir : 'c');

function resolveFor(deg, prev) {
  const letter = deg % 7;
  const sthayi = (deg === 7 ? 1 : 0) + stickSthayi();
  const note = resolveNote(ragam, letter, sthayi, prev);
  if (!note) return null;
  const cents = centsOf(note.pos + 12 * sthayi);
  return { note, cents, nb: nbCents(note) };
}

function press(deg, id) {
  if (!started) return;
  const r = resolveFor(deg, lastNote);
  if (!r) { keyEls[deg].animate?.([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 160 }); return; }
  const legato = held.length > 0;
  held.push({ deg, id, note: r.note });
  keyEls[deg].classList.add('down');
  engine.noteOn({ cents: r.cents, gamaka: stickGamaka(), nb: r.nb, legato });
  lastNote = r.note;
  current = { deg, ...r };
  renderActive();
  renderDisplay();
  renderPath();
  lessonOnNote(r.note, stickGamaka());
}

function release(id) {
  const i = held.findIndex((h) => h.id === id);
  if (i < 0) return;
  const [h] = held.splice(i, 1);
  if (!held.some((x) => x.deg === h.deg)) keyEls[h.deg].classList.remove('down');
  if (!held.length) {
    engine.noteOff();
    current = null;
    renderActive();
    renderDisplay();
  } else if (i === held.length) {
    // Let go of the sounding key while another is held: slide back to it.
    const back = held[held.length - 1];
    const r = resolveFor(back.deg, lastNote);
    if (r) {
      engine.noteOn({ cents: r.cents, gamaka: stickGamaka(), nb: r.nb, legato: true });
      lastNote = r.note;
      current = { deg: back.deg, ...r };
      renderActive(); renderDisplay(); renderPath();
    }
  }
}

function onStick(dir) {
  const prevSthayi = stickSthayi();
  stickDir = dir;
  $$('.jl').forEach((el) => el.classList.toggle('on', el.classList.contains(dir)));
  if (current) {
    if (stickSthayi() !== prevSthayi) {
      // Sthayi changed while holding: move the held swara to the new octave.
      const r = resolveFor(current.deg, lastNote);
      if (r) {
        engine.noteOn({ cents: r.cents, gamaka: stickGamaka(), nb: r.nb, legato: true });
        lastNote = r.note;
        current = { deg: current.deg, ...r };
      }
    } else {
      engine.regamaka(stickGamaka(), current.cents, current.nb);
      if (GAMAKAS[dir]) lessonEvent('gamaka');
    }
  }
  renderDisplay();
}

function renderActive() {
  keyEls.forEach((b, d) => b.classList.toggle('active', !!current && current.deg === d));
}

for (const b of keyEls) {
  const deg = Number(b.dataset.deg);
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    press(deg, `p${e.pointerId}`);
  });
  const up = (e) => release(`p${e.pointerId}`);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------------------------------------------------------------- joystick
const stick = createJoystick({
  el: $('#joy'), well: $('#joy .joy-well'), knob: $('#joyKnob'), lockBtn: $('#joyLock'),
  radius: 40, getScale: () => 1, enabled: () => started, onChange: (dir) => onStick(dir),
});

// ---------------------------------------------------------------- keyboard
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (!started && (e.key === 'Enter' || e.key === ' ')) { startApp(); e.preventDefault(); return; }
  if (e.repeat) return;
  if (/^[1-8]$/.test(e.key)) { press(Number(e.key) - 1, `k${e.key}`); e.preventDefault(); }
  if (e.key === 't' || e.key === 'T') toggleTalam();
  if (e.key === 'Escape') { openSheet('#ragamSheet', false); openSheet('#settings', false); }
});
window.addEventListener('keyup', (e) => { if (/^[1-8]$/.test(e.key)) release(`k${e.key}`); });

// ---------------------------------------------------------------- display
function swaraLabelHTML(id, sthayi) {
  if (S.notation === 'tamil') return esc(tamilLabel(id, sthayi).normalize('NFC'));
  const base = carnaticLabel(id, sthayi).normalize('NFC');
  return `${esc(base.replace(/[0-9]/g, ''))}${id.length > 1 ? `<span class="sub">${id.slice(1)}</span>` : ''}`;
}
function renderDisplay() {
  const el = $('#scrSwara');
  const n = current ? current.note : lastNote;
  el.classList.toggle('tamil', S.notation === 'tamil');
  el.classList.toggle('idle', !current);
  if (n) {
    el.innerHTML = swaraLabelHTML(n.id, n.sthayi);
    $('#dName').textContent = SWARAS[n.id].name;
    $('#dWestern').textContent = S.western ? westernName(kattaiById(S.kattai).pc, n.pos, Number(S.octave), n.sthayi) : '';
  } else {
    el.innerHTML = swaraLabelHTML('S', 0);
    $('#dName').textContent = 'Shadjam';
    $('#dWestern').textContent = '';
  }
  if (current) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  const sth = stickSthayi() + (current && current.deg === 7 ? 1 : 0);
  const shown = current ? current.note.sthayi : sth;
  $('#dSthayi').textContent = shown > 0 ? 'Mel sthayi' : shown < 0 ? 'Mandra sthayi' : 'Madhya sthayi';
  $('#dGamaka').textContent = GAMAKAS[stickDir] ? `${GAMAKAS[stickDir].arrow} ${GAMAKAS[stickDir].name}` : '';
  // Highlight the current position in the arohanam / avarohanam.
  $$('#dAro span, #dAvaro span').forEach((s) => s.classList.remove('now'));
  if (current) {
    const n2 = current.note;
    const list = n2.dir === 'up' ? '#dAro' : '#dAvaro';
    const idx = n2.path[n2.dir];
    const spans = $$(`${list} span`);
    if (idx >= 0 && spans[idx]) spans[idx].classList.add('now');
  }
}
function renderScales() {
  const tok = (t) => (S.notation === 'tamil' ? tamilLabel(t.id, t.oct) : carnaticLabel(t.id, t.oct, { subscript: true }));
  $('#dAro').innerHTML = ragam.aro.map((t) => `<span>${esc(tok(t))}</span>`).join('');
  $('#dAvaro').innerHTML = ragam.avaro.map((t) => `<span>${esc(tok(t))}</span>`).join('');
}

// ---------------------------------------------------------------- ragam
function ragamMeta(r) {
  if (r.kind === 'melakarta') return `Melakarta ${r.number} · ${r.chakra} chakra`;
  return `Janya of ${r.parent} ${r.parentName}`;
}
function setRagam(id, { fromUser = true } = {}) {
  ragam = ragamById(id);
  S.ragam = ragam.id;
  save();
  lastNote = null;
  $('#ragamName').textContent = ragam.name;
  $('#ragamMeta').textContent = ragam.kind === 'melakarta' ? `Melakarta ${ragam.number}` : `Janya · ${ragam.parentName}`;
  renderKeys();
  renderScales();
  renderDisplay();
  configureDrone();
  if (fromUser) lessonEvent(`ragam:${ragam.id}`);
}

const ragamSheet = $('#ragamSheet');
let ragamFilter = 'all';
function renderRagamList() {
  const q = $('#ragamSearch').value;
  const list = searchRagams(q, ragamFilter);
  const pretty = (x) => sub(x.replace(/'/g, '\u0307')).normalize('NFC');
  const scale = (r) => `${pretty(r.arohanam)}  ·  ${pretty(r.avarohanam)}`;
  let html = '';
  let lastHead = '';
  for (const r of list) {
    const head = r.kind === 'melakarta' ? `${r.chakraNumber}. ${r.chakra} chakra` : 'Janya ragams';
    if (head !== lastHead) { html += `<div class="chakra-head">${esc(head)}</div>`; lastHead = head; }
    html += `<button type="button" class="ragam-row ${r.id === ragam.id ? 'on' : ''}" data-id="${r.id}">
      <span class="num">${r.number || ''}</span>
      <span><span class="nm">${esc(r.name)}<small>${r.kind === 'janya' ? `janya of ${r.parent} ${esc(r.parentName)}` : ''}</small></span>
      <span class="sc">${esc(scale(r))}</span></span></button>`;
  }
  $('#ragamList').innerHTML = html || '<div class="empty">No ragam matches that search.</div>';
}
$('#ragamList').addEventListener('click', (e) => {
  const row = e.target.closest('.ragam-row');
  if (!row) return;
  setRagam(row.dataset.id);
  openSheet('#ragamSheet', false);
});
$('#ragamSearch').addEventListener('input', renderRagamList);
segment('#ragamFilter', () => ragamFilter, (v) => { ragamFilter = v; renderRagamList(); });
$('#ragamBtn').addEventListener('click', () => {
  $('#ragamSearch').value = '';
  renderRagamList();
  openSheet('#ragamSheet', true);
  setTimeout(() => { const on = $('#ragamList .on'); if (on) on.scrollIntoView({ block: 'center' }); }, 60);
});
$('#ragamClose').addEventListener('click', () => openSheet('#ragamSheet', false));
ragamSheet.addEventListener('click', (e) => { if (e.target === ragamSheet) openSheet('#ragamSheet', false); });

function openSheet(sel, open) {
  const el = $(sel);
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', String(!open));
  if (open && sel === '#ragamSheet') setTimeout(() => $('#ragamSearch').focus({ preventScroll: true }), 80);
}

// generic segmented control
function segment(sel, get, set) {
  const el = $(sel);
  const render = () => el.querySelectorAll('button').forEach((b) => {
    const on = String(get()) === b.dataset.v;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    set(b.dataset.v);
    render();
  });
  render();
  return render;
}

// ---------------------------------------------------------------- drone / shruti
function renderKattai() {
  const k = kattaiById(S.kattai);
  $('#kattaiVal').textContent = k.label;
  const hz = saHz();
  $('#kattaiWest').textContent = `${WESTERN[k.pc]}${S.octave} · ${hz.toFixed(1)} Hz${Number(S.fine) ? ` (${S.fine > 0 ? '+' : ''}${S.fine}¢)` : ''}`;
  $('#fineCents').value = S.fine;
  $('#fineVal').textContent = `${S.fine > 0 ? '+' : ''}${S.fine} ¢`;
}
function applySa() {
  renderKattai();
  engine.setSa(saHz());
  renderDisplay();
}
function stepKattai(d) {
  const i = KATTAIS.findIndex((k) => k.id === String(S.kattai));
  const j = Math.max(0, Math.min(KATTAIS.length - 1, i + d));
  S.kattai = KATTAIS[j].id;
  save();
  applySa();
  lessonEvent('kattai');
}
$('#kattaiDown').addEventListener('click', () => stepKattai(-1));
$('#kattaiUp').addEventListener('click', () => stepKattai(1));
$('#fineCents').addEventListener('input', (e) => { S.fine = Number(e.target.value); save(); applySa(); });

function autoFirstString() {
  if (ragam.letters[4].used) return 'pa';
  if (ragam.letters[3].used) return 'ma';
  return 'ni';
}
function letterPos(letter, fallback) {
  const t = ragam.aro.find((x) => x.letter === letter) || ragam.avaro.find((x) => x.letter === letter);
  return t ? t.pos : fallback;
}
function configureDrone() {
  engine.droneConfigure({
    type: S.droneType, sa: saHz(), setting: S.shruti,
    maPos: letterPos(3, 5), niPos: letterPos(6, 11),
    firstString: S.firstString === 'auto' ? autoFirstString() : S.firstString,
  });
  renderDroneSetting();
}
function renderDroneSetting() {
  const el = $('#droneSetting');
  if (S.droneType === 'shruti') {
    el.innerHTML = SHRUTI_SETTINGS.map((s) => `<button type="button" data-v="${s.id}" role="radio" class="${S.shruti === s.id ? 'on' : ''}">${s.name}</button>`).join('');
  } else {
    const fs = S.firstString === 'auto' ? autoFirstString() : S.firstString;
    const name = { pa: 'Pa', ma: 'Ma', ni: 'Ni' }[fs];
    el.innerHTML = `<button type="button" class="on" data-v="tanpura-info" tabindex="-1">${name} · Sa · Sa · lower Sa</button>`;
  }
}
$('#droneSetting').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || S.droneType !== 'shruti') return;
  S.shruti = b.dataset.v; save(); configureDrone();
});
segment('#droneType', () => S.droneType, (v) => { S.droneType = v; save(); configureDrone(); lessonEvent('drone'); });
$('#droneOn').checked = S.droneOn;
$('#droneOn').addEventListener('change', (e) => { S.droneOn = e.target.checked; save(); engine.droneOn(S.droneOn); lessonEvent('drone'); });
$('#droneVol').value = S.droneVol;
$('#droneVol').addEventListener('input', (e) => { S.droneVol = Number(e.target.value); save(); engine.droneVolume(S.droneVol); });

// Quiet drone visualiser: a soft ring that breathes with the drone.
const viz = $('#droneViz');
const vctx = viz.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function drawViz() {
  const w = viz.width; const h = viz.height;
  vctx.clearRect(0, 0, w, h);
  if (started && engine.drone && S.droneOn) {
    const a = new Float32Array(engine.drone.analyser.fftSize);
    engine.drone.analyser.getFloatTimeDomainData(a);
    vctx.strokeStyle = 'rgba(239, 217, 163, 0.85)';
    vctx.lineWidth = 1.5;
    vctx.beginPath();
    const step = Math.floor(a.length / w);
    for (let x = 0; x < w; x++) {
      const v = a[x * step] * (h * 0.9);
      const y = h / 2 + v;
      if (x === 0) vctx.moveTo(x, y); else vctx.lineTo(x, y);
    }
    vctx.stroke();
  } else {
    vctx.strokeStyle = 'rgba(239, 217, 163, 0.3)';
    vctx.beginPath(); vctx.moveTo(0, h / 2); vctx.lineTo(w, h / 2); vctx.stroke();
  }
  if (!reduced.matches) setTimeout(() => requestAnimationFrame(drawViz), 50);
}

// ---------------------------------------------------------------- talam
const fill = (sel, items, val) => {
  const el = $(sel);
  el.innerHTML = items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  el.value = val;
};
fill('#voiceSel', VOICES, S.voice);
fill('#talamSel', TALAMS.filter((t) => !t.lessonOnly), S.talam);
fill('#nadaiSel', NADAIS, S.nadai);
fill('#kalamSel', KALAMS, String(S.kalam));
fill('#percSel', [...PERCUSSION, { id: 'tick', name: 'Soft count' }, { id: 'none', name: 'None' }], S.perc);
$('#tempo').value = S.tempo;
$('#tempoVal').textContent = S.tempo;

$('#voiceSel').addEventListener('change', (e) => { S.voice = e.target.value; save(); engine.setVoice(S.voice); });
$('#talamSel').addEventListener('change', (e) => { S.talam = e.target.value; save(); applyTalam(); });
$('#nadaiSel').addEventListener('change', (e) => { S.nadai = e.target.value; save(); applyTalam(); });
$('#kalamSel').addEventListener('change', (e) => { S.kalam = Number(e.target.value); save(); applyTalam(); });
$('#percSel').addEventListener('change', (e) => { S.perc = e.target.value; save(); applyTalam(); });
$('#tempo').addEventListener('input', (e) => { S.tempo = Number(e.target.value); $('#tempoVal').textContent = S.tempo; save(); applyTalam(); });

const KRIYA_ICON = {
  clap: '<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="10" class="ic-fill"/><circle cx="15" cy="15" r="13" class="ic-line"/></svg>',
  wave: '<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="11" class="ic-line" stroke-dasharray="3 3"/><path class="ic-line" d="M9 17c2-5 10-5 12 0m0 0l1-4m-1 4l-4-1"/></svg>',
  rest: '<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="2.5" class="ic-fill"/></svg>',
};
function fingerIcon(n) {
  const xs = n === 1 ? [15] : n === 2 ? [12, 18] : [10, 15, 20];
  return `<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="11" class="ic-line"/>${xs.map((x) => `<path class="ic-line" d="M${x} 10v10"/>`).join('')}</svg>`;
}
function renderTalamStrip() {
  const t = talamById(S.talam);
  const starts = groupStarts(t);
  $('#kriyas').innerHTML = t.kriyas.map((k, i) => {
    const icon = k.startsWith('f') ? fingerIcon(Number(k[1])) : KRIYA_ICON[k];
    const label = k === 'clap' ? 'Clap' : k === 'wave' ? 'Wave' : k === 'rest' ? '' : k[1];
    return `<div class="kriya ${starts.includes(i) && i > 0 ? 'group-start' : ''}" data-beat="${i}" title="${esc(KRIYA[k].label)}">${icon}<span class="k-label">${label}</span><span class="k-num">${i + 1}</span></div>`;
  }).join('');
  $('#talamName').textContent = t.name;
  $('#talamMeta').textContent = `${t.beats} beats · ${nadaiById(S.nadai).name.toLowerCase()} · ${kalamById(S.kalam).short} kalam`;
}
function applyTalam() {
  engine.setTalam({ talamId: S.talam, nadaiId: S.nadai, kalamId: Number(S.kalam), tempo: Number(S.tempo), percussion: S.perc });
  renderTalamStrip();
  $('#talamSel').value = S.talam; $('#nadaiSel').value = S.nadai; $('#kalamSel').value = String(S.kalam);
  $('#tempo').value = S.tempo; $('#tempoVal').textContent = S.tempo;
}
function toggleTalam() {
  if (!started) return;
  if (engine.talam.running) engine.stopTalam(); else engine.startTalam();
}
$('#talamPlay').addEventListener('click', toggleTalam);
engine.on('talam', ({ running }) => {
  $('#talamPlay').classList.toggle('on', running);
  $('#talamPlay').setAttribute('aria-pressed', String(running));
  if (!running) { $$('.kriya').forEach((k) => k.classList.remove('now')); $('#avartanam').textContent = ''; }
  if (running) lessonEvent('talam-on');
});
engine.on('beat', ({ beat, cycle }) => {
  $$('.kriya').forEach((k, i) => k.classList.toggle('now', i === beat));
  $('#avartanam').textContent = `Avartanam ${cycle + 1}`;
});

// ---------------------------------------------------------------- looper
engine.on('loop', ({ state, cycles }) => {
  $('#recBtn').classList.toggle('blink', state === 'countin');
  $('#recBtn').classList.toggle('on', state === 'recording');
  $('#playBtn').classList.toggle('on', state === 'playing');
  $('#playBtn').disabled = !(state === 'playing' || state === 'stopped');
  $('#clearBtn').disabled = state === 'empty';
  $('#playBtn').textContent = state === 'playing' ? 'Stop' : 'Play';
  $('#recBtn').lastChild.textContent = state === 'countin' ? 'Wait…' : state === 'recording' ? 'Stop rec' : 'Rec';
  $('#avartanam').title = cycles ? `Loop: ${cycles} avartanam${cycles > 1 ? 's' : ''}` : '';
});
engine.on('looprecorded', () => lessonEvent('loop'));
$('#recBtn').addEventListener('click', () => engine.loopRec());
$('#playBtn').addEventListener('click', () => engine.loopPlay());
$('#clearBtn').addEventListener('click', () => engine.loopClear());

// ---------------------------------------------------------------- settings sheet
$('#settingsBtn').addEventListener('click', () => openSheet('#settings', true));
$('#settingsClose').addEventListener('click', () => openSheet('#settings', false));
$('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') openSheet('#settings', false); });
segment('#notationSeg', () => S.notation, (v) => { S.notation = v; save(); renderKeys(); renderScales(); renderDisplay(); renderLearn(); });
segment('#tuningSeg', () => S.tuning, (v) => { S.tuning = v; save(); });
segment('#octaveSeg', () => S.octave, (v) => { S.octave = Number(v); save(); applySa(); });
segment('#firstStringSeg', () => S.firstString, (v) => { S.firstString = v; save(); configureDrone(); });
$('#optWestern').checked = S.western;
$('#optWestern').addEventListener('change', (e) => { S.western = e.target.checked; save(); renderDisplay(); });
$('#optPath').checked = S.path;
$('#optPath').addEventListener('change', (e) => { S.path = e.target.checked; save(); renderPath(); });
$('#resetProgress').addEventListener('click', () => { store.lessons.done = []; save(); lesson = null; renderLearn(); $('#resetProgress').textContent = 'Progress reset'; });

// ---------------------------------------------------------------- learn
const learnEl = $('#learn');
const learnBody = $('#learnBody');
let lesson = null; // { def, step, ex }

function openLearn(open) {
  learnEl.classList.toggle('open', open);
  learnEl.setAttribute('aria-hidden', String(!open));
  $('#learnBtn').classList.toggle('on', open);
  if (!open) stopExercise();
}
$('#learnBtn').addEventListener('click', () => openLearn(!learnEl.classList.contains('open')));
$('#learnClose').addEventListener('click', () => openLearn(false));

function startLesson(id) {
  stopExercise();
  lesson = { def: LESSONS.find((l) => l.id === id), step: 0, ex: null };
  enterStep();
}
const step = () => (lesson ? lesson.def.steps[lesson.step] : null);

function enterStep() {
  stopExercise();
  const st = step();
  if (!st) return;
  if (st.ragam && st.ragam !== ragam.id) setRagam(st.ragam, { fromUser: false });
  if (st.talam && (st.type === 'exercise' || st.type === 'do')) {
    S.talam = st.talam;
    if (st.kalam) S.kalam = st.kalam;
    if (st.tempo) S.tempo = st.tempo;
    applyTalam();
  }
  if (st.type === 'exercise' || st.type === 'demo') prepareExercise(st);
  renderLearn();
  applyHighlight();
  if (st.type === 'do' && waitAlreadyDone(st.wait)) setTimeout(() => { if (step() === st) next(); }, 900);
}

function next() {
  if (!lesson) return;
  stopExercise();
  lesson.step++;
  if (lesson.step >= lesson.def.steps.length) {
    if (!store.lessons.done.includes(lesson.def.id)) store.lessons.done.push(lesson.def.id);
    save();
    lesson.finished = true;
    renderLearn();
    applyHighlight();
    return;
  }
  enterStep();
}

function waitAlreadyDone(w) {
  if (w === 'drone-tanpura') return S.droneOn && S.droneType === 'tanpura';
  if (w === 'talam-on') return engine.talam.running;
  if (w && w.startsWith('ragam:')) return ragam.id === w.slice(6);
  return false;
}

let playCount = 0;
function lessonEvent(name) {
  const st = step();
  if (!st || st.type !== 'do' || lesson.finished) return;
  const w = st.wait;
  let done = false;
  if (w === name) done = true;
  if (w === 'drone-tanpura' && name === 'drone') done = S.droneOn && S.droneType === 'tanpura';
  if (w === 'ragam-change' && name.startsWith('ragam:')) done = true;
  if (done) { flashFeedback('Lovely.'); setTimeout(next, 700); }
}

function applyHighlight() {
  $$('.hl').forEach((el) => el.classList.remove('hl'));
  const st = step();
  if (st && st.highlight && !lesson.finished) $$(st.highlight).forEach((el) => el.classList.add('hl'));
}

function flashFeedback(text) {
  const fb = learnBody.querySelector('.feedback');
  if (fb) fb.textContent = text;
}

function swaraToken(ev) {
  const name = S.notation === 'tamil' ? LETTER_TAMIL[ev.letter] : 'SRGMPDN'[ev.letter];
  const mark = ev.sthayi > 0 ? '̇' : ev.sthayi < 0 ? '̣' : '';
  return name + mark + (ev.gamaka !== 'c' ? GAMAKAS[ev.gamaka].arrow : '');
}

function renderLearn() {
  if (!lesson) {
    $('#learnTitle').textContent = 'Learn';
    learnBody.innerHTML = `<p>Lessons follow the traditional order of learning. The keys light up to guide you, and you can always go at your own pace.</p>${LESSONS.map((l, i) => {
      const done = store.lessons.done.includes(l.id);
      return `<button type="button" class="lesson-item ${done ? 'done' : ''}" data-id="${l.id}"><span class="n">${done ? '✓' : i + 1}</span><span><b>${esc(l.title)}</b><span>${esc(l.blurb)}</span></span></button>`;
    }).join('')}`;
    return;
  }
  const { def } = lesson;
  $('#learnTitle').textContent = def.title;
  const bar = def.steps.map((_, i) => `<i class="${i < lesson.step || lesson.finished ? 'on' : ''}"></i>`).join('');
  let html = `<div class="progress">${bar}</div>`;
  if (lesson.finished) {
    const i = LESSONS.findIndex((l) => l.id === def.id);
    html += `<div class="step-card"><h3>Well done</h3><p class="say">You have completed “${esc(def.title)}”. Come back to it whenever you like; repetition is how these things settle.</p></div>
      <div class="lesson-actions">${i < LESSONS.length - 1 ? '<button class="plain primary" data-act="nextlesson" type="button">Next lesson</button>' : ''}
      <button class="plain" data-act="again" type="button">Do it again</button><button class="plain" data-act="list" type="button">All lessons</button></div>`;
    learnBody.innerHTML = html;
    return;
  }
  const st = step();
  html += '<div class="step-card">';
  if (st.title) html += `<h3>${esc(st.title)}</h3>`;
  html += `<div class="say">${st.html || ''}</div>`;
  if (st.table) html += swarasthanaTable();
  if (st.type === 'exercise' || st.type === 'demo') {
    const ex = lesson.ex;
    html += `<div class="notation" id="exNotation">${ex.tokens.map((t, i) => (t.bar ? `<span class="bar">${t.bar}</span>` : `<span class="tok" data-i="${t.i}">${esc(t.text)}</span>`)).join('')}</div>`;
    html += `<div class="small-note">${esc(ragamById(st.ragam).name)} · ${esc(talamById(st.talam || 'adi').name)} talam · ${kalamById(st.kalam || 1).name.toLowerCase()}</div>`;
  }
  html += '<div class="feedback" aria-live="polite"></div></div><div class="lesson-actions">';
  if (st.type === 'read') html += '<button class="plain primary" data-act="next" type="button">Next</button>';
  if (st.type === 'demo') html += '<button class="plain primary" data-act="listen" type="button">Listen</button><button class="plain" data-act="step" type="button">Try it</button>';
  if (st.type === 'exercise') {
    if (!st.timedOnly) html += '<button class="plain primary" data-act="step" type="button">Step by step</button>';
    html += `<button class="plain ${st.timedOnly ? 'primary' : ''}" data-act="timed" type="button">With talam</button>`;
  }
  if (st.type !== 'read') html += '<button class="plain" data-act="next" type="button">Next</button>';
  html += '<button class="plain" data-act="list" type="button">All lessons</button></div>';
  html += `<p class="small-note">Step ${lesson.step + 1} of ${def.steps.length}</p>`;
  learnBody.innerHTML = html;
}

function swarasthanaTable() {
  const rows = SWARASTHANAS.map((s) => `<tr><td>${s.pos + 1}</td><td>${s.names.map((n) => `<b>${n}</b> ${esc(SWARAS[n].name)}`).join('<br>')}</td></tr>`).join('');
  return `<table><thead><tr><th>Position</th><th>Swara names</th></tr></thead><tbody>${rows}</tbody></table>`;
}

learnBody.addEventListener('click', (e) => {
  const item = e.target.closest('.lesson-item');
  if (item) { startLesson(item.dataset.id); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'next') next();
  if (act === 'list') { stopExercise(); lesson = null; renderLearn(); applyHighlight(); }
  if (act === 'again') startLesson(lesson.def.id);
  if (act === 'nextlesson') { const i = LESSONS.findIndex((l) => l.id === lesson.def.id); startLesson(LESSONS[i + 1].id); }
  if (act === 'step') runStep();
  if (act === 'timed') runTimed();
  if (act === 'listen') runDemo();
});

// ---------- exercises ----------
function prepareExercise(st) {
  const parsed = parseExercise(st.notation);
  const tokens = [];
  let bi = 0;
  parsed.events.forEach((ev, i) => {
    while (bi < parsed.bars.length && parsed.bars[bi].at <= ev.at) { tokens.push({ bar: parsed.bars[bi].kind }); bi++; }
    tokens.push({ i, text: swaraToken(ev) + ' ,'.repeat(ev.units - 1).replace(/ ,/g, ' ,') });
  });
  while (bi < parsed.bars.length) { tokens.push({ bar: parsed.bars[bi].kind }); bi++; }
  lesson.ex = { parsed, tokens, mode: null, idx: 0, timers: [], results: [] };
}

function keyForEvent(ev) { return ev.letter === 0 && ev.sthayi === 1 ? 7 : ev.letter; }
function stickForEvent(ev) {
  if (ev.gamaka && ev.gamaka !== 'c') return ev.gamaka;
  if (ev.letter === 0 && ev.sthayi === 1) return 'c';
  return ev.sthayi > 0 ? 'u' : ev.sthayi < 0 ? 'd' : 'c';
}
function showGuide(ev) {
  keyEls.forEach((k) => k.classList.remove('guide'));
  const g = $('#joyGuide');
  g.classList.remove('show');
  if (!ev) return;
  keyEls[keyForEvent(ev)].classList.add('guide');
  const dir = stickForEvent(ev);
  if (dir !== 'c') {
    const a = DIR_ANGLE[dir] * Math.PI / 180;
    g.style.setProperty('--gx', `${Math.cos(a) * 40}px`);
    g.style.setProperty('--gy', `${Math.sin(a) * 40}px`);
    g.classList.add('show');
  }
}
function markToken(i, cls) {
  const el = learnBody.querySelector(`.tok[data-i="${i}"]`);
  if (!el) return;
  el.classList.remove('now', 'done', 'miss');
  if (cls) el.classList.add(cls);
}

function stopExercise() {
  if (lesson && lesson.ex) {
    lesson.ex.timers.forEach(clearTimeout);
    lesson.ex.timers = [];
    if (lesson.ex.unsub) lesson.ex.unsub();
    lesson.ex.mode = null;
  }
  showGuide(null);
}

function runStep() {
  stopExercise();
  const ex = lesson.ex;
  ex.mode = 'step'; ex.idx = 0; ex.misses = 0;
  learnBody.querySelectorAll('.tok').forEach((t) => t.classList.remove('now', 'done', 'miss'));
  markToken(0, 'now');
  showGuide(ex.parsed.events[0]);
  flashFeedback('Take your time. Play the glowing key.');
}

function runTimed() {
  if (!started) return;
  stopExercise();
  const st = step();
  const ex = lesson.ex;
  ex.mode = 'timed'; ex.results = []; ex.expect = [];
  learnBody.querySelectorAll('.tok').forEach((t) => t.classList.remove('now', 'done', 'miss'));
  if (!engine.talam.running) engine.startTalam();
  flashFeedback('Get ready. The exercise begins on the next samam (the first beat).');
  let armed = true;
  ex.unsub = engine.on('step', (info) => {
    if (!armed || info.beat !== 0 || info.sub !== 0) return;
    armed = false;
    const unit = info.beatDur / kalamById(st.kalam || 1).perBeat;
    const t0 = info.time;
    ex.unit = unit;
    ex.parsed.events.forEach((ev, i) => {
      const at = t0 + ev.at * unit;
      ex.expect.push({ i, at, ev, hit: false });
      const delay = Math.max(0, (at - engine.ctx.currentTime) * 1000);
      ex.timers.push(setTimeout(() => { markToken(i, 'now'); showGuide(ev); if (i > 0 && !ex.expect[i - 1].hit) markToken(i - 1, 'miss'); }, delay));
    });
    const end = t0 + ex.parsed.units * unit;
    ex.timers.push(setTimeout(() => finishTimed(), Math.max(0, (end - engine.ctx.currentTime) * 1000) + 300));
  });
}

function finishTimed() {
  const ex = lesson.ex;
  if (!ex || ex.mode !== 'timed') return;
  const total = ex.expect.length;
  const hits = ex.expect.filter((e) => e.hit).length;
  ex.expect.forEach((e) => { if (!e.hit) markToken(e.i, 'miss'); });
  showGuide(null);
  if (ex.unsub) ex.unsub();
  ex.mode = null;
  const pct = total ? hits / total : 0;
  let msg;
  if (pct >= 0.95) msg = `Beautiful. ${hits} of ${total} swaras, right with the talam.`;
  else if (pct >= 0.75) msg = `Lovely work: ${hits} of ${total} swaras in time. Try once more and listen for the beat just before each swara.`;
  else if (pct >= 0.4) msg = `A good start: ${hits} of ${total}. Practise it step by step a few times, then come back to the talam.`;
  else msg = 'Take it slowly first. Use step by step until the shape is in your fingers, then try with the talam again.';
  flashFeedback(msg);
}

function runDemo() {
  if (!started) return;
  stopExercise();
  const st = step();
  const ex = lesson.ex;
  const unit = 60 / (st.tempo || 60);
  let prev = null;
  const seq = [];
  ex.parsed.events.forEach((ev) => {
    const note = resolveNote(ragam, ev.letter, ev.sthayi, prev);
    if (!note) return;
    prev = note;
    seq.push({ at: ev.at * unit, dur: ev.units * unit * 0.95, cents: centsOf(note.pos + 12 * ev.sthayi), gamaka: ev.gamaka, nb: nbCents(note), ev });
  });
  const t0 = engine.playDemo(seq);
  ex.mode = 'demo';
  seq.forEach((s, i) => {
    const d = Math.max(0, (t0 + s.at - engine.ctx.currentTime) * 1000);
    ex.timers.push(setTimeout(() => { markToken(i, 'now'); showGuide(s.ev); }, d));
    ex.timers.push(setTimeout(() => { markToken(i, 'done'); }, d + s.dur * 1000));
  });
  const endMs = (t0 + ex.parsed.units * unit - engine.ctx.currentTime) * 1000 + 200;
  ex.timers.push(setTimeout(() => { showGuide(null); ex.mode = null; flashFeedback('Now try it yourself: press Try it.'); }, endMs));
}

// Called on every swara played.
function lessonOnNote(note, gamaka) {
  playCount++;
  const st = step();
  if (st && st.type === 'do' && st.wait && st.wait.startsWith('play:') && playCount >= Number(st.wait.slice(5))) lessonEvent(st.wait);
  if (gamaka !== 'c') lessonEvent('gamaka');
  if (!lesson || !lesson.ex || !lesson.ex.mode) return;
  const ex = lesson.ex;
  if (ex.mode === 'step') {
    const want = ex.parsed.events[ex.idx];
    const needGamaka = want.gamaka !== 'c';
    const okLetter = note.letter === want.letter && note.sthayi === want.sthayi;
    const okGamaka = !needGamaka || gamaka === want.gamaka;
    if (okLetter && okGamaka) {
      markToken(ex.idx, 'done');
      keyEls[keyForEvent(want)].classList.add('hit');
      setTimeout(() => keyEls.forEach((k) => k.classList.remove('hit')), 500);
      ex.idx++;
      if (ex.idx >= ex.parsed.events.length) {
        showGuide(null);
        ex.mode = null;
        const isDemo = step() && step().type === 'demo';
        if (isDemo) flashFeedback(ex.misses === 0 ? 'Beautiful. Listen again whenever you like, or move on when you are ready.' : 'Well done. Try it once more, listening for the movement.');
        else flashFeedback(ex.misses === 0 ? 'Beautiful, every swara in place. When you feel ready, try it with the talam.' : 'Well done. Play it once more, and then try it with the talam.');
      } else {
        markToken(ex.idx, 'now');
        showGuide(ex.parsed.events[ex.idx]);
        flashFeedback('');
      }
    } else {
      ex.misses++;
      const name = LETTER_NAMES[want.letter];
      if (okLetter && !okGamaka) flashFeedback(`Nearly. This ${name} wants ${GAMAKAS[want.gamaka].name}: hold the stick ${GAMAKAS[want.gamaka].arrow} as you play it.`);
      else if (note.letter === want.letter) flashFeedback(want.sthayi > 0 ? `That ${name} was in the middle octave; this one is the upper ${name}.` : want.sthayi < 0 ? `This ${name} is in mandra sthayi: hold the stick down as you play it.` : `That was the right swara in another octave. Try the middle ${name}.`);
      else flashFeedback(`That was ${LETTER_NAMES[note.letter]}. The glowing key is ${name}.`);
    }
  } else if (ex.mode === 'timed') {
    const now = engine.ctx.currentTime;
    const win = ex.unit * 0.45;
    let best = null;
    for (const e of ex.expect) {
      if (e.hit) continue;
      const d = Math.abs(now - e.at);
      if (d <= win && (!best || d < Math.abs(now - best.at))) best = e;
    }
    if (best && best.ev.letter === note.letter && best.ev.sthayi === note.sthayi) {
      best.hit = true;
      markToken(best.i, 'done');
    }
  }
}

// ---------------------------------------------------------------- welcome + start
$('#tipText').textContent = tipOfTheDay();
const welcome = $('#welcome');
function startApp() {
  if (started) return;
  started = true;
  engine.start();
  engine.setSa(saHz());
  engine.setVoice(S.voice);
  configureDrone();
  engine.droneVolume(S.droneVol);
  engine.droneOn(S.droneOn);
  applyTalam();
  welcome.classList.add('gone');
  setTimeout(() => welcome.remove(), 700);
}
// iOS treats pointerup/touchend (not touchstart) as the gesture that may start audio.
$('#welcomeStart').addEventListener('click', startApp);
welcome.addEventListener('pointerup', startApp);

// ---------------------------------------------------------------- iPad: no zoom, no stray scrolling
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => { if (!e.target.closest('input, .panel-body')) e.preventDefault(); });
document.addEventListener('touchmove', (e) => {
  if (e.target.closest('.swara-key, .joystick')) e.preventDefault();
}, { passive: false });

// ---------------------------------------------------------------- initial render
setRagam(S.ragam, { fromUser: false });
renderKattai();
renderTalamStrip();
renderLearn();
drawViz();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
