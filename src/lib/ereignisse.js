import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { navigieren } from './router';
export const EREIGNIS_GRUPPEN = [
    { id: 'einrichtungen', label: 'Einrichtungen', text: 'angelegt, verschoben, gelöscht', nurInhaber: false },
    { id: 'zaehlung', label: 'Wildzählung', text: 'Zählung gestartet oder abgeschlossen', nurInhaber: false },
    { id: 'abschuesse', label: 'Abschüsse & Fänge', text: 'neue Abschüsse und Fänge, Fang in Falle', nurInhaber: false },
    { id: 'aufgaben', label: 'Aufgaben', text: 'zugewiesen, fällig, erledigt', nurInhaber: false },
    { id: 'karte', label: 'Zonen, Routen & Reviergrenze', text: 'angelegt oder ersetzt', nurInhaber: true },
    { id: 'wildschaeden', label: 'Wildschäden', text: 'gemeldet, mit Frist', nurInhaber: true },
    { id: 'bewegungsjagd', label: 'Bewegungsjagd', text: 'Zu- und Absagen, Jagd abgeschlossen', nurInhaber: true },
    { id: 'mitglieder', label: 'Mitglieder', text: 'beigetreten, Einladung eingelöst', nurInhaber: true },
    { id: 'import', label: 'Datenimport', text: 'eine Meldung je Import', nurInhaber: true },
];
export const EREIGNIS_SYMBOL = {
    einrichtungen: '📍',
    zaehlung: '🔢',
    abschuesse: '🎯',
    aufgaben: '✅',
    karte: '🗺',
    wildschaeden: '🌾',
    bewegungsjagd: '🐗',
    mitglieder: '👤',
    import: '⬆️',
};
export function symbolFuer(e) {
    return e.typ === 'fang_erfasst' && e.hervorgehoben ? '⚠️' : (EREIGNIS_SYMBOL[e.gruppe] ?? '🔔');
}
export function useEreignisse(revierId, userId) {
    const [alle, setAlle] = useState([]);
    const [gelesenBis, setGelesenBis] = useState(null);
    const [einst, setEinst] = useState({});
    const [ladeFehler, setLadeFehler] = useState(false);
    const neuLaden = useCallback(async () => {
        if (!revierId) {
            setAlle([]);
            return;
        }
        try {
            await supabase.rpc('aufgaben_faellig_pruefen', { p_revier_id: revierId });
        }
        catch {
            /* Fälligkeitsprüfung ist optional */
        }
        const [ev, gel, profil] = await Promise.all([
            supabase
                .from('ereignisse')
                .select('id, typ, gruppe, akteur_id, akteur_name, titel, ziel_typ, ziel_id, anzahl, hervorgehoben, erstellt_am')
                .eq('revier_id', revierId)
                .order('erstellt_am', { ascending: false })
                .limit(200),
            supabase.from('ereignis_gelesen').select('zuletzt_gelesen_am').eq('user_id', userId).eq('revier_id', revierId).maybeSingle(),
            supabase.from('profiles').select('benachrichtigungen').eq('id', userId).maybeSingle(),
        ]);
        if (ev.error) {
            setLadeFehler(true);
            return;
        }
        setLadeFehler(false);
        setAlle((ev.data ?? []));
        setEinst((profil.data?.benachrichtigungen ?? {}) || {});
        if (gel.data)
            setGelesenBis(gel.data.zuletzt_gelesen_am);
        else if (!gel.error) {
            // Erster Besuch: der bisherige Bestand gilt als gelesen
            const jetzt = new Date().toISOString();
            setGelesenBis(jetzt);
            await supabase.from('ereignis_gelesen').upsert({ user_id: userId, revier_id: revierId, zuletzt_gelesen_am: jetzt });
        }
    }, [revierId, userId]);
    useEffect(() => {
        setAlle([]);
        setGelesenBis(null);
        void neuLaden();
        if (!revierId)
            return;
        const kanal = supabase
            .channel(`ereignisse:${revierId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ereignisse', filter: `revier_id=eq.${revierId}` }, () => void neuLaden())
            .subscribe();
        // Rückkehr in die App: neu laden (Fallback, falls Realtime unterwegs getrennt wurde)
        const sichtbar = () => {
            if (document.visibilityState === 'visible')
                void neuLaden();
        };
        document.addEventListener('visibilitychange', sichtbar);
        window.addEventListener('focus', sichtbar);
        window.addEventListener('online', sichtbar);
        return () => {
            void supabase.removeChannel(kanal);
            document.removeEventListener('visibilitychange', sichtbar);
            window.removeEventListener('focus', sichtbar);
            window.removeEventListener('online', sichtbar);
        };
    }, [revierId, neuLaden]);
    const liste = useMemo(() => alle.filter((e) => e.akteur_id !== userId && einst[e.gruppe] !== false), [alle, userId, einst]);
    const ungelesen = useMemo(() => liste.filter((e) => !gelesenBis || e.erstellt_am > gelesenBis).length, [liste, gelesenBis]);
    const markieren = useCallback(async (bis) => {
        if (!revierId)
            return;
        const ziel = bis ?? liste[0]?.erstellt_am ?? new Date().toISOString();
        if (gelesenBis && ziel <= gelesenBis)
            return;
        setGelesenBis(ziel);
        await supabase.from('ereignis_gelesen').upsert({ user_id: userId, revier_id: revierId, zuletzt_gelesen_am: ziel });
    }, [revierId, userId, liste, gelesenBis]);
    return { liste, ungelesen, gelesenBis, ladeFehler, markieren, neuLaden };
}
// Deep Link zum Ziel eines Ereignisses
export async function ereignisOeffnen(e, revierId) {
    const id = e.ziel_id;
    switch (e.ziel_typ) {
        case 'einrichtung': {
            if (!id)
                return;
            const { data } = await supabase.rpc('karte_daten', { p_revier_id: revierId, p_tage: 1 });
            const x = data;
            const z = (x?.einrichtungen ?? []).find((q) => (q.id ?? q.properties?.id) === id);
            if (!z?.geometry?.coordinates)
                return navigieren('/karte');
            const info = { id, name: z.properties?.name ?? null, typ: z.properties?.typ ?? 'sonstiges', bemerkung: z.properties?.bemerkung ?? null, lng: z.geometry.coordinates[0], lat: z.geometry.coordinates[1] };
            if (window.location.pathname === '/karte') {
                window.dispatchEvent(new CustomEvent('hegewerk:kartenfokus', { detail: info }));
            }
            else {
                try {
                    sessionStorage.setItem('hegewerk:kartenfokus', JSON.stringify(info));
                }
                catch {
                    /* ohne Fokus */
                }
                navigieren('/karte');
            }
            return;
        }
        case 'zaehlung':
            return navigieren(id ? `/zaehlung/${id}` : '/zaehlung');
        case 'abschuss':
            return navigieren('/abschuesse');
        case 'zone':
            return navigieren('/zonen');
        case 'route':
            return navigieren('/zonen/routen');
        case 'karte':
            return navigieren('/karte');
        case 'wildschaden':
            return navigieren('/wildschaeden');
        case 'bewegungsjagd':
            return navigieren(id ? `/bewegungsjagd/${id}` : '/bewegungsjagd');
        case 'aufgabe':
            return navigieren('/aufgaben');
        case 'reviermanagement':
            return navigieren('/reviermanagement');
        case 'import':
            return navigieren('/import');
        default:
            return;
    }
}
