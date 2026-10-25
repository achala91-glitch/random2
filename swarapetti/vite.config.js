import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Swarapetti builds into dist/swarapetti so it deploys at /random2/swarapetti/
// next to JahanChord. Relative base keeps it working in any subfolder.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: {
    outDir: fileURLToPath(new URL('../dist/swarapetti', import.meta.url)),
    emptyOutDir: true,
    target: 'safari15',
  },
  server: { host: true, fs: { allow: ['..'] } },
});
