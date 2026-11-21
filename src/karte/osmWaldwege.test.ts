import { describe, expect, it, vi } from 'vitest';
import type { FeatureCollection, LineString, MultiPolygon } from 'geojson';
import {
  OVERPASS_URLS,
  abfrageBereich,
  aufFlaecheZuschneiden,
  betriebsFlaeche,
  flaechenSchluessel,
  gespeicherteWege,
  linieZuschneiden,
  overpassAbfrage,
  overpassAbrufen,
  wegArt,
  wegeSpeichern,
  zuGeoJSON,
} from './osmWaldwege';

// Quadrat 9.47–9.49 / 52.20–52.21 mit Loch 9.475–9.48 / 52.203–52.207
const FLAECHE: MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [[9.47, 52.2], [9.49, 52.2], [9.49, 52.21], [9.47, 52.21], [9.47, 52.2]],
      [[9.475, 52.203], [9.48, 52.203], [9.48, 52.207], [9.475, 52.207], [9.475, 52.203]],
    ],
  ],
};

const linien = (...ks: number[][][]): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: ks.map((coordinates, i) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { osm_id: i, art: 'weg' } })),
});

describe('OSM-Waldwege: Abfrage', () => {
  it('erweitert um den Rand und rundet nach außen aufs Raster', () => {
    // 1 km ≈ 0,009° Breite und ≈ 0,0147° Länge bei 52°
    expect(abfrageBereich([9.47, 52.2, 9.49, 52.21])).toEqual([9.44, 52.18, 9.52, 52.22]);
  });

  it('lehnt zu ausgedehnte Betriebe ab', () => {
    expect(abfrageBereich([9, 52, 10, 52.2])).toBeNull();
  });

  it('baut die Overpass-Abfrage mit bbox in der Reihenfolge Süd, West, Nord, Ost', () => {
    const q = overpassAbfrage([9.46, 52.18, 9.52, 52.22]);
    expect(q).toContain('way["highway"="track"](52.18,9.46,52.22,9.52)');
    expect(q).toContain('path|bridleway');
    expect(q).toMatch(/out geom;$/);
  });

  it('unterscheidet Fahrwege und Pfade', () => {
    expect(wegArt({ highway: 'track' })).toBe('weg');
    expect(wegArt({ highway: 'path' })).toBe('pfad');
  });

  it('wandelt Overpass-Elemente in Linien um', () => {
    const fc = zuGeoJSON({
      elements: [
        { type: 'way', id: 1, tags: { highway: 'track', tracktype: 'grade2', name: 'Kammweg' }, geometry: [{ lat: 52.2, lon: 9.47 }, { lat: 52.21, lon: 9.48 }] },
        { type: 'way', id: 2, tags: { highway: 'path', tracktype: 'unsinn' }, geometry: [{ lat: 52.2, lon: 9.47 }, { lat: 52.2, lon: 9.471 }] },
        { type: 'way', id: 3, tags: { highway: 'track' }, geometry: [{ lat: 52.2, lon: 9.47 }] },
        { type: 'node', id: 4 },
      ],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.geometry.coordinates).toEqual([[9.47, 52.2], [9.48, 52.21]]);
    expect(fc.features[0]!.properties).toMatchObject({ art: 'weg', tracktype: 'grade2', name: 'Kammweg' });
    expect(fc.features[1]!.properties).toMatchObject({ art: 'pfad', tracktype: null, name: null });
  });
});

describe('OSM-Waldwege: Zuschneiden', () => {
  it('kürzt eine Linie, die über die Grenze läuft, auf das Innere', () => {
    const teile = linieZuschneiden([[9.46, 52.209], [9.5, 52.209]], FLAECHE);
    expect(teile).toHaveLength(1);
    expect(teile[0]![0]![0]).toBeCloseTo(9.47, 9);
    expect(teile[0]!.at(-1)![0]).toBeCloseTo(9.49, 9);
  });

  it('spart Löcher aus und teilt die Linie dort', () => {
    const teile = linieZuschneiden([[9.471, 52.205], [9.489, 52.205]], FLAECHE);
    expect(teile).toHaveLength(2);
    expect(teile[0]!.at(-1)![0]).toBeCloseTo(9.475, 9);
    expect(teile[1]![0]![0]).toBeCloseTo(9.48, 9);
  });

  it('behält innere Stützpunkte und verwirft Linien außerhalb', () => {
    const fc = aufFlaecheZuschneiden(
      linien(
        [[9.472, 52.201], [9.474, 52.202], [9.474, 52.209]],
        [[9.3, 52.1], [9.31, 52.11]],
      ),
      FLAECHE,
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.geometry.coordinates).toEqual([[9.472, 52.201], [9.474, 52.202], [9.474, 52.209]]);
    expect(fc.features[0]!.properties).toMatchObject({ osm_id: 0 });
  });

  it('nimmt ohne Grenze Flurstücke und Bestände als Fläche', () => {
    expect(betriebsFlaeche(FLAECHE, [])).toBe(FLAECHE);
    const f = betriebsFlaeche(null, [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: {} },
      { type: 'Feature', geometry: FLAECHE, properties: {} },
    ]);
    expect(f?.coordinates).toHaveLength(2);
    expect(betriebsFlaeche(null, [])).toBeNull();
  });

  it('ändert den Flächenschlüssel, wenn sich die Grenze ändert', () => {
    const verschoben: MultiPolygon = { type: 'MultiPolygon', coordinates: [[[[9.47, 52.2], [9.5, 52.2], [9.49, 52.21], [9.47, 52.21], [9.47, 52.2]]]] };
    expect(flaechenSchluessel(FLAECHE)).not.toBe(flaechenSchluessel(verschoben));
  });
});

describe('OSM-Waldwege: Abruf und Speicher', () => {
  it('weicht auf die nächste Instanz aus und nennt die Gründe', async () => {
    const abruf = vi.fn(async (url: string) =>
      url === OVERPASS_URLS[1] ? new Response(JSON.stringify({ elements: [] }), { status: 200 }) : new Response('', { status: 504 }),
    );
    await expect(overpassAbrufen([9.44, 52.18, 9.52, 52.22], undefined, abruf as unknown as typeof fetch)).resolves.toMatchObject({ features: [] });
    expect(abruf).toHaveBeenCalledTimes(2);
    const init = (abruf.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe('POST');
    expect(String(init.body)).toMatch(/^data=/);

    const kaputt = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(overpassAbrufen([9.44, 52.18, 9.52, 52.22], undefined, kaputt as unknown as typeof fetch)).rejects.toThrow(/overpass-api\.de: nicht erreichbar/);
  });

  it('merkt Wege je Betrieb und verwirft alte oder fremde Stände', () => {
    const daten = new Map<string, string>();
    const speicher = { getItem: (k: string) => daten.get(k) ?? null, setItem: (k: string, v: string) => void daten.set(k, v) };
    const fc = linien([[9.472, 52.201], [9.474, 52.202]]);
    wegeSpeichern('b1', 's1', fc, speicher, 1000);
    expect(gespeicherteWege('b1', 's1', speicher, 2000)).toEqual(fc);
    expect(gespeicherteWege('b1', 's2', speicher, 2000)).toBeNull();
    expect(gespeicherteWege('b2', 's1', speicher, 2000)).toBeNull();
    expect(gespeicherteWege('b1', 's1', speicher, 1000 + 31 * 24 * 3600 * 1000)).toBeNull();
  });
});
