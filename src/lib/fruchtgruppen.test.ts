import { describe, expect, it } from 'vitest';
import { FRUCHTGRUPPEN, SONSTIGE, fruchtErkennen, fruchtgruppe, normalisieren } from './fruchtgruppen';

describe('Fruchtgruppen', () => {
  it('hat eindeutige Schlüssel und endet mit „Sonstige“', () => {
    const schluessel = FRUCHTGRUPPEN.map((g) => g.schluessel);
    expect(new Set(schluessel).size).toBe(schluessel.length);
    expect(schluessel.at(-1)).toBe(SONSTIGE);
    expect(fruchtgruppe('gibt-es-nicht').schluessel).toBe(SONSTIGE);
  });

  it('normalisiert wie private.frucht_norm in der Datenbank', () => {
    expect(normalisieren('  Winter  Weizen ')).toBe('winter weizen');
    expect(normalisieren('Rüben')).toBe('rueben');
    expect(normalisieren(null)).toBe('');
  });

  it('nimmt zuerst die gemerkte Zuordnung', () => {
    const gemerkt = new Map([['mein sonderfall', 'mais']]);
    expect(fruchtErkennen('Mein  Sonderfall', gemerkt)).toEqual({ gruppe: 'mais', quelle: 'gemerkt' });
  });

  it('erkennt über Text und fällt sonst auf „Sonstige“ zurück', () => {
    expect(fruchtErkennen('Wald').quelle).toBe('text');
    expect(fruchtErkennen('Wald').gruppe).toBe('wald');
    expect(fruchtErkennen('')).toEqual({ gruppe: SONSTIGE, quelle: 'unbekannt' });
    expect(fruchtErkennen('xyz unbekannt')).toEqual({ gruppe: SONSTIGE, quelle: 'unbekannt' });
  });

  it('ordnet jeden hinterlegten NC-Code der eigenen Gruppe zu', () => {
    for (const g of FRUCHTGRUPPEN) {
      for (const c of g.codes) {
        const code = Array.isArray(c) ? c[0] : c;
        const e = fruchtErkennen(String(code));
        expect(e.quelle).toBe('code');
      }
    }
  });
});
