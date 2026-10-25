// Shared 8-way joystick used by JahanChord and Swarapetti.
// Pointer Events cover touch, mouse, pen and trackpad. One pointer drives the
// stick (captured, so dragging continues outside it) while other pointers stay
// free for the buttons. Latch mode keeps the stick where it was left.

export const DIRS = ['c', 'u', 'd', 'l', 'r', 'ul', 'ur', 'dl', 'dr'];
const DIR_BY_SECTOR = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur'];
export const DIR_ANGLE = { r: 0, dr: 45, d: 90, dl: 135, l: 180, ul: 225, u: 270, ur: 315 };

const KEY_DIR = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r',
};

// Pure helpers (unit tested).
export function vectorToDir(dx, dy, radius, current = 'c', deadzone = 0.38) {
  const dist = Math.hypot(dx, dy);
  if (dist < radius * deadzone) return 'c';
  const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  // Hysteresis so it doesn't flicker on the diagonals.
  if (current !== 'c') {
    const diff = Math.abs(((ang - DIR_ANGLE[current] + 540) % 360) - 180);
    if (diff < 22.5 + 7) return current;
  }
  return DIR_BY_SECTOR[Math.round(ang / 45) % 8];
}

export function keysToDir(held) {
  const u = held.has('u'); const d = held.has('d'); const l = held.has('l'); const r = held.has('r');
  const v = u && !d ? 'u' : d && !u ? 'd' : '';
  const h = l && !r ? 'l' : r && !l ? 'r' : '';
  return (v + h) || 'c';
}

export function dirToVector(dir, length) {
  if (dir === 'c') return [0, 0];
  const a = DIR_ANGLE[dir] * Math.PI / 180;
  return [Math.cos(a) * length, Math.sin(a) * length];
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

/**
 * el: the stick's hit area. well: the circular well (used for its centre).
 * knob: element moved with translate(). lockBtn: optional latch toggle.
 * radius: max knob travel in layout px. getScale(): current CSS scale of the device.
 * onChange(dir, source): called when the direction changes.
 */
export function createJoystick({
  el, well, knob, lockBtn = null, radius = 52, getScale = () => 1,
  onChange = () => {}, onLatch = () => {}, keyboard = true, enabled = () => true,
}) {
  let dir = 'c';
  let latched = false;
  let pointerId = null;
  let down = null; // { x, y, t, moved }
  let lastTap = { t: 0, x: 0, y: 0 };
  const heldKeys = new Set();

  function place(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function set(next, source) {
    if (next === dir) return;
    dir = next;
    el.dataset.dir = dir;
    onChange(dir, source);
  }

  function center(source = 'center') {
    el.classList.remove('dragging');
    place(0, 0);
    set('c', source);
  }

  function setLatch(on) {
    latched = on;
    el.classList.toggle('latched', on);
    if (lockBtn) {
      lockBtn.setAttribute('aria-pressed', String(on));
      lockBtn.classList.toggle('on', on);
    }
    if (!on && pointerId === null && heldKeys.size === 0) center('unlatch');
    onLatch(on);
  }

  function fromPointer(e) {
    const r = well.getBoundingClientRect();
    const s = getScale() || 1;
    let dx = (e.clientX - (r.left + r.width / 2)) / s;
    let dy = (e.clientY - (r.top + r.height / 2)) / s;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) { dx *= radius / dist; dy *= radius / dist; }
    return { dx, dy };
  }

  function move(e) {
    const { dx, dy } = fromPointer(e);
    place(dx, dy);
    set(vectorToDir(dx, dy, radius, dir), 'pointer');
  }

  el.addEventListener('pointerdown', (e) => {
    if (lockBtn && lockBtn.contains(e.target)) return;
    if (!enabled()) return;
    if (e.button !== undefined && e.button > 0) return; // ignore right/middle click
    e.preventDefault();
    if (pointerId !== null) return; // one pointer drives the stick
    pointerId = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.add('dragging');
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    move(e);
  });

  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
    move(e);
  });

  function release(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    el.classList.remove('dragging');
    const now = performance.now();
    const tap = down && !down.moved && now - down.t < 350;
    const { dx, dy } = fromPointer(e);
    const nearCentre = Math.hypot(dx, dy) < radius * 0.38;
    // A double tap only counts when both taps land in about the same place.
    const doubleTap = tap && now - lastTap.t < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24;
    if (tap) lastTap = { t: now, x: e.clientX, y: e.clientY };
    down = null;
    if (!latched) { center('release'); return; }
    // Latched: stay put, unless it was a tap on the centre or a double tap.
    if ((tap && nearCentre) || doubleTap) center('tap');
  }
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  el.addEventListener('dblclick', (e) => { e.preventDefault(); center('dblclick'); });

  if (lockBtn) {
    lockBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    lockBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setLatch(!latched); });
  }

  function applyKeys() {
    const next = keysToDir(heldKeys);
    if (next === 'c' && latched) return; // latched: keep the last direction
    const [x, y] = dirToVector(next, radius * 0.85);
    place(x, y);
    set(next, 'keyboard');
  }

  if (keyboard) {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'l' || e.key === 'L') { if (!e.repeat) setLatch(!latched); e.preventDefault(); return; }
      const k = KEY_DIR[e.key];
      if (!k || !enabled()) return;
      e.preventDefault();
      if (e.repeat) return;
      heldKeys.add(k);
      applyKeys();
    });
    window.addEventListener('keyup', (e) => {
      const k = KEY_DIR[e.key];
      if (!k) return;
      heldKeys.delete(k);
      applyKeys();
    });
    window.addEventListener('blur', () => { heldKeys.clear(); if (!latched) center('blur'); });
  }

  el.dataset.dir = 'c';
  return {
    get dir() { return dir; },
    get latched() { return latched; },
    setLatch,
    center,
    setDir(next) { const [x, y] = dirToVector(next, radius * 0.85); place(x, y); set(next, 'api'); },
  };
}
