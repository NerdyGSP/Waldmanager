import { describe, expect, it, vi } from 'vitest';
import { abfrageBereich, overpassAbfrage, waldwegeLaden, wegArt, zuGeoJSON } from './osmWaldwege';

describe('OSM-Waldwege', () => {
  it('rundet den Ausschnitt nach außen auf das Raster', () => {
    expect(abfrageBereich([9.461, 52.181, 9.519, 52.219])).toEqual([9.46, 52.18, 9.52, 52.22]);
    // Werte genau auf dem Raster bleiben stehen
    expect(abfrageBereich([9.46, 52.18, 9.52, 52.22])).toEqual([9.46, 52.18, 9.52, 52.22]);
  });

  it('lehnt zu große Ausschnitte ab', () => {
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

  it('fragt denselben Bereich nur einmal ab', async () => {
    const abruf = vi.fn(async () => new Response(JSON.stringify({ elements: [] }), { status: 200 }));
    const b: [number, number, number, number] = [10.0, 51.0, 10.02, 51.02];
    await waldwegeLaden(b, undefined, abruf as unknown as typeof fetch);
    await waldwegeLaden(b, undefined, abruf as unknown as typeof fetch);
    expect(abruf).toHaveBeenCalledTimes(1);
  });

  it('meldet Fehler des Dienstes', async () => {
    const abruf = vi.fn(async () => new Response('zu viele Anfragen', { status: 429 }));
    await expect(waldwegeLaden([11, 51, 11.02, 51.02], undefined, abruf as unknown as typeof fetch)).rejects.toThrow('429');
  });
});
