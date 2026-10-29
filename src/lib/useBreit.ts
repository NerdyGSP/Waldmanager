import { useEffect, useState } from 'react';

// Browser/iPad quer: Seitenleiste + dauerhafte Karte; darunter iPhone-Ansicht mit Übersichtsseite
const ABFRAGE = '(min-width: 900px)';

export function useBreit(): boolean {
  const [breit, setBreit] = useState(() => window.matchMedia(ABFRAGE).matches);
  useEffect(() => {
    const mq = window.matchMedia(ABFRAGE);
    const aendern = () => setBreit(mq.matches);
    mq.addEventListener('change', aendern);
    return () => mq.removeEventListener('change', aendern);
  }, []);
  return breit;
}
