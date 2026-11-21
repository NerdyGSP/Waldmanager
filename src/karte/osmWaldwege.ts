import type { Feature, FeatureCollection, LineString, MultiPolygon, Position } from 'geojson';
import { koordinaten, punktInFlaeche } from './kern/geometrie';

// Wald- und Feldwege aus OpenStreetMap (Testebene), abgefragt über die Overpass API und auf die Betriebsfläche
// zugeschnitten. Lizenz: ODbL – Namensnennung „© OpenStreetMap-Mitwirkende“ steht an der Basiskarte.
//
// Datenschutz („Daten bleiben im Betrieb“): Overpass bekommt nur ein grobes Rechteck – Betriebsausdehnung plus
// 1 km Rand, nach außen auf ein 0,02°-Raster (≈ 1,4 × 2,2 km) gerundet. Das entspricht den OSM-Kachelabrufen der
// Basiskarte für dieselbe Gegend. Grenze, Flurstücke und Namen bleiben im Browser; zugeschnitten wird lokal.

/** Öffentliche Overpass-Instanzen, der Reihe nach versucht (die Hauptinstanz ist oft überlastet) */
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
export const RASTER_GRAD = 0.02;
/** Rand um den Betrieb, damit das Rechteck nicht auf die Grenze schließen lässt */
export const RAND_M = 1000;
/** Größte Abfrage (Breite × Höhe in Grad), etwa 35 × 25 km */
export const MAX_AUSDEHNUNG_GRAD = 0.5;
const ZEITLIMIT_MS = 30000;
const SPEICHER_PREFIX = 'waldmanager.waldwege.';
const MAX_ALTER_MS = 30 * 24 * 3600 * 1000;

export type Ausdehnung = [west: number, sued: number, ost: number, nord: number];
export type WegArt = 'weg' | 'pfad';

// toFixed(6) fängt Gleitkomma-Reste ab (9.46 / 0.02 = 472.99999…)
const runden = (wert: number, nachOben: boolean) =>
  Number(((nachOben ? Math.ceil : Math.floor)(Number((wert / RASTER_GRAD).toFixed(6))) * RASTER_GRAD).toFixed(4));

