import { describe, expect, it } from 'vitest';
import type { MultiPolygon } from 'geojson';
import { abstandM, koordinaten, mittelpunkt, naechsterRandpunkt, punktInFlaeche } from './geometrie';

// Quadrat 9,0–9,1 / 52,0–52,1 mit Loch in der Mitte
const flaeche: MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [[
    [[9.0, 52.0], [9.1, 52.0], [9.1, 52.1], [9.0, 52.1], [9.0, 52.0]],
    [[9.04, 52.04], [9.06, 52.04], [9.06, 52.06], [9.04, 52.06], [9.04, 52.04]],
  ]],
};

describe('Geometrie-Helfer', () => {
  it('sammelt Stützpunkte aller Geometrietypen', () => {
    expect(koordinaten(null)).toEqual([]);
    expect(koordinaten({ type: 'Point', coordinates: [9, 52] })).toEqual([[9, 52]]);
    expect(koordinaten(flaeche)).toHaveLength(10);
    expect(koordinaten({ type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [1, 2] }, { type: 'LineString', coordinates: [[3, 4], [5, 6]] }] })).toHaveLength(3);
  });

  it('mittelt die Stützpunkte', () => {
    expect(mittelpunkt({ type: 'LineString', coordinates: [[9, 52], [10, 53]] })).toEqual([9.5, 52.5]);
  });

  it('erkennt innen, außen und Löcher', () => {
    expect(punktInFlaeche([9.02, 52.02], flaeche)).toBe(true);
    expect(punktInFlaeche([9.2, 52.02], flaeche)).toBe(false);
    expect(punktInFlaeche([9.05, 52.05], flaeche)).toBe(false);
  });

  it('findet den nächsten Randpunkt', () => {
    const [x, y] = naechsterRandpunkt([9.2, 52.03], flaeche) as [number, number];
    expect(x).toBeCloseTo(9.1, 6);
    expect(y).toBeCloseTo(52.03, 6);
  });

  it('misst Abstände in Metern', () => {
    // 0,001° Breite sind rund 111 m
    expect(abstandM([9, 52], [9, 52.001])).toBeGreaterThan(110);
    expect(abstandM([9, 52], [9, 52.001])).toBeLessThan(112);
    expect(abstandM([9, 52], [9, 52])).toBe(0);
  });
});
