// Drives the built app in headless Chromium at iPad sizes with real multi-touch.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/ipad-test.mjs [outDir]
import { chromium } from 'playwright-core';

const OUT = process.argv[2] || 'shots';
const URL = 'http://localhost:4173/';
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=user-gesture-required'],
});

const SIZES = [
  ['ipad-air-landscape', 1180, 820],
  ['ipad-air-portrait', 820, 1180],
  ['ipad-mini-landscape', 1133, 744],
  ['ipad-9th-landscape-safari-bars', 1080, 730],
  ['ipad-pro-12-landscape', 1366, 1024],
  ['ipad-pro-12-portrait', 1024, 1366],
];

async function newPage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

const center = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
};

// ---------- layout at each size ----------
for (const [name, w, h] of SIZES) {
  const { ctx, page, errors } = await newPage(w, h);
  if (name === 'ipad-air-landscape') await page.screenshot({ path: `${OUT}/welcome-${name}.png` });
  await page.touchscreen.tap(w / 2, h / 2);
  await page.waitForTimeout(500);
  // Device must be fully on screen, nothing overflowing.
  const dev = await page.locator('#device').boundingBox();
  ok(dev.x >= 0 && dev.y >= 0 && dev.x + dev.width <= w + 1 && dev.y + dev.height <= h + 1, `${name}: device fits (${Math.round(dev.width)}x${Math.round(dev.height)})`);
  const btn = await page.locator('.chord .cap').first().boundingBox();
  ok(btn.width >= 60 && btn.height >= 60, `${name}: chord buttons are finger-sized (${Math.round(btn.width)}x${Math.round(btn.height)})`);
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  ok(scroll[0] <= w && scroll[1] <= h, `${name}: no page scroll`);
  // Toast area doesn't overlap the device.
  await page.evaluate(() => {
    const el = document.createElement('div'); el.className = 'toast show';
    el.textContent = "Ten minutes in and your bank account is still intact. Proud of you.";
    document.querySelector('#toasts').replaceChildren(el);
  });
  const t = await page.locator('.toast').boundingBox();
  const overlap = !(t.x > dev.x + dev.width || t.x + t.width < dev.x || t.y > dev.y + dev.height || t.y + t.height < dev.y);
  const btns = await page.locator('.chord, .fn, .sbtn, .joystick, .fader').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  const hitsButton = btns.some(([x, y, bw, bh]) => !(t.x > x + bw || t.x + t.width < x || t.y > y + bh || t.y + t.height < y));
  ok(!hitsButton, `${name}: toast does not cover any control${overlap ? ' (touches device edge only)' : ''}`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  // Learn panel open: still no overlap with the instrument.
  await page.locator('#learnBtn').click();
  await page.waitForTimeout(600);
  const panel = await page.locator('#learn').boundingBox();
  const dev2 = await page.locator('#device').boundingBox();
  const covers = !(panel.x >= dev2.x + dev2.width - 1 || panel.y >= dev2.y + dev2.height - 1);
  ok(!covers, `${name}: learn panel does not cover the instrument`);
  await page.screenshot({ path: `${OUT}/${name}-learn.png` });
  ok(errors.length === 0, `${name}: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------- behaviour: iPad Air landscape ----------
{
  const { ctx, page, errors } = await newPage(1180, 820);
  const cdp = await ctx.newCDPSession(page);
  await page.touchscreen.tap(590, 410);
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => window.__jc.engine.started);
  ok(state, 'audio engine started on first tap');
  const ctxState = await page.evaluate(() => window.__jc.engine.master.context.state);
  ok(ctxState === 'running', `AudioContext running after first tap (${ctxState})`);
  const latency = await page.evaluate(() => window.__jc.engine.master.context.rawContext._nativeAudioContext?.baseLatency ?? window.__jc.engine.master.context.rawContext.baseLatency);
  console.log(`      baseLatency reported: ${latency}`);

  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const screenText = () => page.locator('#scrChord').textContent();
  const level = () => page.evaluate(async () => {
    let peak = -Infinity;
    for (let i = 0; i < 10; i++) { peak = Math.max(peak, window.__jc.engine.meter.getValue()); await new Promise((r) => setTimeout(r, 30)); }
    return peak;
  });

  // Plain chord
  const c1 = await center(page, '.chord[data-deg="1"] .cap');
  await touch('touchStart', [{ x: c1.x, y: c1.y, id: 1 }]);
  await wait(500);
  ok((await screenText()) === 'C', `button 1 shows C (got ${await screenText()})`);
  const lvl = await level();
  ok(lvl > -40, `sound is coming out while holding (${lvl.toFixed(1)} dB)`);
  ok(await page.locator('.chord[data-deg="1"]').evaluate((e) => e.classList.contains('active') && e.classList.contains('down')), 'button 1 shows pressed + glowing');
  await touch('touchEnd', []);
  await wait(300);
  ok(await page.evaluate(() => window.__jc.engine.live.sounding.size === 0), 'all notes released when the finger lifts');
  await wait(7000); // pad release + 5.5s reverb tail
  const tail = await level();
  ok(tail < lvl - 15, `sound dies away naturally after letting go (${lvl.toFixed(1)} -> ${tail.toFixed(1)} dB)`);

  // Multi-touch: thumb on joystick (up), finger on 1 -> Cmaj7. Then roll the stick to up-right -> Cmaj9.
  const j = await center(page, '.joy-well');
  await touch('touchStart', [{ x: j.x, y: j.y, id: 10 }]);
  await touch('touchMove', [{ x: j.x, y: j.y - 70, id: 10 }]);
  await wait(100);
  ok((await screenText()) === '7th', `joystick preview with no chord (${await screenText()})`);
  const names = await page.locator('.chord .cname').allTextContents();
  ok(names.join(',') === 'Cmaj7,Dm7,Em7,Fmaj7,G7,Am7,Bm7♭5', `button labels follow the stick: ${names.join(',')}`);
  await touch('touchStart', [{ x: j.x, y: j.y - 70, id: 10 }, { x: c1.x, y: c1.y, id: 11 }]);
  await wait(200);
  ok((await screenText()) === 'Cmaj7', `thumb up + button 1 = Cmaj7 (got ${await screenText()})`);
  await touch('touchMove', [{ x: j.x + 50, y: j.y - 50, id: 10 }, { x: c1.x, y: c1.y, id: 11 }]);
  await wait(200);
  ok((await screenText()) === 'Cmaj9', `rolling stick to up-right while holding = Cmaj9 (got ${await screenText()})`);
  // Third finger on 6 while still holding: newest wins
  const c6 = await center(page, '.chord[data-deg="6"] .cap');
  await touch('touchStart', [{ x: j.x + 50, y: j.y - 50, id: 10 }, { x: c1.x, y: c1.y, id: 11 }, { x: c6.x, y: c6.y, id: 12 }]);
  await wait(200);
  ok((await screenText()) === 'Am9', `third finger on 6 = Am9 (got ${await screenText()})`);
  // Let go of 6: falls back to the still-held 1
  await touch('touchEnd', [{ x: c6.x, y: c6.y, id: 12 }]); // lift just that finger
  await wait(150);
  ok((await screenText()) === 'Cmaj9', `release 6, still holding 1 = Cmaj9 (got ${await screenText()})`);
  // Let go of stick: springs back, chord becomes plain C without lifting the finger
  await touch('touchEnd', [{ x: j.x + 50, y: j.y - 50, id: 10 }]); // lift the thumb
  await wait(350);
  ok((await screenText()) === 'C', `stick springs back to center = C (got ${await screenText()})`);
  const knobT = await page.locator('#joyKnob').evaluate((e) => getComputedStyle(e).transform);
  ok(knobT === 'none' || knobT === 'matrix(1, 0, 0, 1, 0, 0)', `knob returned to center (${knobT})`);
  await touch('touchEnd', []);

  // All 8 directions on button 5 in C
  const expect = { u: 'G7', d: 'Gm', l: 'Gsus4', r: 'Gadd9', ul: 'Gsus2', ur: 'G9', dl: 'Gdim', dr: 'Gaug' };
  const vec = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0], ul: [-0.7, -0.7], ur: [0.7, -0.7], dl: [-0.7, 0.7], dr: [0.7, 0.7] };
  const c5 = await center(page, '.chord[data-deg="5"] .cap');
  const got = [];
  for (const [d, name] of Object.entries(expect)) {
    const [vx, vy] = vec[d];
    await touch('touchStart', [{ x: j.x + vx * 70, y: j.y + vy * 70, id: 20 }]);
    await touch('touchStart', [{ x: j.x + vx * 70, y: j.y + vy * 70, id: 20 }, { x: c5.x, y: c5.y, id: 21 }]);
    await wait(80);
    got.push(`${d}:${await screenText()}`);
    ok((await screenText()) === name, `stick ${d} + 5 = ${name}`);
    await touch('touchEnd', []);
    await wait(60);
  }
  await page.screenshot({ path: `${OUT}/playing.png` });

  // Function buttons
  await page.locator('#keyBtn').tap();
  await wait(150);
  ok((await page.locator('#scrKey').textContent()) === 'KEY D♭', 'KEY cycles to D♭');
  const names2 = await page.locator('.chord .cname').allTextContents();
  ok(names2.join(',') === 'D♭,E♭m,Fm,G♭,A♭,B♭m,Cdim', `labels in D♭: ${names2.join(',')}`);
  await page.locator('#soundBtn').tap();
  await wait(200);
  ok((await page.locator('#scrPreset').textContent()) === 'PLUCK', 'SOUND cycles to Pluck');

  // Every preset makes sound
  for (let i = 0; i < 6; i++) {
    const p = await page.locator('#scrPreset').textContent();
    await touch('touchStart', [{ x: c1.x, y: c1.y, id: 30 }]);
    await wait(700);
    const l = await level();
    ok(l > -45, `preset ${p} is audible (${l.toFixed(1)} dB)`);
    await touch('touchEnd', []);
    await page.locator('#soundBtn').tap();
    await wait(1500);
  }

  // Arp
  await page.locator('#arpBtn').tap();
  await wait(100);
  ok((await page.locator('#scrArp').textContent()) === 'ARP UP', 'ARP cycles to UP');
  await page.evaluate(() => { window.__arp = []; window.__jc.engine.on('arp', (a) => window.__arp.push(a.note)); });
  await touch('touchStart', [{ x: c1.x, y: c1.y, id: 40 }]);
  await wait(1500);
  await touch('touchEnd', []);
  const arp = await page.evaluate(() => window.__arp);
  // In Db with the pluck: upper voices then the octave, rising, starting right away.
  const rising = arp.slice(0, 3).every((n, i, a) => i === 0 || n > a[i - 1]);
  ok(arp.length >= 5 && rising, `arp UP plays rising notes in time (${arp.length} notes: ${arp.slice(0, 6).join(',')})`);
  for (let i = 0; i < 4; i++) await page.locator('#arpBtn').tap(); // back to off
  ok((await page.locator('#scrArp').textContent()) === 'ARP OFF', 'ARP back to OFF');

  // Drums
  await page.locator('#drumsBtn').tap();
  await wait(1200);
  const dl = await level();
  ok(dl > -45, `drums audible (${dl.toFixed(1)} dB)`);
  for (const kit of ['80s', 'Chill', 'Lo-Fi']) {
    await page.locator('#kitBtn').tap();
    await wait(900);
    ok((await page.locator('#kitVal').textContent()) === kit, `kit -> ${kit}`);
  }
  for (let i = 0; i < 4; i++) { await page.locator('#beatBtn').tap(); await wait(400); }
  await page.locator('#drumsBtn').tap();

  // Looper: speed up to 160 to keep the test short
  await page.evaluate(() => { window.__jc.engine.setBpm(160); });
  await page.locator('#recBtn').tap();
  await wait(100);
  ok(await page.locator('#recBtn').evaluate((e) => e.classList.contains('blink')), 'REC blinks during count-in');
  // wait for recording to start
  await page.waitForFunction(() => window.__jc.engine.loop.state === 'recording', null, { timeout: 5000 });
  const bar = 60 / 160 * 4 * 1000;
  for (const deg of [1, 5]) {
    const c = await center(page, `.chord[data-deg="${deg}"] .cap`);
    await touch('touchStart', [{ x: c.x, y: c.y, id: 50 }]);
    await wait(bar * 0.95);
    await touch('touchEnd', []);
    await wait(bar * 0.05);
  }
  await page.locator('#recBtn').tap();
  await wait(200);
  const info = await page.evaluate(() => window.__jc.engine.loopInfo());
  ok(info.state === 'playing' && info.bars === 2 && info.chords === 2, `loop recorded: ${JSON.stringify(info)}`);
  // Loop plays back by itself
  const seen = await page.evaluate(() => new Promise((res) => {
    const got = [];
    window.__jc.engine.on('loopchord', (n) => got.push(n.voicing.bass));
    setTimeout(() => res(got), 3200);
  }));
  ok(seen.length >= 2, `loop plays chords back on its own (${seen.length} chord events)`);
  const ll = await level();
  ok(ll > -45, `loop audible (${ll.toFixed(1)} dB)`);
  // Drop
  await page.locator('#dropBtn').tap();
  await wait(300);
  ok(await page.locator('#dropBtn').evaluate((e) => e.classList.contains('on')), 'DROP cuts drums and loop');
  await page.locator('#dropBtn').tap();
  await page.waitForFunction(() => !document.querySelector('#dropBtn').classList.contains('blink'), null, { timeout: 4000 });
  ok(true, 'DROP brings everything back on the next bar');
  await page.locator('#playBtn').tap();
  await wait(100);
  ok((await page.evaluate(() => window.__jc.engine.loop.state)) === 'stopped', 'PLAY stops the loop');
  await page.locator('#clearBtn').tap();

  // Faders
  const tf = await page.locator('#tempoFader .fader-track').boundingBox();
  await page.touchscreen.tap(tf.x + tf.width, tf.y + tf.height / 2);
  ok((await page.locator('#tempoVal').textContent()) === '160', 'tempo fader max = 160');
  await page.touchscreen.tap(tf.x + 1, tf.y + tf.height / 2);
  ok(Number(await page.locator('#tempoVal').textContent()) <= 61, 'tempo fader min ~ 60');

  // Lesson: guide mode
  await page.locator('#learnBtn').click();
  await wait(500);
  await page.locator('.lesson-item[data-id="pop4"]').click();
  await wait(200);
  ok(await page.locator('.chord[data-deg="1"]').evaluate((e) => e.classList.contains('guide')), 'lesson lights up button 1');
  for (const deg of [1, 5, 6, 4]) {
    const c = await center(page, `.chord[data-deg="${deg}"] .cap`);
    await touch('touchStart', [{ x: c.x, y: c.y, id: 60 }]);
    await wait(150);
    await touch('touchEnd', []);
    await wait(450);
  }
  const lit = await page.locator('.chord.guide').getAttribute('data-deg');
  ok(lit === '1', `after 1-5-6-4 the guide moved on to the repeat (lit: ${lit})`);
  await page.screenshot({ path: `${OUT}/lesson.png` });

  // Storage persisted
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jahanchord:v1')).settings.key);
  ok(saved === 'Db', `settings saved to localStorage (key ${saved})`);

  // Settings sheet
  await page.locator('#settingsBtn').click();
  await wait(300);
  await page.screenshot({ path: `${OUT}/settings.png` });
  ok(errors.length === 0, `no console errors in behaviour run ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------- toasts: first chord + reload persistence ----------
{
  const { ctx, page } = await newPage(1180, 820);
  await page.touchscreen.tap(590, 410);
  await wait(800);
  const c = await center(page, '.chord[data-deg="1"] .cap');
  await page.touchscreen.tap(c.x, c.y);
  await wait(1700);
  const t = await page.locator('.toast').textContent().catch(() => '');
  ok(t.includes('30K'), `first chord toast: "${t}"`);
  await page.screenshot({ path: `${OUT}/toast.png` });
  // Dim chord right after: suppressed by cooldown
  const c7 = await center(page, '.chord[data-deg="7"] .cap');
  await page.touchscreen.tap(c7.x, c7.y);
  await wait(5000);
  const t2 = await page.locator('.toast').count();
  ok(t2 === 0, 'second toast suppressed by the 3.5 minute cooldown');
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll iPad checks passed.');
process.exit(fails ? 1 : 0);
