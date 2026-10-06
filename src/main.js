import './style.css';
import {
  KEYS, ROMAN, DIRECTION_LABELS, buildChord, voiceChord, spellVoiced, keyName,
} from './theory.js';
import { Engine, ARP_MODES, ARP_LABELS } from './audio.js';
import { PRESETS, presetIndex } from './presets.js';
import { KITS, BEATS } from './drums.js';
import { LESSONS, tipOfTheDay } from './lessons.js';
import { Commentary } from './commentary.js';
import { store, save, saveNow, dayString } from './storage.js';

const $ = (sel) => document.querySelector(sel);
const S = store.settings;
const engine = new Engine();
window.__jc = { engine, store }; // handy for debugging in the console

// ---------------------------------------------------------------- visits
const today = dayString();
const isNewDay = !!store.stats.lastVisitDay && store.stats.lastVisitDay !== today;
if (!store.stats.firstVisit) store.stats.firstVisit = Date.now();
store.stats.visits += 1;
store.stats.lastVisitDay = today;
save();

// ---------------------------------------------------------------- toasts
const toastBox = $('#toasts');
function showToast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastBox.replaceChildren(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.classList.remove('show'), 4000);
  setTimeout(() => el.remove(), 4600);
}
const commentary = new Commentary({ store, save, show: showToast });

// ---------------------------------------------------------------- layout: scale the device to fit
const device = $('#device');
const stage = $('#stage');
const LAYOUTS = { landscape: [1100, 640], portrait: [760, 1010] };
const TOAST_SPACE = 70; // bottom strip reserved for toasts so they never cover a button
let scale = 1;
function fit() {
  const w = stage.clientWidth - 24;
  const h = stage.clientHeight - TOAST_SPACE - 8;
  let best = null;
  for (const [name, [dw, dh]] of Object.entries(LAYOUTS)) {
    const s = Math.min(w / dw, h / dh);
    if (!best || s > best.s * 1.04) best = { name, s, dw, dh };
  }
  scale = Math.max(0.2, best.s);
  device.classList.toggle('landscape', best.name === 'landscape');
  device.classList.toggle('portrait', best.name === 'portrait');
  const left = (stage.clientWidth - best.dw * scale) / 2;
  const top = Math.max(4, (stage.clientHeight - TOAST_SPACE - best.dh * scale) / 2);
  device.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
}
new ResizeObserver(fit).observe(stage);
window.addEventListener('orientationchange', () => setTimeout(fit, 250));

// ---------------------------------------------------------------- chord buttons
const chordsEl = $('#chords');
const QUALITY = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const chordBtns = [];
for (let d = 1; d <= 7; d++) {
  const b = document.createElement('div');
  b.className = 'chord';
  b.dataset.deg = d;
  b.dataset.q = QUALITY[d - 1];
  b.innerHTML = `<i class="led"></i><div class="cap"><span class="roman">${ROMAN[d - 1]}</span><span class="num">${d}</span><span class="cname"></span></div>`;
  chordsEl.appendChild(b);
  chordBtns.push(b);
}

// ---------------------------------------------------------------- playing state
let joyDir = 'c';
const held = []; // [{ deg, id }] most recent last
let current = null; // { deg, dir, chord, voicing }
let lastShown = null;
let prevUpper = null;
let started = false;

const ARROW = { c: '', u: '↑', d: '↓', l: '←', r: '→', ul: '↖', ur: '↗', dl: '↙', dr: '↘' };

function playChord(deg, dir, legato) {
  const chord = buildChord(S.key, deg, dir);
  const voicing = voiceChord(chord, prevUpper);
  prevUpper = voicing.upper;
  current = { deg, dir, chord, voicing };
  lastShown = current;
  if (started) engine.liveChordOn(voicing, { legato });
  renderActive();
  renderScreen();
  onChordPlayed(deg, dir, chord, legato);
}

function pressChord(deg, id) {
  if (!started) return;
  held.push({ deg, id });
  chordBtns[deg - 1].classList.add('down');
  commentary.notePress();
  playChord(deg, joyDir, false);
}

