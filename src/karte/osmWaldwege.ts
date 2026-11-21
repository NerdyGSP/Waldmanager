import type { Feature, FeatureCollection, LineString } from 'geojson';

// Wald- und Feldwege aus OpenStreetMap (Testebene), abgefragt über die Overpass API.
// Lizenz: ODbL – Namensnennung „© OpenStreetMap-Mitwirkende“ ist Pflicht (steht bereits an der Basiskarte).
// Datenschutz: Die Abfrage enthält nur den sichtbaren Kartenausschnitt (auf ein Raster gerundet), wie die
// OSM-Kachelabrufe der Basiskarte auch – keine Grenzen, Namen oder Koordinaten aus dem Betrieb.

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** Darunter wird nichts geladen – sonst würden die Abfragen zu groß */
export const WALDWEGE_MIN_ZOOM = 13;
/** Rastergröße in Grad: kleine Verschiebungen nutzen dieselbe Abfrage */
export const RASTER_GRAD = 0.02;
/** Größte Abfrage (Breite × Höhe in Grad), etwa 20 × 15 km */
export const MAX_AUSDEHNUNG_GRAD = 0.3;

export type Ausdehnung = [west: number, sued: number, ost: number, nord: number];
export type WegArt = 'weg' | 'pfad';

// toFixed(6) fängt Gleitkomma-Reste ab (9.46 / 0.02 = 472.99999…)
const runden = (wert: number, nachOben: boolean) =>
  Number(((nachOben ? Math.ceil : Math.floor)(Number((wert / RASTER_GRAD).toFixed(6))) * RASTER_GRAD).toFixed(4));

/** Kartenausschnitt auf das Raster aufrunden; null, wenn er für eine Abfrage zu groß ist */
export function abfrageBereich([w, s, o, n]: Ausdehnung): Ausdehnung | null {
  const b: Ausdehnung = [runden(w, false), runden(s, false), runden(o, true), runden(n, true)];
  if (b[2] - b[0] > MAX_AUSDEHNUNG_GRAD + 1e-9 || b[3] - b[1] > MAX_AUSDEHNUNG_GRAD + 1e-9) return null;
  return b;
}

export const bereichSchluessel = (b: Ausdehnung) => b.join(',');

/** Overpass-QL: Fahrwege (track) sowie Pfade und Reitwege, mit Geometrie */
export function overpassAbfrage([w, s, o, n]: Ausdehnung): string {
  const bbox = `${s},${w},${n},${o}`;
  return `[out:json][timeout:25];(way["highway"="track"](${bbox});way["highway"~"^(path|bridleway)$"](${bbox}););out geom;`;
}

type OverpassElement = { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };

export function wegArt(tags: Record<string, string>): WegArt {
  return tags.highway === 'track' ? 'weg' : 'pfad';
}

/** Overpass-Antwort in GeoJSON-Linien umwandeln; Elemente ohne brauchbare Geometrie fallen weg */
export function zuGeoJSON(antwort: { elements?: OverpassElement[] }): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const el of antwort.elements ?? []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    features.push({
      type: 'Feature',
      id: el.id,
      geometry: { type: 'LineString', coordinates: el.geometry.map((p) => [p.lon, p.lat]) },
      properties: {
        osm_id: el.id,
        art: wegArt(tags),
        // grade1 (befestigt) … grade5 (Erdweg); fehlt oft
        tracktype: /^grade[1-5]$/.test(tags.tracktype ?? '') ? tags.tracktype : null,
        name: tags.name ?? null,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

const zwischenspeicher = new Map<string, FeatureCollection<LineString>>();
const MAX_EINTRAEGE = 30;

/** Waldwege für einen (bereits gerundeten) Bereich laden; Ergebnisse bleiben für die Sitzung im Speicher */
export async function waldwegeLaden(b: Ausdehnung, signal?: AbortSignal, abruf: typeof fetch = fetch): Promise<FeatureCollection<LineString>> {
  const schluessel = bereichSchluessel(b);
  const vorhanden = zwischenspeicher.get(schluessel);
  if (vorhanden) return vorhanden;
  const antwort = await abruf(`${OVERPASS_URL}?data=${encodeURIComponent(overpassAbfrage(b))}`, { signal });
  if (!antwort.ok) throw new Error(`Overpass antwortet mit ${antwort.status}`);
  const fc = zuGeoJSON((await antwort.json()) as { elements?: OverpassElement[] });
  if (zwischenspeicher.size >= MAX_EINTRAEGE) zwischenspeicher.delete(zwischenspeicher.keys().next().value!);
  zwischenspeicher.set(schluessel, fc);
  return fc;
}
