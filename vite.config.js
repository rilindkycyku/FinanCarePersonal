import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // The app already runs entirely offline - the data never leaves IndexedDB - so the only thing
    // between it and working on a plane was fetching the assets. `public/site.webmanifest` stays
    // the manifest of record (`manifest: false`); this only adds the service worker.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        // `woff2` is Inter, the interface font: without it here the app came back offline set in
        // whatever the system offered instead. `ttf` is Quicksand, which is not on screen anywhere -
        // exportPdf.js fetches it to embed in the statement, so the PDF export works offline too.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,ttf,woff2,webmanifest}'],
        // ExcelJS alone is ~940 kB, and the statement fonts are ~80 kB each.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
  },
});
