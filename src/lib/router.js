import { useEffect, useState } from 'react';
// Minimaler Router über die History-API (Cloudflare liefert für jede Unterseite index.html aus)
const EREIGNIS = 'hegewerk:navigation';
export function navigieren(pfad, ersetzen = false) {
    if (pfad === window.location.pathname)
        return;
    if (ersetzen)
        window.history.replaceState(null, '', pfad);
    else
        window.history.pushState(null, '', pfad);
    window.dispatchEvent(new Event(EREIGNIS));
    window.scrollTo(0, 0);
}
export function usePfad() {
    const [pfad, setPfad] = useState(window.location.pathname);
    useEffect(() => {
        const aktualisieren = () => setPfad(window.location.pathname);
        window.addEventListener('popstate', aktualisieren);
        window.addEventListener(EREIGNIS, aktualisieren);
        return () => {
            window.removeEventListener('popstate', aktualisieren);
            window.removeEventListener(EREIGNIS, aktualisieren);
        };
    }, []);
    return pfad.split('/').filter(Boolean);
}
