import { describe, expect, it } from 'vitest';
import { flurstueckText, nummerBilden, pakete, werteAus, zahlLesen, zuordnungRaten } from './flurstuecke';

describe('zuordnungRaten', () => {
  it('erkennt ALKIS-Felder mit Zähler und Nenner', () => {
    expect(zuordnungRaten(['gml_id', 'gemarkung', 'flur', 'flstnrzae', 'flstnrnen', 'amtlflsfl'])).toEqual({
      gemarkung: 'gemarkung',
      flur: 'flur',
      nummer: 'flstnrzae',
      nenner: 'flstnrnen',
      flaeche: 'amtlflsfl',
      flaecheEinheit: 'm2',
    });
  });
  it('erkennt Hektar am Feldnamen und lässt Fehlendes leer', () => {
    const z = zuordnungRaten(['Flurstueck', 'Flaeche_ha']);
    expect(z.nummer).toBe('Flurstueck');
    expect(z.gemarkung).toBe('');
    expect(z.flaeche).toBe('Flaeche_ha');
    expect(z.flaecheEinheit).toBe('ha');
  });
});

describe('Werte lesen', () => {
  it('setzt die Nummer aus Zähler und Nenner zusammen', () => {
    expect(nummerBilden('0041', '0001')).toBe('41/1');
    expect(nummerBilden('42', '')).toBe('42');
    expect(nummerBilden('42', '0')).toBe('42');
    expect(nummerBilden('7/2', '5')).toBe('7/2');
    expect(nummerBilden('', '3')).toBeNull();
  });
  it('liest deutsche und englische Zahlen', () => {
    expect(zahlLesen('1.234,5')).toBe(1234.5);
    expect(zahlLesen('1234.5')).toBe(1234.5);
    expect(zahlLesen('')).toBeNull();
    expect(zahlLesen('abc')).toBeNull();
  });
  it('rechnet die amtliche Fläche von m² in Hektar um', () => {
    const z = zuordnungRaten(['gemarkung', 'flur', 'flstnrzae', 'flstnrnen', 'amtlflsfl']);
    expect(werteAus({ gemarkung: 'Lindenhang', flur: '03', flstnrzae: '41', flstnrnen: '1', amtlflsfl: 54000 }, z)).toEqual({
      gemarkung: 'Lindenhang',
      flur: '3',
      nummer: '41/1',
      bezeichnung: 'Lindenhang · Flur 3 · 41/1',
      flaeche_amtlich_ha: 5.4,
    });
  });
  it('kommt ohne Attribute aus', () => {
    expect(werteAus(null, zuordnungRaten([]))).toEqual({ gemarkung: null, flur: null, nummer: null, bezeichnung: '', flaeche_amtlich_ha: null });
  });
});

describe('Hilfen', () => {
  it('formatiert und teilt in Pakete', () => {
    expect(flurstueckText({ gemarkung: null, flur: '4', nummer: '9' })).toBe('Flur 4 · 9');
    expect(pakete([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(pakete([], 500)).toEqual([]);
  });
});
