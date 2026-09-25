import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';
import { lexoNdryshimet } from './src/lib/ndryshimet.js';

/**
 * CHANGELOG.md as `/ndryshimet.json`, for the update dialog (Components/PerditesimiIRi.jsx). Read
 * from the file at build time rather than imported into the bundle: the dialog needs the list of
 * the version that is *waiting*, and only the server has that one - the running bundle only knows
 * its own past. Not in the precache (`json` is not in `globPatterns`) for the same reason.
 */
function ndryshimetJson() {
  const permbajtja = () =>
    JSON.stringify(lexoNdryshimet(readFileSync(path.resolve(__dirname, 'CHANGELOG.md'), 'utf8')));
  return {
    name: 'fcp-ndryshimet',
    configureServer(server) {
      server.middlewares.use('/ndryshimet.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(permbajtja());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'ndryshimet.json', source: permbajtja() });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    ndryshimetJson(),
    // The app already runs entirely offline - the data never leaves IndexedDB - so the only thing
    // between it and working on a plane was fetching the assets. `public/site.webmanifest` stays
    // the manifest of record (`manifest: false`); this only adds the service worker.
    //
    // `prompt`, not `autoUpdate`: a new version waits until the user has read what it changes and
    // pressed «Përditëso» (Components/PerditesimiIRi.jsx, which registers the worker itself - hence
    // no injected register script).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        // `woff2` is Inter, the interface font: without it here the app came back offline set in
        // whatever the system offered instead. `ttf` is Quicksand, which is not on screen anywhere -
        // exportPdf.js fetches it to embed in the statement, so the PDF export works offline too.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,ttf,woff2,webmanifest}'],
        // Precache the core shell and use runtimeCaching for the heavy PDF and spreadsheet engines
        // so the initial download stays light. Also ignore html2canvas and purify that are only loaded lazily.
        globIgnores: [
          '**/html2canvas*.js',
          '**/purify*.js',
          '**/vendor-excel*',
          '**/vendor-jspdf*',
          '**/vendor-pdfjs*',
          '**/pdf.worker*',
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.includes('vendor-excel') ||
              url.pathname.includes('vendor-jspdf') ||
              url.pathname.includes('vendor-pdfjs') ||
              url.pathname.includes('pdf.worker'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fcp-on-demand-libs',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) return 'vendor-react';
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
            if (id.includes('exceljs')) return 'vendor-excel';
            if (
              id.includes('jspdf') ||
              id.includes('jspdf-autotable') ||
              id.includes('html2canvas') ||
              id.includes('canvg') ||
              id.includes('dompurify')
            ) {
              return 'vendor-jspdf';
            }
            if (id.includes('qrcode')) return 'vendor-qr';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('bootstrap') || id.includes('react-bootstrap') || id.includes('@restart')) return 'vendor-bootstrap';
            if (id.includes('date-fns')) return 'vendor-date';
            if (
              id.includes('react-router-dom') ||
              id.includes('react-dom') ||
              id.includes('/react/') ||
              id.includes('\\react\\') ||
              id.includes('scheduler')
            ) {
              return 'vendor-react';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
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

