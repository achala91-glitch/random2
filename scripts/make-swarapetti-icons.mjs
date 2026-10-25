// Renders Swarapetti's app icon to PNGs. Run once: node scripts/make-swarapetti-icons.mjs
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const dots = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  dots.push(`<circle cx="${256 + Math.cos(a) * 196}" cy="${256 + Math.sin(a) * 196}" r="${i % 2 ? 4 : 6}" fill="#d4ad61" fill-opacity="${i % 2 ? 0.45 : 0.75}"/>`);
}
const svg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="#6e2129"/><stop offset="0.65" stop-color="#3a1016"/><stop offset="1" stop-color="#2a0b10"/></radialGradient>
    <radialGradient id="brass" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="#fff2cf"/><stop offset="0.35" stop-color="#d4ad61"/><stop offset="0.75" stop-color="#a27b34"/><stop offset="1" stop-color="#7d5c22"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    ${dots.join('')}
    <g fill="none" stroke="#d4ad61" stroke-opacity="0.35" stroke-width="3">
      <path d="M256 70c40 0 40 60 0 60s-40-60 0-60zM256 382c40 0 40 60 0 60s-40-60 0-60zM70 256c0-40 60-40 60 0s-60 40-60 0zM382 256c0-40 60-40 60 0s-60 40-60 0z"/>
    </g>
    <circle cx="256" cy="256" r="150" fill="url(#brass)"/>
    <circle cx="256" cy="256" r="150" fill="none" stroke="#5a3a10" stroke-opacity="0.45" stroke-width="3"/>
    <circle cx="256" cy="256" r="128" fill="none" stroke="#fff2cf" stroke-opacity="0.45" stroke-width="2"/>
    <text x="256" y="300" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-weight="600" font-size="150" fill="#3a1016">Sa</text>
  </g>
</svg>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
for (const [file, size, scale] of [
  ['swarapetti/public/icons/icon-512.png', 512, 1],
  ['swarapetti/public/icons/icon-192.png', 192, 1],
  ['swarapetti/public/icons/apple-touch-icon.png', 180, 1],
  ['swarapetti/public/icons/icon-maskable-512.png', 512, 0.8],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&display=block" rel="stylesheet"></head><body style="margin:0">${svg(scale).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
  console.log('wrote', file);
}
await browser.close();
