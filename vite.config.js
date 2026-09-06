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
        // Two chunks nothing here can ever load. jsPDF imports html2canvas and DOMPurify lazily for
        // its `doc.html()` API, which draws a DOM into a page; the statement and the invoice sheet
        // are both drawn by hand, so that call is made nowhere. Rollup still emits the chunks and
        // the pattern above still precaches them - a quarter of a megabyte fetched on every install
        // and after every release, for code no click can reach.
        globIgnores: ['**/html2canvas*.js', '**/purify*.js'],
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
    port: 5182,
  },
});
