// Browser test for the shared joystick: mouse-only desktop, then touch emulation.
// Usage: node scripts/joystick-browser-test.mjs <url> <app>   (app: jahanchord | swarapetti)
import { chromium } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:4173/';
const APP = process.argv[3] || 'jahanchord';
const SEL = {
  jahanchord: { stick: '#joy', well: '#joy .joy-well', lock: '#joyLock', key1: '.chord[data-deg="1"] .cap', readout: '#scrChord', upNote: 'Cmaj7', plain: 'C' },
  swarapetti: { stick: '#joy', well: '#joy .joy-well', lock: '#joyLock', key1: '.swara-key[data-deg="0"]', readout: '#scrSwara', upNote: 'Ṡ', plain: 'S' },
}[APP];

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function open(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const dirOf = (page) => page.locator(SEL.stick).getAttribute('data-dir');
const centre = async (page) => { const b = await page.locator(SEL.well).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 }; };

// ---------- 1. Mouse only (laptop) ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await page.mouse.click(720, 450); // welcome / start
  await page.waitForTimeout(700);
  const c = await centre(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x, c.y - c.r * 0.7, { steps: 6 });
  ok((await dirOf(page)) === 'u', 'mouse drag up sets the stick to up');
  await page.mouse.move(c.x + 400, c.y - 400, { steps: 6 });
  ok((await dirOf(page)) === 'ur', 'dragging keeps working after leaving the stick (pointer capture)');
  await page.mouse.up();
  await wait(300);
  ok((await dirOf(page)) === 'c', 'unlatched: releasing springs back to centre');

  // Latch with the lock button, then set the stick with a click and play with the mouse.
  await page.locator(SEL.lock).click();
  ok(await page.locator(SEL.stick).evaluate((e) => e.classList.contains('latched')), 'lock button turns latch on');
  await page.mouse.click(c.x, c.y - c.r * 0.7);
  await wait(250);
  ok((await dirOf(page)) === 'u', 'latched: a click on the up position stays up after release');
  const knob = await page.locator(`${SEL.stick} .joy-knob`).evaluate((e) => e.style.transform);
  ok(/-\d/.test(knob), `latched position is visible on the knob (${knob})`);
  const k = await page.locator(SEL.key1).boundingBox();
  await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
  await page.mouse.down();
  await wait(250);
  ok((await page.locator(SEL.readout).textContent()).trim() === SEL.upNote, `then a mouse press on button 1 plays ${SEL.upNote}`);
  await page.mouse.up();
  // Tap on the centre returns it.
  await page.mouse.click(c.x, c.y);
  await wait(250);
  ok((await dirOf(page)) === 'c', 'latched: a tap on the centre returns the stick to centre');
  // Double-click anywhere returns it too.
  await page.mouse.click(c.x - c.r * 0.7, c.y);
  await wait(450);
  ok((await dirOf(page)) === 'l', 'latched: click left stays left');
  await page.mouse.dblclick(c.x - c.r * 0.7, c.y);
  await wait(250);
  ok((await dirOf(page)) === 'c', 'double-click returns the stick to centre');

  // Keyboard: WASD + arrows, L toggles latch.
  await page.keyboard.press('l');
  ok(!(await page.locator(SEL.stick).evaluate((e) => e.classList.contains('latched'))), 'L toggles latch off');
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await wait(60);
  ok((await dirOf(page)) === 'ur', 'W+D = up-right');
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  await wait(60);
  ok((await dirOf(page)) === 'c', 'releasing keys springs back when unlatched');
  await page.keyboard.press('L');
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.up('ArrowLeft');
  await wait(60);
  ok((await dirOf(page)) === 'l', 'latched: arrow key direction stays after release');
  await page.keyboard.down('1');
  await wait(200);
  await page.keyboard.up('1');
  ok((await page.locator(SEL.readout).textContent()).trim().length > 0, 'number key 1 plays the first button');
  await page.keyboard.press('l');
  await wait(60);
  ok((await dirOf(page)) === 'c', 'turning latch off returns the stick to centre');
  ok(errors.length === 0, `no errors (mouse) ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------- 2. Touch emulation (iPad), multi-touch ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });
  await page.touchscreen.tap(590, 410);
  await page.waitForTimeout(700);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const c = await centre(page);
  const kb = await page.locator(SEL.key1).boundingBox();
  const kp = { x: kb.x + kb.width / 2, y: kb.y + kb.height / 2, id: 2 };
  const sp = { x: c.x, y: c.y - c.r * 0.7, id: 1 };
  await touch('touchStart', [{ ...sp, x: c.x, y: c.y }]);
  await touch('touchMove', [sp]);
  await touch('touchStart', [sp, kp]);
  await wait(200);
  ok((await dirOf(page)) === 'u' && (await page.locator(SEL.readout).textContent()).trim() === SEL.upNote, `thumb on stick + finger on button 1 = ${SEL.upNote}`);
  await touch('touchEnd', [sp]);
  await wait(250);
  ok((await dirOf(page)) === 'c', 'lifting the thumb springs back');
  ok((await page.locator(SEL.readout).textContent()).trim() === SEL.plain, `still holding button 1 = ${SEL.plain}`);
  await touch('touchEnd', []);
  // Latch with a tap, set by touch, lift, stays.
  await page.locator(SEL.lock).tap();
  await touch('touchStart', [{ x: c.x + c.r * 0.7, y: c.y, id: 5 }]);
  await touch('touchEnd', []);
  await wait(200);
  ok((await dirOf(page)) === 'r', 'touch + latch: stick stays right after lifting');
  await page.touchscreen.tap(c.x, c.y);
  await wait(200);
  ok((await dirOf(page)) === 'c', 'touch + latch: tapping the centre returns it');
  ok(errors.length === 0, `no errors (touch) ${errors.join(' | ')}`);
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll joystick browser checks passed.');
process.exit(fails ? 1 : 0);
