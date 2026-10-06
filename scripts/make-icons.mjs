// Renders the app icon SVG to PNGs. Run once: node scripts/make-icons.mjs
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a322b"/><stop offset="1" stop-color="#231e1a"/></linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f2e5"/><stop offset="1" stop-color="#ddd1b9"/></linearGradient>
    <radialGradient id="knob" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="#e1866f"/><stop offset="0.5" stop-color="#b5523b"/><stop offset="1" stop-color="#873925"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)">
    <rect x="56" y="118" width="400" height="276" rx="56" fill="#9d9077"/>
    <rect x="56" y="104" width="400" height="276" rx="56" fill="url(#body)"/>
    <rect x="186" y="140" width="236" height="96" rx="18" fill="#1d1915"/>
    <text x="304" y="207" font-family="Menlo, monospace" font-size="54" font-weight="700" fill="#ffc163" text-anchor="middle">Am7</text>
    <circle cx="124" cy="190" r="46" fill="#2f2924"/>
    <circle cx="124" cy="186" r="30" fill="url(#knob)"/>
    <g fill="#f4ecdb" stroke="#b7aa90" stroke-width="3">
      <rect x="92" y="268" width="40" height="72" rx="12"/><rect x="140" y="268" width="40" height="72" rx="12"/>
      <rect x="188" y="268" width="40" height="72" rx="12"/><rect x="236" y="268" width="40" height="72" rx="12"/>
      <rect x="284" y="268" width="40" height="72" rx="12"/><rect x="332" y="268" width="40" height="72" rx="12"/>
      <rect x="380" y="268" width="40" height="72" rx="12"/>
    </g>
    <g fill="#d9a52f"><rect x="92" y="268" width="40" height="8" rx="3"/><rect x="236" y="268" width="40" height="8" rx="3"/><rect x="284" y="268" width="40" height="8" rx="3"/></g>
    <rect x="380" y="268" width="40" height="8" rx="3" fill="#b5523b"/>
  </g>
</svg>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const out = [
  ['public/icons/icon-512.png', 512, 1],
  ['public/icons/icon-192.png', 192, 1],
  ['public/icons/apple-touch-icon.png', 180, 1],
  ['public/icons/icon-maskable-512.png', 512, 0.8],
];
for (const [file, size, pad] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
  console.log('wrote', file);
}
await browser.close();
