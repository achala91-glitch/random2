// Unit tests for the shared joystick maths. Run: node scripts/test-joystick.mjs
import { vectorToDir, keysToDir, dirToVector } from '../shared/joystick.js';

let fails = 0; let n = 0;
const eq = (a, b, m) => { n++; if (a !== b) { fails++; console.log(`FAIL ${m}: got ${a}, expected ${b}`); } };
const R = 52;
eq(vectorToDir(0, 0, R), 'c', 'centre');
eq(vectorToDir(5, 5, R), 'c', 'inside deadzone');
eq(vectorToDir(0, -50, R), 'u', 'up');
eq(vectorToDir(0, 50, R), 'd', 'down');
eq(vectorToDir(-50, 0, R), 'l', 'left');
eq(vectorToDir(50, 0, R), 'r', 'right');
eq(vectorToDir(35, -35, R), 'ur', 'up-right');
eq(vectorToDir(-35, -35, R), 'ul', 'up-left');
eq(vectorToDir(35, 35, R), 'dr', 'down-right');
eq(vectorToDir(-35, 35, R), 'dl', 'down-left');
// Hysteresis: 24 degrees off "up" toward up-right stays "up" when already up, flips when coming from centre.
const a = (-90 + 24) * Math.PI / 180;
eq(vectorToDir(Math.cos(a) * 50, Math.sin(a) * 50, R, 'u'), 'u', 'hysteresis keeps up');
const a2 = (-90 + 20) * Math.PI / 180;
eq(vectorToDir(Math.cos(a2) * 50, Math.sin(a2) * 50, R, 'c'), 'u', 'nearest sector from centre');
eq(vectorToDir(Math.cos(a) * 50, Math.sin(a) * 50, R, 'c'), 'ur', 'past the sector edge from centre');
const b = (-90 + 40) * Math.PI / 180;
eq(vectorToDir(Math.cos(b) * 50, Math.sin(b) * 50, R, 'u'), 'ur', 'leaves up past the band');
eq(keysToDir(new Set()), 'c', 'no keys');
eq(keysToDir(new Set(['u'])), 'u', 'up key');
eq(keysToDir(new Set(['u', 'r'])), 'ur', 'up+right keys');
eq(keysToDir(new Set(['u', 'd'])), 'c', 'opposite keys cancel');
eq(keysToDir(new Set(['d', 'l', 'r'])), 'd', 'down with left+right cancelling');
for (const d of ['u', 'd', 'l', 'r', 'ul', 'ur', 'dl', 'dr']) {
  const [x, y] = dirToVector(d, 50);
  eq(vectorToDir(x, y, R), d, `round trip ${d}`);
}
console.log(`${n - fails}/${n} joystick checks passed.`);
if (fails) process.exit(1);
