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
  /** Kachelvorlage für MapLibre (Platzhalter {bbox-epsg-3857}) */
  url: string;
  attribution: string;
  /** Landesausdehnung [W, S, O, N] – außerhalb fragt MapLibre keine Kacheln an */
  bounds: [number, number, number, number];
  /** höchste sinnvolle Zoomstufe am PC (NRW hat 10 cm, NI und HE 20 cm Bodenauflösung) */
  maxzoom: number;
};

const wms = (basis: string, layer: string) =>
  `${basis}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/jpeg&LAYERS=${layer}` +
  '&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}';

const jahr = new Date().getFullYear();

export const LUFTBILDER: Record<LuftbildId, LuftbildQuelle> = {
  ni: {
    id: 'ni',
    land: 'Niedersachsen',
    kurz: 'LGLN',
    url: wms('https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms', 'ni_dop20'),
    attribution: `Luftbild © GeoBasis-DE/LGLN ${jahr}, Daten geändert`,
    bounds: [6.6, 51.29, 11.6, 53.9],
    maxzoom: 19,
  },
  nw: {
    id: 'nw',
    land: 'Nordrhein-Westfalen',
    kurz: 'Geobasis NRW',
    url: wms('https://www.wms.nrw.de/geobasis/wms_nw_dop', 'nw_dop_rgb'),
    attribution: `Luftbild © Geobasis NRW ${jahr}`,
    bounds: [5.86, 50.32, 9.47, 52.54],
    maxzoom: 20,
  },
  he: {
    id: 'he',
    land: 'Hessen',
    kurz: 'HVBG',
    url: wms('https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows', 'he_dop_rgb'),
    attribution: `Luftbild © HVBG ${jahr}`,
    bounds: [7.77, 49.39, 10.24, 51.66],
    maxzoom: 19,
  },
};

export const LUFTBILD_IDS = Object.keys(LUFTBILDER) as LuftbildId[];

// Grobe Landesumrisse (lon, lat) für die automatische Wahl. Bewusst vereinfacht: An der Landesgrenze kann die
// Auswahl danebenliegen – dafür gibt es die Wahl von Hand im Ebenen-Menü.
const UMRISSE: Partial<Record<LuftbildId, [number, number][]>> = {
  nw: [
    [6.0, 50.75], [5.87, 51.05], [6.07, 51.2], [6.17, 51.5], [5.95, 51.8], [6.4, 51.87], [6.83, 52.0], [7.05, 52.24],
    [7.07, 52.4], [7.4, 52.35], [7.7, 52.4], [7.95, 52.15], [8.3, 52.12], [8.45, 52.2], [8.4, 52.45], [8.7, 52.53],
    [9.05, 52.45], [9.1, 52.3], [8.92, 52.18], [9.25, 51.95], [9.42, 51.75], [9.42, 51.62], [9.17, 51.47],
    [8.85, 51.44], [8.7, 51.2], [8.5, 51.1], [8.4, 50.98], [8.15, 50.8], [8.1, 50.7], [7.87, 50.79], [7.25, 50.62],
    [7.1, 50.6], [6.8, 50.35], [6.4, 50.32], [6.24, 50.55],
  ],
  he: [
    [9.45, 51.66], [9.85, 51.4], [10.0, 51.2], [10.2, 51.0], [9.95, 50.85], [10.07, 50.5], [9.92, 50.42],
    [9.6, 50.3], [9.15, 50.12], [9.0, 50.05], [9.1, 49.75], [9.0, 49.55], [8.9, 49.39], [8.6, 49.5], [8.47, 49.6],
    [8.35, 49.85], [8.2, 50.0], [7.8, 50.05], [7.78, 50.12], [7.95, 50.3], [8.05, 50.45], [8.1, 50.7], [8.4, 50.9],
    [8.6, 51.15], [8.85, 51.3], [9.0, 51.5], [9.25, 51.6],
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

/** Vorschlag anhand der Betriebsmitte: erst NRW und Hessen nach Umriss, sonst Niedersachsen nach Ausdehnung */
export function luftbildFuer(mitte: [number, number] | null): LuftbildId | null {
  if (!mitte) return null;
  for (const id of ['nw', 'he'] as const) if (imUmriss(mitte, UMRISSE[id]!)) return id;
  const [w, s, o, n] = LUFTBILDER.ni.bounds;
  const [lon, lat] = mitte;
  return lon >= w && lon <= o && lat >= s && lat <= n ? 'ni' : null;
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
