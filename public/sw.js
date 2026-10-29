// Zwischenspeicher für Kartenkacheln (Luftbild LGLN, OpenStreetMap): spart mobile Daten,
// weil Kacheln beim erneuten Öffnen der Karte nicht noch einmal geladen werden.
const CACHE = 'hegewerk-karten-v1';
const MAX_EINTRAEGE = 5000;
const MAX_ALTER_MS = 60 * 24 * 3600 * 1000;
const HOSTS = ['opendata.lgln.niedersachsen.de', 'tile.openstreetmap.org'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!HOSTS.includes(url.hostname)) return;
  event.respondWith(kachel(req));
});

async function kachel(req) {
  const cache = await caches.open(CACHE);
  const treffer = await cache.match(req);
  if (treffer) {
    const datum = Number(treffer.headers.get('x-hegewerk-geladen')) || 0;
    if (Date.now() - datum < MAX_ALTER_MS) return treffer;
  }
  try {
    const antwort = await fetch(req);
    const typ = antwort.headers.get('content-type') || '';
    // Nur echte Bilder merken (WMS liefert Fehler als XML mit Status 200)
    if (antwort.ok && typ.startsWith('image/')) {
      const kopf = new Headers(antwort.headers);
      kopf.set('x-hegewerk-geladen', String(Date.now()));
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
