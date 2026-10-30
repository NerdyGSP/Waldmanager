import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { datumDE } from '../lib/zeit';
import { AUDIT_FELDER, personText, useProfilNamen } from '../lib/audit';
const zeit = (iso) => {
    if (!iso)
        return '';
    const d = new Date(iso);
    return `${datumDE(d.toLocaleDateString('sv-SE'))}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
};
// Schmale Zeile „Erstellt von X am … · Zuletzt geändert von Y am …“; lädt die Angaben selbst
export function AuditZeile({ tabelle, id, aktualisierung }) {
    const f = AUDIT_FELDER[tabelle];
    const [z, setZ] = useState(null);
    useEffect(() => {
        if (!id)
            return;
        let aktiv = true;
        const spalten = ['erstellt_am', f.von, 'geaendert_von', 'aktualisiert_am', ...(f.abschluss ? [f.abschluss.von, f.abschluss.am] : [])].join(', ');
        void supabase.from(tabelle)
            .select(spalten)
            .eq('id', id)
            .maybeSingle()
            .then(({ data }) => aktiv && setZ(data));
        return () => {
            aktiv = false;
        };
    }, [tabelle, id, f, aktualisierung]);
    const namen = useProfilNamen([z?.[f.von], z?.geaendert_von, f.abschluss ? z?.[f.abschluss.von] : null]);
    if (!z)
        return null;
    const erstellt = z.erstellt_am;
    const geaendert = z.aktualisiert_am && erstellt && Math.abs(new Date(z.aktualisiert_am).getTime() - new Date(erstellt).getTime()) > 60_000;
    const teile = [`${f.label} von ${personText(z[f.von], erstellt, namen)} am ${zeit(erstellt)}`];
    if (f.abschluss && z[f.abschluss.am])
        teile.push(`${f.abschluss.label} von ${personText(z[f.abschluss.von], z[f.abschluss.am], namen)} am ${zeit(z[f.abschluss.am])}`);
    if (geaendert)
        teile.push(`Zuletzt geändert von ${personText(z.geaendert_von, z.aktualisiert_am, namen)} am ${zeit(z.aktualisiert_am)}`);
    return (_jsx("small", { className: "audit-zeile", style: { color: 'var(--color-text-muted)', display: 'block' }, children: teile.join(' · ') }));
}
