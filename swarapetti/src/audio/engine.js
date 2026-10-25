// Swarapetti audio engine: context and iPad unlock, master chain and reverb,
// monophonic melody channels with gamakas, drone, percussion, talam clock and
// looper. Plain Web Audio, no libraries.
import { startNote, voiceById } from './voices.js';
import { Drone } from './drone.js';
import { Percussion } from './percussion.js';
import { renderImpulse } from './render.js';
import { gamakaContour, GAMAKAS } from '../theory/gamaka.js';
import { talamById, nadaiById, kalamById, stepsPerBeat, percussionPattern } from '../theory/talam.js';

// ---------- iPad: play with the silent switch on ----------
let silentEl = null;
function silentWavUrl() {
  const n = 4000;
  const buf = new ArrayBuffer(44 + n);
  const dv = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
export function unlockAudioSession() {
  // Safari 16.4+: declare this as music playback so the silent switch doesn't mute it.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
  // Older iOS: a looping silent <audio> element moves the page into playback mode.
  try {
    if (!silentEl) {
      silentEl = document.createElement('audio');
      silentEl.setAttribute('playsinline', '');
      silentEl.setAttribute('x-webkit-airplay', 'deny');
      silentEl.loop = true;
      silentEl.src = silentWavUrl();
    }
    const p = silentEl.play();
    if (p && p.catch) p.catch(() => {});
  } catch { /* ignore */ }
}

const GLIDE = { veena: 0.06, violin: 0.075, venu: 0.06, nadaswaram: 0.06, harmonium: 0.03, keyboard: 0.05, vocal: 0.085 };

// ---------- a monophonic melody line ----------
class Channel {
  constructor(engine, out) {
    this.e = engine;
    this.out = out;
    this.note = null;
    this.cycle = null;
    this.release = null;
    this.timer = null;
    this.target = 0;
    this.nb = {};
  }

  get ctx() { return this.e.ctx; }

  startCycleTimer() {
    clearInterval(this.timer);
    if (!this.cycle) return;
    const extend = () => {
      const n = this.note;
      if (!n || n.released || !this.cycle) { clearInterval(this.timer); return; }
      while (n.track.end < this.ctx.currentTime + 0.35) n.track.append(n.track.end, this.cycle);
    };
    extend();
    this.timer = setInterval(extend, 60);
  }

  // Play a swara: cents above madhya Sa, the gamaka direction, neighbours.
  play({ cents, gamaka = 'c', nb = {}, voiceId, time, legato = false }) {
    const t = Math.max(time ?? this.ctx.currentTime, this.ctx.currentTime);
    const gid = GAMAKAS[gamaka]?.id || null;
    const c = gamakaContour(gid, cents, nb);
    this.target = cents; this.nb = nb;
    this.cycle = c.cycle; this.release = c.release;
    const def = voiceById(voiceId);
    const n = this.note;
    const canSlide = legato && n && !n.released && n.voiceId === voiceId
      && (def.legato === 'glide' || (def.legato === 'slide' && t - n.startedAt < 2.4));
    if (canSlide) {
      const from = n.track.valueAt(t);
      const g = GLIDE[voiceId] ?? 0.06;
      const first = c.points[0].c;
      const pts = [{ t: 0, c: from, ease: 'step' }, { t: g, c: first, ease: 's' }];
      for (const p of c.points.slice(1)) pts.push({ ...p, t: p.t + g });
      n.track.replace(t, pts);
    } else {
      if (n && !n.released) n.release(t);
      this.note = startNote(this.ctx, voiceId, this.out, (x) => this.e.hzOf(x, voiceId), c.points[0].c, t);
      if (c.points.length > 1) this.note.track.replace(t, c.points);
    }
    this.startCycleTimer();
    return this.note;
  }

  // The stick moved while a swara is held: apply the new gamaka from where the
  // pitch is now (or return to the plain swara).
  regamaka(gamaka, cents = this.target, nb = this.nb, time) {
    const n = this.note;
    if (!n || n.released) return;
    const t = Math.max(time ?? this.ctx.currentTime, this.ctx.currentTime);
    const gid = GAMAKAS[gamaka]?.id || null;
    const c = gamakaContour(gid, cents, nb);
    this.target = cents; this.nb = nb;
    this.cycle = c.cycle; this.release = c.release;
    const from = n.track.valueAt(t);
    const pts = [{ t: 0, c: from, ease: 'step' }, { t: 0.05, c: c.points[0].c, ease: 's' }];
    for (const p of c.points.slice(1)) pts.push({ ...p, t: p.t + 0.05 });
    n.track.replace(t, pts);
    this.startCycleTimer();
  }

  stop(time) {
    const n = this.note;
    if (!n || n.released) return;
    const t = Math.max(time ?? this.ctx.currentTime, this.ctx.currentTime);
    clearInterval(this.timer);
    this.cycle = null;
    if (this.release) {
      // Orikkai: flick up as the note ends.
      n.track.replace(t, this.release);
      const dur = this.release[this.release.length - 1].t;
      n.release(t + dur * 0.8);
    } else {
      n.track.replace(t, []); // freeze the pitch where it is
      n.release(t);
    }
  }
}

// ---------- the engine ----------
export class Engine {
  constructor() {
    this.started = false;
    this.listeners = {};
    this.sa = 138.59;
    this.voiceId = 'veena';
    this.talam = { running: false, tempo: 70, talamId: 'adi', nadaiId: 'chatusram', kalamId: 1, percussion: 'mridangam' };
    this.loop = { state: 'empty', events: [], cycles: 0 };
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); return () => { this.listeners[name] = this.listeners[name].filter((f) => f !== fn); }; }
  emit(name, data) { (this.listeners[name] || []).forEach((fn) => fn(data)); }

  // Must be called from a user gesture (pointerup / click).
  start() {
    if (this.started) return;
    this.started = true;
    unlockAudioSession();
    const AC = window.AudioContext || window.webkitAudioContext;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { this.ctx = new AC(); }
    this.ctx.resume?.();
    this.build();
    const resume = () => {
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      if (silentEl && silentEl.paused) silentEl.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(ev, resume, true);
    this.ctx.addEventListener?.('statechange', () => this.emit('state', this.ctx.state));
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.knee.value = 10;
    comp.attack.value = 0.01; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    const [L, R] = renderImpulse(ctx.sampleRate);
    const ir = ctx.createBuffer(2, L.length, ctx.sampleRate);
    ir.getChannelData(0).set(L); ir.getChannelData(1).set(R);
    this.reverb.buffer = ir;
    this.reverbReturn = ctx.createGain(); this.reverbReturn.gain.value = 0.9;
    this.reverb.connect(this.reverbReturn).connect(this.master);

    const bus = (send) => {
      const g = ctx.createGain();
      g.connect(this.master);
      const s = ctx.createGain(); s.gain.value = send;
      g.connect(s).connect(this.reverb);
      return { g, s };
    };
    this.melodyBus = bus(0.2);
    this.loopBus = bus(0.2);
    this.live = new Channel(this, this.melodyBus.g);
    this.loopCh = new Channel(this, this.loopBus.g);
    this.demoCh = new Channel(this, this.melodyBus.g);
    const droneBus = bus(0.12);
    this.drone = new Drone(ctx, droneBus.g);
    const percBus = bus(0.08);
    this.perc = new Percussion(ctx, percBus.g);
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 2048;
    this.master.connect(this.meter);
  }

  hzOf(cents, voiceId = this.voiceId) {
    return this.sa * 2 ** ((cents + 1200 * voiceById(voiceId).octave) / 1200);
  }

  setSa(hz) {
    this.sa = hz;
    if (!this.started) return;
    this.drone.configure({ sa: hz });
    this.perc.setSa(hz);
  }

  setVoice(id) {
    this.voiceId = id;
    if (this.started) this.melodyBus.s.gain.value = voiceById(id).reverb;
  }

  setMelodyVolume(v) { if (this.started) this.melodyBus.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  // ---------- live playing ----------
  noteOn(note) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.live.play({ ...note, voiceId: this.voiceId, time: t });
    this.record({ type: 'on', t, note: { ...note, voiceId: this.voiceId } });
  }
  regamaka(gamaka, cents, nb) {
    if (!this.started) return;
    this.live.regamaka(gamaka, cents, nb);
    this.record({ type: 'gamaka', t: this.ctx.currentTime, gamaka, cents, nb });
  }
  noteOff() {
    if (!this.started) return;
    this.live.stop();
    this.record({ type: 'off', t: this.ctx.currentTime });
  }

  // Demo playback (lessons): a sequence of { at (s from now), dur, cents, gamaka, nb }.
  playDemo(seq, voiceId = this.voiceId) {
    const t0 = this.ctx.currentTime + 0.08;
    for (const ev of seq) {
      this.demoCh.play({ ...ev, voiceId, time: t0 + ev.at, legato: ev.legato });
      this.demoCh.stop(t0 + ev.at + ev.dur);
    }
    return t0;
  }

  // ---------- drone ----------
  droneConfigure(opts) { if (this.started) this.drone.configure(opts); }
  droneOn(on) { if (this.started) this.drone.setOn(on); }
  droneVolume(v) { if (this.started) this.drone.setVolume(v); }

  // ---------- talam clock ----------
  setTalam(opts) {
    Object.assign(this.talam, opts);
    this.pattern = percussionPattern(talamById(this.talam.talamId), nadaiById(this.talam.nadaiId));
    if (this.started && opts.percussion) this.perc.prepare(opts.percussion);
  }

  get beatDur() { return 60 / this.talam.tempo; }

  startTalam() {
    if (!this.started || this.talam.running) return;
    this.setTalam({});
    this.perc.prepare(this.talam.percussion);
    const T = this.talam;
    T.running = true;
    T.step = 0;
    T.cycle = 0;
    T.nextTime = this.ctx.currentTime + 0.12;
    this.emit('talam', { running: true });
    const tick = () => {
      const now = this.ctx.currentTime;
      while (T.nextTime < now + 0.15) {
        this.scheduleStep(T.nextTime);
        const spb = stepsPerBeat(nadaiById(T.nadaiId), kalamById(T.kalamId));
        T.nextTime += this.beatDur / spb;
      }
    };
    tick();
    T.timer = setInterval(tick, 25);
  }

  stopTalam() {
    const T = this.talam;
    if (!T.running) return;
    clearInterval(T.timer);
    T.running = false;
    if (this.loop.state !== 'empty') this.loopStopPlayback();
    this.emit('talam', { running: false });
  }

  scheduleStep(time) {
    const T = this.talam;
    const talam = talamById(T.talamId);
    const nadai = nadaiById(T.nadaiId);
    const spb = stepsPerBeat(nadai, kalamById(T.kalamId));
    const perCycle = talam.beats * spb;
    const inCycle = T.step % perCycle;
    const beat = Math.floor(inCycle / spb);
    const sub = inCycle % spb;
    if (inCycle === 0 && T.step > 0) T.cycle++;
    const pat = this.pattern || percussionPattern(talam, nadai);
    const stroke = pat[inCycle % pat.length];
    if (T.percussion === 'tick') { if (sub === 0) this.perc.click(time, beat === 0); }
    else if (T.percussion && T.percussion !== 'none') this.perc.play(stroke, time, sub === 0 ? 1 : 0.8, T.percussion);
    const info = { time, beat, sub, spb, cycle: T.cycle, beats: talam.beats, beatDur: this.beatDur };
    this.emit('step', info);
    if (sub === 0) {
      if (beat === 0) this.loopOnSamam(info);
      const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
      setTimeout(() => this.emit('beat', info), delay);
    }
    T.step++;
  }

  // ---------- looper ----------
  record(ev) {
    const L = this.loop;
    if (L.state !== 'recording') return;
    L.events.push(ev);
  }

  loopRec() {
    const L = this.loop;
    if (!this.started) return;
    if (L.state === 'recording') { this.loopFinish(); return; }
    if (L.state === 'countin') { this.loopClear(); return; }
    this.loopClear(true);
    if (!this.talam.running) this.startTalam();
    L.state = 'countin';
    L.voiceId = this.voiceId;
    this.emit('loop', this.loopInfo());
  }

  loopOnSamam(info) {
    const L = this.loop;
    if (L.state === 'countin') {
      L.state = 'recording';
      L.recStart = info.time;
      L.cycleDurAtRec = info.beats * info.beatDur;
      L.events = [];
      // A swara already being held as samam arrives counts from the start.
      const n = this.live.note;
      if (n && !n.released) L.events.push({ type: 'on', t: info.time, note: { cents: this.live.target, gamaka: 'c', nb: this.live.nb, voiceId: this.voiceId } });
      setTimeout(() => this.emit('loop', this.loopInfo()), Math.max(0, (info.time - this.ctx.currentTime) * 1000));
    } else if (L.state === 'playing') {
      const idx = L.nextIndex ?? 0;
      L.nextIndex = (idx + 1) % L.cycles;
      this.loopScheduleCycle(info, idx);
    }
  }

  loopFinish() {
    const L = this.loop;
    const now = this.ctx.currentTime;
    const cycleDur = talamById(this.talam.talamId).beats * this.beatDur;
    const elapsed = (now - L.recStart) / cycleDur;
    // Stopped just after samam: end at that samam. Later in the cycle: keep it.
    const cycles = Math.max(1, elapsed % 1 < 0.35 ? Math.floor(elapsed) : Math.ceil(elapsed));
    const end = L.recStart + cycles * cycleDur;
    const evs = L.events.filter((e) => e.t < end);
    if (this.live.note && !this.live.note.released) evs.push({ type: 'off', t: Math.min(now, end) - 0.01 });
    if (!evs.some((e) => e.type === 'on')) { this.loopClear(); return; }
    L.cycles = cycles;
    // Store positions in beats so tempo changes stretch the loop correctly.
    L.events = evs.map((e) => ({ ...e, beat: (e.t - L.recStart) / this.beatDur }));
    L.state = 'playing';
    L.nextIndex = 0;
    // If we're already inside the cycle after the recording, carry on at once.
    const cyc = Math.floor(elapsed);
    if (cyc >= cycles) {
      const idx = cyc % cycles;
      this.loopScheduleCycle({ time: L.recStart + cyc * cycleDur, beats: talamById(this.talam.talamId).beats, beatDur: this.beatDur }, idx, now);
      L.nextIndex = (idx + 1) % cycles;
    }
    this.emit('loop', this.loopInfo());
    this.emit('looprecorded', this.loopInfo());
  }

  // Schedule one avartanam of the loop (cycle idx) starting at info.time.
  loopScheduleCycle(info, idx, notBefore = 0) {
    const L = this.loop;
    const from = idx * info.beats;
    const to = from + info.beats;
    for (const ev of L.events) {
      if (ev.beat < from || ev.beat >= to) continue;
      const t = info.time + (ev.beat - from) * info.beatDur;
      if (t < notBefore) continue;
      if (ev.type === 'on') this.loopCh.play({ ...ev.note, time: t });
      else if (ev.type === 'gamaka') this.loopCh.regamaka(ev.gamaka, ev.cents, ev.nb, t);
      else this.loopCh.stop(t);
    }
  }

  loopPlay() {
    const L = this.loop;
    if (L.state === 'playing') { this.loopStopPlayback(); L.state = 'stopped'; }
    else if (L.state === 'stopped') {
      if (!this.talam.running) this.startTalam();
      L.state = 'playing'; L.nextIndex = 0;
    }
    this.emit('loop', this.loopInfo());
  }

  loopStopPlayback() { this.loopCh.stop(); }

  loopClear(silent) {
    const L = this.loop;
    this.loopCh.stop();
    L.state = 'empty'; L.events = []; L.cycles = 0;
    if (!silent) this.emit('loop', this.loopInfo());
  }

  loopInfo() { return { state: this.loop.state, cycles: this.loop.cycles }; }

  // Current output level (for tests and the visualiser).
  level() {
    const a = new Float32Array(this.meter.fftSize);
    this.meter.getFloatTimeDomainData(a);
    let s = 0; for (const v of a) s += v * v;
    return 10 * Math.log10(s / a.length + 1e-12);
  }
}