function releaseChord(id) {
  const i = held.findIndex((h) => h.id === id);
  if (i < 0) return;
  const [h] = held.splice(i, 1);
  if (!held.some((x) => x.deg === h.deg)) chordBtns[h.deg - 1].classList.remove('down');
  if (!held.length) {
    current = null;
    engine.liveChordOff();
    renderActive();
    renderScreen();
    onChordReleased();
  } else if (i === held.length) {
    // Released the sounding chord while another is still held: go back to that one.
    playChord(held[held.length - 1].deg, joyDir, false);
  }
}

function setJoyDir(dir) {
  if (dir === joyDir) return;
  joyDir = dir;
  document.querySelectorAll('.jl').forEach((el) => el.classList.toggle('on', el.classList.contains(dir)));
  if (current) playChord(current.deg, dir, true);
  else renderScreen();
  renderButtonNames();
}

function renderActive() {
  chordBtns.forEach((b, i) => b.classList.toggle('active', !!current && current.deg === i + 1));
}

function renderButtonNames() {
  chordBtns.forEach((b, i) => {
    b.querySelector('.cname').textContent = buildChord(S.key, i + 1, joyDir).display;
  });
}

for (const b of chordBtns) {
  const deg = Number(b.dataset.deg);
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pressChord(deg, `p${e.pointerId}`);
  });
  const up = (e) => releaseChord(`p${e.pointerId}`);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
}

// ---------------------------------------------------------------- joystick
const joy = $('#joy');
const knob = $('#joyKnob');
let joyPointer = null;
const DIR_BY_SECTOR = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur'];
const DIR_ANGLE = { r: 0, dr: 45, d: 90, dl: 135, l: 180, ul: 225, u: 270, ur: 315 };

function joyMove(e) {
  const well = joy.querySelector('.joy-well').getBoundingClientRect();
  const cx = well.left + well.width / 2;
  const cy = well.top + well.height / 2;
  let dx = (e.clientX - cx) / scale;
  let dy = (e.clientY - cy) / scale;
  const R = 52;
  const dist = Math.hypot(dx, dy);
  if (dist > R) { dx *= R / dist; dy *= R / dist; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  if (dist < R * 0.38) { setJoyDir('c'); return; }
  const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  // A little hysteresis so it doesn't flicker on the diagonals.
  if (joyDir !== 'c') {
    const diff = Math.abs(((ang - DIR_ANGLE[joyDir] + 540) % 360) - 180);
    if (diff < 22.5 + 7) return;
  }
  setJoyDir(DIR_BY_SECTOR[Math.round(ang / 45) % 8]);
}
function joyRelease(e) {
  if (e.pointerId !== joyPointer) return;
  joyPointer = null;
  joy.classList.remove('dragging');
  knob.style.transform = 'translate(0px, 0px)';
  setJoyDir('c');
}
joy.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (joyPointer !== null) return;
  joyPointer = e.pointerId;
  try { joy.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  joy.classList.add('dragging');
  joyMove(e);
});
joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) joyMove(e); });
joy.addEventListener('pointerup', joyRelease);
joy.addEventListener('pointercancel', joyRelease);
joy.addEventListener('lostpointercapture', joyRelease);

// ---------------------------------------------------------------- keyboard (for laptops)
const arrows = new Set();
function arrowsToDir() {
  const u = arrows.has('ArrowUp'); const d = arrows.has('ArrowDown');
  const l = arrows.has('ArrowLeft'); const r = arrows.has('ArrowRight');
  const v = u && !d ? 'u' : d && !u ? 'd' : '';
  const h = l && !r ? 'l' : r && !l ? 'r' : '';
  return (v + h) || 'c';
}
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey) return;
  if (!started && (e.key === 'Enter' || e.key === ' ')) { startApp(); return; }
  if (/^[1-7]$/.test(e.key)) { pressChord(Number(e.key), `k${e.key}`); e.preventDefault(); }
  if (e.key.startsWith('Arrow')) {
    arrows.add(e.key);
    const dir = arrowsToDir();
    const a = DIR_ANGLE[dir];
    knob.style.transform = dir === 'c' ? '' : `translate(${Math.cos(a * Math.PI / 180) * 44}px, ${Math.sin(a * Math.PI / 180) * 44}px)`;
    setJoyDir(dir);
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  if (/^[1-7]$/.test(e.key)) releaseChord(`k${e.key}`);
  if (e.key.startsWith('Arrow')) {
    arrows.delete(e.key);
    const dir = arrowsToDir();
    const a = DIR_ANGLE[dir];
    knob.style.transform = dir === 'c' ? 'translate(0px, 0px)' : `translate(${Math.cos(a * Math.PI / 180) * 44}px, ${Math.sin(a * Math.PI / 180) * 44}px)`;
    setJoyDir(dir);
  }
});

