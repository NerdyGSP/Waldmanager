import { describe, expect, it, vi } from 'vitest';
import { beiFundeGeaendert, fundeGeaendert, letztePosition, positionMelden, positionWahlAktiv, positionWahlBeenden, positionWahlStarten } from './positionWahl';

describe('Positionswahl zwischen Formular und Karte', () => {
  it('merkt sich Status und Punkt und setzt beim Beenden zurück', () => {
    expect(positionWahlAktiv()).toBe(false);
    positionWahlStarten();
    expect(positionWahlAktiv()).toBe(true);
    positionMelden({ lon: 9.47, lat: 52.2 });
    expect(letztePosition()).toEqual({ lon: 9.47, lat: 52.2 });
    positionWahlBeenden();
    expect(positionWahlAktiv()).toBe(false);
    expect(letztePosition()).toBeNull();
  });

  it('benachrichtigt über neue Funde, bis abgemeldet wird', () => {
    const f = vi.fn();
    const abmelden = beiFundeGeaendert(f);
    fundeGeaendert();
    abmelden();
    fundeGeaendert();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
