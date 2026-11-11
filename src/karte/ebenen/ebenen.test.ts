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

  it('hat die Forstebenen in Standardreihenfolge', () => {
    expect(STANDARD_REIHENFOLGE).toEqual(['grenze', 'bestaende', 'flurstuecke', 'luftbild']);
    expect(STANDARD_DECKKRAFT).toMatchObject({ bestaende: 0.55, luftbild: 1 });
    expect(EBENEN_SCHICHTEN.bestaende).toEqual(['bestaende-flaeche', 'bestaende-linie', 'bestaende-auswahl']);
    expect(standardSichtbarkeit()).toEqual({ grenze: true, bestaende: true, flurstuecke: false, luftbild: false });
  });

  it('zeigt die Grenze in jedem Modus', () => {
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
    const e = einstellungenAusRoh({ reihenfolge: umgekehrt, deckkraft: { bestaende: 0.2, grenze: 7, luftbild: 'x' } });
    expect(e.reihenfolge).toEqual(umgekehrt);
    expect(e.deckkraft.bestaende).toBe(0.2);
    expect(e.deckkraft.grenze).toBe(1);
    expect(e.deckkraft.luftbild).toBe(1);
  });

  it('fügt in alten Speicherständen fehlende Ebenen an ihrem Standardplatz ein', () => {
    // Speicherstand ohne „Bestände“: sie gehören direkt über das Luftbild
    expect(reihenfolgeAnpassen(['luftbild', 'grenze'])).toEqual(['bestaende', 'flurstuecke', 'luftbild', 'grenze']);
    expect(reihenfolgeAnpassen(['grenze', 'bestaende', 'luftbild'])).toEqual(['grenze', 'bestaende', 'flurstuecke', 'luftbild']);
  });

  it('verwirft unbekannte und doppelte Ebenen', () => {
    const r = reihenfolgeAnpassen(['luftbild', 'gibt-es-nicht', 'luftbild', 'bestaende', 42]);
    expect(r).toHaveLength(STANDARD_REIHENFOLGE.length);
    expect(new Set(r).size).toBe(r.length);
    expect(r.indexOf('luftbild')).toBeLessThan(r.indexOf('bestaende'));
  });
});
