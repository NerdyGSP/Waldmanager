import { useCallback, useEffect, useState } from 'react';
const EREIGNIS = 'hegewerk:breite';
const schluessel = (modul) => `hegewerk.breite.${modul}`;
// Die Masteradmin-Tabelle ist breit – dort ist „Voll“ voreingestellt
const standard = (modul) => (modul === 'masteradmin' ? 'voll' : 'drittel');
function lesen(modul) {
    try {
        const v = localStorage.getItem(schluessel(modul));
        return v ? (v === 'voll' ? 'voll' : 'drittel') : standard(modul);
    }
    catch {
        return standard(modul);
    }
}
// Breite je Modul und Gerät (Browser ≥ 900 px): „1/3“ = Modul im Seitenbereich, Karte rechts; „Voll“ = Modul ohne Karte
export function useModulBreite(modul) {
    const [breite, setBreite] = useState(() => lesen(modul));
    useEffect(() => {
        setBreite(lesen(modul));
        const neu = () => setBreite(lesen(modul));
        window.addEventListener(EREIGNIS, neu);
        return () => window.removeEventListener(EREIGNIS, neu);
    }, [modul]);
    const setzen = useCallback((b) => {
        setBreite(b);
        try {
            localStorage.setItem(schluessel(modul), b);
        }
        catch {
            /* Speicher nicht verfügbar – gilt nur für diese Sitzung */
        }
        window.dispatchEvent(new Event(EREIGNIS));
    }, [modul]);
    return [breite, setzen];
}