// ---------------------------------------------------------------- screen
const scr = {
  key: $('#scrKey'), preset: $('#scrPreset'), bpm: $('#scrBpm'), arp: $('#scrArp'),
  roman: $('#scrRoman'), chord: $('#scrChord'), mod: $('#scrMod'), notes: $('#scrNotes'),
  beats: [...document.querySelectorAll('#scrBeats i')], drums: $('#scrDrums'), loop: $('#scrLoop'), guide: $('#scrGuide'),
};
let flashUntil = 0;
let flashTimer = null;

// LCD text with flats/sharps drawn in a font that has them.
function lcd(el, text) {
  el.innerHTML = esc(text).replace(/[♭♯𝄪𝄫]/g, (m) => `<span class="acc">${m}</span>`);
}

function renderStatus() {
  lcd(scr.key, `KEY ${keyName(S.key)}`);
  $('#fnKey').textContent = keyName(S.key);
  $('#fnSound').textContent = PRESETS[presetIndex(S.preset)].name.split(' ').pop();
  $('#fnArp').textContent = S.arp === 'off' ? 'Off' : ARP_LABELS[S.arp][0] + ARP_LABELS[S.arp].slice(1).toLowerCase();
  scr.preset.textContent = PRESETS[presetIndex(S.preset)].short;
  scr.bpm.textContent = `${S.bpm} BPM`;
  scr.arp.textContent = `ARP ${ARP_LABELS[S.arp]}`;
  scr.drums.textContent = drumsOn ? `DRUMS ${KITS.find((k) => k.id === S.kit).name.toUpperCase()}` : '';
}

function renderScreen() {
  const show = current || lastShown;
  if (show && (current || joyDir === 'c')) {
    const { chord, voicing, dir } = show;
    lcd(scr.chord, chord.display);
    scr.chord.classList.toggle('idle', !current);
    scr.chord.classList.toggle('long', chord.display.length > 7);
    scr.roman.textContent = ROMAN[chord.degree - 1];
    scr.mod.textContent = dir === 'c' ? '' : `${ARROW[dir]}${DIRECTION_LABELS[dir]}`;
    if (Date.now() > flashUntil) {
      lcd(scr.notes, S.showNotes ? voicing.all.map((m) => spellVoiced(chord, m)).join(' ').replace(/##/g, '𝄪').replace(/#/g, '♯').replace(/([A-G])bb/g, '$1𝄫').replace(/([A-G])b/g, '$1♭') : '');
    }
  } else if (joyDir !== 'c') {
    // Stick held, no chord: preview what it will do.
    scr.chord.textContent = DIRECTION_LABELS[joyDir];
    scr.chord.classList.add('idle');
    scr.chord.classList.remove('long');
    scr.roman.textContent = '';
    scr.mod.textContent = ARROW[joyDir];
  } else {
    scr.chord.textContent = 'ready';
    scr.chord.classList.add('idle');
    scr.roman.textContent = '';
    scr.mod.textContent = '';
  }
}

function flash(text) {
  flashUntil = Date.now() + 1600;
  lcd(scr.notes, text);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flashUntil = 0; renderScreen(); if (!current && !lastShown) scr.notes.textContent = ''; }, 1650);
}

engine.on('beat', ({ beat, countdown }) => {
  scr.beats.forEach((el, i) => el.classList.toggle('on', i === beat));
  if (countdown !== undefined) scr.loop.textContent = `REC IN ${countdown}`;
});

// ---------------------------------------------------------------- function buttons
function pressable(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('down');
    if (!started) return;
    fn(e);
  });
  const up = () => el.classList.remove('down');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}

