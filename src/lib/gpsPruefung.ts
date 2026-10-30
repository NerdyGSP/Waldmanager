import type { Geometry } from 'geojson';
import type { GpsPunkt, GpsRoh, GpsTrack } from './gpsParser';

export type Warnung = { text: string };
export type TrackBericht = {
  index: number;
  name: string;
  segmente: number;
  punkteGesamt: number; // wie in der Datei
  punkte: GpsPunkt[]; // bereinigt (Segmente zusammengefügt)
  laengeM: number;
  von: number | null;
  bis: number | null;
  ausdehnungM: [number, number] | null; // Breite × Höhe der Bounding-Box
  hatZeit: boolean;
  warnungen: string[];
  brauchbar: boolean;
};

const R = 6371008.8;
export const abstandM = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
export const laengeM = (p: Array<{ lng: number; lat: number }>) => p.reduce((s, x, i) => (i ? s + abstandM(p[i - 1]!, x) : 0), 0);

const gueltig = (p: GpsPunkt) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

// Punkt-in-Polygon (gerade/ungerade Regel) für MultiPolygon
function imRevier(g: Geometry, lng: number, lat: number): boolean {
  const flaechen = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
  for (const f of flaechen) {
    let drin = false;
    for (const ring of f) {
      let inn = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]!;
        const [xj, yj] = ring[j]!;
        if (yi! > lat !== yj! > lat && lng < ((xj! - xi!) * (lat - yi!)) / (yj! - yi!) + xi!) inn = !inn;
      }
      if (inn) drin = !drin;
    }
    if (drin) return true;
  }
  return false;
}

export const SPRUNG_MS = 50; // m/s

export function trackPruefen(t: GpsTrack, index: number, grenze: Geometry | null): TrackBericht {
  const warnungen: string[] = [];
  const alle = t.segmente.flat();
  let ungueltig = 0;
  let nullpunkte = 0;
  let doppelt = 0;
  let spruenge = 0;
  const sauber: GpsPunkt[] = [];
  let ohneZeit = 0;
  for (const seg of t.segmente) {
    let davor: GpsPunkt | null = null;
    for (const p of seg) {
      if (!gueltig(p)) {
        ungueltig++;
        continue;
      }
      if (p.lat === 0 && p.lng === 0) {
        nullpunkte++;
        continue;
      }
      if (davor && davor.lat === p.lat && davor.lng === p.lng) {
        doppelt++;
        continue;
      }
      if (davor && davor.t !== null && p.t !== null && p.t > davor.t && abstandM(davor, p) / ((p.t - davor.t) / 1000) > SPRUNG_MS) spruenge++;
      if (p.t === null) ohneZeit++;
      sauber.push(p);
      davor = p;
    }
  }
  if (ungueltig) warnungen.push(`${ungueltig} Punkte mit ungültigen Koordinaten (außerhalb des gültigen Bereichs) wurden entfernt.`);
  if (nullpunkte) warnungen.push(`${nullpunkte} Punkte bei (0, 0) wurden entfernt.`);
  if (doppelt) warnungen.push(`${doppelt} doppelte Punkte wurden entfernt.`);
  if (spruenge) warnungen.push(`${spruenge} Sprünge mit mehr als ${SPRUNG_MS} m/s (GPS-Aussetzer?) – bitte in der Vorschau prüfen.`);
  const hatZeit = sauber.length > 0 && ohneZeit < sauber.length;
  if (sauber.length > 0 && !hatZeit) warnungen.push('Der Track enthält keine Zeitstempel (Sprünge können nicht geprüft werden).');
  if (grenze && sauber.length) {
    const aussen = sauber.filter((p) => !imRevier(grenze, p.lng, p.lat)).length;
    if (aussen) warnungen.push(`${aussen.toLocaleString('de-DE')} von ${sauber.length.toLocaleString('de-DE')} Punkten liegen außerhalb des Reviers.`);
  }
  const leereSegmente = t.segmente.filter((s) => s.length === 0).length;
  if (leereSegmente) warnungen.push(`${leereSegmente} leere Segmente.`);
  const len = laengeM(sauber);
  const zeiten = sauber.map((p) => p.t).filter((x): x is number => x !== null);
  let ausdehnung: [number, number] | null = null;
  if (sauber.length) {
    const lats = sauber.map((p) => p.lat);
    const lngs = sauber.map((p) => p.lng);
    const mitteLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    ausdehnung = [abstandM({ lng: Math.min(...lngs), lat: mitteLat }, { lng: Math.max(...lngs), lat: mitteLat }), abstandM({ lng: lngs[0]!, lat: Math.min(...lats) }, { lng: lngs[0]!, lat: Math.max(...lats) })];
  }
  const brauchbar = sauber.length >= 2 && len > 0;
  if (!brauchbar) warnungen.push(sauber.length < 2 ? 'Der Track hat weniger als zwei gültige Punkte und kann nicht übernommen werden.' : 'Der Track hat keine Länge (alle Punkte liegen übereinander).');
  return {
    index,
    name: t.name,
    segmente: t.segmente.length,
    punkteGesamt: alle.length,
    punkte: sauber,
    laengeM: len,
    von: zeiten.length ? Math.min(...zeiten) : null,
    bis: zeiten.length ? Math.max(...zeiten) : null,
    ausdehnungM: ausdehnung,
    hatZeit,
    warnungen,
    brauchbar,
  };
}

