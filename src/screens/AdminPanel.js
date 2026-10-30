import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';
import { EinladungErstellen } from './MitgliederPanel';
// Masteradmin: Hegeringe und Reviere anlegen, Inhaber einladen, Reviere löschen.
// Fachdaten der Reviere sind für den Masteradmin per RLS nicht sichtbar –
// außer in Revieren, in denen er selbst Mitglied ist.
export function AdminPanel({ eigeneId, onGeaendert, }) {
    const [hegeringe, setHegeringe] = useState([]);
    const [reviere, setReviere] = useState([]);
    const [einladenFuer, setEinladenFuer] = useState(null);
    const [fehler, setFehler] = useState(null);
    const laden = useCallback(async () => {
        const [hr, rv] = await Promise.all([
            supabase.from('hegeringe').select('id, name').order('name'),
            supabase
                .from('reviere')
                .select('id, name, flaeche_ha, hegering_id, hegeringe(name), revier_mitglieder(user_id, rolle, profiles(name))')
                .order('name'),
        ]);
        const err = hr.error ?? rv.error;
        if (err)
            setFehler(fehlertext(err));
        setHegeringe(hr.data ?? []);
        setReviere((rv.data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            flaeche_ha: r.flaeche_ha,
            hegering_id: r.hegering_id,
            hegering: r.hegeringe?.name ?? '–',
            inhaber: r.revier_mitglieder.filter((m) => m.rolle === 'inhaber').map((m) => m.profiles?.name ?? '?'),
            mitglieder: r.revier_mitglieder.length,
            selbstMitglied: r.revier_mitglieder.some((m) => m.user_id === eigeneId),
        })));
    }, [eigeneId]);
    // Masteradmin trägt sich selbst als Inhaber ein: Einladung erzeugen und sofort einlösen
    async function selbstEintragen(r) {
        setFehler(null);
        const erstellt = await supabase.rpc('einladung_erstellen', {
            p_revier_id: r.id,
            p_rolle: 'inhaber',
            p_gueltig_tage: 1,
        });
        if (erstellt.error || !erstellt.data) {
            setFehler(fehlertext(erstellt.error ?? 'Einladung konnte nicht erstellt werden.'));
            return;
        }
        const eingeloest = await supabase.rpc('einladung_einloesen', { p_code: erstellt.data });
        if (eingeloest.error) {
            setFehler(fehlertext(eingeloest.error));
            return;
        }
        await laden();
        await onGeaendert(r.id);
    }
    useEffect(() => {
        void laden();
    }, [laden]);
    async function revierLoeschen(r) {
        const eingabe = window.prompt(`Revier „${r.name}“ endgültig löschen? Alle Zählungen, Abschüsse, Zonen und Einrichtungen werden mitgelöscht.\n\nZur Bestätigung den Reviernamen eingeben:`);
        if (eingabe?.trim() !== r.name)
            return;
        setFehler(null);
        const { error } = await supabase.from('reviere').delete().eq('id', r.id);
        if (error)
            setFehler(fehlertext(error));
        await laden();
        await onGeaendert();
    }
    // Hegeringe lassen sich nur löschen, wenn ihnen kein Revier mehr zugeordnet ist
    async function hegeringLoeschen(h) {
        if (!window.confirm(`Hegering „${h.name}“ löschen?`))
            return;
        setFehler(null);
        const { error } = await supabase.from('hegeringe').delete().eq('id', h.id);
        if (error)
            setFehler(fehlertext(error));
        await laden();
    }
    const revierAnzahl = (hegeringId) => reviere.filter((r) => r.hegering_id === hegeringId).length;
    return (_jsxs("div", { className: "admin", children: [_jsx("h2", { className: "bereich-titel", children: "Hegeringe & Reviere" }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsxs(Gruppe, { titel: "Reviere", children: [reviere.length === 0 && _jsx(Zeile, { label: "Noch keine Reviere angelegt" }), reviere.map((r) => (_jsxs("div", { children: [_jsxs(Zeile, { label: _jsxs(_Fragment, { children: [r.name, _jsxs("small", { children: [r.hegering, r.flaeche_ha ? ` · ${r.flaeche_ha.toLocaleString('de-DE')} ha` : '', " \u00B7 ", r.mitglieder, ' ', r.mitglieder === 1 ? 'Mitglied' : 'Mitglieder', r.inhaber.length ? ` · Inhaber: ${r.inhaber.join(', ')}` : ' · noch kein Inhaber'] })] }), children: [r.selbstMitglied ? (_jsx("span", { className: "zeile-wert", children: "Du bist Mitglied" })) : (_jsx("button", { className: "link", onClick: () => selbstEintragen(r), children: "Mich als Inhaber eintragen" })), _jsx("button", { className: "link", onClick: () => setEinladenFuer(einladenFuer === r.id ? null : r.id), children: "Inhaber einladen" }), _jsx("button", { className: "link gefahr", onClick: () => revierLoeschen(r), children: "L\u00F6schen" })] }), einladenFuer === r.id && (_jsx("div", { className: "eingerueckt", children: _jsx(EinladungErstellen, { revierId: r.id, festeRolle: "inhaber", titel: `Inhaber für ${r.name} einladen` }) }))] }, r.id)))] }), _jsx(RevierAnlegen, { hegeringe: hegeringe, onAngelegt: async (id) => {
                    await laden();
                    setEinladenFuer(id);
                } }), _jsxs(Gruppe, { titel: "Hegeringe", fuss: "Ein Hegering l\u00E4sst sich erst l\u00F6schen, wenn ihm kein Revier mehr zugeordnet ist.", children: [hegeringe.length === 0 && _jsx(Zeile, { label: "Noch keine Hegeringe angelegt" }), hegeringe.map((h) => {
                        const anzahl = revierAnzahl(h.id);
                        return (_jsx(Zeile, { label: _jsxs(_Fragment, { children: [h.name, _jsxs("small", { children: [anzahl, " ", anzahl === 1 ? 'Revier' : 'Reviere'] })] }), children: anzahl === 0 && (_jsx("button", { className: "link gefahr", onClick: () => hegeringLoeschen(h), children: "L\u00F6schen" })) }, h.id));
                    })] }), _jsx(HegeringAnlegen, { onAngelegt: laden })] }));
}
function RevierAnlegen({ hegeringe, onAngelegt, }) {
    const [name, setName] = useState('');
    const [hegeringId, setHegeringId] = useState('');
    const [flaeche, setFlaeche] = useState('');
    const [fehler, setFehler] = useState(null);
    // Auswahl gültig halten: nach Löschen oder Neuanlage eines Hegerings nie auf eine alte ID zeigen
    useEffect(() => {
        if (!hegeringe.some((h) => h.id === hegeringId))
            setHegeringId(hegeringe[0]?.id ?? '');
    }, [hegeringe, hegeringId]);
    async function absenden(e) {
        e.preventDefault();
        setFehler(null);
        const ha = flaeche.trim() ? Number(flaeche.replace(',', '.')) : null;
        if (ha !== null && (!Number.isFinite(ha) || ha <= 0)) {
            setFehler('Bitte eine gültige Fläche in Hektar angeben.');
            return;
        }
        const { data, error } = await supabase
            .from('reviere')
            .insert({ name: name.trim(), hegering_id: hegeringId, flaeche_ha: ha })
            .select('id')
            .single();
        if (error) {
            setFehler(fehlertext(error));
            return;
        }
        setName('');
        setFlaeche('');
        await onAngelegt(data.id);
    }
    if (hegeringe.length === 0) {
        return _jsx(Hinweis, { children: "Lege zuerst einen Hegering an, danach kannst du Reviere anlegen." });
    }
    return (_jsxs("form", { onSubmit: absenden, children: [_jsxs(Gruppe, { titel: "Revier anlegen", fuss: "Nach dem Anlegen kannst du direkt den Inhaber/P\u00E4chter einladen.", children: [_jsx(Feld, { label: "Name", required: true, value: name, onChange: (e) => setName(e.target.value) }), _jsx(Auswahl, { label: "Hegering", value: hegeringId, onChange: (e) => setHegeringId(e.target.value), children: hegeringe.map((h) => (_jsx("option", { value: h.id, children: h.name }, h.id))) }), _jsx(Feld, { label: "Fl\u00E4che (ha)", inputMode: "decimal", placeholder: "optional", value: flaeche, onChange: (e) => setFlaeche(e.target.value) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", variante: "sekundaer", children: "Revier anlegen" })] }));
}
function HegeringAnlegen({ onAngelegt }) {
    const [name, setName] = useState('');
    const [fehler, setFehler] = useState(null);
    async function absenden(e) {
        e.preventDefault();
        setFehler(null);
        const { error } = await supabase.from('hegeringe').insert({ name: name.trim() });
        if (error) {
            setFehler(fehlertext(error));
            return;
        }
        setName('');
        await onAngelegt();
    }
    return (_jsxs("form", { onSubmit: absenden, children: [_jsx(Gruppe, { titel: "Hegering anlegen", children: _jsx(Feld, { label: "Name", required: true, value: name, onChange: (e) => setName(e.target.value) }) }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", variante: "sekundaer", children: "Hegering anlegen" })] }));
}
