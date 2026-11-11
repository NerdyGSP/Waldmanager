import { useCallback, useEffect, useState } from 'react';

export type Modulbreite = 'drittel' | 'voll';
const EREIGNIS = 'waldmanager:breite';
const schluessel = (modul: string) => `waldmanager.breite.${modul}`;

// Die Masteradmin-Tabelle ist breit – dort ist „Voll“ voreingestellt
const standard = (modul: string): Modulbreite => (modul === 'masteradmin' ? 'voll' : 'drittel');

function lesen(modul: string): Modulbreite {
  try {
    const v = localStorage.getItem(schluessel(modul));
    return v ? (v === 'voll' ? 'voll' : 'drittel') : standard(modul);
  } catch {
    return standard(modul);
  }
}

// Breite je Modul und Gerät (Browser ≥ 900 px): „1/3“ = Modul im Seitenbereich, Karte rechts; „Voll“ = Modul ohne Karte
export function useModulBreite(modul: string): [Modulbreite, (b: Modulbreite) => void] {
  const [breite, setBreite] = useState<Modulbreite>(() => lesen(modul));
  useEffect(() => {
    setBreite(lesen(modul));
    const neu = () => setBreite(lesen(modul));
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, [modul]);
  const setzen = useCallback(
    (b: Modulbreite) => {
      setBreite(b);
      try {
        localStorage.setItem(schluessel(modul), b);
      } catch {
        /* Speicher nicht verfügbar – gilt nur für diese Sitzung */
      }
      window.dispatchEvent(new Event(EREIGNIS));
    },
    [modul],
  );
  return [breite, setzen];
}