const keyIds = KEYS.map((k) => k.id);
function setKey(id, fromUser = true) {
  S.key = id;
  prevUpper = null;
  save();
  renderButtonNames();
  renderStatus();
  renderKeyGrid();
  if (current) playChord(current.deg, joyDir, true);
  else { lastShown = null; renderScreen(); }
  flash(`KEY OF ${keyName(id)} MAJOR`);
  if (fromUser) { session.keyChanges++; if (session.keyChanges === 6) commentary.fire('keyHopping'); lessonEvent('key'); }
}

pressable($('#keyBtn'), () => setKey(keyIds[(keyIds.indexOf(S.key) + 1) % keyIds.length]));

pressable($('#soundBtn'), () => {
  const p = PRESETS[(presetIndex(S.preset) + 1) % PRESETS.length];
  S.preset = p.id;
  save();
  engine.setPreset(p.id);
  renderStatus();
  flash(`SOUND: ${p.name.toUpperCase()}`);
  session.presets.add(p.id);
  if (session.presets.size === PRESETS.length) commentary.fire('allPresets');
  checkLofiCombo();
  lessonEvent('preset');
});

pressable($('#arpBtn'), () => {
  S.arp = ARP_MODES[(ARP_MODES.indexOf(S.arp) + 1) % ARP_MODES.length];
  save();
  engine.setArp(S.arp);
  renderStatus();
  flash(`ARPEGGIATOR: ${ARP_LABELS[S.arp]}`);
  if (S.arp !== 'off') commentary.fire('firstArp');
  lessonEvent('arp');
});

// ---------------------------------------------------------------- strip: drums
let drumsOn = false;
const drumsBtn = $('#drumsBtn');
function renderDrums() {
  drumsBtn.classList.toggle('on', drumsOn);
  $('#kitVal').textContent = KITS.find((k) => k.id === S.kit).name;
  $('#beatVal').textContent = BEATS.find((b) => b.id === S.beat).name;
  renderStatus();
}
pressable(drumsBtn, () => {
  drumsOn = !drumsOn;
  engine.setDrums(drumsOn);
  renderDrums();
  if (drumsOn) { commentary.fire('firstDrums'); checkLofiCombo(); }
  lessonEvent('drums');
});
pressable($('#kitBtn'), () => {
  const i = KITS.findIndex((k) => k.id === S.kit);
  S.kit = KITS[(i + 1) % KITS.length].id;
  save();
  engine.setKit(S.kit);
  renderDrums();
  flash(`KIT: ${KITS.find((k) => k.id === S.kit).name.toUpperCase()}`);
  checkLofiCombo();
  lessonEvent('kit');
});
pressable($('#beatBtn'), () => {
  const i = BEATS.findIndex((b) => b.id === S.beat);
  S.beat = BEATS[(i + 1) % BEATS.length].id;
  save();
  engine.setBeat(S.beat);
  renderDrums();
  flash(`BEAT: ${BEATS.find((b) => b.id === S.beat).name.toUpperCase()}`);
  lessonEvent('beat');
});

// ---------------------------------------------------------------- strip: looper + drop
const recBtn = $('#recBtn');
const playBtn = $('#playBtn');
const clearBtn = $('#clearBtn');
const dropBtn = $('#dropBtn');
let loopState = 'empty';
let dropState = 'in';
pressable(recBtn, () => engine.loopRec());
pressable(playBtn, () => engine.loopPlay());
pressable(clearBtn, () => engine.clearLoop());
pressable(dropBtn, () => {
  if (dropState === 'out') engine.setDrop(false);
  else if (dropState === 'in') engine.setDrop(true);
});

