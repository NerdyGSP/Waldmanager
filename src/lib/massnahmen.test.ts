import { describe, expect, it } from 'vitest';
import { anzeigeStatus, heuteIso, istUeberfaellig, naechsterStatus, passtZuFilter, sortieren, typLabel, zaehlen } from './massnahmen';

const heute = '2026-11-11';

describe('Status', () => {
  it('liefert das heutige Datum in Ortszeit', () => {
    expect(heuteIso(new Date('2026-11-11T23:30:00'))).toBe('2026-11-11');
  });
  it('erkennt Überfälligkeit erst nach dem Termin', () => {
    expect(istUeberfaellig({ status: 'geplant', faellig_am: '2026-11-10' }, heute)).toBe(true);
    expect(istUeberfaellig({ status: 'geplant', faellig_am: heute }, heute)).toBe(false);
    expect(istUeberfaellig({ status: 'erledigt', faellig_am: '2026-01-01' }, heute)).toBe(false);
    expect(istUeberfaellig({ status: 'in_arbeit', faellig_am: null }, heute)).toBe(false);
  });
  it('zeigt überfällig vor dem gespeicherten Status', () => {
    expect(anzeigeStatus({ status: 'in_arbeit', faellig_am: '2026-10-30' }, heute)).toBe('ueberfaellig');
    expect(anzeigeStatus({ status: 'in_arbeit', faellig_am: '2026-12-01' }, heute)).toBe('in_arbeit');
  });
  it('schaltet den Status im Kreis', () => {
    expect(naechsterStatus('geplant')).toBe('in_arbeit');
    expect(naechsterStatus('in_arbeit')).toBe('erledigt');
    expect(naechsterStatus('erledigt')).toBe('geplant');
  });
});

describe('Filter, Zählung und Sortierung', () => {
  const liste = [
    { id: 'a', status: 'erledigt', faellig_am: '2026-08-10' },
    { id: 'b', status: 'geplant', faellig_am: '2026-12-05' },
    { id: 'c', status: 'geplant', faellig_am: '2026-10-15' },
    { id: 'd', status: 'in_arbeit', faellig_am: '2026-11-20' },
    { id: 'e', status: 'geplant', faellig_am: null },
    { id: 'f', status: 'erledigt', faellig_am: '2026-10-01' },
  ];
  it('filtert offen, überfällig und nach Status', () => {
    expect(liste.filter((m) => passtZuFilter(m, 'offen', heute)).map((m) => m.id)).toEqual(['b', 'c', 'd', 'e']);
    expect(liste.filter((m) => passtZuFilter(m, 'ueberfaellig', heute)).map((m) => m.id)).toEqual(['c']);
    expect(liste.filter((m) => passtZuFilter(m, 'geplant', heute)).map((m) => m.id)).toEqual(['b', 'c', 'e']);
  });
  it('zählt je Filter', () => {
    expect(zaehlen(liste, heute)).toEqual({ offen: 4, ueberfaellig: 1, in_arbeit: 1, geplant: 3, erledigt: 2, alle: 6 });
  });
  it('sortiert Offene nach Termin, Erledigte ans Ende mit den neuesten zuerst', () => {
    expect(sortieren(liste).map((m) => m.id)).toEqual(['c', 'd', 'b', 'e', 'f', 'a']);
  });
  it('kennt die Typen', () => {
    expect(typLabel('kaeferkontrolle')).toBe('Käferkontrolle');
    expect(typLabel('unbekannt')).toBe('unbekannt');
  });
});
