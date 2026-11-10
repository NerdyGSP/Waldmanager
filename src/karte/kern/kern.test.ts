import { describe, expect, it } from 'vitest';
import { ausUrl, inUrl, type KartenUrlZustand } from './urlZustand';
import { erlaubteModi, modusErlaubt, modusWechseln } from '../modi/modi';

describe('Kartenzustand in der Adresse', () => {
  const voll: KartenUrlZustand = {
    ausschnitt: { lng: 9.47, lat: 52.2, zoom: 14.5 },
    modus: 'zaehlen',
    ansicht: 'feld',
    auswahl: { typ: 'einrichtung', id: '0b9d6a52-1c3e-4f6a-9d2b-7e8f9a0b1c2d' },
    zeitraum: { von: '2026-04-01', bis: '2027-03-31' },
  };

  it('schreibt und liest denselben Zustand', () => {
    const text = inUrl(voll);
    expect(text).toBe('?k=9.47000,52.20000,14.5&m=zaehlen&a=feld&o=einrichtung:0b9d6a52-1c3e-4f6a-9d2b-7e8f9a0b1c2d&z=2026-04-01..2027-03-31');
    expect(ausUrl(text)).toEqual(voll);
  });

  it('lässt den Standardmodus und leere Zustände weg', () => {
    expect(inUrl({})).toBe('');
    expect(inUrl({ modus: 'ansehen' })).toBe('');
  });

  it('behält fremde Parameter', () => {
    expect(inUrl({ ansicht: 'feld' }, '?stichtag=2026-11-09&a=alt')).toBe('?stichtag=2026-11-09&a=feld');
  });

  it('ignoriert ungültige Werte', () => {
    expect(ausUrl('?k=abc,52,14')).toEqual({});
    expect(ausUrl('?k=9.4,152,14')).toEqual({});
    expect(ausUrl('?m=fliegen&o=nur-typ&z=2027-01-01..2026-01-01')).toEqual({});
    expect(ausUrl('?o=<script>:1')).toEqual({});
  });
});

describe('Kartenmodi', () => {
  const inhaberPc = { istInhaber: true, breit: true };
  const mitjaegerHandy = { istInhaber: false, breit: false };

  it('gibt Mitjägern nur Ansehen, Erfassen und Zählen', () => {
    expect(erlaubteModi(mitjaegerHandy)).toEqual(['ansehen', 'erfassen', 'zaehlen']);
    expect(erlaubteModi(inhaberPc)).toHaveLength(6);
    expect(modusErlaubt('druck', { istInhaber: true, breit: false })).toBe(false);
  });

  it('wechselt nur in erlaubte Modi', () => {
    expect(modusWechseln('ansehen', 'bearbeiten', inhaberPc)).toBe('bearbeiten');
    expect(modusWechseln('zaehlen', 'bearbeiten', mitjaegerHandy)).toBe('zaehlen');
    expect(modusWechseln('bearbeiten', 'druck', mitjaegerHandy)).toBe('ansehen');
  });
});
