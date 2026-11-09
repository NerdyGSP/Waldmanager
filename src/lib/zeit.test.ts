import { describe, expect, it } from 'vitest';
import { aktuellesJagdjahr, jagdjahr } from './zeit';

describe('Jagdjahr (1. April bis 31. März)', () => {
  it('bildet Grenzen und Bezeichnung', () => {
    expect(jagdjahr(2026)).toEqual({ start: 2026, von: '2026-04-01', bis: '2027-03-31', label: '2026/27' });
  });

  it('wechselt am 1. April', () => {
    expect(aktuellesJagdjahr(new Date(2026, 2, 31)).start).toBe(2025);
    expect(aktuellesJagdjahr(new Date(2026, 3, 1)).start).toBe(2026);
    expect(aktuellesJagdjahr(new Date(2026, 10, 9)).label).toBe('2026/27');
  });
});
