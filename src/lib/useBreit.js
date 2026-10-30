import { useEffect, useState } from 'react';
// Browser/iPad quer: Seitenleiste + dauerhafte Karte; darunter iPhone-Ansicht mit Übersichtsseite
const ABFRAGE = '(min-width: 900px)';
export function useBreit() {
    const [breit, setBreit] = useState(() => window.matchMedia(ABFRAGE).matches);
    useEffect(() => {
        const mq = window.matchMedia(ABFRAGE);
        // Beim Drucken schrumpft der Viewport auf Papierbreite – dann nicht umschalten, sonst wird die Ansicht samt Druckdialog neu aufgebaut
        const aendern = () => {
            if (window.matchMedia('print').matches)
                return;
            setBreit(mq.matches);
        };
        mq.addEventListener('change', aendern);
        return () => mq.removeEventListener('change', aendern);
    }, []);
    return breit;
}
