import { describe, expect, it } from 'vitest';
import { EBENEN, EBENEN_SCHICHTEN, STANDARD_DECKKRAFT, STANDARD_REIHENFOLGE, imModusErlaubt, standardSichtbarkeit } from './registry';
import { EBENEN_SPEICHER, ebenenEinstellungenLesen, einstellungenAusRoh, reihenfolgeAnpassen } from './einstellungen';
import { KARTEN_MODI } from './typen';

describe('Ebenen-Registry', () => {
  it('hat eindeutige Ebenen und Schichten', () => {
    const ids = EBENEN.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const schichten = EBENEN.flatMap((e) => [...e.schichten]);
    expect(new Set(schichten).size).toBe(schichten.length);
  });

  it('hält die Basiskarte unten und gültige Standardwerte', () => {
    expect(STANDARD_REIHENFOLGE.at(-1)).toBe('luftbild');
    for (const e of EBENEN) {
      expect(e.standardDeckkraft).toBeGreaterThan(0);
      expect(e.standardDeckkraft).toBeLessThanOrEqual(1);
      expect(e.schichten.length).toBeGreaterThan(0);
    }
  });

  it('entspricht dem Stand von Karte.tsx vor dem Rework', () => {
    expect(STANDARD_REIHENFOLGE).toEqual(['einrichtungen', 'abschuesse', 'pirschwege', 'treiberrouten', 'wteRouten', 'heatmap', 'grenze', 'zonen', 'felder', 'luftbild']);
    expect(STANDARD_DECKKRAFT).toMatchObject({ heatmap: 0.75, zonen: 0.55, felder: 0.45, luftbild: 1 });
    expect(EBENEN_SCHICHTEN.zonen).toEqual(['zonen-flaeche', 'zonen-linie', 'zonen-auswahl']);
    expect(standardSichtbarkeit()).toEqual({
      felder: false, luftbild: false, grenze: true, zonen: true, einrichtungen: true,
      pirschwege: true, treiberrouten: true, wteRouten: true, heatmap: false, abschuesse: false,
    });
  });

  it('zeigt im Zählmodus nur Grenze, Zonen, WTE-Routen und Luftbild', () => {
    const imZaehlen = EBENEN.map((e) => e.id).filter((id) => imModusErlaubt(id, 'zaehlen'));
    expect(imZaehlen.sort()).toEqual(['grenze', 'luftbild', 'wteRouten', 'zonen']);
    for (const m of KARTEN_MODI) expect(imModusErlaubt('grenze', m)).toBe(true);
  });
});

describe('Ebenen-Einstellungen', () => {
  it('liefert den Standard bei leerem oder defektem Speicher', () => {
    expect(einstellungenAusRoh(null).reihenfolge).toEqual(STANDARD_REIHENFOLGE);
    expect(ebenenEinstellungenLesen({ getItem: () => '{kaputt' }).reihenfolge).toEqual(STANDARD_REIHENFOLGE);
    expect(ebenenEinstellungenLesen({ getItem: (k) => (k === EBENEN_SPEICHER ? null : 'x') }).deckkraft).toEqual(STANDARD_DECKKRAFT);
  });

  it('behält die Nutzerreihenfolge und übernimmt gültige Deckkraft', () => {
    const umgekehrt = [...STANDARD_REIHENFOLGE].reverse();
    const e = einstellungenAusRoh({ reihenfolge: umgekehrt, deckkraft: { zonen: 0.2, heatmap: 7, luftbild: 'x' } });
    expect(e.reihenfolge).toEqual(umgekehrt);
    expect(e.deckkraft.zonen).toBe(0.2);
    expect(e.deckkraft.heatmap).toBe(0.75);
    expect(e.deckkraft.luftbild).toBe(1);
  });

  it('fügt in alten Speicherständen fehlende Ebenen an ihrem Standardplatz ein', () => {
    // Speicherstand von vor der Ebene „Felder“: sie gehört direkt über das Luftbild
    const alt = ['zonen', 'einrichtungen', 'abschuesse', 'pirschwege', 'treiberrouten', 'wteRouten', 'heatmap', 'grenze', 'luftbild'];
    expect(reihenfolgeAnpassen(alt)).toEqual(['zonen', 'einrichtungen', 'abschuesse', 'pirschwege', 'treiberrouten', 'wteRouten', 'heatmap', 'grenze', 'felder', 'luftbild']);
  });

  it('verwirft unbekannte und doppelte Ebenen', () => {
    const r = reihenfolgeAnpassen(['luftbild', 'gibt-es-nicht', 'luftbild', 'zonen', 42]);
    expect(r).toHaveLength(STANDARD_REIHENFOLGE.length);
    expect(new Set(r).size).toBe(r.length);
    expect(r.indexOf('luftbild')).toBeLessThan(r.indexOf('zonen'));
  });
});
