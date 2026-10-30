import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { Auswahl, CodeAnzeige, Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';
export function MitgliederPanel({ revierId, eigeneId }) {
    const [mitglieder, setMitglieder] = useState([]);
    const [fehler, setFehler] = useState(null);
    const laden = useCallback(async () => {
        const { data, error } = await supabase
            .from('revier_mitglieder')
            .select('user_id, rolle, profiles(name, email)')
            .eq('revier_id', revierId);
        if (error) {
            setFehler(fehlertext(error));
            return;
        }
        setMitglieder((data ?? [])
            .map((m) => ({
            user_id: m.user_id,
            rolle: m.rolle,
            name: m.profiles?.name ?? '–',
            email: m.profiles?.email ?? '',
        }))
            .sort((a, b) => (a.rolle === b.rolle ? a.name.localeCompare(b.name, 'de') : a.rolle === 'inhaber' ? -1 : 1)));
    }, [revierId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    async function rolleAendern(m, rolle) {
        setFehler(null);
        const { error } = await supabase
            .from('revier_mitglieder')
            .update({ rolle })
            .eq('revier_id', revierId)
            .eq('user_id', m.user_id);
        if (error)
            setFehler(fehlertext(error));
        await laden();
    }
    async function entfernen(m) {
        if (!window.confirm(`${m.name} aus dem Revier entfernen?`))
            return;
        setFehler(null);
        const { error } = await supabase
            .from('revier_mitglieder')
            .delete()
            .eq('revier_id', revierId)
            .eq('user_id', m.user_id);
        if (error)
            setFehler(fehlertext(error));
        await laden();
    }
    return (_jsxs(_Fragment, { children: [_jsx(Gruppe, { titel: "Mitglieder", children: mitglieder.map((m) => (_jsxs(Zeile, { label: _jsxs(_Fragment, { children: [m.name, _jsx("small", { children: m.email })] }), children: [_jsxs("select", { className: "zeile-auswahl", "aria-label": `Rolle von ${m.name}`, value: m.rolle, onChange: (e) => rolleAendern(m, e.target.value), children: [_jsx("option", { value: "inhaber", children: "Inhaber/P\u00E4chter" }), _jsx("option", { value: "mitjaeger", children: "Mitj\u00E4ger" })] }), m.user_id !== eigeneId && (_jsx("button", { className: "link gefahr", onClick: () => entfernen(m), children: "Entfernen" }))] }, m.user_id))) }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(EinladungErstellen, { revierId: revierId })] }));
}
export function EinladungErstellen({ revierId, festeRolle, titel = 'Jemanden einladen', }) {
    const [rolle, setRolle] = useState(festeRolle ?? 'mitjaeger');
    const [email, setEmail] = useState('');
    const [tage, setTage] = useState(14);
    const [code, setCode] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [laedt, setLaedt] = useState(false);
    async function absenden(e) {
        e.preventDefault();
        setFehler(null);
        setCode(null);
        setLaedt(true);
        const { data, error } = await supabase.rpc('einladung_erstellen', {
            p_revier_id: revierId,
            p_rolle: festeRolle ?? rolle,
            p_email: email.trim() || undefined,
            p_gueltig_tage: tage,
        });
        setLaedt(false);
        if (error)
            setFehler(fehlertext(error));
        else
            setCode(data);
    }
    return (_jsxs("form", { onSubmit: absenden, children: [_jsxs(Gruppe, { titel: titel, fuss: "Der Code ist einmal nutzbar. Mit E-Mail-Adresse kann ihn nur diese Person einl\u00F6sen.", children: [!festeRolle && (_jsxs(Auswahl, { label: "Rolle", value: rolle, onChange: (e) => setRolle(e.target.value), children: [_jsx("option", { value: "mitjaeger", children: "Mitj\u00E4ger" }), _jsx("option", { value: "inhaber", children: "Inhaber/P\u00E4chter" })] })), _jsx(Feld, { label: "E-Mail (optional)", type: "email", value: email, onChange: (e) => setEmail(e.target.value) }), _jsxs(Auswahl, { label: "G\u00FCltig", value: tage, onChange: (e) => setTage(Number(e.target.value)), children: [_jsx("option", { value: 7, children: "7 Tage" }), _jsx("option", { value: 14, children: "14 Tage" }), _jsx("option", { value: 30, children: "30 Tage" }), _jsx("option", { value: 90, children: "90 Tage" })] })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), code ? (_jsx(CodeAnzeige, { code: code, beschreibung: `Gib diesen Code weiter. Registrierung unter ${window.location.origin} mit E-Mail, Name und Code.` })) : (_jsx(Knopf, { type: "submit", variante: "sekundaer", disabled: laedt, children: "Einladungscode erstellen" }))] }));
}
