import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { jahreLesen, jahreText, naechsterZonenName, zoneLesen, zonenFuerKarte } from './zonen';

describe('Zonen', () => {
  it('liest Eigenschaften aus RPC-Antwort und aus Kartenklick (JSON-Text)', () => {
    const roh = { id: 'z1', bestand_id: 'b1', name: 'Oben', baumarten: [{ art: 'Fi', anteil: 70 }, { art: 'Bu', anteil: 30 }], pflanzjahr: 2008, flaeche_ha: 1.25, durchforstungen: [2022, 2015] };
    const z = zoneLesen(roh);
    expect(z).toMatchObject({ id: 'z1', bestandId: 'b1', name: 'Oben', pflanzjahr: 2008, flaecheHa: 1.25, durchforstungen: [2015, 2022] });
    expect(z.baumarten).toHaveLength(2);
    const ausKarte = zoneLesen({ ...roh, baumarten: JSON.stringify(roh.baumarten), durchforstungen: '[2022,2015]', pflanzjahr: null });
    expect(ausKarte.baumarten).toEqual(z.baumarten);
    expect(ausKarte.durchforstungen).toEqual([2015, 2022]);
    expect(ausKarte.pflanzjahr).toBeNull();
  });

  it('bereinigt Jahreslisten', () => {
    expect(jahreLesen([2022, '2015', 2022, 99, 'x'])).toEqual([2015, 2022]);
    expect(jahreLesen('kaputt')).toEqual([]);
    expect(jahreLesen(null)).toEqual([]);
    expect(jahreText([2015, 2022])).toBe('2015, 2022');
  });

  it('färbt Zonen nach Wuchsstadium', () => {
    const heute = new Date('2026-11-21T12:00:00');
    const fs = zonenFuerKarte(
      [
        { type: 'Feature', geometry: null as never, properties: { pflanzjahr: 2019 } },
        { type: 'Feature', geometry: null as never, properties: { pflanzjahr: null } },
      ],
      heute,
    );
    expect(fs[0]!.properties).toMatchObject({ stadium: 'dickung', stadium_farbe: '#9cc96b' });
    expect(fs[1]!.properties).toMatchObject({ stadium: null });
  });

  it('schlägt die erste freie Zonennummer vor', () => {
    expect(naechsterZonenName([])).toBe('Zone 1');
    expect(naechsterZonenName(['Zone 1', 'zone 3', 'Oben'])).toBe('Zone 2');
  });
});
