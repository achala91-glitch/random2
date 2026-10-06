import { defineConfig } from 'vite';

// Relative base so the build works on Netlify, Vercel or a GitHub Pages subfolder.
export default defineConfig({
  base: './',
  build: { target: 'safari15', chunkSizeWarningLimit: 900 },
  server: { host: true },
});
