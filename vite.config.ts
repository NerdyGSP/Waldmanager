import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Trägt beim Build die Dateiliste und eine Versionskennung in den Service Worker ein
function swPrecache(): Plugin {
  return {
    name: 'sw-precache',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const dist = 'dist';
      if (!existsSync(`${dist}/index.html`)) return;
      const assets = readdirSync(`${dist}/assets`).filter((f) => !f.endsWith('.map')).map((f) => `/assets/${f}`);
      const extra = ['/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'].filter((f) => existsSync(`${dist}${f}`));
      const liste = ['/index.html', ...extra, ...assets];
      const version = createHash('sha1').update(liste.join('|') + readFileSync(`${dist}/index.html`, 'utf8')).digest('hex').slice(0, 10);
      const quelle = readFileSync('public/sw.js', 'utf8')
        .replace('/*__PRECACHE__*/ []', JSON.stringify(liste))
        .replace("/*__VERSION__*/ 'dev'", JSON.stringify(version));
      writeFileSync(`${dist}/sw.js`, quelle);
    },
  };
}

export default defineConfig({
  plugins: [react(), swPrecache()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
});
