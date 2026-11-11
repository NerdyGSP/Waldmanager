// Service Worker: (1) App-Hülle offline verfügbar, (2) Kartenkacheln zwischenspeichern.
// Die Liste PRECACHE und die Version werden beim Build von vite.config.ts eingesetzt.
const PRECACHE = /*__PRECACHE__*/ [];
const VERSION = /*__VERSION__*/ 'dev';
const APP_CACHE = `waldmanager-app-${VERSION}`;
const KACHEL_CACHE = 'waldmanager-karten-v1';
const MAX_EINTRAEGE = 5000;
const MAX_ALTER_MS = 60 * 24 * 3600 * 1000;
const HOSTS = ['opendata.lgln.niedersachsen.de', 'tile.openstreetmap.org'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // Einzeln laden: ein fehlender Eintrag darf die Installation nicht verhindern, die Startseite ist Pflicht
      const ergebnisse = await Promise.allSettled(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
      const startseite = PRECACHE.indexOf('/index.html');
      if (startseite >= 0 && ergebnisse[startseite].status === 'rejected') throw new Error('Startseite nicht ladbar');
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Die letzten zwei App-Versionen behalten: offene Tabs laden ihre Teil-Dateien weiter aus der alten Version
      const namen = (await caches.keys()).filter((n) => n.startsWith('waldmanager-app-')).sort().reverse();
      await Promise.all(namen.slice(2).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (HOSTS.includes(url.hostname)) return void event.respondWith(kachel(req));
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') return void event.respondWith(seite(req));
  event.respondWith(datei(req));
});

// Seitenaufruf: Netz zuerst (kurzes Zeitlimit wegen schlechtem Empfang), sonst gespeicherte Startseite
async function seite(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const antwort = await fetch(req, { signal: ctl.signal });
    clearTimeout(t);
    if (antwort.ok && (antwort.headers.get('content-type') || '').includes('text/html')) cache.put('/index.html', antwort.clone());
    return antwort;
  } catch {
    const treffer = (await cache.match('/index.html', { ignoreVary: true })) || (await caches.match('/index.html', { ignoreVary: true }));
    if (treffer) return treffer;
    return new Response('Offline – die App wurde noch nicht vollständig geladen. Bitte einmal mit Internet öffnen.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

// Statische Dateien: Cache zuerst (Dateinamen mit Hash sind unveränderlich), sonst Netz und merken
async function datei(req) {
  const treffer = await caches.match(req, { ignoreVary: true });
  if (treffer) return treffer;
  const antwort = await fetch(req);
  if (antwort.ok && new URL(req.url).pathname.startsWith('/assets/')) {
    const cache = await caches.open(APP_CACHE);
    cache.put(req, antwort.clone());
  }
  return antwort;
}

async function kachel(req) {
  const cache = await caches.open(KACHEL_CACHE);
  const treffer = await cache.match(req);
  if (treffer) {
    const datum = Number(treffer.headers.get('x-waldmanager-geladen')) || 0;
    if (Date.now() - datum < MAX_ALTER_MS) return treffer;
  }
  try {
    const antwort = await fetch(req);
    const typ = antwort.headers.get('content-type') || '';
    // Nur echte Bilder merken (WMS liefert Fehler als XML mit Status 200)
    if (antwort.ok && typ.startsWith('image/')) {
      const kopf = new Headers(antwort.headers);
      kopf.set('x-waldmanager-geladen', String(Date.now()));
      const kopie = new Response(await antwort.clone().blob(), { status: 200, headers: kopf });
      await cache.put(req, kopie);
      aufraeumen(cache);
    }
    return antwort;
  } catch (err) {
    if (treffer) return treffer; // offline: lieber alte Kachel als keine
    throw err;
  }
}

let aufraeumenLaeuft = false;
async function aufraeumen(cache) {
  if (aufraeumenLaeuft) return;
  aufraeumenLaeuft = true;
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_EINTRAEGE) for (const k of keys.slice(0, keys.length - MAX_EINTRAEGE + 500)) await cache.delete(k);
  } finally {
    aufraeumenLaeuft = false;
  }
}
