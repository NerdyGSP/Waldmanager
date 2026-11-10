import { describe, expect, it, vi } from 'vitest';

// jagdzeiten.ts lädt beim Import den Supabase-Client; die geprüften Funktionen brauchen ihn nicht
vi.mock('./supabase', () => ({ supabase: {} }));

import { JAGDJAHR_TAGE, imZeitraum, jagdzeitWarnung, klassen, statusAm, tagImJagdjahr, tagesverlauf, type Jagdzeit } from './jagdzeiten';

const zeile = (teil: Partial<Jagdzeit>): Jagdzeit =>
  ({ ganzjaehrig: false, jagdzeit_von: null, jagdzeit_bis: null, eingeschraenkt: false, wildart_id: 'rehwild', ...teil }) as Jagdzeit;

describe('imZeitraum', () => {
  it('prüft Zeiträume innerhalb eines Kalenderjahres', () => {
    const z = zeile({ jagdzeit_von: '05-01', jagdzeit_bis: '10-15' });
    expect(imZeitraum(z, '05-01')).toBe(true);
    expect(imZeitraum(z, '10-15')).toBe(true);
    expect(imZeitraum(z, '10-16')).toBe(false);
  });

  it('prüft Zeiträume über den Jahreswechsel', () => {
    const z = zeile({ jagdzeit_von: '10-01', jagdzeit_bis: '01-31' });
    expect(imZeitraum(z, '12-24')).toBe(true);
    expect(imZeitraum(z, '01-31')).toBe(true);
    expect(imZeitraum(z, '02-01')).toBe(false);
    expect(imZeitraum(z, '09-30')).toBe(false);
  });

  it('behandelt ganzjährig und fehlende Angaben', () => {
    expect(imZeitraum(zeile({ ganzjaehrig: true }), '07-07')).toBe(true);
    expect(imZeitraum(zeile({}), '07-07')).toBe(false);
  });
});

describe('Jagdjahr-Skala', () => {
  it('beginnt am 1. April und endet am 31. März', () => {
    expect(tagImJagdjahr('04-01')).toBe(0);
    expect(tagImJagdjahr('03-31')).toBe(JAGDJAHR_TAGE - 1);
    expect(tagImJagdjahr('02-29')).toBe(tagImJagdjahr('02-28'));
  });

  it('liefert für jeden Tag des Jagdjahres einen Status', () => {
    const k = klassen([zeile({ jagdzeit_von: '05-01', jagdzeit_bis: '05-31' })]);
    const verlauf = tagesverlauf(k);
    expect(verlauf).toHaveLength(JAGDJAHR_TAGE);
    expect(verlauf[tagImJagdjahr('05-15')]).toBe(2);
    expect(verlauf[tagImJagdjahr('06-01')]).toBe(0);
    expect(verlauf.filter((v) => v === 2)).toHaveLength(31);
  });
});

describe('statusAm und jagdzeitWarnung', () => {
  const zeiten = [zeile({ jagdzeit_von: '05-01', jagdzeit_bis: '01-31' })];

  it('meldet jagdbar und Schonzeit', () => {
    expect(statusAm(zeiten, new Date(2026, 10, 9)).status).toBe('jagdbar');
    expect(statusAm(zeiten, new Date(2026, 2, 15)).status).toBe('schonzeit');
  });

  it('warnt nur außerhalb der Jagdzeit', () => {
    expect(jagdzeitWarnung(zeiten, 'rehwild', new Date(2026, 10, 9))).toBeNull();
    expect(jagdzeitWarnung(zeiten, 'rehwild', new Date(2026, 2, 15))?.art).toBe('warnung');
    expect(jagdzeitWarnung(zeiten, 'fuchs', new Date(2026, 2, 15))).toBeNull(); // keine Zeiten hinterlegt
    expect(jagdzeitWarnung(null, 'rehwild', new Date())).toBeNull();
  });
});
