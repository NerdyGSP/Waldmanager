// Zwischenspeicher für lesende Supabase-Abfragen (IndexedDB), damit die App ohne Netz zuletzt geladene Daten zeigt.
// Gilt für PostgREST-GET-Abfragen und eine Liste rein lesender RPCs. Schreibzugriffe laufen nie über den Cache.
const DB_NAME = 'waldmanager-offline';
const STORE = 'antworten';
const MAX_ALTER_MS = 30 * 24 * 3600 * 1000;
const LESENDE_RPC = new Set(['karte_daten', 'bestaende_flaechen', 'funde_laden', 'betrieb_letzte_logins', 'masteradmin_letzte_logins']);

type Eintrag = { status: number; body: string; headers: Array<[string, string]>; zeit: number };

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB fehlt'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

async function lesen(key: string): Promise<Eintrag | undefined> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const r = d.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as Eintrag | undefined);
      r.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function schreiben(key: string, e: Eintrag): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((resolve) => {
      const t = d.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(e, key);
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    });
  } catch {
    /* Speicher voll oder gesperrt – dann gibt es eben keinen Offline-Wert */
  }
}

/** Alles löschen (Abmeldung): gespeicherte Daten gehören zum angemeldeten Konto */
export async function offlineCacheLeeren(): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((resolve) => {
      const t = d.transaction(STORE, 'readwrite');
      t.objectStore(STORE).clear();
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
    });
  } catch {
    /* egal */
  }
}

/** Einträge löschen, die älter als 30 Tage sind */
export async function offlineCacheAufraeumen(): Promise<void> {
  try {
    const d = await db();
    const t = d.transaction(STORE, 'readwrite');
    const os = t.objectStore(STORE);
    const c = os.openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) return;
      if (Date.now() - (cur.value as Eintrag).zeit > MAX_ALTER_MS) cur.delete();
      cur.continue();
    };
  } catch {
    /* egal */
  }
}

// ----- Hinweis „zeigt gespeicherte Daten“ -----
const EREIGNIS = 'waldmanager:aus-cache';
let zuletztAusCache = 0;
export function zuletztAusCacheAm() {
  return zuletztAusCache;
}
export const AUS_CACHE_EREIGNIS = EREIGNIS;

function nutzerKennung(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const s = JSON.parse(localStorage.getItem(k) ?? 'null') as { user?: { id?: string } } | null;
        if (s?.user?.id) return s.user.id;
      }
    }
  } catch {
    /* ignorieren */
  }
  return 'anon';
}

function cacheSchluessel(input: RequestInfo | URL, init?: RequestInit): string | null {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const methode = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const pfad = new URL(url, window.location.href).pathname;
  if (!pfad.includes('/rest/v1/')) return null;
  const h = new Headers(init?.headers);
  const kopf = `${h.get('accept') ?? ''}|${h.get('prefer') ?? ''}|${h.get('range') ?? ''}`;
  if (methode === 'GET') return `${nutzerKennung()}|GET|${url}|${kopf}`;
  if (methode === 'POST' && pfad.includes('/rest/v1/rpc/')) {
    const name = pfad.split('/rpc/')[1]!;
    if (LESENDE_RPC.has(name) && typeof init?.body === 'string') return `${nutzerKennung()}|RPC|${url}|${init.body}`;
  }
  return null;
}

/** fetch mit Offline-Rückfall für lesende Abfragen; für alles andere ein normales fetch */
export async function cachingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const key = cacheSchluessel(input, init);
  if (!key) return fetch(input, init);
  const treffer = await lesen(key);
  const ausCache = () => {
    zuletztAusCache = Date.now();
    window.dispatchEvent(new Event(EREIGNIS));
    return new Response(treffer!.body, { status: treffer!.status, headers: treffer!.headers });
  };
  if (treffer && !navigator.onLine) return ausCache();
  try {
    // Gibt es einen gespeicherten Wert, nicht ewig auf ein schlechtes Netz warten
    let res: Response;
    if (treffer) {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 8000);
      init?.signal?.addEventListener('abort', () => ctl.abort());
      try {
        res = await fetch(input, { ...init, signal: ctl.signal });
      } finally {
        window.clearTimeout(t);
      }
    } else {
      res = await fetch(input, init);
    }
    if (res.status === 200 || res.status === 206) {
      const kopie = res.clone();
      void kopie.text().then((body) =>
        schreiben(key, {
          status: res.status,
          body,
          zeit: Date.now(),
          headers: ['content-type', 'content-range'].flatMap((n) => (res.headers.get(n) ? [[n, res.headers.get(n)!] as [string, string]] : [])),
        }),
      );
    }
    return res;
  } catch (e) {
    if (treffer && !(init?.signal as AbortSignal | undefined)?.aborted) return ausCache();
    throw e;
  }
}
