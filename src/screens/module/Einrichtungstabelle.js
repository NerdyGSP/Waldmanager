import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import { EinrichtungsIcon } from '../../lib/einrichtungsIcons';
import { EINRICHTUNGSTYPEN } from '../../lib/stammdaten';
import { Hinweis, Knopf, Leer } from '../../components/ui';
import { EinrichtungSheet } from './EinrichtungSheet';
const typLabel = (t) => EINRICHTUNGSTYPEN.find((x) => x.wert === t)?.label ?? t;
const typIndex = (t) => {
    const i = EINRICHTUNGSTYPEN.findIndex((x) => x.wert === t);
    return i < 0 ? 999 : i;
};
const koordText = (e) => `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}`;
// Vollbild-Tabelle aller Einrichtungen des Reviers (Mitjäger nur lesend)
export function EinrichtungenVollbild({ k }) {
    const [zeilen, setZeilen] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [meldung, setMeldung] = useState(null);
    const [suche, setSuche] = useState('');
    const [typFilter, setTypFilter] = useState('');
    const [sortSpalte, setSortSpalte] = useState('typ');
    const [sortRichtung, setSortRichtung] = useState(1);
    const [dialog, setDialog] = useState(null);
    const laden = useCallback(async () => {
        const { data, error } = await supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 1 });
        if (error)
            return setFehler(fehlertext(error));
        const x = data;
        const basis = (x?.einrichtungen ?? []).map((e) => ({
            id: e.id ?? e.properties?.id ?? '',
            name: e.properties?.name ?? null,
            typ: (e.properties?.typ ?? 'sonstiges'),
            bemerkung: e.properties?.bemerkung ?? null,
            lng: e.geometry?.coordinates?.[0] ?? 0,
            lat: e.geometry?.coordinates?.[1] ?? 0,
        }));
        const [erst, ebenen, zonen, fang, jagd] = await Promise.all([
            supabase.from('einrichtungen').select('id, erstellt_am').eq('revier_id', k.revierId).is('geloescht_am', null),
            supabase.from('zonen_ebenen').select('id, name').eq('revier_id', k.revierId),
            supabase.from('zonen').select('id, name, ebene_id').eq('revier_id', k.revierId).is('geloescht_am', null),
            supabase.from('abschuesse').select('einrichtung_id, erlegt_am, art').eq('revier_id', k.revierId).not('einrichtung_id', 'is', null).is('geloescht_am', null).order('erlegt_am', { ascending: false }),
            supabase.from('bewegungsjagd_teilnehmer').select('zugeordnete_einrichtung_id, bewegungsjagden(titel, datum)').not('zugeordnete_einrichtung_id', 'is', null),
        ]);
        const erstMap = new Map((erst.data ?? []).map((e) => [e.id, e.erstellt_am]));
        const ebeneName = new Map((ebenen.data ?? []).map((e) => [e.id, e.name]));
        const zoneMap = new Map((zonen.data ?? []).map((z) => [z.id, z.ebene_id ? `${z.name} (${ebeneName.get(z.ebene_id) ?? 'Ebene'})` : z.name]));
        const letzterFang = new Map();
        for (const f of fang.data ?? [])
            if (f.einrichtung_id && !letzterFang.has(f.einrichtung_id))
                letzterFang.set(f.einrichtung_id, `${datumDE(f.erlegt_am.slice(0, 10))}${f.art ? ` · ${f.art}` : ''}`);
        const jagden = new Map();
        for (const t of jagd.data ?? []) {
            const j = t.bewegungsjagden;
            if (!t.zugeordnete_einrichtung_id || !j)
                continue;
            const set = jagden.get(t.zugeordnete_einrichtung_id) ?? new Set();
            set.add(`${j.titel}${j.datum ? ` (${datumDE(j.datum)})` : ''}`);
            jagden.set(t.zugeordnete_einrichtung_id, set);
        }
        const zonenIds = await Promise.all(basis.map(async (e) => {
            const r = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: e.lng, p_lat: e.lat });
            return r.data;
        }));
        setZeilen(basis.map((e, i) => ({
            ...e,
            erstellt: erstMap.get(e.id) ?? '',
            zone: (zonenIds[i] && zoneMap.get(zonenIds[i])) || '',
            zusatz: e.typ === 'falle' ? (letzterFang.has(e.id) ? `Letzter Fang: ${letzterFang.get(e.id)}` : 'Noch kein Fang')
                : e.typ === 'drueckjagdbock' ? (jagden.has(e.id) ? `Zugewiesen bei: ${[...jagden.get(e.id)].join(', ')}` : 'Keiner Jagd zugewiesen')
                    : '',
        })));
        setFehler(null);
    }, [k.revierId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    const zaehler = useMemo(() => {
        const m = new Map();
        for (const z of zeilen ?? [])
            m.set(z.typ, (m.get(z.typ) ?? 0) + 1);
        return m;
    }, [zeilen]);
    const sichtbar = useMemo(() => {
        const q = suche.trim().toLocaleLowerCase('de');
        const wert = (z) => {
            switch (sortSpalte) {
                case 'typ': return typIndex(z.typ);
                case 'name': return (z.name ?? '').toLocaleLowerCase('de');
                case 'zone': return z.zone.toLocaleLowerCase('de');
                case 'koord': return z.lat;
                case 'bemerkung': return (z.bemerkung ?? '').toLocaleLowerCase('de');
                case 'erstellt': return z.erstellt;
                case 'zusatz': return z.zusatz.toLocaleLowerCase('de');
            }
        };
        return (zeilen ?? [])
            .filter((z) => (!typFilter || z.typ === typFilter) && (!q || [z.name ?? '', typLabel(z.typ), z.zone, z.bemerkung ?? '', z.zusatz].some((t) => t.toLocaleLowerCase('de').includes(q))))
            .sort((a, b) => {
            const x = wert(a);
            const y = wert(b);
            const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de');
            return (r || (a.name ?? '').localeCompare(b.name ?? '', 'de')) * sortRichtung;
        });
    }, [zeilen, suche, typFilter, sortSpalte, sortRichtung]);
    const sortieren = (s) => {
        if (s === sortSpalte)
            setSortRichtung((r) => (r === 1 ? -1 : 1));
        else {
            setSortSpalte(s);
            setSortRichtung(1);
        }
    };
    const kopf = (s, text) => (_jsx("th", { scope: "col", "aria-sort": sortSpalte === s ? (sortRichtung === 1 ? 'ascending' : 'descending') : 'none', children: _jsxs("button", { type: "button", onClick: () => sortieren(s), children: [text, sortSpalte === s ? (sortRichtung === 1 ? ' ▲' : ' ▼') : ''] }) }));
    function csvExport() {
        const feld = (t) => `"${t.replace(/"/g, '""')}"`;
        const kopfzeile = ['Typ', 'Name', 'Zone', 'Breitengrad', 'Längengrad', 'Bemerkung', 'Angelegt am', 'Zusatzinfo'];
        const zeilenCsv = sichtbar.map((z) => [typLabel(z.typ), z.name ?? '', z.zone, z.lat.toFixed(6), z.lng.toFixed(6), z.bemerkung ?? '', z.erstellt ? datumDE(z.erstellt.slice(0, 10)) : '', z.zusatz]);
        const text = [kopfzeile, ...zeilenCsv].map((r) => r.map(feld).join(';')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'einrichtungen.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
    function aufKarte(z) {
        try {
            sessionStorage.setItem('hegewerk:kartenfokus', JSON.stringify({ id: z.id, name: z.name, typ: z.typ, bemerkung: z.bemerkung, lng: z.lng, lat: z.lat }));
        }
        catch {
            /* ohne Fokus */
        }
        navigieren('/karte');
    }
    const namen = (zeilen ?? []).map((z) => z.name);
    return (_jsxs("div", { className: "bj-vollbild", children: [_jsx("header", { className: "bj-vollbild-kopf", children: _jsxs("nav", { "aria-label": "Brotkrumen", children: [_jsx("button", { onClick: () => navigieren('/reviermanagement'), children: "\u2039 Zur\u00FCck zum Reviermanagement" }), _jsx("span", { children: "/" }), _jsx("span", { children: "Alle Einrichtungen" })] }) }), _jsxs("main", { className: "bj-vollbild-inhalt einr-tabelle-rahmen", style: { maxWidth: 1200 }, children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), meldung && _jsx(Hinweis, { art: "erfolg", children: meldung }), _jsxs("div", { className: "einr-zaehler", role: "group", "aria-label": "Nach Typ filtern", children: [_jsxs("button", { type: "button", "aria-pressed": typFilter === '', onClick: () => setTypFilter(''), children: ["Alle ", _jsx("strong", { children: zeilen?.length ?? 0 })] }), EINRICHTUNGSTYPEN.filter((t) => zaehler.has(t.wert)).map((t) => (_jsxs("button", { type: "button", "aria-pressed": typFilter === t.wert, onClick: () => setTypFilter(typFilter === t.wert ? '' : t.wert), children: [t.label, " ", _jsx("strong", { children: zaehler.get(t.wert) })] }, t.wert)))] }), _jsxs("div", { className: "einr-filter", children: [_jsx("input", { type: "search", placeholder: "Suchen (Name, Zone, Bemerkung)", "aria-label": "Einrichtungen suchen", value: suche, onChange: (e) => setSuche(e.target.value) }), _jsx(Knopf, { variante: "sekundaer", onClick: csvExport, disabled: !sichtbar.length, children: "CSV exportieren" })] }), zeilen === null && !fehler && _jsx("div", { className: "laden", children: "Lade \u2026" }), zeilen !== null && sichtbar.length === 0 && _jsx(Leer, { children: "Keine Einrichtungen in dieser Ansicht." }), sichtbar.length > 0 && (_jsx("div", { style: { overflowX: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }, children: _jsxs("table", { className: "einr-tab", children: [_jsx("thead", { children: _jsxs("tr", { children: [kopf('typ', 'Typ'), kopf('name', 'Name'), kopf('zone', 'Zone'), kopf('koord', 'Koordinaten'), kopf('bemerkung', 'Bemerkung'), kopf('erstellt', 'Angelegt am'), kopf('zusatz', 'Zusatzinfo'), _jsx("th", { scope: "col", children: "Aktionen" })] }) }), _jsx("tbody", { children: sichtbar.map((z) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("span", { style: { display: 'inline-flex', gap: 6, alignItems: 'center' }, title: typLabel(z.typ), children: [_jsx(EinrichtungsIcon, { typ: z.typ, farbe: EINRICHTUNGSTYPEN.find((t) => t.wert === z.typ)?.farbe ?? '#5d6d7e', groesse: 22 }), _jsx("small", { children: typLabel(z.typ) })] }) }), _jsx("td", { children: z.name ?? '–' }), _jsx("td", { children: z.zone || '–' }), _jsx("td", { children: koordText(z) }), _jsx("td", { children: z.bemerkung ?? '' }), _jsx("td", { children: z.erstellt ? datumDE(z.erstellt.slice(0, 10)) : '–' }), _jsx("td", { children: z.zusatz }), _jsxs("td", { className: "aktion", children: [_jsx(Knopf, { variante: "ghost", onClick: () => aufKarte(z), children: "Auf Karte zeigen" }), k.istInhaber && (_jsxs(_Fragment, { children: [_jsx(Knopf, { variante: "ghost", onClick: () => setDialog({ einr: z, start: 'bearbeiten' }), children: "Bearbeiten" }), _jsx(Knopf, { variante: "gefahr", onClick: () => setDialog({ einr: z, start: 'loeschen' }), children: "L\u00F6schen" })] }))] })] }, z.id))) })] }) }))] }), dialog && (_jsx("div", { className: "einr-dialog-rahmen", children: _jsx(EinrichtungSheet, { k: k, einr: dialog.einr, vergebeneNamen: namen, startAnsicht: dialog.start, onSchliessen: () => setDialog(null), onGeaendert: (text) => {
                        setDialog(null);
                        setMeldung(text);
                        void laden();
                    }, onVerschieben: () => undefined, onPosition: async () => 'gespeichert' }, `${dialog.einr.id}-${dialog.start}`) }))] }));
}