function renderLoop(info) {
  loopState = info.state;
  recBtn.classList.toggle('blink', info.state === 'countin');
  recBtn.classList.toggle('on', info.state === 'recording');
  playBtn.classList.toggle('on', info.state === 'playing');
  playBtn.disabled = !(info.state === 'playing' || info.state === 'stopped');
  clearBtn.disabled = info.state === 'empty';
  scr.loop.classList.toggle('scr-blink', info.state === 'recording');
  scr.loop.textContent = {
    empty: '', countin: 'REC IN 4', recording: '● REC',
    playing: `LOOP ${info.bars} BAR${info.bars > 1 ? 'S' : ''}`, stopped: 'LOOP STOPPED',
  }[info.state];
}
engine.on('loop', renderLoop);
engine.on('looprecorded', () => {
  session.loops++;
  if (commentary.wouldFire('firstLoop')) commentary.fire('firstLoop');
  else commentary.fire('loop');
  lessonEvent('loop:recorded');
});
engine.on('drop', ({ state }) => {
  dropState = state;
  dropBtn.classList.toggle('on', state === 'out');
  dropBtn.classList.toggle('blink', state === 'waiting');
  if (state === 'out') { flash('DROP: TAP AGAIN TO BRING IT BACK'); lessonEvent('drop:out'); }
  if (state === 'waiting') flash('BACK IN ON THE NEXT BAR...');
  if (state === 'in') { commentary.fire('drop'); lessonEvent('drop:in'); }
});
renderLoop(engine.loopInfo());

// ---------------------------------------------------------------- faders
function makeFader(el, { min, max, step, get, set, format }) {
  const track = el.querySelector('.fader-track');
  const cap = el.querySelector('.fader-cap');
  const fill = el.querySelector('.fader-fill');
  const val = el.querySelector('b');
  let pid = null;
  const render = () => {
    const f = (get() - min) / (max - min);
    cap.style.left = `${f * 100}%`;
    fill.style.width = `${f * 100}%`;
    val.textContent = format(get());
  };
  const fromEvent = (e) => {
    const r = track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = Math.round((min + f * (max - min)) / step) * step;
    if (v !== get()) set(v);
    render();
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(pid); } catch { /* ignore */ }
    el.classList.add('dragging');
    fromEvent(e);
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === pid) fromEvent(e); });
  const end = (e) => { if (e.pointerId === pid) { pid = null; el.classList.remove('dragging'); } };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  render();
  return { render };
}

let tempoSettle = null;
makeFader($('#volFader'), {
  min: 0, max: 1, step: 0.01, get: () => S.volume,
  set: (v) => {
    S.volume = v; save(); engine.setVolume(v);
    if (v >= 1) commentary.fire('maxVolume');
  },
  format: (v) => Math.round(v * 100),
});
makeFader($('#tempoFader'), {
  min: 60, max: 160, step: 1, get: () => S.bpm,
  set: (v) => {
    S.bpm = v; save(); if (started) engine.setBpm(v); renderStatus();
    clearTimeout(tempoSettle);
    tempoSettle = setTimeout(() => {
      if (S.bpm >= 160) commentary.fire('tempoMax');
      if (S.bpm <= 60) commentary.fire('tempoMin');
      lessonEvent('tempo');
    }, 600);
  },
  format: (v) => v,
});

// ---------------------------------------------------------------- settings sheet
const settingsEl = $('#settings');
function openSettings(open) {
  settingsEl.classList.toggle('open', open);
  settingsEl.setAttribute('aria-hidden', String(!open));
  $('#settingsBtn').classList.toggle('on', open);
}
$('#settingsBtn').addEventListener('click', () => openSettings(!settingsEl.classList.contains('open')));
$('#settingsClose').addEventListener('click', () => openSettings(false));
settingsEl.addEventListener('click', (e) => { if (e.target === settingsEl) openSettings(false); });

function renderKeyGrid() {
  const grid = $('#keyGrid');
  if (!grid.children.length) {
    for (const k of KEYS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = keyName(k.id);
      b.dataset.key = k.id;
      b.addEventListener('click', () => setKey(k.id));
      grid.appendChild(b);
    }
  }
  grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.key === S.key));
}
function renderArpRate() {
  $('#arpRateSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.arpRate));
}
$('#arpRateSeg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  S.arpRate = b.dataset.v; save(); engine.setArpRate(S.arpRate); renderArpRate();
}));
const optCommentary = $('#optCommentary');
optCommentary.checked = S.commentary;
optCommentary.addEventListener('change', () => { S.commentary = optCommentary.checked; save(); });
const optNotes = $('#optNotes');
optNotes.checked = S.showNotes;
optNotes.addEventListener('change', () => { S.showNotes = optNotes.checked; save(); renderScreen(); });
$('#resetLessons').addEventListener('click', () => {
  store.lessons.done = [];
  store.lessons.current = null;
  save();
  lesson = null;
  renderLearn();
  applyGuide();
  $('#resetLessons').textContent = 'Lesson progress reset';
});