/** Ausdehnung einer Fläche */
export function ausdehnungVon(flaeche: MultiPolygon): Ausdehnung | null {
  const k = koordinaten(flaeche);
  if (!k.length) return null;
  const xs = k.map((p) => p[0]!);
  const ys = k.map((p) => p[1]!);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Betriebsausdehnung um den Rand erweitern und nach außen aufs Raster runden; null, wenn zu groß */
export function abfrageBereich([w, s, o, n]: Ausdehnung, randM = RAND_M): Ausdehnung | null {
  const dy = randM / 111320;
  const dx = randM / (111320 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  const b: Ausdehnung = [runden(w - dx, false), runden(s - dy, false), runden(o + dx, true), runden(n + dy, true)];
  if (b[2] - b[0] > MAX_AUSDEHNUNG_GRAD + 1e-9 || b[3] - b[1] > MAX_AUSDEHNUNG_GRAD + 1e-9) return null;
  return b;
}

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

// ---------- Zuschneiden auf die Betriebsfläche ----------

/** Schnittparameter t (0…1) der Strecke a→b mit der Strecke c→d, falls vorhanden */
function schnitt(a: Position, b: Position, c: Position, d: Position): number | null {
  const rx = b[0]! - a[0]!, ry = b[1]! - a[1]!;
  const sx = d[0]! - c[0]!, sy = d[1]! - c[1]!;
  const nenner = rx * sy - ry * sx;
  if (Math.abs(nenner) < 1e-18) return null;
  const qx = c[0]! - a[0]!, qy = c[1]! - a[1]!;
  const t = (qx * sy - qy * sx) / nenner;
  const u = (qx * ry - qy * rx) / nenner;
  return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
}

const zwischen = (a: Position, b: Position, t: number): Position => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t];

/** Linie an den Rändern der Fläche teilen und nur die Stücke innerhalb behalten */
export function linieZuschneiden(linie: Position[], flaeche: MultiPolygon): Position[][] {
  const ringe = flaeche.coordinates.flat();
  const teile: Position[][] = [];
  let aktuell: Position[] | null = null;
  for (let i = 0; i < linie.length - 1; i++) {
    const a = linie[i]!, b = linie[i + 1]!;
    const ts = [0, 1];
    for (const ring of ringe) for (let j = 0; j < ring.length - 1; j++) {
      const t = schnitt(a, b, ring[j]!, ring[j + 1]!);
      if (t !== null) ts.push(t);
    }
    ts.sort((x, y) => x - y);
    for (let k = 0; k < ts.length - 1; k++) {
      const [t0, t1] = [ts[k]!, ts[k + 1]!];
      if (t1 - t0 < 1e-12) continue;
      const innen = punktInFlaeche(zwischen(a, b, (t0 + t1) / 2), flaeche);
      if (innen) {
        const p0 = zwischen(a, b, t0), p1 = zwischen(a, b, t1);
        if (!aktuell) teile.push((aktuell = [p0]));
        aktuell.push(p1);
      } else aktuell = null;
    }
  }
  return teile.filter((t) => t.length >= 2);
}

/** Alle Wege auf die Fläche zuschneiden; schnelle Vorauswahl über das Rechteck */
export function aufFlaecheZuschneiden(fc: FeatureCollection<LineString>, flaeche: MultiPolygon): FeatureCollection<LineString> {
  const box = ausdehnungVon(flaeche);
  if (!box) return { type: 'FeatureCollection', features: [] };
  const features: Feature<LineString>[] = [];
  for (const f of fc.features) {
    const k = f.geometry.coordinates;
    if (k.every((p) => p[0]! < box[0]) || k.every((p) => p[0]! > box[2]) || k.every((p) => p[1]! < box[1]) || k.every((p) => p[1]! > box[3])) continue;
    for (const teil of linieZuschneiden(k, flaeche)) features.push({ ...f, geometry: { type: 'LineString', coordinates: teil } });
  }
  return { type: 'FeatureCollection', features };
}

/** Betriebsfläche: Grenze, sonst Flurstücke und Bestände zusammen (Überlappungen sind unschädlich) */
export function betriebsFlaeche(grenze: MultiPolygon | null, weitere: Feature[]): MultiPolygon | null {
  if (grenze?.coordinates.length) return grenze;
  const polys: Position[][][] = [];
  for (const f of weitere) {
    if (f.geometry?.type === 'Polygon') polys.push(f.geometry.coordinates);
    else if (f.geometry?.type === 'MultiPolygon') polys.push(...f.geometry.coordinates);
  }
  return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
}

/** Kurzer Fingerabdruck der Fläche, damit ein geänderter Grenzverlauf neu zuschneidet */
export function flaechenSchluessel(flaeche: MultiPolygon): string {
  const k = koordinaten(flaeche);
  return `${k.length}:${k.reduce((s, p, i) => s + (p[0]! + p[1]! * 3) * ((i % 7) + 1), 0).toFixed(6)}`;
}

// ---------- Abruf ----------

/** Overpass-Instanzen der Reihe nach versuchen; der Fehler nennt jede Instanz mit Grund */
export async function overpassAbrufen(b: Ausdehnung, signal?: AbortSignal, abruf: typeof fetch = fetch): Promise<FeatureCollection<LineString>> {
  const gruende: string[] = [];
  for (const url of OVERPASS_URLS) {
    if (signal?.aborted) throw new DOMException('abgebrochen', 'AbortError');
    const zeit = new AbortController();
    const zeitlimit = setTimeout(() => zeit.abort(), ZEITLIMIT_MS);
    const weiter = () => zeit.abort();
    signal?.addEventListener('abort', weiter);
    try {
      // Formular-POST ist eine „einfache“ Anfrage ohne CORS-Vorabprüfung
      const antwort = await abruf(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassAbfrage(b))}`,
        signal: zeit.signal,
      });
      if (!antwort.ok) {
        gruende.push(`${new URL(url).hostname}: HTTP ${antwort.status}`);
        continue;
      }
      return zuGeoJSON((await antwort.json()) as { elements?: OverpassElement[] });
    } catch (err) {
      if (signal?.aborted) throw err;
      gruende.push(`${new URL(url).hostname}: ${zeit.signal.aborted ? 'Zeitüberschreitung' : 'nicht erreichbar'}`);
    } finally {
      clearTimeout(zeitlimit);
      signal?.removeEventListener('abort', weiter);
    }
  }
  throw new Error(gruende.join(' · '));
}

type Gespeichert = { schluessel: string; zeit: number; fc: FeatureCollection<LineString> };

/** Zugeschnittene Wege je Betrieb und Gerät merken (auch offline nutzbar, 30 Tage gültig) */
export function gespeicherteWege(betriebId: string, schluessel: string, speicher: Pick<Storage, 'getItem'> = localStorage, jetzt = Date.now()): FeatureCollection<LineString> | null {
  try {
    const g = JSON.parse(speicher.getItem(SPEICHER_PREFIX + betriebId) ?? 'null') as Gespeichert | null;
    return g && g.schluessel === schluessel && jetzt - g.zeit < MAX_ALTER_MS ? g.fc : null;
  } catch {
    return null;
  }
}

export function wegeSpeichern(betriebId: string, schluessel: string, fc: FeatureCollection<LineString>, speicher: Pick<Storage, 'setItem'> = localStorage, jetzt = Date.now()): void {
  try {
    speicher.setItem(SPEICHER_PREFIX + betriebId, JSON.stringify({ schluessel, zeit: jetzt, fc } satisfies Gespeichert));
  } catch {
    /* Speicher voll – gilt dann nur für diese Sitzung */
  }
}

/**
 * Waldwege des Betriebs: aus dem Gerätespeicher oder neu von Overpass, auf die Fläche zugeschnitten.
 * Wirft 'gross', wenn der Betrieb für eine Abfrage zu ausgedehnt ist.
 */
export async function betriebsWaldwege(betriebId: string, flaeche: MultiPolygon, signal?: AbortSignal, abruf: typeof fetch = fetch): Promise<FeatureCollection<LineString>> {
  const box = ausdehnungVon(flaeche);
  const bereich = box && abfrageBereich(box);
  if (!bereich) throw new Error('gross');
  const schluessel = `${bereich.join(',')}|${flaechenSchluessel(flaeche)}`;
  const vorhanden = gespeicherteWege(betriebId, schluessel);
  if (vorhanden) return vorhanden;
  const fc = aufFlaecheZuschneiden(await overpassAbrufen(bereich, signal, abruf), flaeche);
  wegeSpeichern(betriebId, schluessel, fc);
  return fc;
}

