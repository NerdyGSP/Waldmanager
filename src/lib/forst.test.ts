import { describe, expect, it } from 'vitest';
import { anteilSumme, baumartenPruefen, bestandesalter, hauptbaumart, pflanzjahrAusAlter } from './forst';

const heute = new Date('2026-11-11T12:00:00');

describe('bestandesalter', () => {
  it('rechnet aus dem Pflanzjahr', () => {
    expect(bestandesalter(1955, heute)).toBe(71);
  });
  it('liefert null ohne Pflanzjahr oder bei Pflanzjahr in der Zukunft', () => {
    expect(bestandesalter(null, heute)).toBeNull();
    expect(bestandesalter(2030, heute)).toBeNull();
  });
  it('ist die Umkehrung von pflanzjahrAusAlter', () => {
    expect(bestandesalter(pflanzjahrAusAlter(62, heute), heute)).toBe(62);
  });
});

describe('baumartenPruefen', () => {
  it('akzeptiert eine leere Liste und genau 100 %', () => {
    expect(baumartenPruefen([])).toBeNull();
    expect(baumartenPruefen([{ art: 'Fi', anteil: 80 }, { art: 'Lä', anteil: 20 }])).toBeNull();
  });
  it('meldet falsche Summe', () => {
    expect(baumartenPruefen([{ art: 'Fi', anteil: 70 }])).toMatch(/70 %/);
  });
  it('meldet doppelte Arten und ungültige Anteile', () => {
    expect(baumartenPruefen([{ art: 'Fi', anteil: 50 }, { art: 'Fi', anteil: 50 }])).toMatch(/doppelt/);
    expect(baumartenPruefen([{ art: 'Fi', anteil: 0 }, { art: 'Bu', anteil: 100 }])).toMatch(/zwischen 1 und 100/);
    expect(baumartenPruefen([{ art: '', anteil: 100 }])).toMatch(/Baumart wählen/);
  });
});

describe('hauptbaumart und anteilSumme', () => {
  it('wählt den größten Anteil, bei Gleichstand den ersten', () => {
    expect(hauptbaumart([{ art: 'Bu', anteil: 40 }, { art: 'Ei', anteil: 40 }, { art: 'BAh', anteil: 20 }])).toBe('Bu');
    expect(hauptbaumart([])).toBeNull();
    expect(anteilSumme([{ art: 'Fi', anteil: 60 }, { art: 'Dgl', anteil: 40 }])).toBe(100);
  });
});
