import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
export function useNutzerKontext(userId) {
    const [laedt, setLaedt] = useState(true);
    const [fehler, setFehler] = useState(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [istMasteradmin, setIstMasteradmin] = useState(false);
    const [mitgliedschaften, setMitgliedschaften] = useState([]);
    const neuLaden = useCallback(async () => {
        setFehler(null);
        const [profil, master, mitglieder] = await Promise.all([
            supabase.from('profiles').select('name, email').eq('id', userId).maybeSingle(),
            supabase.from('masteradmins').select('user_id').eq('user_id', userId).maybeSingle(),
            supabase
                .from('revier_mitglieder')
                .select('rolle, reviere(id, name, flaeche_ha, bundesland, hegeringe(name))')
                .eq('user_id', userId),
        ]);
        const ersterFehler = profil.error ?? master.error ?? mitglieder.error;
        if (ersterFehler)
            setFehler(ersterFehler.message);
        setName(profil.data?.name ?? '');
        setEmail(profil.data?.email ?? '');
        setIstMasteradmin(Boolean(master.data));
        setMitgliedschaften((mitglieder.data ?? [])
            .filter((m) => m.reviere)
            .map((m) => ({
            rolle: m.rolle,
            revier: {
                id: m.reviere.id,
                name: m.reviere.name,
                flaeche_ha: m.reviere.flaeche_ha,
                hegering: m.reviere.hegeringe?.name ?? null,
                bundesland: m.reviere.bundesland,
            },
        }))
            .sort((a, b) => a.revier.name.localeCompare(b.revier.name, 'de')));
        setLaedt(false);
    }, [userId]);
    useEffect(() => {
        void neuLaden();
    }, [neuLaden]);
    return { laedt, fehler, name, email, istMasteradmin, mitgliedschaften, neuLaden };
}
const SPEICHER_SCHLUESSEL = 'hegewerk.aktuellesRevier';
export function gemerktesRevier() {
    try {
        return localStorage.getItem(SPEICHER_SCHLUESSEL);
    }
    catch {
        return null;
    }
}
export function revierMerken(id) {
    try {
        localStorage.setItem(SPEICHER_SCHLUESSEL, id);
    }
    catch {
        /* Speicher nicht verfügbar – Auswahl gilt dann nur für diese Sitzung */
    }
}
