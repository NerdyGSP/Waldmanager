import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { FRIST_TAGE, istUeberfaellig, liegtSeitTage, liegtSeitText, passtZuFilter, polterText, sortieren, zaehlen } from './polter';

const JETZT = new Date('2026-11-21T12:00:00+01:00');
const vor = (tage: number) => new Date(JETZT.getTime() - tage * 24 * 3600 * 1000).toISOString();

describe('Polter', () => {
  it('zählt volle Tage seit dem Ablegen', () => {
    expect(liegtSeitTage(vor(0), JETZT)).toBe(0);
    expect(liegtSeitTage(vor(0.9), JETZT)).toBe(0);
    expect(liegtSeitTage(vor(94), JETZT)).toBe(94);
    // Datum in der Zukunft (Uhr falsch gestellt) und Unsinn ergeben 0
    expect(liegtSeitTage(vor(-3), JETZT)).toBe(0);
    expect(liegtSeitTage('kein Datum', JETZT)).toBe(0);
  });

  it('beschreibt die Liegedauer', () => {
    expect(liegtSeitText(vor(0), JETZT)).toBe('liegt seit heute');
    expect(liegtSeitText(vor(1), JETZT)).toBe('liegt seit 1 Tag');
    expect(liegtSeitText(vor(94), JETZT)).toBe('liegt seit 94 Tagen');
  });

  it('markiert liegende Polter nach der Frist als überfällig', () => {
    expect(istUeberfaellig({ status: 'liegt', abgelegt_am: vor(FRIST_TAGE - 1) }, JETZT)).toBe(false);
    expect(istUeberfaellig({ status: 'liegt', abgelegt_am: vor(FRIST_TAGE) }, JETZT)).toBe(true);
    expect(istUeberfaellig({ status: 'abgefahren', abgelegt_am: vor(200) }, JETZT)).toBe(false);
  });

  it('beschreibt Baumart und Menge', () => {
    expect(polterText({ baumart: 'Fi', menge_fm: 3, stueck: null })).toBe('Fichte · ca. 3 fm');
    expect(polterText({ baumart: null, menge_fm: null, stueck: 12 })).toBe('12 Stück');
    expect(polterText({ baumart: 'XY', menge_fm: 1.5, stueck: 2 })).toBe('XY · ca. 1,5 fm · 2 Stück');
    expect(polterText({})).toBe('');
  });

  it('filtert, zählt und sortiert', () => {
    const liste = [
      { id: 'neu', status: 'liegt', abgelegt_am: vor(2) },
      { id: 'weg-alt', status: 'abgefahren', abgelegt_am: vor(90) },
      { id: 'alt', status: 'liegt', abgelegt_am: vor(94) },
      { id: 'weg-neu', status: 'abgefahren', abgelegt_am: vor(10) },
    ];
    expect(zaehlen(liste, JETZT)).toEqual({ liegt: 2, ueberfaellig: 1, abgefahren: 2, alle: 4 });
    expect(liste.filter((p) => passtZuFilter(p, 'ueberfaellig', JETZT)).map((p) => p.id)).toEqual(['alt']);
    expect(sortieren(liste).map((p) => p.id)).toEqual(['alt', 'neu', 'weg-neu', 'weg-alt']);
  });
});
