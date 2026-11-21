import type { Feature } from 'geojson';
import { baumartenLesen, type Baumartenanteil } from './stammdaten';
import { stadiumFarbe, wuchsstadium } from './forst';

// Zonen: Teilflächen eines Bestands mit eigenem Baumarten-Mix und Pflanzjahr (z. B. nach Kyrill unterschiedlich alt).
// Durchforstungsjahre kommen aus erledigten Maßnahmen „Durchforstung“, die der Zone zugeordnet sind.

export type Zone = {
  id: string;
  bestandId: string;
  name: string;
  baumarten: Baumartenanteil[];
  pflanzjahr: number | null;
  bemerkung: string | null;
  flaecheHa: number | null;
  durchforstungen: number[];
};

/** MapLibre liefert verschachtelte Eigenschaften als JSON-Text; RPC-Antworten als Objekt */
function jsonFeld(wert: unknown): unknown {
  if (typeof wert !== 'string') return wert;
  try {
    return JSON.parse(wert) as unknown;
  } catch {
    return null;
  }
}

/** Jahre aufsteigend, ohne Doppelte und Unsinn */
export function jahreLesen(wert: unknown): number[] {
  const roh = jsonFeld(wert);
  if (!Array.isArray(roh)) return [];
  return [...new Set(roh.map(Number).filter((j) => Number.isInteger(j) && j >= 1700 && j <= 2100))].sort((a, b) => a - b);
}

/** Eigenschaften eines Zonen-Features (aus karte_daten oder einem Kartenklick) lesen */
export function zoneLesen(p: Record<string, unknown>): Zone {
  return {
    id: String(p.id),
    bestandId: String(p.bestand_id),
    name: String(p.name ?? ''),
    baumarten: baumartenLesen(jsonFeld(p.baumarten)),
    pflanzjahr: p.pflanzjahr != null && p.pflanzjahr !== '' ? Number(p.pflanzjahr) : null,
    bemerkung: (p.bemerkung as string | null) ?? null,
    flaecheHa: p.flaeche_ha != null ? Number(p.flaeche_ha) : null,
    durchforstungen: jahreLesen(p.durchforstungen),
  };
}

/** Zonen-Features für die Karte: Farbe nach Wuchsstadium */
export function zonenFuerKarte(features: Feature[], heute: Date = new Date()): Feature[] {
  return features.map((f) => {
    const pj = f.properties?.pflanzjahr;
    const stadium = wuchsstadium(pj != null ? Number(pj) : null, heute);
    return { ...f, properties: { ...f.properties, stadium, stadium_farbe: stadiumFarbe(stadium) } };
  });
}

/** „2015, 2022“ oder leer */
export function jahreText(jahre: number[]): string {
  return jahre.join(', ');
}

/** Vorschlag für den Namen einer neuen Zone: „Zone 1“, „Zone 2“ … (erste freie Nummer) */
export function naechsterZonenName(vorhandene: string[]): string {
  const belegt = new Set(vorhandene.map((n) => n.trim().toLowerCase()));
  for (let i = 1; ; i++) if (!belegt.has(`zone ${i}`)) return `Zone ${i}`;
}
