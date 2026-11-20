// Amtliche Luftbilder (DOP) der Länder als WMS in EPSG:3857 – alle unter dl-de/zero-2.0.
// NI, NW und HE am 20.11.2026 mit CRS=EPSG:3857 im Browser geprüft.

export type LuftbildId = 'ni' | 'nw' | 'he';
export type LuftbildWahl = 'auto' | LuftbildId;

export type LuftbildQuelle = {
  id: LuftbildId;
  /** Land, für Auswahlliste */
  land: string;
  /** Kurzname des Anbieters, für Ebenenbeschriftung */
  kurz: string;
  /** WMS-Endpunkt und Ebene */
  wms: string;
  ebene: string;
  attribution: string;
  /** Landesausdehnung [W, S, O, N] – außerhalb fragt MapLibre keine Kacheln an */
  bounds: [number, number, number, number];
  /** höchste sinnvolle Zoomstufe am PC (NRW hat 10 cm, NI und HE 20 cm Bodenauflösung) */
  maxzoom: number;
};

const jahr = new Date().getFullYear();

export const LUFTBILDER: Record<LuftbildId, LuftbildQuelle> = {
  ni: {
    id: 'ni',
    land: 'Niedersachsen',
    kurz: 'LGLN',
    wms: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms',
    ebene: 'ni_dop20',
    attribution: `Luftbild © GeoBasis-DE/LGLN ${jahr}, Daten geändert`,
    bounds: [6.6, 51.29, 11.6, 53.9],
    maxzoom: 19,
  },
  nw: {
    id: 'nw',
    land: 'Nordrhein-Westfalen',
    kurz: 'Geobasis NRW',
    wms: 'https://www.wms.nrw.de/geobasis/wms_nw_dop',
    ebene: 'nw_dop_rgb',
    attribution: `Luftbild © Geobasis NRW ${jahr}`,
    bounds: [5.86, 50.32, 9.47, 52.54],
    maxzoom: 20,
  },
  he: {
    id: 'he',
    land: 'Hessen',
    kurz: 'HVBG',
    wms: 'https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows',
    ebene: 'he_dop_rgb',
    attribution: `Luftbild © HVBG ${jahr}`,
    bounds: [7.77, 49.39, 10.24, 51.66],
    maxzoom: 19,
  },
};

export const LUFTBILD_IDS = Object.keys(LUFTBILDER) as LuftbildId[];

// Grobe Landesumrisse (lon, lat) für die automatische Wahl und den Grenzstreifen. Gemeinsame Grenzen werden nur
// einmal beschrieben, damit sich die Umrisse nicht widersprechen. Genauigkeit wenige Kilometer – der Grenzstreifen
// (STREIFEN) ist breiter, und für die Betriebsmitte gibt es die Wahl von Hand im Ebenen-Menü.
type Linie = [number, number][];

/** NRW–Niedersachsen, von der niederländischen Grenze (Gronau) bis Bad Karlshafen */
const GRENZE_NW_NI: Linie = [
  [7.03, 52.29], [7.4, 52.36], [7.65, 52.44], [7.8, 52.33], [7.98, 52.25], [7.95, 52.17], [8.08, 52.06], [8.3, 52.12],
  [8.45, 52.2], [8.4, 52.4], [8.7, 52.53], [8.9, 52.42], [9.1, 52.4], [9.05, 52.22], [8.95, 52.18], [9.1, 52.1],
  [9.25, 51.97], [9.38, 51.85], [9.4, 51.72], [9.42, 51.64],
];
/** NRW–Hessen, von Bad Karlshafen bis Burbach/Haiger */
const GRENZE_NW_HE: Linie = [
  [9.42, 51.64], [9.3, 51.55], [9.12, 51.45], [9.0, 51.43], [8.92, 51.4], [8.8, 51.4], [8.7, 51.33], [8.62, 51.33],
  [8.57, 51.25], [8.72, 51.25], [8.75, 51.17], [8.63, 51.08], [8.5, 51.0], [8.47, 50.93], [8.3, 50.88], [8.2, 50.8],
  [8.12, 50.69],
];
/** Hessen–Niedersachsen, von Bad Karlshafen bis Witzenhausen */
const GRENZE_HE_NI: Linie = [[9.42, 51.64], [9.55, 51.62], [9.62, 51.5], [9.62, 51.42], [9.72, 51.38], [9.85, 51.38], [9.95, 51.38]];