export function berichtErstellen(roh: GpsRoh, grenze: Geometry | null): TrackBericht[] {
  return roh.tracks.map((t, i) => trackPruefen(t, i, grenze));
}

// ---------- Punktreduktion ----------

type Pt = { lng: number; lat: number };

// Douglas-Peucker in lokalen Metern (flächentreue Näherung um den Mittelpunkt, iterativ ohne Rekursion)
export function douglasPeucker(p: Pt[], toleranzM: number): Pt[] {
  if (p.length <= 2 || toleranzM <= 0) return p.slice();
  const lat0 = p.reduce((s, x) => s + x.lat, 0) / p.length;
  const kx = (Math.PI / 180) * R * Math.cos((lat0 * Math.PI) / 180);
  const ky = (Math.PI / 180) * R;
  const xy = p.map((x) => [x.lng * kx, x.lat * ky] as const);
  const behalten = new Uint8Array(p.length);
  behalten[0] = 1;
  behalten[p.length - 1] = 1;
  const stapel: Array<[number, number]> = [[0, p.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop()!;
    let maxD = 0;
    let maxI = -1;
    const [ax, ay] = xy[a]!;
    const [bx, by] = xy[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i]!;
      let d: number;
      if (l2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxI >= 0 && maxD > toleranzM) {
      behalten[maxI] = 1;
      stapel.push([a, maxI], [maxI, b]);
    }
  }
  return p.filter((_, i) => behalten[i]);
}

// Mindestabstand: Punkte, die näher als `m` am zuletzt behaltenen liegen, entfallen (Endpunkt bleibt)
export function mindestAbstand(p: Pt[], m: number): Pt[] {
  if (m <= 0 || p.length <= 2) return p.slice();
  const aus = [p[0]!];
  for (let i = 1; i < p.length - 1; i++) if (abstandM(aus[aus.length - 1]!, p[i]!) >= m) aus.push(p[i]!);
  aus.push(p[p.length - 1]!);
  return aus;
}

export type Reduktion = { punkte: Pt[]; laengeM: number; toleranzM: number };

export function reduzieren(p: Pt[], toleranzM: number, minAbstandM = 0, maxPunkte = 0): Reduktion {
  let tol = toleranzM;
  let r = mindestAbstand(douglasPeucker(p, tol), minAbstandM);
  // Obergrenze: Toleranz schrittweise erhöhen, bis die Punktzahl passt
  let n = 0;
  while (maxPunkte >= 2 && r.length > maxPunkte && n++ < 40) {
    tol = tol * 1.4 + 0.5;
    r = mindestAbstand(douglasPeucker(p, tol), minAbstandM);
  }
  if (maxPunkte >= 2 && r.length > maxPunkte) {
    // Notfalls gleichmäßig ausdünnen
    const schritt = (r.length - 1) / (maxPunkte - 1);
    r = Array.from({ length: maxPunkte }, (_, i) => r[Math.round(i * schritt)]!);
  }
  return { punkte: r, laengeM: laengeM(r), toleranzM: tol };
}
