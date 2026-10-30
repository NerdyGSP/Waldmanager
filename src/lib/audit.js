import { useEffect, useState } from 'react';
import { supabase } from './supabase';
// Ab diesem Zeitpunkt füllt die Datenbank Ersteller/Bearbeiter automatisch. Ältere Datensätze haben keine Angabe („–“),
// neuere ohne Angabe gehören zu einem gelöschten Account („Ehemaliges Mitglied“).
export const AUDIT_AB = '2026-10-30T12:30:00Z';
const cache = new Map();
export function useProfilNamen(ids) {
    const gueltig = [...new Set(ids.filter((x) => !!x))];
    const schluessel = gueltig.sort().join(',');
    const [, setZaehler] = useState(0);
    useEffect(() => {
        const fehlend = gueltig.filter((id) => !cache.has(id));
        if (!fehlend.length)
            return;
        let aktiv = true;
        void supabase
            .from('profiles')
            .select('id, name')
            .in('id', fehlend)
            .then(({ data }) => {
            for (const p of data ?? [])
                cache.set(p.id, p.name);
            for (const id of fehlend)
                if (!cache.has(id))
                    cache.set(id, 'Mitglied');
            if (aktiv)
                setZaehler((z) => z + 1);
        });
        return () => {
            aktiv = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schluessel]);
    return cache;
}
export function personText(id, am, namen) {
    if (id)
        return namen.get(id) ?? '…';
    if (am && am >= AUDIT_AB)
        return 'Ehemaliges Mitglied';
    return '–';
}
// Spaltennamen je Tabelle: Ersteller und ggf. Abschluss
export const AUDIT_FELDER = {
    einrichtungen: { von: 'erstellt_von', label: 'Erstellt' },
    zonen: { von: 'erstellt_von', label: 'Erstellt' },
    zonen_ebenen: { von: 'erstellt_von', label: 'Erstellt' },
    routen_ebenen: { von: 'erstellt_von', label: 'Erstellt' },
    pirschwege: { von: 'erstellt_von', label: 'Erstellt' },
    revier_grenzen: { von: 'erstellt_von', label: 'Erstellt' },
    zaehlsitzungen: { von: 'erstellt_von', label: 'Gestartet', abschluss: { von: 'abgeschlossen_von', am: 'abgeschlossen_am', label: 'Abgeschlossen' } },
    beobachtungen: { von: 'erfasst_von', label: 'Erfasst' },
    abschuesse: { von: 'erfasst_von', label: 'Erfasst' },
    wildschaeden: { von: 'erfasst_von', label: 'Gemeldet', abschluss: { von: 'erledigt_von', am: 'erledigt_am', label: 'Erledigt' } },
    aufgaben: { von: 'erstellt_von', label: 'Erstellt', abschluss: { von: 'erledigt_von', am: 'erledigt_am', label: 'Erledigt' } },
    aufgabenlisten: { von: 'erstellt_von', label: 'Erstellt', abschluss: { von: 'erledigt_von', am: 'erledigt_am', label: 'Erledigt' } },
    begehungsscheine: { von: 'ausgestellt_von', label: 'Ausgestellt' },
    bewegungsjagden: { von: 'erstellt_von', label: 'Angelegt', abschluss: { von: 'abgeschlossen_von', am: 'abgeschlossen_am', label: 'Abgeschlossen' } },
};
