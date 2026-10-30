import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { useBreit } from '../lib/useBreit';
import { Auswahl, CodeAnzeige, Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';
const INAKTIV_TAGE = 90;
const zeitpunktDE = (iso) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// „vor 2 Tagen“
function vorZeit(iso) {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    const f = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
    if (min < 2)
        return 'gerade eben';
    if (min < 60)
        return f.format(-min, 'minute');
    if (min < 60 * 24)
        return f.format(-Math.round(min / 60), 'hour');
    if (min < 60 * 24 * 60)
        return f.format(-Math.round(min / 1440), 'day');
    if (min < 60 * 24 * 365)
        return f.format(-Math.round(min / 43200), 'month');
    return f.format(-Math.round(min / 525600), 'year');
}
// Aktivität = letzte App-Nutzung, sonst letzte Anmeldung
const referenz = (m) => m.aktiv ?? m.login;
function Aktivitaet({ m }) {
    const ref = referenz(m);
    if (!ref)
        return _jsx("span", { className: "aktiv-text", children: "Noch nie angemeldet" });
    const inaktiv = Date.now() - new Date(ref).getTime() > INAKTIV_TAGE * 86400000;
    const tipp = [m.aktiv ? `Zuletzt aktiv: ${zeitpunktDE(m.aktiv)}` : null, m.login ? `Letzte Anmeldung: ${zeitpunktDE(m.login)}` : null].filter(Boolean).join('\n');
    return (_jsxs("span", { className: "aktiv-text", title: tipp, children: [m.aktiv ? 'Zuletzt aktiv' : 'Letzte Anmeldung', " ", vorZeit(ref), inaktiv && _jsx("span", { className: "badge-inaktiv", children: "Inaktiv" })] }));
}
export function MitgliederPanel({ revierId, eigeneId }) {
    const [mitglieder, setMitglieder] = useState([]);
    const [offene, setOffene] = useState([]);
    const [fehler, setFehler] = useState(null);
    const [sortierung, setSortierung] = useState('name');
    const [zeigeAktivitaet, setZeigeAktivitaet] = useState(false);
    const breit = useBreit();
    const laden = useCallback(async () => {
        const [mit, logins, einl] = await Promise.all([
            supabase.from('revier_mitglieder').select('user_id, rolle, profiles(name, email)').eq('revier_id', revierId),
            supabase.rpc('revier_letzte_logins', { p_revier_id: revierId }),
            supabase.from('einladungen').select('code, rolle, email, gueltig_bis').eq('revier_id', revierId).is('eingeloest_am', null).gt('gueltig_bis', new Date().toISOString()).order('gueltig_bis'),
        ]);
        if (mit.error) {
            setFehler(fehlertext(mit.error));
            return;
        }
        // Nur Inhaber des Reviers bekommen Werte; sonst bleibt die Spalte ausgeblendet
        const aktivMap = new Map((logins.data ?? []).map((l) => [l.user_id, l]));
        setZeigeAktivitaet(!logins.error && aktivMap.size > 0);
        setOffene(einl.error ? [] : (einl.data ?? []));
        setMitglieder((mit.data ?? []).map((m) => ({
            user_id: m.user_id,
            rolle: m.rolle,
            name: m.profiles?.name ?? '–',
            email: m.profiles?.email ?? '',
            login: aktivMap.get(m.user_id)?.letzter_login ?? null,
            aktiv: aktivMap.get(m.user_id)?.zuletzt_aktiv_am ?? null,
        })));
    }, [revierId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    const sortiert = [...mitglieder].sort((a, b) => {
        if (sortierung === 'aktivitaet') {
            // Zuletzt aktive zuerst, „nie angemeldet“ am Ende
            const x = referenz(a);
            const y = referenz(b);
            if (x !== y)
                return !x ? 1 : !y ? -1 : y.localeCompare(x);
        }
        return a.rolle === b.rolle ? a.name.localeCompare(b.name, 'de') : a.rolle === 'inhaber' ? -1 : 1;
    });
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
    return (_jsxs(_Fragment, { children: [_jsxs(Gruppe, { titel: "Mitglieder", children: [zeigeAktivitaet && (_jsx("div", { style: { padding: '8px var(--abstand) 0' }, children: _jsxs(Auswahl, { label: "Sortieren nach", value: sortierung, onChange: (e) => setSortierung(e.target.value), children: [_jsx("option", { value: "name", children: "Name" }), _jsx("option", { value: "aktivitaet", children: "Letzter Login (zuletzt aktive zuerst)" })] }) })), breit && zeigeAktivitaet ? (_jsxs("table", { className: "mitglieder-tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Mitglied" }), _jsx("th", { children: "Rolle" }), _jsx("th", { children: _jsxs("button", { type: "button", className: "link", onClick: () => setSortierung((s) => (s === 'aktivitaet' ? 'name' : 'aktivitaet')), children: ["Letzter Login ", sortierung === 'aktivitaet' ? '↓' : ''] }) }), _jsx("th", {})] }) }), _jsxs("tbody", { children: [sortiert.map((m) => (_jsxs("tr", { children: [_jsxs("td", { children: [m.name, _jsx("small", { children: m.email })] }), _jsx("td", { children: _jsxs("select", { className: "zeile-auswahl", "aria-label": `Rolle von ${m.name}`, value: m.rolle, onChange: (e) => rolleAendern(m, e.target.value), children: [_jsx("option", { value: "inhaber", children: "Inhaber/P\u00E4chter" }), _jsx("option", { value: "mitjaeger", children: "Mitj\u00E4ger" })] }) }), _jsx("td", { children: _jsx(Aktivitaet, { m: m }) }), _jsx("td", { children: m.user_id !== eigeneId && (_jsx("button", { className: "link gefahr", onClick: () => entfernen(m), children: "Entfernen" })) })] }, m.user_id))), offene.map((e) => (_jsxs("tr", { className: "offen", children: [_jsxs("td", { children: [e.email ?? 'Einladung ohne E-Mail', _jsxs("small", { children: [e.rolle === 'inhaber' ? 'Inhaber/Pächter' : 'Mitjäger', " \u00B7 g\u00FCltig bis ", new Date(e.gueltig_bis).toLocaleDateString('de-DE')] })] }), _jsx("td", {}), _jsx("td", { children: _jsx("span", { className: "aktiv-text", children: "Einladung offen" }) }), _jsx("td", {})] }, e.code)))] })] })) : (_jsxs(_Fragment, { children: [sortiert.map((m) => (_jsxs(Zeile, { label: _jsxs(_Fragment, { children: [m.name, _jsx("small", { children: m.email }), zeigeAktivitaet && (_jsx("small", { children: _jsx(Aktivitaet, { m: m }) }))] }), children: [_jsxs("select", { className: "zeile-auswahl", "aria-label": `Rolle von ${m.name}`, value: m.rolle, onChange: (e) => rolleAendern(m, e.target.value), children: [_jsx("option", { value: "inhaber", children: "Inhaber/P\u00E4chter" }), _jsx("option", { value: "mitjaeger", children: "Mitj\u00E4ger" })] }), m.user_id !== eigeneId && (_jsx("button", { className: "link gefahr", onClick: () => entfernen(m), children: "Entfernen" }))] }, m.user_id))), offene.map((e) => (_jsx(Zeile, { label: _jsxs(_Fragment, { children: [e.email ?? 'Einladung ohne E-Mail', _jsxs("small", { children: ["Einladung offen \u00B7 ", e.rolle === 'inhaber' ? 'Inhaber/Pächter' : 'Mitjäger', " \u00B7 g\u00FCltig bis ", new Date(e.gueltig_bis).toLocaleDateString('de-DE')] })] }) }, e.code)))] }))] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(EinladungErstellen, { revierId: revierId })] }));
}
export function EinladungErstellen({ revierId, festeRolle, titel = 'Jemanden einladen', }) {
    const [rolle, setRolle] = useState(festeRolle ?? 'mitjaeger');
    const [email, setEmail] = useState('');
    const [tage, setTage] = useState(14);
    const [code, setCode] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [laedt, setLaedt] = useState(false);
    const [mailInfo, setMailInfo] = useState(null);
    async function absenden(e) {
        e.preventDefault();
        setFehler(null);
        setCode(null);
        setMailInfo(null);
        setLaedt(true);
        const adresse = email.trim();
        if (adresse) {
            // Mit E-Mail-Adresse: Code erstellen und die Einladung per Mail versenden
            const { data, error } = await supabase.functions.invoke('revier-einladen', {
                body: { revier_id: revierId, rolle: festeRolle ?? rolle, email: adresse, tage },
            });
            setLaedt(false);
            if (error || !data?.code) {
                setFehler(data?.fehler ?? (error ? fehlertext(error) : 'Einladung konnte nicht erstellt werden.'));
                return;
            }
            setCode(data.code);
            setMailInfo(data.mail ? `Einladung per E-Mail an ${adresse} gesendet.` : `Code erstellt, aber die E-Mail konnte nicht gesendet werden (${data.fehler ?? 'unbekannter Fehler'}). Gib den Code selbst weiter.`);
            return;
        }
        const { data, error } = await supabase.rpc('einladung_erstellen', {
            p_revier_id: revierId,
            p_rolle: festeRolle ?? rolle,
            p_gueltig_tage: tage,
        });
        setLaedt(false);
        if (error)
            setFehler(fehlertext(error));
        else
            setCode(data);
    }
    return (_jsxs("form", { onSubmit: absenden, children: [_jsxs(Gruppe, { titel: titel, fuss: "Der Code ist einmal nutzbar. Mit E-Mail-Adresse kann ihn nur diese Person einl\u00F6sen, und die Einladung wird ihr per E-Mail geschickt.", children: [!festeRolle && (_jsxs(Auswahl, { label: "Rolle", value: rolle, onChange: (e) => setRolle(e.target.value), children: [_jsx("option", { value: "mitjaeger", children: "Mitj\u00E4ger" }), _jsx("option", { value: "inhaber", children: "Inhaber/P\u00E4chter" })] })), _jsx(Feld, { label: "E-Mail (optional)", type: "email", value: email, onChange: (e) => setEmail(e.target.value) }), _jsxs(Auswahl, { label: "G\u00FCltig", value: tage, onChange: (e) => setTage(Number(e.target.value)), children: [_jsx("option", { value: 7, children: "7 Tage" }), _jsx("option", { value: 14, children: "14 Tage" }), _jsx("option", { value: 30, children: "30 Tage" }), _jsx("option", { value: 90, children: "90 Tage" })] })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), mailInfo && _jsx(Hinweis, { children: mailInfo }), code ? (_jsx(CodeAnzeige, { code: code, beschreibung: `Gib diesen Code weiter. Registrierung unter ${window.location.origin} mit E-Mail, Name und Code.` })) : (_jsx(Knopf, { type: "submit", variante: "sekundaer", disabled: laedt, children: "Einladungscode erstellen" }))] }));
}