const rueckwaerts = (l: Linie): Linie => [...l].reverse();

const UMRISSE: Record<LuftbildId, Linie> = {
  nw: [
    ...GRENZE_NW_NI,
    ...GRENZE_NW_HE.slice(1),
    // Rheinland-Pfalz, Belgien, Niederlande
    [7.87, 50.79], [7.25, 50.62], [7.1, 50.6], [6.8, 50.35], [6.4, 50.32], [6.24, 50.55], [6.0, 50.75], [5.87, 51.05],
    [6.07, 51.2], [6.17, 51.5], [5.95, 51.8], [6.4, 51.87], [6.83, 52.0], [7.05, 52.12],
  ],
  he: [
    ...GRENZE_HE_NI,
    // Thüringen, Bayern, Baden-Württemberg, Rheinland-Pfalz
    [10.2, 51.3], [10.22, 51.05], [9.95, 50.85], [10.07, 50.5], [9.92, 50.42], [9.6, 50.3], [9.15, 50.12], [9.0, 50.05],
    [9.1, 49.75], [9.0, 49.55], [8.9, 49.39], [8.6, 49.5], [8.47, 49.6], [8.35, 49.85], [8.2, 50.0], [7.8, 50.05],
    [7.78, 50.12], [7.95, 50.3], [8.05, 50.45],
    ...rueckwaerts(GRENZE_NW_HE).slice(0, -1),
  ],
  ni: [
    ...GRENZE_NW_NI,
    ...GRENZE_HE_NI.slice(1),
    // Thüringen, Sachsen-Anhalt, Brandenburg, Mecklenburg-Vorpommern, Nordsee, Niederlande (Bremen/Hamburg grob eingeschlossen)
    [10.3, 51.5], [10.6, 51.55], [10.7, 51.65], [10.95, 51.9], [10.9, 52.1], [11.0, 52.35], [10.8, 52.75], [11.0, 53.0],
    [11.6, 53.05], [10.6, 53.4], [9.8, 53.55], [8.7, 53.9], [7.0, 53.75], [7.2, 53.2], [7.05, 52.65], [6.7, 52.5],
    [6.95, 52.43],
  ],
};

function imUmriss(p: [number, number], umriss: [number, number][]): boolean {
  const [x, y] = p;
  let drin = false;
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const [xi, yi] = umriss[i]!;
    const [xj, yj] = umriss[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

// ---------- Kacheln ----------

const HALB = 20037508.342789244;

/** Ausdehnung einer XYZ-Kachel in EPSG:3857 [minX, minY, maxX, maxY] */
export function kachelBbox3857(z: number, x: number, y: number): [number, number, number, number] {
  const groesse = (2 * HALB) / 2 ** z;
  return [-HALB + x * groesse, HALB - (y + 1) * groesse, -HALB + (x + 1) * groesse, HALB - y * groesse];
}

/** Ausdehnung einer XYZ-Kachel in WGS84 [W, S, O, N] */
export function kachelBboxGrad(z: number, x: number, y: number): [number, number, number, number] {
  const n = 2 ** z;
  const lon = (i: number) => (i / n) * 360 - 180;
  const lat = (j: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * j) / n))) * 180) / Math.PI;
  return [lon(x), lat(y + 1), lon(x + 1), lat(y)];
}

/** GetMap-Adresse einer Kachel; durchsichtig = PNG mit Transparenz (für den Grenzstreifen), sonst JPEG */
export function kachelUrl(q: LuftbildQuelle, z: number, x: number, y: number, durchsichtig: boolean): string {
  const format = durchsichtig ? 'image/png&TRANSPARENT=TRUE' : 'image/jpeg';
  return (
    `${q.wms}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=${format}&LAYERS=${q.ebene}` +
    `&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX=${kachelBbox3857(z, x, y).join(',')}`
  );
}

