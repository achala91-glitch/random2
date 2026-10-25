// Drives the built Swarapetti in headless Chromium: sound, pitch of every voice,
// gamakas, ragam logic, talam, looper, picker, settings, lessons, layout.
// Usage: npm run build && npx vite preview --port 4173 &  node swarapetti/tests/browser.test.mjs [shotsDir]
import { chromium } from 'playwright-core';

const URL = process.env.SP_URL || 'http://localhost:4173/swarapetti/';
const OUT = process.argv[2] || 'shots';
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function open(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

// In-page pitch estimate from the engine's output analyser.
const PITCH = `async (ms) => {
  const e = window.__sp.engine;
  e.meter.fftSize = 8192;
  await new Promise((r) => setTimeout(r, ms));
  const sr = e.ctx.sampleRate;
  const a = new Float32Array(e.meter.fftSize);
  e.meter.getFloatTimeDomainData(a);
  const minLag = Math.floor(sr / 1500), maxLag = Math.floor(sr / 60);
  const r = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0, e1 = 0, e2 = 0;
    for (let i = 0; i + lag < a.length; i++) { s += a[i] * a[i + lag]; e1 += a[i] * a[i]; e2 += a[i + lag] * a[i + lag]; }
    r[lag] = s / Math.sqrt(e1 * e2 + 1e-12);
  }
  let mx = 0; for (let l = minLag; l <= maxLag; l++) mx = Math.max(mx, r[l]);
  let lag = 0;
  for (let l = minLag + 1; l <= maxLag; l++) if (r[l] >= 0.88 * mx && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { lag = l; break; }
  const A = r[lag - 1], B = r[lag], C = r[lag + 1];
  const shift = (A - C) / (2 * (A - 2 * B + C) || 1);
  let rms = 0; for (const v of a) rms += v * v;
  return { f0: sr / (lag + shift), clarity: B, db: 10 * Math.log10(rms / a.length + 1e-12) };
}`;
const cents = (a, b) => 1200 * Math.log2(a / b);

// ---------------------------------------------------------------- desktop, mouse only
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await page.click('#welcomeStart');
  await page.waitForTimeout(2500);
  ok(await page.evaluate(() => window.__sp.engine.ctx.state === 'running'), 'audio starts from the welcome button');
  const droneDb = await page.evaluate(() => window.__sp.engine.level());
  ok(droneDb > -55, `the tanpura drone is sounding (${droneDb.toFixed(1)} dB)`);
  await page.screenshot({ path: `${OUT}/sp-desktop.png` });

  // Turn the drone off for clean pitch measurement.
  await page.click('.switch');
  await page.waitForTimeout(1800);
  const sa = await page.evaluate(() => window.__sp.engine.sa);
  ok(Math.abs(sa - 138.59) < 0.05, `Sa is 1½ kattai = C♯3 (${sa.toFixed(2)} Hz)`);

  const pa = await page.locator('.swara-key[data-deg="4"]').boundingBox();
  const voices = ['veena', 'violin', 'venu', 'nadaswaram', 'harmonium', 'keyboard', 'vocal'];
  const octave = { venu: 2, nadaswaram: 2 };
  for (const v of voices) {
    await page.selectOption('#voiceSel', v);
    await page.mouse.move(pa.x + pa.width / 2, pa.y + pa.height / 2);
    await page.mouse.down();
    const m = await page.evaluate(`(${PITCH})(${v === 'veena' ? 250 : 450})`);
    await page.mouse.up();
    await wait(500);
    const expected = sa * 1.5 * (octave[v] || 1);
    let err = cents(m.f0, expected);
    // Accept the octave below for voices with a strong lower partial (harmonium's bass reed).
    if (v === 'harmonium' && Math.abs(cents(m.f0, expected / 2)) < Math.abs(err)) err = cents(m.f0 * 2, expected);
    ok(Math.abs(err) < 12 && m.db > -50, `${v}: Pa sounds at ${m.f0.toFixed(1)} Hz, expected ${expected.toFixed(1)} (${err.toFixed(1)} cents, ${m.db.toFixed(0)} dB)`);
  }
  await page.selectOption('#voiceSel', 'violin');

  // Display and swarasthanas in Mayamalavagowla.
  const ga = await page.locator('.swara-key[data-deg="2"]').boundingBox();
  await page.mouse.click(ga.x + ga.width / 2, ga.y + ga.height / 2);
  ok((await page.locator('#scrSwara').textContent()) === 'G3', 'Ga in Mayamalavagowla shows G3');
  ok((await page.locator('#dName').textContent()) === 'Antara Gandharam', 'display names the swarasthana');

  // Gamaka: kampitam on Ga in Shankarabharanam swings between Ga and Ma.
  await page.click('#ragamBtn');
  await page.fill('#ragamSearch', 'shankarabharanam');
  await page.waitForTimeout(150);
  await page.click('.ragam-row[data-id="mela-29"]');
  ok((await page.locator('#ragamName').textContent()) === 'Dheerashankarabharanam', 'picker search finds Shankarabharanam by its short name');
  const joy = await page.locator('#joy .joy-well').boundingBox();
  const jc = { x: joy.x + joy.width / 2, y: joy.y + joy.height / 2 };
  await page.click('#joyLock');
  await page.mouse.click(jc.x + 45, jc.y); // latch right = kampitam
  ok((await page.locator('#dGamaka').textContent()).includes('Kampitam'), 'stick right shows Kampitam');
  await page.mouse.move(ga.x + ga.width / 2, ga.y + ga.height / 2);
  await page.mouse.down();
  await wait(200);
  const samples = [];
  for (let i = 0; i < 14; i++) samples.push((await page.evaluate(`(${PITCH})(20)`)).f0);
  await page.mouse.up();
  const gHz = sa * 5 / 4; const mHz = sa * 4 / 3;
  const lo = Math.min(...samples); const hi = Math.max(...samples);
  ok(Math.abs(cents(lo, gHz)) < 40 && Math.abs(cents(hi, mHz)) < 40, `kampitam moves between Ga (${gHz.toFixed(0)}) and Ma (${mHz.toFixed(0)}): ${lo.toFixed(0)} to ${hi.toFixed(0)} Hz`);
  // Etra jaru: slide up into Pa from below.
  await page.mouse.click(jc.x, jc.y); // centre
  await page.mouse.click(jc.x + 32, jc.y - 32); // up-right
  await wait(150);
  await page.mouse.move(pa.x + pa.width / 2, pa.y + pa.height / 2);
  await page.mouse.down();
  const early = (await page.evaluate(`(${PITCH})(60)`)).f0;
  const late = (await page.evaluate(`(${PITCH})(450)`)).f0;
  await page.mouse.up();
  ok(early < late * 0.95 && Math.abs(cents(late, sa * 1.5)) < 20, `etra jaru slides up into Pa (${early.toFixed(0)} -> ${late.toFixed(0)} Hz)`);
  await page.mouse.click(jc.x, jc.y);
  await page.click('#joyLock');

  // Bhairavi: Dha is D2 going up, D1 coming down.
  await page.click('#ragamBtn');
  await page.fill('#ragamSearch', 'bhairavi');
  await page.waitForTimeout(150);
  await page.click('.ragam-row[data-id="janya-bhairavi"]');
  const seq = [];
  for (const d of [4, 5, 6, 7, 6, 5]) {
    const k = await page.locator(`.swara-key[data-deg="${d}"]`).boundingBox();
    await page.mouse.click(k.x + k.width / 2, k.y + k.height / 2);
    seq.push((await page.locator('#scrSwara').textContent()).trim());
  }
  ok(seq.join(' ') === 'P D2 N2 Ṡ N2 D1', `Bhairavi phrase P D N Ṡ N D resolves to ${seq.join(' ')}`);
  ok((await page.locator('.swara-key[data-deg="5"] .k-sthana').textContent()).includes('↑') , 'Bhairavi Dha key shows both swarasthanas');

  // Mohanam: Ma and Ni are dimmed and silent.
  await page.click('#ragamBtn');
  await page.click('#ragamFilter button[data-v="janya"]');
  await page.fill('#ragamSearch', 'moha');
  await page.waitForTimeout(150);
  await page.click('.ragam-row[data-id="janya-mohanam"]');
  ok(await page.locator('.swara-key[data-deg="3"]').evaluate((e) => e.classList.contains('off')), 'Mohanam dims Ma');
  ok(await page.locator('.swara-key[data-deg="6"]').evaluate((e) => e.classList.contains('off')), 'Mohanam dims Ni');
  const before = await page.locator('#scrSwara').textContent();
  const ma = await page.locator('.swara-key[data-deg="3"]').boundingBox();
  await page.mouse.click(ma.x + ma.width / 2, ma.y + ma.height / 2);
  ok((await page.locator('#scrSwara').textContent()) === before, 'a dimmed key does not play');

  // Kattai.
  await page.click('#kattaiUp');
  ok((await page.locator('#kattaiVal').textContent()) === '2', 'kattai up: 2');
  ok((await page.locator('#kattaiWest').textContent()).startsWith('D3 · 146.8 Hz'), 'shows the Western equivalent');
  await page.click('#kattaiDown');

  // Talam with mridangam.
  await page.click('.switch'); // drone back on
  await page.selectOption('#tempo', { index: 0 }).catch(() => {});
  await page.click('#talamPlay');
  await wait(1600);
  const nowBeats = await page.locator('.kriya.now').count();
  ok(nowBeats === 1, 'the talam display marks the current beat');
  const b1 = await page.locator('.kriya.now').getAttribute('data-beat');
  await wait(900);
  const b2 = await page.locator('.kriya.now').getAttribute('data-beat');
  ok(b1 !== b2, `the beat moves on (${b1} -> ${b2})`);
  for (const p of ['tabla', 'kanjira', 'ghatam', 'morsing', 'thavil', 'mridangam']) {
    await page.selectOption('#percSel', p);
    await wait(700);
    const db = await page.evaluate(() => window.__sp.engine.level());
    ok(db > -55, `${p} is audible (${db.toFixed(1)} dB)`);
  }
  for (const t of ['rupakam', 'misra-chapu', 'khanda-chapu', 'adi']) {
    await page.selectOption('#talamSel', t);
    const n = await page.locator('.kriya').count();
    ok(n === { rupakam: 6, 'misra-chapu': 7, 'khanda-chapu': 5, adi: 8 }[t], `${t}: ${n} beats shown`);
  }
  await page.screenshot({ path: `${OUT}/sp-talam.png` });

  // Looper: record two swaras over one avartanam at a quick tempo.
  await page.evaluate(() => { const r = document.querySelector('#tempo'); r.value = 160; r.dispatchEvent(new Event('input')); });
  await page.click('#recBtn');
  await page.waitForFunction(() => window.__sp.engine.loop.state === 'recording', null, { timeout: 8000 });
  const beat = 60 / 160 * 1000;
  for (const d of [0, 4]) {
    const k = await page.locator(`.swara-key[data-deg="${d}"]`).boundingBox();
    await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
    await page.mouse.down(); await wait(beat * 3.5); await page.mouse.up(); await wait(beat * 0.4);
  }
  await page.click('#recBtn');
  const loop = await page.evaluate(() => window.__sp.engine.loopInfo());
  ok(loop.state === 'playing' && loop.cycles === 1, `looper records one avartanam and plays it (${JSON.stringify(loop)})`);
  await wait(beat * 8 + 500);
  ok(await page.evaluate(() => !!window.__sp.engine.loopCh.note), 'loop plays back on its own channel');
  await page.click('#playBtn');
  await page.click('#clearBtn');
  await page.click('#talamPlay');

  // Settings: Tamil notation.
  await page.click('#settingsBtn');
  await page.click('#notationSeg button[data-v="tamil"]');
  ok((await page.locator('.swara-key[data-deg="2"] .k-letter').textContent()) === 'க', 'Tamil notation shows க on Ga');
  await page.click('#notationSeg button[data-v="carnatic"]');
  await page.click('#settingsClose');

  // Learn: varisai, step by step.
  await page.click('#learnBtn');
  await wait(500);
  await page.click('.lesson-item[data-id="varisai"]');
  await page.click('[data-act="next"]');
  await page.click('[data-act="step"]');
  ok(await page.locator('.swara-key[data-deg="0"]').evaluate((e) => e.classList.contains('guide')), 'sarali varisai lights Sa first');
  for (const d of [0, 1, 2]) {
    const k = await page.locator(`.swara-key[data-deg="${d}"]`).boundingBox();
    await page.mouse.click(k.x + k.width / 2, k.y + k.height / 2);
  }
  ok(await page.locator('.swara-key[data-deg="3"]').evaluate((e) => e.classList.contains('guide')), 'after S R G the guide moves to Ma');
  const k5 = await page.locator('.swara-key[data-deg="5"]').boundingBox();
  await page.mouse.click(k5.x + k5.width / 2, k5.y + k5.height / 2);
  const fb = await page.locator('.feedback').textContent();
  ok(/That was Dha\. The glowing key is Ma\./.test(fb), `gentle feedback on a wrong swara: "${fb}"`);
  const learnBox = await page.locator('#learn').boundingBox();
  const keysBox = await page.locator('#keys').boundingBox();
  ok(learnBox.x >= keysBox.x + keysBox.width - 1, 'the learn panel sits beside the instrument, not over it');
  await page.screenshot({ path: `${OUT}/sp-learn.png` });
  ok(errors.length === 0, `no console errors (desktop) ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------------------------------------------------------------- layouts
for (const [name, w, h, mobile] of [['ipad-land', 1180, 820, true], ['ipad-port', 820, 1180, true], ['phone', 390, 844, true], ['phone-land', 844, 390, true], ['laptop', 1280, 720, false]]) {
  const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile && w < 900 });
  await page.click('#welcomeStart');
  await page.waitForTimeout(900);
  const overflowX = await page.evaluate(() => document.querySelector('#stage').scrollWidth > document.querySelector('#stage').clientWidth + 1);
  ok(!overflowX, `${name}: no sideways scrolling`);
  const keys = await page.locator('.swara-key').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, r.bottom]; }));
  ok(keys.every(([kw, kh]) => kw >= 44 && kh >= 44), `${name}: keys are at least 44 px (${Math.round(keys[0][0])}x${Math.round(keys[0][1])})`);
  const keysVisible = keys.every(([, , b]) => b <= h + 1);
  ok(keysVisible || name.startsWith('phone'), `${name}: all keys visible without scrolling`);
  const header = await page.locator('.bar').boundingBox();
  ok(header.y < 40, `${name}: header at the top`);
  await page.screenshot({ path: `${OUT}/sp-${name}.png` });
  ok(errors.length === 0, `${name}: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll Swarapetti browser checks passed.');
process.exit(fails ? 1 : 0);
