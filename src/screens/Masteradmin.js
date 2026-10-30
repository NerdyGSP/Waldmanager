import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { datumDE } from '../lib/zeit';
import { CodeAnzeige, Gruppe, Hinweis, Knopf, Seite } from '../components/ui';
import { AdminPanel } from './AdminPanel';
import { Symbol } from '../components/symbole';
const ROLLEN = { inhaber: 'Inhaber/Pächter', mitjaeger: 'Mitjäger' };
// Masteradmin: Gesamtübersicht der Mitgliedschaften (ohne Fachdaten) und Verwaltung von Hegeringen/Revieren
export function Masteradmin({ userId, nachAenderung }) {
    const [zeilen, setZeilen] = useState([]);
    const [fehler, setFehler] = useState(null);
    const [laedt, setLaedt] = useState(true);
    const [suche, setSuche] = useState('');
    const [hegering, setHegering] = useState('');
    const [revier, setRevier] = useState('');
    const [sort, setSort] = useState({ spalte: 'hegering', auf: true });
    const [neuerCode, setNeuerCode] = useState(null);
    const laden = useCallback(async () => {
        const [m, e, l] = await Promise.all([
            supabase.from('revier_mitglieder').select('user_id, rolle, revier_id, reviere(name, hegeringe(name)), profiles(name, email)'),
            supabase
                .from('einladungen')
                .select('id, rolle, email, revier_id, gueltig_bis, reviere(name, hegeringe(name))')
                .is('eingeloest_am', null)
                .gt('gueltig_bis', new Date().toISOString()),
            supabase.rpc('masteradmin_letzte_logins'),
        ]);
        const err = m.error ?? e.error ?? l.error;
        if (err)
            setFehler(fehlertext(err));
        const logins = new Map((l.data ?? []).map((x) => [x.user_id, x.letzter_login]));
        const mitglieder = (m.data ?? []).map((x) => ({
            key: `m-${x.revier_id}-${x.user_id}`,
            art: 'mitglied',
            hegering: x.reviere?.hegeringe?.name ?? '–',
            revier: x.reviere?.name ?? '–',
            revierId: x.revier_id,
            name: x.profiles?.name ?? '?',
            email: x.profiles?.email ?? '',
            rolle: x.rolle,
            einladung: null,
            login: logins.get(x.user_id) ?? null,
            userId: x.user_id,
        }));
        const einladungen = (e.data ?? [])
            .filter((x) => x.revier_id)
            .map((x) => ({
            key: `e-${x.id}`,
            art: 'einladung',
            hegering: x.reviere?.hegeringe?.name ?? '–',
            revier: x.reviere?.name ?? '–',
            revierId: x.revier_id,
            name: '(noch nicht registriert)',
            email: x.email ?? '',
            rolle: x.rolle,
            einladung: x.gueltig_bis,
            login: null,
            einladungId: x.id,
        }));
        setZeilen([...mitglieder, ...einladungen]);
        setLaedt(false);
    }, []);
    useEffect(() => {
        void laden();
    }, [laden]);
    const hegeringe = useMemo(() => [...new Set(zeilen.map((z) => z.hegering))].sort((a, b) => a.localeCompare(b, 'de')), [zeilen]);
    const reviere = useMemo(() => [...new Set(zeilen.filter((z) => !hegering || z.hegering === hegering).map((z) => z.revier))].sort((a, b) => a.localeCompare(b, 'de')), [zeilen, hegering]);
    const sichtbar = useMemo(() => {
        const q = suche.trim().toLowerCase();
        const wert = (z) => (sort.spalte === 'login' ? z.login ?? '' : sort.spalte === 'einladung' ? z.einladung ?? '' : z[sort.spalte]);
        return zeilen
            .filter((z) => (!hegering || z.hegering === hegering) && (!revier || z.revier === revier) && (!q || `${z.name} ${z.email}`.toLowerCase().includes(q)))
            .sort((a, b) => wert(a).localeCompare(wert(b), 'de') * (sort.auf ? 1 : -1) || a.revier.localeCompare(b.revier, 'de'));
    }, [zeilen, suche, hegering, revier, sort]);
    const kopf = (spalte, titel) => (_jsx("th", { "aria-sort": sort.spalte === spalte ? (sort.auf ? 'ascending' : 'descending') : 'none', children: _jsxs("button", { onClick: () => setSort((s) => ({ spalte, auf: s.spalte === spalte ? !s.auf : true })), children: [titel, " ", sort.spalte === spalte ? _jsx(Symbol, { name: sort.auf ? 'nachOben' : 'nachUnten', className: "symbol klein" }) : ''] }) }));
    async function entfernen(z) {
        if (!window.confirm(`${z.name} aus „${z.revier}“ entfernen? Der Account bleibt bestehen.`))
            return;
        const { error } = await supabase.from('revier_mitglieder').delete().eq('revier_id', z.revierId).eq('user_id', z.userId);
        setFehler(error ? fehlertext(error) : null);
        await laden();
        await nachAenderung();
    }
    async function erneutSenden(z) {
        const { data, error } = await supabase.rpc('einladung_erstellen', {
            p_revier_id: z.revierId,
            p_rolle: z.rolle,
            p_email: z.email || undefined,
            p_gueltig_tage: 14,
        });
        if (error || !data)
            return setFehler(fehlertext(error ?? 'Einladung konnte nicht erstellt werden.'));
        await supabase.from('einladungen').delete().eq('id', z.einladungId);
        setFehler(null);
        setNeuerCode({ code: data, fuer: `${z.email || 'Einladung'} · ${z.revier}` });
        await laden();
    }
    return (_jsxs(Seite, { titel: "Masteradmin", children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), neuerCode && _jsx(CodeAnzeige, { code: neuerCode.code, beschreibung: `Neue Einladung für ${neuerCode.fuer} (14 Tage gültig). Der alte Code ist ungültig – bitte dem Empfänger übermitteln.` }), _jsxs(Gruppe, { titel: "\u00DCbersicht", fuss: "Nur Mitgliedschaften und offene Einladungen \u2013 keine Fachdaten der Reviere.", children: [_jsxs("div", { className: "ma-filter", style: { padding: 10 }, children: [_jsx("input", { type: "search", placeholder: "Suche nach Name oder E-Mail", "aria-label": "Suche", value: suche, onChange: (e) => setSuche(e.target.value) }), _jsxs("select", { "aria-label": "Hegering", value: hegering, onChange: (e) => { setHegering(e.target.value); setRevier(''); }, children: [_jsx("option", { value: "", children: "Alle Hegeringe" }), hegeringe.map((h) => _jsx("option", { children: h }, h))] }), _jsxs("select", { "aria-label": "Revier", value: revier, onChange: (e) => setRevier(e.target.value), children: [_jsx("option", { value: "", children: "Alle Reviere" }), reviere.map((r) => _jsx("option", { children: r }, r))] })] }), _jsx("div", { className: "ma-tabelle", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [kopf('hegering', 'Hegering'), kopf('revier', 'Revier'), kopf('name', 'User'), kopf('rolle', 'Rolle'), kopf('einladung', 'Einladung offen'), kopf('login', 'Letzter Login'), _jsx("th", { children: "Aktionen" })] }) }), _jsxs("tbody", { children: [laedt && _jsx("tr", { children: _jsx("td", { colSpan: 7, children: "Lade \u2026" }) }), !laedt && sichtbar.length === 0 && _jsx("tr", { children: _jsx("td", { colSpan: 7, children: "Keine Eintr\u00E4ge." }) }), sichtbar.map((z) => (_jsxs("tr", { children: [_jsx("td", { children: z.hegering }), _jsx("td", { children: z.revier }), _jsxs("td", { children: [z.name, _jsx("small", { children: z.email })] }), _jsx("td", { children: ROLLEN[z.rolle] ?? z.rolle }), _jsx("td", { children: z.einladung ? `ja, bis ${datumDE(z.einladung)}` : '–' }), _jsx("td", { children: z.login ? new Date(z.login).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–' }), _jsx("td", { children: z.art === 'mitglied' ? (_jsx("button", { className: "link gefahr", onClick: () => void entfernen(z), children: "Mitgliedschaft entfernen" })) : (_jsx("button", { className: "link", onClick: () => void erneutSenden(z), children: "Einladung erneut senden" })) })] }, z.key)))] })] }) })] }), _jsx(Knopf, { variante: "ghost", onClick: () => void laden(), children: "Aktualisieren" }), _jsx(AdminPanel, { eigeneId: userId, onGeaendert: async (id) => { await nachAenderung(id); await laden(); } })] }));
}
