import type { KartenModus } from '../ebenen/typen';
import { istKartenModus } from '../modi/modi';

// Kartenzustand in der Adresse, damit Ansichten teilbar sind und Deep Links auf einzelne Objekte zeigen.
// Noch nicht an den Router angeschlossen (AP 1.6): src/lib/router.ts kennt bisher nur den Pfad.
//
//   ?k=9.47000,52.20000,14.5   Kartenmitte (Länge, Breite) und Zoom
//   &m=zaehlen                 Kartenmodus (fehlt = ansehen)
//   &a=<id>                    gespeicherte Kartenansicht
//   &o=einrichtung:<uuid>      ausgewähltes Objekt (Typ:ID)
//   &z=2026-04-01..2027-03-31  Zeitraum (ISO-Datum von..bis)

export type KartenUrlZustand = {
  ausschnitt?: { lng: number; lat: number; zoom: number };
  modus?: KartenModus;
  ansicht?: string;
  auswahl?: { typ: string; id: string };
  zeitraum?: { von: string; bis: string };
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const SCHLUESSEL = /^[A-Za-z0-9_-]{1,64}$/;

/** Liest den Kartenzustand aus `location.search`; ungültige Teile werden ignoriert */
export function ausUrl(search: string): KartenUrlZustand {
  const p = new URLSearchParams(search);
  const z: KartenUrlZustand = {};

  const k = p.get('k')?.split(',').map(Number);
  if (k?.length === 3 && k.every(Number.isFinite)) {
    const [lng, lat, zoom] = k as [number, number, number];
    if (Math.abs(lng) <= 180 && Math.abs(lat) <= 90 && zoom >= 0 && zoom <= 24) z.ausschnitt = { lng, lat, zoom };
  }

  const m = p.get('m');
  if (istKartenModus(m) && m !== 'ansehen') z.modus = m;

  const a = p.get('a');
  if (a && SCHLUESSEL.test(a)) z.ansicht = a;

  const o = p.get('o')?.split(':');
  if (o?.length === 2 && SCHLUESSEL.test(o[0]!) && SCHLUESSEL.test(o[1]!)) z.auswahl = { typ: o[0]!, id: o[1]! };

  const zeit = p.get('z')?.split('..');
  if (zeit?.length === 2 && DATUM.test(zeit[0]!) && DATUM.test(zeit[1]!) && zeit[0]! <= zeit[1]!) z.zeitraum = { von: zeit[0]!, bis: zeit[1]! };

  return z;
}

/** Schreibt den Kartenzustand als Query-String (mit führendem „?“, leer ohne Inhalt); fremde Parameter bleiben erhalten */
export function inUrl(z: KartenUrlZustand, bisher = ''): string {
  const p = new URLSearchParams(bisher);
  for (const s of ['k', 'm', 'a', 'o', 'z']) p.delete(s);
  if (z.ausschnitt) p.set('k', `${z.ausschnitt.lng.toFixed(5)},${z.ausschnitt.lat.toFixed(5)},${Math.round(z.ausschnitt.zoom * 10) / 10}`);
  if (z.modus && z.modus !== 'ansehen') p.set('m', z.modus);
  if (z.ansicht) p.set('a', z.ansicht);
  if (z.auswahl) p.set('o', `${z.auswahl.typ}:${z.auswahl.id}`);
  if (z.zeitraum) p.set('z', `${z.zeitraum.von}..${z.zeitraum.bis}`);
  // Lesbare Adresse: Komma, Doppelpunkt und Punkte nicht maskieren
  const text = p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
  return text ? `?${text}` : '';
}
