import { useEffect, useState } from 'react';

// Verbindung zwischen einem Formular in der Seitenleiste und der dauerhaften Karte (Browseransicht):
// Das Formular startet die Positionswahl, die Karte meldet den angeklickten Punkt zurück.
// Außerdem meldet das Formular neue Funde, damit die Karte sie sofort nachlädt.

export type Punkt = { lon: number; lat: number };

const bus = new EventTarget();
let aktiv = false;
let letzter: Punkt | null = null;

export function positionWahlStarten() {
  aktiv = true;
  bus.dispatchEvent(new Event('status'));
}

export function positionWahlBeenden() {
  aktiv = false;
  letzter = null;
  bus.dispatchEvent(new Event('status'));
}

export function positionWahlAktiv(): boolean {
  return aktiv;
}

/** Von der Karte aufgerufen, wenn während der Positionswahl geklickt wurde */
export function positionMelden(p: Punkt) {
  letzter = p;
  bus.dispatchEvent(new CustomEvent<Punkt>('punkt', { detail: p }));
}

export function letztePosition(): Punkt | null {
  return letzter;
}

/** Ob gerade eine Position gewählt wird, und der zuletzt gewählte Punkt (für Karte und Formular) */
export function usePositionWahl(): { aktiv: boolean; punkt: Punkt | null } {
  const [zustand, setZustand] = useState(() => ({ aktiv, punkt: letzter }));
  useEffect(() => {
    const aktualisieren = () => setZustand({ aktiv, punkt: letzter });
    bus.addEventListener('status', aktualisieren);
    bus.addEventListener('punkt', aktualisieren);
    return () => {
      bus.removeEventListener('status', aktualisieren);
      bus.removeEventListener('punkt', aktualisieren);
    };
  }, []);
  return zustand;
}

/** Ein neuer Fund wurde gespeichert oder vorgemerkt */
export function fundeGeaendert() {
  bus.dispatchEvent(new Event('funde'));
}

export function beiFundeGeaendert(f: () => void): () => void {
  bus.addEventListener('funde', f);
  return () => bus.removeEventListener('funde', f);
}
