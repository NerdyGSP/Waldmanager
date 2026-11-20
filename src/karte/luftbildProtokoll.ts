import { addProtocol } from 'maplibre-gl';
import { LUFTBILDER, kachelQuellen, kachelUrl, type LuftbildId } from './luftbild';

// Eigenes Kachelprotokoll „luftbild://<vorrang>/{z}/{x}/{y}“ für die Luftbild-Ebene:
// - Im Landesinneren lädt es genau eine JPEG-Kachel des zuständigen Landes (wie bisher).
// - Im Grenzstreifen lädt es die Kachel bei allen beteiligten Ländern als PNG, macht leere (weiße) Bereiche durchsichtig
//   und legt die Bilder übereinander, die Vorrang-Quelle oben. So schließt die Nachbarkarte die Lücke.
// Die einzelnen WMS-Abrufe laufen weiter über fetch und damit durch den Kachel-Cache des Service Workers.

const GROESSE = 256;
// Weiß gilt als „kein Bild“; die Dienste füllen außerhalb ihres Landes weiß auf
const WEISS = 250;

let registriert = false;

export function luftbildProtokollRegistrieren(): void {
  if (registriert) return;
  registriert = true;
  addProtocol('luftbild', async (params, abort) => {
    const m = /^luftbild:\/\/([a-z]+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (!m) throw new Error(`Ungültige Luftbild-Adresse: ${params.url}`);
    const vorrang = (m[1]! in LUFTBILDER ? m[1] : 'ni') as LuftbildId;
    const [z, x, y] = [Number(m[2]), Number(m[3]), Number(m[4])];
    const ids = kachelQuellen(z, x, y, vorrang);

    if (ids.length === 0) return { data: await leereKachel() };
    if (ids.length === 1) return { data: await bildLaden(kachelUrl(LUFTBILDER[ids[0]!], z, x, y, false), abort.signal) };

    // Grenzstreifen: alle beteiligten Dienste laden; fehlt einer (Störung, CORS), bleibt der andere sichtbar
    const bilder = await Promise.all(
      ids.map((id) =>
        bildLaden(kachelUrl(LUFTBILDER[id], z, x, y, true), abort.signal)
          .then((b) => createImageBitmap(new Blob([b])))
          .catch(() => null),
      ),
    );
    if (abort.signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    if (bilder.every((b) => !b)) throw new Error('Luftbild an der Landesgrenze nicht verfügbar');

    const ziel = leinwand();
    const zielKontext = ziel.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    const zwischen = leinwand();
    const zwischenKontext = zwischen.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    for (const bild of bilder) {
      if (!bild) continue;
      zwischenKontext.clearRect(0, 0, GROESSE, GROESSE);
      zwischenKontext.drawImage(bild, 0, 0, GROESSE, GROESSE);
      bild.close();
      const pixel = zwischenKontext.getImageData(0, 0, GROESSE, GROESSE);
      const d = pixel.data;
      for (let i = 0; i < d.length; i += 4) if (d[i]! >= WEISS && d[i + 1]! >= WEISS && d[i + 2]! >= WEISS) d[i + 3] = 0;
      zwischenKontext.putImageData(pixel, 0, 0);
      zielKontext.drawImage(zwischen, 0, 0);
    }
    return { data: await createImageBitmap(ziel) };
  });
}

async function bildLaden(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const antwort = await fetch(url, { signal });
  // WMS meldet Fehler oft als XML mit Status 200
  if (!antwort.ok || !(antwort.headers.get('content-type') ?? '').startsWith('image/')) {
    throw new Error(`Luftbild nicht geladen (${antwort.status})`);
  }
  return antwort.arrayBuffer();
}

// Safari kennt OffscreenCanvas mit 2D-Kontext erst ab iOS 16.4 – vorher auf ein normales Canvas ausweichen
let offscreen2d: boolean | null = null;

function leinwand(): HTMLCanvasElement | OffscreenCanvas {
  if (offscreen2d === null) {
    try {
      offscreen2d = typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(1, 1).getContext('2d');
    } catch {
      offscreen2d = false;
    }
  }
  if (offscreen2d) return new OffscreenCanvas(GROESSE, GROESSE);
  const c = document.createElement('canvas');
  c.width = GROESSE;
  c.height = GROESSE;
  return c;
}

async function leereKachel(): Promise<ImageBitmap> {
  return createImageBitmap(leinwand());
}