// ---------------------------------------------------------------- learn panel + guide mode
const learnEl = $('#learn');
const learnBody = $('#learnBody');
let lesson = null; // { def, step, done, guideIdx }

function openLearn(open) {
  learnEl.classList.toggle('open', open);
  learnEl.setAttribute('aria-hidden', String(!open));
  $('#learnBtn').classList.toggle('on', open);
  if (!open && lesson && !lesson.done) applyGuide();
}
$('#learnBtn').addEventListener('click', () => openLearn(!learnEl.classList.contains('open')));
$('#learnClose').addEventListener('click', () => openLearn(false));
learnEl.addEventListener('transitionend', fit);

function fill(text) {
  return text.replace(/\{(\d)(c|u|d|l|r|ul|ur|dl|dr)\}/g, (_, deg, dir) => buildChord(S.key, Number(deg), dir).display);
}
function chordLabel(deg, dir) {
  return `${deg}${dir === 'c' ? '' : ' ' + ARROW[dir]}  ${buildChord(S.key, deg, dir).display}`;
}
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function startLesson(id) {
  const def = LESSONS.find((l) => l.id === id);
  lesson = { def, step: 0, done: false, guideIdx: 0 };
  store.lessons.current = id;
  save();
  enterStep();
}

function currentStep() { return lesson && !lesson.done ? lesson.def.steps[lesson.step] : null; }

function enterStep() {
  lesson.guideIdx = 0;
  renderLearn();
  applyGuide();
  const st = currentStep();
  if (st && st.wait && waitSatisfied(st.wait)) setTimeout(() => { if (currentStep() === st) advance(); }, 900);
}

function advance() {
  if (!lesson || lesson.done) return;
  lesson.step++;
  if (lesson.step >= lesson.def.steps.length) {
    lesson.done = true;
    const first = store.lessons.done.length === 0;
    if (!store.lessons.done.includes(lesson.def.id)) store.lessons.done.push(lesson.def.id);
    store.lessons.current = null;
    save();
    if (store.lessons.done.length === LESSONS.length && commentary.wouldFire('allLessons')) commentary.fire('allLessons');
    else if (first || commentary.wouldFire('firstLesson')) commentary.fire('firstLesson');
    else commentary.fire('lesson');
    renderLearn();
    applyGuide();
    return;
  }
  enterStep();
}

function waitSatisfied(w) {
  const [what, arg] = w.split(':');
  switch (what) {
    case 'preset': return S.preset === arg;
    case 'drums': return drumsOn;
    case 'arp': return S.arp !== 'off';
    case 'kit': return S.kit === arg;
    case 'beat': return S.beat === arg;
    case 'tempo': { const [lo, hi] = arg.split('-').map(Number); return S.bpm >= lo && S.bpm <= hi; }
    default: return false;
  }
}

function lessonEvent(type) {
  const st = currentStep();
  if (!st || !st.wait) return;
  if (st.wait === type || (st.wait.startsWith(type + ':') && waitSatisfied(st.wait)) || (type === st.wait.split(':')[0] && waitSatisfied(st.wait))) {
    setTimeout(advance, 350);
  }
}

function lessonChord(deg, dir) {
  const st = currentStep();
  if (!st) return;
  if (st.play && st.play[0] === deg && st.play[1] === dir) { setTimeout(advance, 250); return; }
  if (st.guide) {
    const want = st.guide[lesson.guideIdx % st.guide.length];
    if (want[0] === deg && want[1] === dir) { lesson.guideIdx++; applyGuide(); renderLearn(); }
  }
}

function applyGuide() {
  chordBtns.forEach((b) => b.classList.remove('guide'));
  document.querySelectorAll('.hint').forEach((el) => el.classList.remove('hint'));
  const g = $('#joyGuide');
  g.classList.remove('show');
  scr.guide.textContent = '';
  const st = currentStep();
  if (!st) return;
  let want = st.play;
  if (!want && st.guide) want = st.guide[lesson.guideIdx % st.guide.length];
  if (want) {
    chordBtns[want[0] - 1].classList.add('guide');
    scr.guide.textContent = `NEXT ${want[0]}${ARROW[want[1]]}`;
    if (want[1] !== 'c') {
      const a = DIR_ANGLE[want[1]] * Math.PI / 180;
      g.style.setProperty('--gx', `${Math.cos(a) * 52}px`);
      g.style.setProperty('--gy', `${Math.sin(a) * 52}px`);
      g.classList.add('show');
    }
  }
  if (st.highlight) {
    const el = document.querySelector(`[data-hint="${st.highlight}"]`);
    if (el) el.classList.add('hint');
  }
}

