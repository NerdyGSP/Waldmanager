import { useEffect, useState } from 'react';
const SCHLUESSEL = 'hegewerk.darstellung';
export function darstellungLesen() {
    try {
        const w = localStorage.getItem(SCHLUESSEL);
        return w === 'hell' || w === 'dunkel' ? w : 'system';
    }
    catch {
        return 'system';
    }
}
export function darstellungAnwenden(d) {
    const root = document.documentElement;
    if (d === 'system')
        root.removeAttribute('data-theme');
    else
        root.setAttribute('data-theme', d === 'hell' ? 'light' : 'dark');
    const dunkel = d === 'dunkel' || (d === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = dunkel ? '#0f2a1d' : '#1e5c3a';
    document.head.appendChild(meta);
}
export function useDarstellung() {
    const [wert, setWert] = useState(darstellungLesen);
    useEffect(() => {
        darstellungAnwenden(wert);
    }, [wert]);
    return [
        wert,
        (d) => {
            try {
                if (d === 'system')
                    localStorage.removeItem(SCHLUESSEL);
                else
                    localStorage.setItem(SCHLUESSEL, d);
            }
            catch {
                /* ohne Speicher nur für diese Sitzung */
            }
            setWert(d);
        },
    ];
}
