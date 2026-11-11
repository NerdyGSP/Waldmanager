// Fund-Fotos: im Browser verkleinern, bis zum Hochladen in IndexedDB halten (auch offline), dann in den Bucket „fund-fotos“.
import { supabase } from './supabase';
import { fotoPfad, zielGroesse } from './funde';

const DB_NAME = 'waldmanager-fotos';
const STORE = 'fotos';
const BUCKET = 'fund-fotos';

type Eintrag = { fundId: string; betriebId: string; blob: Blob };

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB fehlt'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'fundId' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

async function mitStore<T>(modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = f(d.transaction(STORE, modus).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Verkleinert ein Foto auf höchstens 1600 px an der langen Kante und speichert es als JPEG */
export async function verkleinern(datei: File): Promise<Blob> {
  const bild = await createImageBitmap(datei);
  const z = zielGroesse(bild.width, bild.height);
  const c = document.createElement('canvas');
  c.width = z.breite;
  c.height = z.hoehe;
  c.getContext('2d')!.drawImage(bild, 0, 0, z.breite, z.hoehe);
  bild.close();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto konnte nicht verarbeitet werden'))), 'image/jpeg', 0.8));
}

/** Foto zum Fund vormerken; hochgeladen wird es mit fotosHochladen() */
export async function fotoMerken(betriebId: string, fundId: string, blob: Blob): Promise<void> {
  await mitStore('readwrite', (s) => s.put({ fundId, betriebId, blob } satisfies Eintrag));
}

export async function wartendeFotos(): Promise<number> {
  try {
    return await mitStore('readonly', (s) => s.count());
  } catch {
    return 0;
  }
}

let laeuft = false;

/**
 * Lädt alle vorgemerkten Fotos hoch und trägt den Pfad am Fund ein.
 * Setzt voraus, dass der Fund schon auf dem Server ist; sonst bleibt das Foto vorgemerkt.
 */
export async function fotosHochladen(): Promise<void> {
  if (laeuft || !navigator.onLine) return;
  laeuft = true;
  try {
    const alle = await mitStore<Eintrag[]>('readonly', (s) => s.getAll() as IDBRequest<Eintrag[]>);
    for (const e of alle) {
      const pfad = fotoPfad(e.betriebId, e.fundId);
      const hoch = await supabase.storage.from(BUCKET).upload(pfad, e.blob, { contentType: 'image/jpeg', upsert: true });
      if (hoch.error) continue;
      const { data, error } = await supabase.from('funde').update({ foto_pfad: pfad }).eq('id', e.fundId).select('id');
      // Fund noch nicht übertragen: Foto behalten und später erneut verknüpfen
      if (error || !data?.length) continue;
      await mitStore('readwrite', (s) => s.delete(e.fundId));
    }
  } catch {
    /* ohne IndexedDB oder Netz: beim nächsten Durchlauf erneut */
  } finally {
    laeuft = false;
  }
}

/** Zeitlich begrenzter Link zum Anzeigen eines Fotos (1 Stunde) */
export async function fotoLink(pfad: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(pfad, 3600);
  return data?.signedUrl ?? null;
}
