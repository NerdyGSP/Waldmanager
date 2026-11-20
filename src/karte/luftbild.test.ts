import { describe, expect, it } from 'vitest';
import { LUFTBILDER, LUFTBILD_IDS, luftbildFuer, luftbildQuelle, luftbildWahlAusRoh } from './luftbild';

describe('Luftbildquellen', () => {
  it('fragen alle als WMS in EPSG:3857 mit Kachelplatzhalter an', () => {
    for (const id of LUFTBILD_IDS) {
      const q = LUFTBILDER[id];
      expect(q.url).toContain('CRS=EPSG:3857');
      expect(q.url).toContain('BBOX={bbox-epsg-3857}');
      expect(q.url.match(/\?/g)).toHaveLength(1);
    }
  });
});

describe('luftbildFuer', () => {
  const orte: [string, [number, number], 'ni' | 'nw' | 'he'][] = [
    ['Hamelspringe', [9.47, 52.2], 'ni'],
    ['Hannover', [9.73, 52.37], 'ni'],
    ['Osnabrück', [8.05, 52.27], 'ni'],
    ['Göttingen', [9.93, 51.53], 'ni'],
    ['Holzminden', [9.45, 51.83], 'ni'],
    ['Arnsberger Wald', [8.1, 51.45], 'nw'],
    ['Minden', [8.92, 52.29], 'nw'],
    ['Bielefeld', [8.53, 52.02], 'nw'],
    ['Detmold', [8.88, 51.94], 'nw'],
    ['Paderborn', [8.75, 51.72], 'nw'],
    ['Siegen', [8.02, 50.88], 'nw'],
    ['Eifel, Schleiden', [6.47, 50.53], 'nw'],
    ['Vogelsberg', [9.25, 50.5], 'he'],
    ['Kassel', [9.48, 51.31], 'he'],
    ['Marburg', [8.77, 50.81], 'he'],
    ['Fulda', [9.68, 50.55], 'he'],
    ['Darmstadt', [8.65, 49.87], 'he'],
    ['Odenwald, Erbach', [8.99, 49.66], 'he'],
  ];
  it.each(orte)('%s', (_, mitte, erwartet) => expect(luftbildFuer(mitte)).toBe(erwartet));

  it('liefert außerhalb und ohne Mitte nichts', () => {
    expect(luftbildFuer(null)).toBeNull();
    expect(luftbildFuer([11.58, 48.14])).toBeNull(); // München
  });
});

describe('luftbildQuelle', () => {
  it('nimmt die Wahl von Hand vor dem Vorschlag', () => {
    expect(luftbildQuelle('he', [9.47, 52.2]).id).toBe('he');
    expect(luftbildQuelle('auto', [8.1, 51.45]).id).toBe('nw');
    expect(luftbildQuelle('auto', null).id).toBe('ni');
  });
});

describe('luftbildWahlAusRoh', () => {
  it('liest die Wahl je Betrieb und verwirft Unbekanntes', () => {
    expect(luftbildWahlAusRoh({ a: 'nw', b: 'xx' }, 'a')).toBe('nw');
    expect(luftbildWahlAusRoh({ a: 'nw', b: 'xx' }, 'b')).toBe('auto');
    expect(luftbildWahlAusRoh(null, 'a')).toBe('auto');
    expect(luftbildWahlAusRoh('kaputt', 'a')).toBe('auto');
  });
});
