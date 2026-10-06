// Audio engine: master chain, live + loop players, arpeggiator, drums,
// looper, and the iPad audio unlock dance.
import * as Tone from 'tone';
import { buildPreset } from './presets.js';
import { DrumMachine } from './drums.js';

export const ARP_MODES = ['off', 'up', 'down', 'updown', 'random'];
export const ARP_LABELS = { off: 'OFF', up: 'UP', down: 'DOWN', updown: 'UP-DN', random: 'RAND' };

const midiNote = (m) => Tone.Frequency(m, 'midi').toNote();

// ---------- iPad: play through the silent switch ----------
let silentEl = null;
function silentWavUrl() {
  // 0.5s of 8-bit mono silence at 8kHz.
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

// Must run inside a user gesture.
export function unlockAudioSession() {
  // Modern Safari: tell iOS this is a music app, not UI sounds, so the
  // silent switch doesn't mute it.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* not supported */ }
  // Older iOS fallback (and belt-and-braces): a looping silent <audio>
  // element switches the page into the "playback" audio category.
  try {
    if (!silentEl) {
      silentEl = document.createElement('audio');
      silentEl.setAttribute('playsinline', '');
      silentEl.setAttribute('x-webkit-airplay', 'deny');
      silentEl.preload = 'auto';
      silentEl.loop = true;
      silentEl.src = silentWavUrl();
    }
    const p = silentEl.play();
    if (p && p.catch) p.catch(() => {});
  } catch { /* ignore */ }
}

// ---------- A player: one synth voice + arpeggiator state ----------
class Player {
  constructor(engine, name) {
    this.engine = engine;
    this.name = name;
    this.out = new Tone.Gain(1);
    this.out.connect(engine.dry);
    this.revSend = new Tone.Gain(0.3);
    this.dlySend = new Tone.Gain(0.15);
    this.out.connect(this.revSend);
    this.out.connect(this.dlySend);
    this.revSend.connect(engine.reverb);
    this.dlySend.connect(engine.delay);
    this.voice = null;
    this.presetId = null;
    this.arpMode = 'off';
    this.arpRate = '16n';
    this.sounding = new Set();
    this.seg = null; // { voicing, from, until }
    this.prevSeg = null;
    this.arpIdx = 0;
    this.lastArpTime = -1;
    this.lastRandom = -1;
  }

  setPreset(id) {
    if (id === this.presetId && this.voice) return;
    const old = this.voice;
    if (old) {
      old.synth.releaseAll(Tone.immediate());
      setTimeout(() => old.dispose(), 4500);
    }
    this.presetId = id;
    this.voice = buildPreset(id);
    this.voice.out.connect(this.out);
    this.revSend.gain.value = this.voice.reverb;
    this.dlySend.gain.value = this.voice.delay;
    this.sounding.clear();
    // Still holding a chord? Bring it back on the new sound.
    if (this.seg && this.seg.until === Infinity) this.chordOn(this.seg.voicing, Tone.immediate(), { legato: false, keepArp: true });
  }

  attack(notes, time) {
    if (!notes.length) return;
    const bass = this.seg?.voicing.bass;
    for (const m of notes) {
      const vel = m === bass ? this.voice.bassVel : this.voice.vel;
      this.voice.synth.triggerAttack(midiNote(m), time, vel);
      this.sounding.add(m);
    }
  }

  release(notes, time) {
    if (!notes.length) return;
    this.voice.synth.triggerRelease(notes.map(midiNote), time);
    for (const m of notes) this.sounding.delete(m);
  }

  chordOn(voicing, time, { legato = false, keepArp = false } = {}) {
    if (!this.voice) return;
    this.prevSeg = this.seg;
    this.seg = { voicing, from: time, until: Infinity };
    const target = this.arpMode === 'off' ? voicing.all : [voicing.bass];
    const cur = [...this.sounding];
    if (legato) {
      this.release(cur.filter((m) => !target.includes(m)), time);
      this.attack(target.filter((m) => !this.sounding.has(m)), time);
    } else {
      this.release(cur, time);
      this.attack(target, time);
    }
    if (this.arpMode !== 'off' && !legato && !keepArp) {
      // Play the first arp note right away so it feels instant.
      this.arpIdx = 0;
      this.playArpNote(time);
    }
  }

  chordOff(time) {
    if (!this.voice) return;
    this.release([...this.sounding], time);
    if (this.seg) this.seg.until = time;
  }

  setArp(mode) {
    this.arpMode = mode;
    // Switching arp on/off mid-chord: swap held notes over.
    if (this.seg && this.seg.until === Infinity) {
      this.chordOn(this.seg.voicing, Tone.immediate(), { legato: true, keepArp: true });
    }
  }

  arpPattern(upper) {
    const up = [...upper, upper[0] + 12];
    switch (this.arpMode) {
      case 'down': return [...up].reverse();
      case 'updown': return [...up, ...up.slice(1, -1).reverse()];
      default: return up;
    }
  }

  playArpNote(time) {
    const seg = this.activeSeg(time);
    if (!seg) return;
    const pat = this.arpPattern(seg.voicing.upper);
    let note;
    if (this.arpMode === 'random') {
      let i = Math.floor(Math.random() * pat.length);
      if (i === this.lastRandom) i = (i + 1) % pat.length;
      this.lastRandom = i;
      note = pat[i];
    } else {
      note = pat[this.arpIdx % pat.length];
    }
    this.arpIdx++;
    const dur = Tone.Time(this.arpRate).toSeconds() * 0.9;
    this.voice.synth.triggerAttackRelease(midiNote(note), dur, time, this.voice.vel);
    this.lastArpTime = time;
    this.engine.emit('arp', { player: this.name, note, time });
  }

  activeSeg(time) {
    for (const s of [this.seg, this.prevSeg]) {
      if (s && time >= s.from - 0.002 && time < s.until) return s;
    }
    return null;
  }

  arpTick(time, idx) {
    if (this.arpMode === 'off' || !this.voice) return;
    if (this.arpRate === '8n' && idx % 2 !== 0) return;
    const step = Tone.Time(this.arpRate).toSeconds();
    if (time - this.lastArpTime < step * 0.55) return; // just played the instant note
    this.playArpNote(time);
  }
}

// ---------- Engine ----------
export class Engine {
  constructor() {
    this.started = false;
    this.listeners = {};
    this.loop = { state: 'empty', events: [], part: null, lengthBars: 0 };
    this.dropped = false;
    this.bpm = 92;
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, data) { (this.listeners[name] || []).forEach((fn) => fn(data)); }

  // Call synchronously from the first tap.
  start(settings) {
    if (this.started) return Promise.resolve();
    this.started = true;
    unlockAudioSession();
    // Replace (and close) Tone's import-time default context with one tuned for
    // live playing. iOS limits how many AudioContexts a page may hold.
    Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0.04 }), true);
    const resumed = Tone.start();
    this.build(settings);
    return resumed;
  }

  build(s) {
    this.master = new Tone.Volume(0).toDestination();
    this.meter = new Tone.Meter({ smoothing: 0 }); // read by the browser test
    this.master.connect(this.meter);
    this.limiter = new Tone.Limiter(-1).connect(this.master);
    this.comp = new Tone.Compressor({ threshold: -16, ratio: 2.5, attack: 0.02, release: 0.25 }).connect(this.limiter);
    this.dry = new Tone.Gain(1).connect(this.comp);
    this.reverb = new Tone.Reverb({ decay: 5.5, preDelay: 0.03, wet: 1 });
    const revTone = new Tone.Filter({ type: 'lowpass', frequency: 6000 });
    this.reverb.chain(revTone, this.comp);
    this.delay = new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.34, wet: 1 });
    const dlyTone = new Tone.Filter({ type: 'lowpass', frequency: 3500 });
    this.delay.chain(dlyTone, this.comp);

    this.live = new Player(this, 'live');
    this.loopPlayer = new Player(this, 'loop');
    this.loopBus = this.loopPlayer.out; // for the drop

    this.drumBus = new Tone.Gain(1).connect(this.comp);
    const drumVerb = new Tone.Gain(0.08).connect(this.reverb);
    this.drumBus.connect(drumVerb);
    this.drums = new DrumMachine(this.drumBus);

    this.metro = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      volume: -14,
    }).connect(this.comp);

    const tr = Tone.getTransport();
    tr.bpm.value = s.bpm;
    this.setBpm(s.bpm);
    this.setVolume(s.volume);
    this.live.setPreset(s.preset);
    this.live.arpMode = s.arp;
    this.live.arpRate = s.arpRate;
    this.drums.setKit(s.kit);
    this.drums.setBeat(s.beat);

    tr.scheduleRepeat((time) => this.tick(time), '16n', 0);
    tr.start('+0.05');

    const resume = () => {
      const ctx = Tone.getContext();
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('pointerup', resume, true);
    window.addEventListener('touchend', resume, true);
  }

  get barTicks() { return Tone.getTransport().PPQ * 4; }
  // Whole ticks only: Tone's "123i" time strings don't accept fractions.
  nowTicks() { return Math.round(Tone.getTransport().getTicksAtTime(Tone.immediate())); }

  tick(time) {
    const tr = Tone.getTransport();
    const sixteenthTicks = tr.PPQ / 4;
    const ticks = tr.getTicksAtTime(time);
    const idx = Math.round(ticks / sixteenthTicks);
    const step = idx % 16;
    const sixteenth = Tone.Time('16n').toSeconds();

    this.drums.tick(time, step, sixteenth);
    this.live.arpTick(time, idx);
    this.loopPlayer.arpTick(time, idx);

    // Looper: count-in and recording bookkeeping.
    const L = this.loop;
    const tickPos = idx * sixteenthTicks;
    if (L.state === 'countin' && tickPos >= L.recStart) this.beginRecording();
    if (L.state === 'recording' && tickPos >= L.recStart + 8 * this.barTicks) {
      Tone.getDraw().schedule(() => this.finishRecording(L.recStart + 8 * this.barTicks), time);
    }
    if ((L.state === 'countin' || L.state === 'recording') && step % 4 === 0 && !this.drums.on) {
      this.metro.triggerAttackRelease(step === 0 ? 'C6' : 'G5', '32n', time, step === 0 ? 0.9 : 0.6);
    }

    if (step % 4 === 0) {
      const beat = step / 4;
      const info = { beat, bar: Math.floor(idx / 16) };
      if (L.state === 'countin') info.countdown = Math.round((L.recStart - tickPos) / tr.PPQ);
      Tone.getDraw().schedule(() => this.emit('beat', info), time);
    }
  }

  // ---- live playing ----
  liveChordOn(voicing, opts = {}) {
    const t = Tone.immediate();
    this.live.chordOn(voicing, t, opts);
    this.recordEvent({ type: 'on', voicing });
  }

  liveChordOff() {
    this.live.chordOff(Tone.immediate());
    this.recordEvent({ type: 'off' });
  }

  setPreset(id) { this.live.setPreset(id); }
  setArp(mode) { this.live.setArp(mode); }
  setArpRate(rate) { this.live.arpRate = rate; }
  setKit(id) { this.drums.setKit(id); }
  setBeat(id) { this.drums.setBeat(id); }
  setDrums(on) { this.drums.on = on; }

  setBpm(bpm) {
    this.bpm = bpm;
    Tone.getTransport().bpm.rampTo(bpm, 0.05);
    if (this.delay) this.delay.delayTime.rampTo(60 / bpm * 0.75, 0.1);
  }

  setVolume(v) { // 0..1
    if (!this.master) return;
    this.master.volume.rampTo(v <= 0.001 ? -Infinity : 20 * Math.log10(v * v) + 2, 0.05);
  }

  // ---- the drop: cut drums + loop, slam them back in on the next bar ----
  setDrop(on) {
    const now = Tone.immediate();
    const gains = [this.drumBus.gain, this.loopBus.gain];
    if (on) {
      this.dropped = true;
      gains.forEach((g) => { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.04); });
      this.emit('drop', { state: 'out' });
    } else {
      const t = Tone.getTransport().nextSubdivision('1m');
      gains.forEach((g) => { g.cancelScheduledValues(now); g.setValueAtTime(0, t - 0.005); g.linearRampToValueAtTime(1, t + 0.005); });
      this.dropped = false;
      this.emit('drop', { state: 'waiting' });
      Tone.getDraw().schedule(() => this.emit('drop', { state: 'in' }), t);
    }
  }

  // ---- looper ----
  loopRec() {
    const L = this.loop;
    if (L.state === 'recording') { this.finishRecording(this.nowTicks()); return; }
    if (L.state === 'countin') { this.clearLoop(); return; }
    this.clearLoop(true);
    // Start on a bar line with at least ~3 beats of count-in.
    const now = this.nowTicks();
    let start = Math.ceil(now / this.barTicks) * this.barTicks;
    if (start - now < Tone.getTransport().PPQ * 2.5) start += this.barTicks;
    L.recStart = start;
    L.events = [];
    L.state = 'countin';
    L.presetId = this.live.presetId;
    L.arpMode = this.live.arpMode;
    L.arpRate = this.live.arpRate;
    this.emit('loop', this.loopInfo());
  }

  beginRecording() {
    const L = this.loop;
    L.state = 'recording';
    // A chord already held as the bar starts (or pressed just before) counts from 0.
    const seg = this.live.seg;
    if (seg && seg.until === Infinity) L.events.push({ type: 'on', tick: 0, voicing: seg.voicing });
    Tone.getDraw().schedule(() => this.emit('loop', this.loopInfo()), Tone.now());
  }

  recordEvent(ev) {
    const L = this.loop;
    if (L.state !== 'recording' && L.state !== 'countin') return;
    let tick = this.nowTicks() - L.recStart;
    const eighth = Tone.getTransport().PPQ / 2;
    if (tick < 0) {
      if (tick < -eighth) return; // too early, beginRecording picks up held chords
      tick = 0;
    }
    if (ev.type === 'on' && tick === 0) L.events = L.events.filter((e) => e.tick !== 0);
    L.events.push({ ...ev, tick });
  }

  finishRecording(stopTick) {
    const L = this.loop;
    if (L.state !== 'recording') return;
    const bar = this.barTicks;
    const bars = Math.max(1, Math.min(8, Math.round((stopTick - L.recStart) / bar)));
    const len = bars * bar;
    // Turn on/off events into chords with durations.
    // Gentle quantize: chord changes snap to the nearest 16th note.
    const q = Tone.getTransport().PPQ / 4;
    const events = L.events.map((e) => ({ ...e, tick: Math.round(e.tick / q) * q })).sort((a, b) => a.tick - b.tick);
    const notes = [];
    let open = null;
    for (const e of events) {
      if (open) { open.dur = Math.max(1, e.tick - open.tick); notes.push(open); open = null; }
      if (e.type === 'on' && e.tick < len) open = { tick: e.tick, voicing: e.voicing };
    }
    if (open) { open.dur = len - open.tick; notes.push(open); }
    const clipped = notes.filter((n) => n.tick < len).map((n) => ({ ...n, dur: Math.min(n.dur, len - n.tick) }));
    if (!clipped.length) { this.clearLoop(); return; }

    L.notes = clipped;
    L.lengthBars = bars;
    L.lenTicks = len;
    this.loopPlayer.setPreset(L.presetId);
    this.loopPlayer.arpMode = L.arpMode;
    this.loopPlayer.arpRate = L.arpRate;
    L.part = new Tone.Part((time, n) => {
      this.loopPlayer.chordOn(n.voicing, time);
      this.loopPlayer.chordOff(time + Tone.Ticks(n.dur).toSeconds() - 0.01);
      Tone.getDraw().schedule(() => this.emit('loopchord', n), time);
    }, clipped.map((n) => ({ time: `${n.tick}i`, ...n })));
    L.part.loop = true;
    L.part.loopStart = 0;
    L.part.loopEnd = `${len}i`;
    const now = Math.max(stopTick, this.nowTicks());
    L.part.start(`${now}i`, `${(now - L.recStart) % len}i`);
    L.state = 'playing';
    this.emit('loop', this.loopInfo());
    this.emit('looprecorded', this.loopInfo());
  }

  loopPlay() {
    const L = this.loop;
    if (L.state === 'playing') {
      L.part.stop();
      this.loopPlayer.chordOff(Tone.immediate());
      L.state = 'stopped';
    } else if (L.state === 'stopped') {
      const next = Math.ceil(this.nowTicks() / this.barTicks) * this.barTicks;
      L.part.start(`${next}i`, 0);
      L.state = 'playing';
    }
    this.emit('loop', this.loopInfo());
  }

  clearLoop(silent = false) {
    const L = this.loop;
    if (L.part) { L.part.stop(); L.part.dispose(); L.part = null; }
    if (this.loopPlayer) this.loopPlayer.chordOff(Tone.immediate());
    L.state = 'empty';
    L.events = [];
    L.notes = [];
    if (!silent) this.emit('loop', this.loopInfo());
  }

  loopInfo() {
    const L = this.loop;
    return { state: L.state, bars: L.lengthBars, chords: (L.notes || []).length };
  }
}
