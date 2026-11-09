import { describe, expect, it } from 'vitest';
import { himmelsrichtung, linieEWKT, punktEWKT } from './geo';

describe('geo', () => {
  it('schreibt EWKT mit sieben Nachkommastellen in WGS84', () => {
    expect(punktEWKT(9.47, 52.2)).toBe('SRID=4326;POINT(9.4700000 52.2000000)');
    expect(linieEWKT([[9, 52], [9.1, 52.1]])).toBe('SRID=4326;LINESTRING(9.0000000 52.0000000, 9.1000000 52.1000000)');
  });

  it('benennt Himmelsrichtungen in 45-Grad-Schritten', () => {
    expect(himmelsrichtung(0)).toBe('N');
    expect(himmelsrichtung(90)).toBe('O');
    expect(himmelsrichtung(225)).toBe('SW');
    expect(himmelsrichtung(-45)).toBe('NW');
    expect(himmelsrichtung(359)).toBe('N');
  });
});
