// The drone (shruti), always under the music.
//  - Shruti box: free reeds held by bellows. Sa-Pa-Sa, Sa-Ma-Sa or Sa-Ni-Sa,
//    with a soft lower Sa for body and a slow bellows breath.
//  - Tanpura: four strings tuned Pa (or Ma, Ni) Sa Sa and lower Sa, plucked in
//    that order with a pause after the low Sa, each string rendered with its
//    jivari overtone sweep.
import { renderTanpura } from './render.js';
import { JUST_RATIOS } from '../theory/swaras.js';

const ratio = (pos) => JUST_RATIOS[pos][0] / JUST_RATIOS[pos][1];

export const SHRUTI_SETTINGS = [
  { id: 'sa-pa-sa', name: 'Sa Pa Sa' },
  { id: 'sa-ma-sa', name: 'Sa Ma Sa' },
  { id: 'sa-ni-sa', name: 'Sa Ni Sa' },
];

export class Drone {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.bus.connect(out);
    this.bus.connect(this.analyser);
    this.type = 'tanpura';
    this.on = false;
    this.volume = 0.6;
    this.sa = 138.59;
    this.setting = 'sa-pa-sa';
    this.maPos = 5; // swarasthana used for "Ma" (M1 = 5, M2 = 6)
    this.niPos = 11;
    this.firstString = 'pa';
    this.reeds = null;
    this.strings = null;
    this.timer = null;
    this.nextPluck = 0;
    this.pluckIndex = 0;
    this.renderToken = 0;
  }

  setVolume(v) {
    this.volume = v;
    if (this.on) this.bus.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.1);
  }

  setOn(on) {
    this.on = on;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.setTargetAtTime(on ? this.volume * 0.9 : 0, t, on ? 0.4 : 0.25);
    if (on) this.ensureRunning();
    else setTimeout(() => { if (!this.on) this.stopSources(); }, 1600);
  }

  configure({ type, sa, setting, maPos, niPos, firstString }) {
    const changed = (type && type !== this.type) || (sa && Math.abs(sa - this.sa) > 0.01)
      || (setting && setting !== this.setting) || (maPos !== undefined && maPos !== this.maPos)
      || (niPos !== undefined && niPos !== this.niPos) || (firstString && firstString !== this.firstString);
    if (type) this.type = type;
    if (sa) this.sa = sa;
    if (setting) this.setting = setting;
    if (maPos !== undefined) this.maPos = maPos;
    if (niPos !== undefined) this.niPos = niPos;
    if (firstString) this.firstString = firstString;
    if (changed) {
      this.stopSources();
      this.strings = null;
      if (this.on) this.ensureRunning();
    }
  }

  ensureRunning() {
    if (this.type === 'shruti') { if (!this.reeds) this.startReeds(); }
    else { this.startTanpura(); }
  }

  stopSources() {
    if (this.reeds) {
      const t = this.ctx.currentTime;
      for (const n of this.reeds.nodes) { try { n.stop(t + 0.5); } catch { /* ignore */ } }
      this.reeds.gain.gain.setTargetAtTime(0, t, 0.1);
      this.reeds = null;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  // ---------- shruti box ----------
  startReeds() {
    const ctx = this.ctx; const t = ctx.currentTime;
    const second = this.setting === 'sa-ma-sa' ? ratio(this.maPos) : this.setting === 'sa-ni-sa' ? ratio(this.niPos) / 2 : 1.5;
    // Sa-Ni-Sa uses the Ni just below Sa, so the reed sits between the two Sas.
    const notes = [
      [0.5, 0.45], [1, 1], [this.setting === 'sa-ni-sa' ? second * 2 : second, 0.85], [2, 0.6],
    ];
    const real = new Float32Array(33); const imag = new Float32Array(33);
    for (let n = 1; n <= 32; n++) imag[n] = (Math.abs(Math.sin(Math.PI * n * 0.27)) / n) * (1 + 0.6 * Math.exp(-((n - 5) ** 2) / 6));
    const wave = ctx.createPeriodicWave(real, imag);
    const gain = ctx.createGain(); gain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 420; body.gain.value = 3; body.Q.value = 0.8;
    lp.connect(body).connect(gain).connect(this.bus);
    const nodes = [];
    for (const [r, a] of notes) {
      for (const detune of [-2.5, 2.5]) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = this.sa * r;
        o.detune.value = detune;
        const g = ctx.createGain(); g.gain.value = a * 0.11;
        o.connect(g).connect(lp);
        o.start(t);
        nodes.push(o);
      }
    }
    // Bellows: a slow, slightly irregular breath.
    for (const [f, d] of [[0.13, 0.07], [0.31, 0.035]]) {
      const l = ctx.createOscillator(); l.frequency.value = f;
      const lg = ctx.createGain(); lg.gain.value = d;
      l.connect(lg).connect(gain.gain);
      l.start(t);
      nodes.push(l);
    }
    gain.gain.setTargetAtTime(1, t, 0.3);
    this.reeds = { nodes, gain };
  }

  // ---------- tanpura ----------
  firstStringRatio() {
    if (this.firstString === 'ma') return ratio(this.maPos) / 2;
    if (this.firstString === 'ni') return ratio(this.niPos) / 2;
    return 0.75; // mandra Pa
  }

  async renderStrings() {
    const token = ++this.renderToken;
    const ctx = this.ctx;
    const specs = [
      { r: this.firstStringRatio(), seed: 1, pan: -0.25 },
      { r: 1, seed: 2, pan: -0.05 },
      { r: 1.0006, seed: 3, pan: 0.08 },
      { r: 0.5, seed: 4, pan: 0.22 },
    ];
    const out = [];
    for (const s of specs) {
      await new Promise((res) => setTimeout(res, 0)); // keep the page responsive
      if (token !== this.renderToken) return null;
      const data = renderTanpura(this.sa * s.r, ctx.sampleRate, { dur: 7, seed: s.seed });
      const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      out.push({ buffer: b, pan: s.pan });
    }
    return out;
  }

  async startTanpura() {
    if (this.timer) return;
    if (!this.strings) {
      this.timer = -1; // rendering
      const s = await this.renderStrings();
      if (!s) return;
      this.strings = s;
      this.timer = null;
    }
    if (!this.on || this.type !== 'tanpura' || this.timer) return;
    this.nextPluck = this.ctx.currentTime + 0.05;
    this.pluckIndex = 0;
    // Pa  Sa  Sa  low-Sa ... pause: a slow, even cycle of about 5 seconds.
    const gaps = [1.05, 1.05, 1.05, 1.75];
    this.timer = setInterval(() => {
      const ctx = this.ctx;
      while (this.nextPluck < ctx.currentTime + 0.3) {
        const i = this.pluckIndex % 4;
        const st = this.strings[i];
        const src = ctx.createBufferSource();
        src.buffer = st.buffer;
        const g = ctx.createGain();
        g.gain.value = [0.8, 0.85, 0.8, 1][i] * (0.9 + Math.random() * 0.1) * 0.6;
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (p) { p.pan.value = st.pan; src.connect(g).connect(p).connect(this.bus); } else src.connect(g).connect(this.bus);
        const t = this.nextPluck + (Math.random() - 0.5) * 0.02;
        src.start(t);
        src.stop(t + 6.5);
        this.nextPluck += gaps[i];
        this.pluckIndex++;
      }
    }, 80);
  }
}
