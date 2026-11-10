import type { Geometry, MultiPolygon, Position } from 'geojson';

// Geometrie-Helfer ohne Kartenbibliothek (aus Karte.tsx herausgelöst, unverändert im Verhalten)

/** Alle Stützpunkte einer Geometrie als flache Liste */
export function koordinaten(g: Geometry | null | undefined): Position[] {
  if (!g) return [];
  switch (g.type) {
    case 'Point':
      return [g.coordinates];
    case 'LineString':
    case 'MultiPoint':
      return g.coordinates;
    case 'Polygon':
    case 'MultiLineString':
      return g.coordinates.flat();
    case 'MultiPolygon':
      return g.coordinates.flat(2);
    case 'GeometryCollection':
      return g.geometries.flatMap(koordinaten);
  }
}

/** Mittel der Stützpunkte (kein Flächenschwerpunkt) */
export function mittelpunkt(g: Geometry): [number, number] {
  const k = koordinaten(g);
  const x = k.reduce((a, p) => a + p[0]!, 0) / (k.length || 1);
  const y = k.reduce((a, p) => a + p[1]!, 0) / (k.length || 1);
  return [x, y];
}

export function inRing(p: Position, ring: Position[]): boolean {
  let innen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [ring[i]![0]!, ring[i]![1]!];
    const [xj, yj] = [ring[j]![0]!, ring[j]![1]!];
    if (yi > p[1]! !== yj > p[1]! && p[0]! < ((xj - xi) * (p[1]! - yi)) / (yj - yi) + xi) innen = !innen;
  }
  return innen;
}

/** Liegt der Punkt in der Fläche? Löcher zählen als außen */
export function punktInFlaeche(p: Position, g: MultiPolygon): boolean {
  return g.coordinates.some((poly) => inRing(p, poly[0] ?? []) && !poly.slice(1).some((loch) => inRing(p, loch)));
}

/** Nächster Punkt auf dem Rand (lokal metrisch genähert) */
export function naechsterRandpunkt(p: Position, g: MultiPolygon): Position {
  const kx = Math.cos((p[1]! * Math.PI) / 180);
  let bester: Position = p;
  let bestD = Infinity;
  for (const poly of g.coordinates)
    for (const ring of poly)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i]!;
        const b = ring[i + 1]!;
        const ax = a[0]! * kx, ay = a[1]!, bx = b[0]! * kx, by = b[1]!, px = p[0]! * kx, py = p[1]!;
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
        const qx = ax + t * dx, qy = ay + t * dy;
        const d = (qx - px) ** 2 + (qy - py) ** 2;
        if (d < bestD) {
          bestD = d;
          bester = [qx / kx, qy];
        }
      }
  return bester;
}

/** Abstand zweier WGS84-Punkte in Metern (Haversine) */
export function abstandM(a: Position, b: Position): number {
  const r = 6371000;
  const dLat = ((b[1]! - a[1]!) * Math.PI) / 180;
  const dLon = ((b[0]! - a[0]!) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1]! * Math.PI) / 180) * Math.cos((b[1]! * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