function renderLearn() {
  if (!lesson) {
    $('#learnTitle').textContent = 'Learn';
    const items = LESSONS.map((l, i) => {
      const done = store.lessons.done.includes(l.id);
      return `<button class="lesson-item ${done ? 'done' : ''}" data-id="${l.id}" type="button">
        <span class="n">${done ? '✓' : i + 1}</span>
        <span><b>${esc(l.title)}</b><span>${esc(l.blurb)}</span></span></button>`;
    }).join('');
    learnBody.innerHTML = `<p class="lesson-intro">Short and hands-on. Follow the glowing button, the lesson moves on when you play it.</p>${items}`;
    learnBody.querySelectorAll('.lesson-item').forEach((b) => b.addEventListener('click', () => startLesson(b.dataset.id)));
    return;
  }
  const { def } = lesson;
  $('#learnTitle').textContent = def.title;
  const total = def.steps.length;
  const bar = def.steps.map((_, i) => `<i class="${i < lesson.step || lesson.done ? 'on' : ''}"></i>`).join('');
  let html = `<div class="progress">${bar}</div>`;
  if (lesson.done) {
    html += `<div class="outro"><b>Done.</b> ${esc(fill(def.outro))}</div>
      <div class="lesson-actions">
        <button class="plain primary" id="lsNext" type="button">Next lesson</button>
        <button class="plain" id="lsAgain" type="button">Do it again</button>
        <button class="plain" id="lsBack" type="button">All lessons</button>
      </div>`;
  } else {
    const st = def.steps[lesson.step];
    if (lesson.step === 0) html += `<p class="lesson-intro">${esc(fill(def.intro))}</p>`;
    html += `<div class="step-card"><p class="say">${esc(fill(st.say))}</p>`;
    if (st.play) html += `<span class="wantchip">${esc(chordLabel(st.play[0], st.play[1]))}</span>`;
    html += '</div>';
    const prog = st.guide || progressionAround(lesson.step);
    if (prog) {
      const idx = st.guide ? lesson.guideIdx % st.guide.length : prog.cur;
      const list = st.guide || prog.list;
      html += `<div class="chips">${list.map((p, i) => `<span class="${i === idx ? 'now' : i < idx ? 'past' : ''}">${esc(chordLabel(p[0], p[1]))}</span>`).join('')}</div>`;
    }
    html += `<div class="lesson-actions">
      ${st.next ? '<button class="plain primary" id="lsGo" type="button">Next</button>' : ''}
      <button class="plain" id="lsSkip" type="button">Skip step</button>
      <button class="plain" id="lsBack" type="button">All lessons</button>
    </div><p style="font-size:13px;color:var(--ink-soft);margin-top:12px">Step ${lesson.step + 1} of ${total}</p>`;
  }
  learnBody.innerHTML = html;
  const on = (id, fn) => { const el = learnBody.querySelector(id); if (el) el.addEventListener('click', fn); };
  on('#lsGo', advance);
  on('#lsSkip', advance);
  on('#lsBack', () => { lesson = null; store.lessons.current = null; save(); renderLearn(); applyGuide(); });
  on('#lsAgain', () => startLesson(def.id));
  on('#lsNext', () => {
    const i = LESSONS.findIndex((l) => l.id === def.id);
    if (i < LESSONS.length - 1) startLesson(LESSONS[i + 1].id);
    else { lesson = null; renderLearn(); applyGuide(); }
  });
}

// The run of consecutive "play" steps around the current one, shown as chips.
function progressionAround(stepIdx) {
  const steps = lesson.def.steps;
  if (!steps[stepIdx].play) return null;
  let a = stepIdx; let b = stepIdx;
  while (a > 0 && steps[a - 1].play) a--;
  while (b < steps.length - 1 && steps[b + 1].play) b++;
  if (b - a < 1) return null;
  return { list: steps.slice(a, b + 1).map((s) => s.play), cur: stepIdx - a };
}

