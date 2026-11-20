import { describe, expect, it } from 'vitest';
import { LUFTBILDER, LUFTBILD_IDS, kachelBbox3857, kachelBboxGrad, kachelQuellen, kachelUrl, luftbildFuer, luftbildQuelle, luftbildWahlAusRoh } from './luftbild';

// XYZ-Kachel, die einen Punkt enthält
function kachel(lon: number, lat: number, z: number): [number, number, number] {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [z, Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
}

describe('Luftbildquellen', () => {
  it('fragen alle als WMS in EPSG:3857 an, im Grenzstreifen als durchsichtiges PNG', () => {
    for (const id of LUFTBILD_IDS) {
      const jpeg = kachelUrl(LUFTBILDER[id], 14, 8600, 5400, false);
      expect(jpeg).toContain('CRS=EPSG:3857');
      expect(jpeg).toContain('FORMAT=image/jpeg');
      expect(jpeg.match(/\?/g)).toHaveLength(1);
      expect(kachelUrl(LUFTBILDER[id], 14, 8600, 5400, true)).toContain('FORMAT=image/png&TRANSPARENT=TRUE');
    }
  });

  it('rechnet Kachelgrenzen wie MapLibre ({bbox-epsg-3857})', () => {
    expect(kachelBbox3857(0, 0, 0).map(Math.round)).toEqual([-20037508, -20037508, 20037508, 20037508]);
    const [w, s, o, n] = kachelBboxGrad(1, 1, 0);
    expect([w, o]).toEqual([0, 180]);
    expect(s).toBeCloseTo(0);
    expect(n).toBeCloseTo(85.0511);
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
    // Grenzorte NRW/Hessen/Niedersachsen
    ['Willingen', [8.61, 51.29], 'he'],
    ['Korbach', [8.87, 51.27], 'he'],
    ['Medebach', [8.71, 51.2], 'nw'],
    ['Winterberg', [8.53, 51.19], 'nw'],
    ['Marsberg', [8.85, 51.46], 'nw'],
    ['Bad Laasphe', [8.41, 50.93], 'nw'],
    ['Biedenkopf', [8.53, 50.91], 'he'],
    ['Witzenhausen', [9.86, 51.34], 'he'],
    ['Hann. Münden', [9.65, 51.42], 'ni'],
    ['Uslar', [9.63, 51.66], 'ni'],
  ];
  it.each(orte)('%s', (_, mitte, erwartet) => expect(luftbildFuer(mitte)).toBe(erwartet));

  it('liefert außerhalb und ohne Mitte nichts', () => {
    expect(luftbildFuer(null)).toBeNull();
    expect(luftbildFuer([11.58, 48.14])).toBeNull(); // München
    expect(luftbildFuer([10.32, 51.38])).toBeNull(); // Heiligenstadt (Thüringen)
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

describe('kachelQuellen', () => {
  it('nimmt im Landesinneren genau einen Dienst', () => {
    expect(kachelQuellen(...kachel(8.1, 51.45, 15), 'nw')).toEqual(['nw']); // Arnsberger Wald
    expect(kachelQuellen(...kachel(9.25, 50.5, 15), 'he')).toEqual(['he']); // Vogelsberg
    expect(kachelQuellen(...kachel(9.47, 52.2, 15), 'ni')).toEqual(['ni']); // Hamelspringe
  });

  it('legt an der Grenze NRW/Hessen beide Dienste übereinander, Vorrang oben', () => {
    // Raum Diemelsee/Willingen, direkt an der Landesgrenze
    const k = kachel(8.72, 51.33, 15);
    expect(kachelQuellen(...k, 'nw')).toEqual(['he', 'nw']);
    expect(kachelQuellen(...k, 'he')).toEqual(['nw', 'he']);
  });

  it('nimmt an der Grenze zu Niedersachsen den LGLN dazu', () => {
    expect(kachelQuellen(...kachel(9.05, 52.4, 15), 'nw')).toContain('ni'); // Petershagen
    expect(kachelQuellen(...kachel(9.65, 51.5, 15), 'he')).toEqual(['ni', 'he']); // Reinhardswald/Weser
  });

  it('braucht außerhalb aller Länder keinen Dienst', () => {
    expect(kachelQuellen(...kachel(11.58, 48.14, 15), 'ni')).toEqual([]); // München
  });
});