// Breite des Grenzstreifens in Breitengrad (≈ 7 km): deckt die Ungenauigkeit der groben Umrisse ab
const STREIFEN = 0.06;

/** Abstand eines Punkts zum Umriss in Breitengrad, Längen mit cos(Breite) gestaucht */
function abstandZumRand(p: [number, number], umriss: [number, number][]): number {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const px = p[0] * k;
  const py = p[1];
  let min = Infinity;
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const ax = umriss[j]![0] * k, ay = umriss[j]![1];
    const bx = umriss[i]![0] * k, by = umriss[i]![1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return min;
}

/**
 * Welche Dienste eine Kachel braucht, von unten nach oben (die Vorrang-Quelle zuletzt).
 * Im Landesinneren genau einer – dann reicht ein JPEG. Im Grenzstreifen mehrere, die übereinandergelegt werden,
 * damit dort, wo ein Dienst kein Bild hat, der Nachbar sichtbar ist.
 */
export function kachelQuellen(z: number, x: number, y: number, vorrang: LuftbildId): LuftbildId[] {
  const [w, s, o, n] = kachelBboxGrad(z, x, y);
  const mitte: [number, number] = [(w + o) / 2, (s + n) / 2];
  const halbeDiagonale = Math.hypot(((o - w) / 2) * Math.cos((mitte[1] * Math.PI) / 180), (n - s) / 2);
  const ids: LuftbildId[] = [];
  for (const id of LUFTBILD_IDS) {
    const umriss = UMRISSE[id];
    const drin = imUmriss(mitte, umriss);
    const abstand = abstandZumRand(mitte, umriss);
    if (drin && abstand > STREIFEN + halbeDiagonale) return [id]; // sicher nur dieses Land
    if (drin || abstand < STREIFEN + halbeDiagonale) ids.push(id);
  }
  return ids.sort((a, b) => Number(a === vorrang) - Number(b === vorrang));
}

/** Vorschlag anhand der Betriebsmitte nach Landesumriss */
export function luftbildFuer(mitte: [number, number] | null): LuftbildId | null {
  if (!mitte) return null;
  return LUFTBILD_IDS.find((id) => imUmriss(mitte, UMRISSE[id])) ?? null;
}

/** Wirksame Quelle: Wahl von Hand, sonst Vorschlag, sonst Niedersachsen */
export function luftbildQuelle(wahl: LuftbildWahl, mitte: [number, number] | null): LuftbildQuelle {
  return LUFTBILDER[wahl === 'auto' ? (luftbildFuer(mitte) ?? 'ni') : wahl];
}

// Wahl von Hand je Gerät und Betrieb merken
export const LUFTBILD_SPEICHER = 'waldmanager.karte.luftbild';

export function luftbildWahlAusRoh(roh: unknown, betriebId: string): LuftbildWahl {
  const w = roh && typeof roh === 'object' ? (roh as Record<string, unknown>)[betriebId] : undefined;
  return typeof w === 'string' && (LUFTBILD_IDS as string[]).includes(w) ? (w as LuftbildId) : 'auto';
}

export function luftbildWahlLesen(betriebId: string): LuftbildWahl {
  try {
    return luftbildWahlAusRoh(JSON.parse(localStorage.getItem(LUFTBILD_SPEICHER) ?? '{}'), betriebId);
  } catch {
    return 'auto';
  }
}

export function luftbildWahlSpeichern(betriebId: string, wahl: LuftbildWahl): void {
  try {
    const roh = JSON.parse(localStorage.getItem(LUFTBILD_SPEICHER) ?? '{}') as Record<string, unknown>;
    const neu = { ...(roh && typeof roh === 'object' ? roh : {}) };
    if (wahl === 'auto') delete neu[betriebId];
    else neu[betriebId] = wahl;
    localStorage.setItem(LUFTBILD_SPEICHER, JSON.stringify(neu));
  } catch {
    /* ohne Speicher gilt die Wahl nur für diese Sitzung */
  }
}