// ---------------------------------------------------------------- commentary triggers
const session = {
  firstChord: false, presses: [], sameCount: 0, lastKey: null, extended: 0,
  keyChanges: 0, presets: new Set([S.preset]), loops: 0, activeSeconds: 0, lastPress: 0,
};
let susTimer = null;

function onChordPlayed(deg, dir, chord, legato) {
  store.stats.chords++;
  save();
  session.lastPress = Date.now();
  lessonChord(deg, dir);

  if (!session.firstChord) {
    session.firstChord = true;
    if (commentary.wouldFire('firstChord')) commentary.fire('firstChord');
    else if (isNewDay) commentary.fire('nextDay');
  }
  const t = chord.typeId;
  if (['dim', 'm7b5', 'm9b5', 'dimadd9'].includes(t)) commentary.fire('dim');
  if (t === 'aug') commentary.fire('aug');
  if (['maj7', 'dom7', 'm7', 'maj9', 'dom9', 'm9'].includes(t)) {
    session.extended++;
    if (session.extended === 16) commentary.fire('dreamy');
  }
  clearTimeout(susTimer);
  if (t === 'sus4' || t === 'sus2') susTimer = setTimeout(() => { if (current && current.chord.typeId === t) commentary.fire('susHold'); }, 7000);

  const hour = new Date().getHours();
  if (hour >= 2 && hour < 5) commentary.fire('lateLate');
  if (hour < 5) commentary.fire('midnight');

  if (legato) return;
  const key = `${deg}${dir}`;
  session.sameCount = key === session.lastKey ? session.sameCount + 1 : 1;
  session.lastKey = key;
  if (session.sameCount === 20) commentary.fire('sameChord');
  // Progression detection on button numbers (repeats of the same button collapse).
  const p = session.presses;
  if (p[p.length - 1] !== deg) p.push(deg);
  if (p.length > 8) p.shift();
  const tail = p.slice(-4).join('');
  if (tail === '1564') commentary.fire('pop');
  if (tail === '6415') commentary.fire('sad');
}

function onChordReleased() { clearTimeout(susTimer); }

function checkLofiCombo() {
  if (S.preset === 'lofi' && S.kit === 'lofi' && drumsOn) commentary.fire('lofiCombo');
}

// Playing time: counts only while he's actually playing.
setInterval(() => {
  if (!started || document.hidden) return;
  if (Date.now() - session.lastPress > 45000 && !current) return;
  session.activeSeconds += 5;
  store.stats.totalSeconds += 5;
  save();
  const a = session.activeSeconds;
  if (a >= 600) commentary.fire('tenMinutes');
  if (a >= 1800) commentary.fire('thirtyMinutes');
  if (a >= 2700) commentary.fire('fortyFive');
  if (a >= 3600) commentary.fire('hour');
}, 5000);

// ---------------------------------------------------------------- iPad: no zoom, no scroll
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if (!e.target.closest('.panel-body, .sheet-body')) e.preventDefault();
}, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pagehide', saveNow);

// ---------------------------------------------------------------- welcome + start
$('#tipText').textContent = tipOfTheDay();
if (store.stats.visits > 1) $('#welcomeSub').textContent = isNewDay ? 'Welcome back. It is still free.' : 'Welcome back.';
const welcome = $('#welcome');

function startApp() {
  if (started) return;
  started = true;
  engine.start(S);
  welcome.classList.add('gone');
  setTimeout(() => welcome.remove(), 600);
  renderStatus();
  if (store.lessons.current && LESSONS.some((l) => l.id === store.lessons.current)) {
    startLesson(store.lessons.current);
  }
}
// iOS treats touchend/pointerup (not touchstart) as the gesture that may start audio.
welcome.addEventListener('pointerup', startApp);
welcome.addEventListener('click', startApp);

// ---------------------------------------------------------------- initial render
renderButtonNames();
renderStatus();
renderDrums();
renderScreen();
renderKeyGrid();
renderArpRate();
renderLearn();
fit();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
