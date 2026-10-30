import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, jagdjahr } from '../../lib/zeit';
import { Gruppe, Hinweis, Knopf, Leer, Segmente } from '../../components/ui';
import { Verlauf } from '../../components/diagramme';
import { Druckrahmen } from '../bewegungsjagd/BjDruck';
const MODUS = { strecke: 'Strecke × Breite', zonen: 'Zonenfläche', zone: 'Zonenfläche' };
const ARTEN = [
    { art: 'abschuss', titel: 'Abschüsse' },
    { art: 'fang', titel: 'Fänge (gefangene Tiere)' },
    { art: 'fallwild', titel: 'Fallwild' },
];
const GESCHLECHT = { maennlich: 'männlich', weiblich: 'weiblich', unbekannt: 'unbekannt' };
const zahl = (n, nk = 0) => (n == null ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk }));
const jjLabel = (j) => jagdjahr(j).label;
export function JagdjahrReport({ k }) {
    const wildarten = useWildarten();
    const aktuell = aktuellesJagdjahr().start;
    const [o, setO] = useState({ von: aktuell - 4, bis: aktuell, wildart: '', gruppe: 'wildart', herkunft: 'alle', kennzahlen: false });
    const [daten, setDaten] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [druck, setDruck] = useState(false);
    useEffect(() => {
        let aktiv = true;
        setFehler(null);
        void supabase.rpc('jagdjahr_report', { p_revier_id: k.revierId, p_von_jahr: Math.min(o.von, o.bis), p_bis_jahr: Math.max(o.von, o.bis) }).then(({ data, error }) => {
            if (!aktiv)
                return;
            if (error)
                setFehler(fehlertext(error));
            else
                setDaten(data);
        });
        return () => {
            aktiv = false;
        };
    }, [k.revierId, o.von, o.bis]);
    const jahre = useMemo(() => {
        const v = Math.min(o.von, o.bis);
        const b = Math.max(o.von, o.bis);
        return Array.from({ length: b - v + 1 }, (_, i) => v + i);
    }, [o.von, o.bis]);
    const name = (id) => wildartName(wildarten, id);
    const strecke = useMemo(() => (daten?.strecke ?? []).filter((r) => (!o.wildart || r.wildart_id === o.wildart) && (o.herkunft === 'alle' || r.herkunft === o.herkunft)), [daten, o.wildart, o.herkunft]);
    const zaehl = useMemo(() => (daten?.zaehlung ?? []).filter((r) => !o.wildart || r.wildart_id === o.wildart), [daten, o.wildart]);
    const zaehlArten = useMemo(() => [...new Set(zaehl.map((r) => r.wildart_id))].sort((a, b) => name(a).localeCompare(name(b), 'de')), [zaehl, wildarten]); // eslint-disable-line react-hooks/exhaustive-deps
    const gewaehlteArt = zaehlArten[0] ?? '';
    function csv() {
        const z = (v) => (v == null ? '' : String(v).replace('.', ',').replace(/;/g, ','));
        const zeilen = [
            ['Teil', 'Jagdjahr', 'Wildart', 'Art', 'Herkunft', 'Geschlecht', 'Altersklasse', 'Anzahl', 'Zählungen', 'Maximum', 'Durchschnitt', 'Fläche ha', 'Wert je 100 ha', 'Flächenmodus'],
            ...strecke.map((r) => ['Strecke', jjLabel(r.jj), name(r.wildart_id), r.art, r.herkunft === 'revier' ? 'Ansitz/Pirsch' : 'Bewegungsjagd', GESCHLECHT[r.geschlecht] ?? r.geschlecht, r.altersklasse ?? '', r.anzahl, '', '', '', '', '', ''].map((x) => z(x))),
            ...zaehl.map((r) => ['Zählung', jjLabel(r.jj), name(r.wildart_id), '', '', '', '', '', r.sitzungen, r.maximum, r.schnitt, r.flaeche_ha, r.je100, r.modi.map((m) => MODUS[m] ?? m).join(' + ')].map((x) => z(x))),
        ];
        const text = '﻿' + zeilen.map((r) => r.join(';')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        a.download = `jagdjahre-${jjLabel(jahre[0]).replace('/', '-')}_${jjLabel(jahre[jahre.length - 1]).replace('/', '-')}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
    const inhalt = (d, ausdruck) => (_jsx(Inhalt, { d: d, o: o, jahre: jahre, strecke: strecke, zaehl: zaehl, zaehlArten: zaehlArten, diagrammArt: gewaehlteArt, name: name, ausdruck: ausdruck }));
    return (_jsxs("div", { className: "monitoring-box", children: [_jsxs("div", { className: "filter-leiste", children: [_jsxs("label", { className: "filter", children: [_jsx("span", { children: "Von" }), _jsx("select", { value: o.von, onChange: (e) => setO({ ...o, von: Number(e.target.value) }), children: Array.from({ length: 12 }, (_, i) => aktuell - i).map((j) => _jsx("option", { value: j, children: jjLabel(j) }, j)) })] }), _jsxs("label", { className: "filter", children: [_jsx("span", { children: "Bis" }), _jsx("select", { value: o.bis, onChange: (e) => setO({ ...o, bis: Number(e.target.value) }), children: Array.from({ length: 12 }, (_, i) => aktuell - i).map((j) => _jsx("option", { value: j, children: jjLabel(j) }, j)) })] }), _jsxs("label", { className: "filter", children: [_jsx("span", { children: "Wildart" }), _jsxs("select", { value: o.wildart, onChange: (e) => setO({ ...o, wildart: e.target.value }), children: [_jsx("option", { value: "", children: "Alle" }), wildarten.map((w) => _jsx("option", { value: w.id, children: w.name }, w.id))] })] }), _jsx(Segmente, { label: "Gruppierung", wert: o.gruppe, onAendern: (g) => setO({ ...o, gruppe: g }), optionen: [{ wert: 'wildart', label: 'Nach Wildart' }, { wert: 'jahr', label: 'Nach Jagdjahr' }] }), _jsx(Segmente, { label: "Herkunft", wert: o.herkunft, onAendern: (h) => setO({ ...o, herkunft: h }), optionen: [{ wert: 'alle', label: 'Alle' }, { wert: 'revier', label: 'Ansitz/Pirsch' }, { wert: 'bewegungsjagd', label: 'Bewegungsjagd' }] }), _jsxs("label", { className: "filter", style: { flexDirection: 'row', gap: 6, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: o.kennzahlen, onChange: (e) => setO({ ...o, kennzahlen: e.target.checked }) }), " ", _jsx("span", { children: "Kennzahlen" })] }), _jsxs("span", { style: { display: 'flex', gap: 6 }, children: [_jsx(Knopf, { variante: "ghost", disabled: !daten, onClick: () => setDruck(true), children: "Drucken" }), _jsx(Knopf, { variante: "ghost", disabled: !daten, onClick: csv, children: "CSV" })] })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), !daten && !fehler && _jsx("div", { className: "laden", children: "Lade \u2026" }), daten && inhalt(daten, false), druck && daten && (_jsx(Druckrahmen, { querformat: true, onZu: () => setDruck(false), children: _jsxs("section", { className: "bj-druck-seite quer", children: [_jsxs("h1", { children: ["Jagdjahr-Report \u00B7 ", k.revierName] }), _jsxs("p", { className: "art", children: ["Jagdjahre ", jjLabel(jahre[0]), " bis ", jjLabel(jahre[jahre.length - 1]), o.wildart ? ` · ${name(o.wildart)}` : '', " \u00B7 Erstellt am ", new Date().toLocaleDateString('de-DE')] }), inhalt(daten, true)] }) }))] }));
}
function Inhalt({ d, o, jahre, strecke, zaehl, zaehlArten, diagrammArt, name, ausdruck }) {
    const [art, setArt] = useState(diagrammArt);
    const aktArt = zaehlArten.includes(art) ? art : diagrammArt;
    const tab = ausdruck ? 'bj-druck-liste' : 'tabelle';
    const rahmen = (c) => (ausdruck ? c : _jsx("div", { className: "tabelle-rahmen", children: c }));
    const modiAlle = new Set(zaehl.flatMap((r) => r.modi));
    const verlauf = jahre.map((j) => ({ label: jjLabel(j).slice(2), wert: zaehl.find((r) => r.jj === j && r.wildart_id === aktArt)?.je100 ?? 0 }));
    // Strecke: Zeilen/Spalten je Gruppierung
    const streckeTabelle = (a) => {
        const zs = strecke.filter((r) => r.art === a);
        if (!zs.length)
            return null;
        const arten = [...new Set(zs.map((r) => r.wildart_id))].sort((x, y) => name(x).localeCompare(name(y), 'de'));
        const n = (w, j) => zs.filter((r) => (w == null || r.wildart_id === w) && (j == null || r.jj === j)).reduce((s, r) => s + r.anzahl, 0);
        const zeilen = o.gruppe === 'wildart' ? arten.map((w) => ({ k: w, l: name(w) })) : jahre.map((j) => ({ k: String(j), l: jjLabel(j) }));
        const spalten = o.gruppe === 'wildart' ? jahre.map((j) => ({ k: String(j), l: jjLabel(j) })) : arten.map((w) => ({ k: w, l: name(w) }));
        const wert = (z, s) => (o.gruppe === 'wildart' ? n(z, Number(s)) : n(s, Number(z)));
        const zSumme = (z) => (o.gruppe === 'wildart' ? n(z) : n(undefined, Number(z)));
        const sSumme = (s) => (o.gruppe === 'wildart' ? n(undefined, Number(s)) : n(s));
        // Detail: Wildart × Geschlecht/Altersklasse je Jagdjahr
        const detail = new Map();
        for (const r of zs) {
            const key = `${r.wildart_id}|${GESCHLECHT[r.geschlecht] ?? r.geschlecht}${r.altersklasse ? ` · ${r.altersklasse}` : ''}`;
            const m = detail.get(key) ?? new Map();
            m.set(r.jj, (m.get(r.jj) ?? 0) + r.anzahl);
            detail.set(key, m);
        }
        const detailTab = (_jsxs("table", { className: tab, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Wildart \u00B7 Geschlecht \u00B7 Alter" }), jahre.map((j) => _jsx("th", { scope: "col", className: "zahl", children: jjLabel(j) }, j)), _jsx("th", { scope: "col", className: "zahl", children: "Summe" })] }) }), _jsx("tbody", { children: [...detail.entries()].sort((x, y) => name(x[0].split('|')[0]).localeCompare(name(y[0].split('|')[0]), 'de') || x[0].localeCompare(y[0], 'de')).map(([key, m]) => (_jsxs("tr", { children: [_jsxs("th", { scope: "row", children: [name(key.split('|')[0]), " \u00B7 ", key.split('|')[1]] }), jahre.map((j) => _jsx("td", { className: "zahl", children: m.get(j) ?? '–' }, j)), _jsx("td", { className: "zahl", children: _jsx("strong", { children: [...m.values()].reduce((s, v) => s + v, 0) }) })] }, key))) })] }));
        return (_jsxs(Fragment, { children: [_jsx("h3", { style: { margin: '10px 0 4px', fontSize: '1rem' }, children: ARTEN.find((x) => x.art === a).titel }), rahmen(_jsxs("table", { className: tab, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: o.gruppe === 'wildart' ? 'Wildart' : 'Jagdjahr' }), spalten.map((s) => _jsx("th", { scope: "col", className: "zahl", children: s.l }, s.k)), _jsx("th", { scope: "col", className: "zahl", children: "Summe" })] }) }), _jsx("tbody", { children: zeilen.map((z) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: z.l }), spalten.map((s) => _jsx("td", { className: `zahl ${wert(z.k, s.k) ? '' : 'leise'}`, children: wert(z.k, s.k) || '–' }, s.k)), _jsx("td", { className: "zahl", children: _jsx("strong", { children: zSumme(z.k) }) })] }, z.k))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("th", { scope: "row", children: "Summe" }), spalten.map((s) => _jsx("td", { className: "zahl", children: _jsx("strong", { children: sSumme(s.k) }) }, s.k)), _jsx("td", { className: "zahl", children: _jsx("strong", { children: n() }) })] }) })] })), ausdruck ? _jsx("div", { style: { marginTop: 6 }, children: rahmen(detailTab) }) : _jsxs("details", { style: { margin: '6px 0' }, children: [_jsx("summary", { children: "Aufschl\u00FCsselung nach Geschlecht und Altersklasse" }), rahmen(detailTab)] })] }, a));
    };
    const hatStrecke = ARTEN.some((a) => strecke.some((r) => r.art === a.art));
    const zeilenB = [...zaehl].sort((x, y) => (o.gruppe === 'wildart' ? name(x.wildart_id).localeCompare(name(y.wildart_id), 'de') || x.jj - y.jj : x.jj - y.jj || name(x.wildart_id).localeCompare(name(y.wildart_id), 'de')));
    // Teil C: Kennzahlen je Wildart (Abschüsse + gefangene Tiere über den Zeitraum)
    const kennz = useMemo(() => {
        const arten = [...new Set([...strecke.map((r) => r.wildart_id), ...zaehl.map((r) => r.wildart_id)])];
        return arten
            .map((w) => {
            const s = strecke.filter((r) => r.wildart_id === w && r.art !== 'fallwild').reduce((a, r) => a + r.anzahl, 0);
            const zz = zaehl.filter((r) => r.wildart_id === w);
            const jahreMitZaehlung = zz.length;
            const schnittSumme = zz.reduce((a, r) => a + r.schnitt, 0);
            const sMitZaehl = strecke.filter((r) => r.wildart_id === w && r.art !== 'fallwild' && zz.some((z) => z.jj === r.jj)).reduce((a, r) => a + r.anzahl, 0);
            return { w, s, je100: d.revier_ha ? (s / d.revier_ha) * 100 / Math.max(1, jahre.length) : null, verhaeltnis: jahreMitZaehlung && schnittSumme > 0 ? sMitZaehl / schnittSumme : null };
        })
            .sort((a, b) => name(a.w).localeCompare(name(b.w), 'de'));
    }, [strecke, zaehl, d.revier_ha, jahre.length]); // eslint-disable-line react-hooks/exhaustive-deps
    return (_jsxs(_Fragment, { children: [_jsx(Gruppe, { titel: "A \u00B7 Strecke", children: _jsx("div", { style: { padding: '4px var(--abstand) 8px' }, children: hatStrecke ? ARTEN.map((a) => streckeTabelle(a.art)) : _jsx(Leer, { children: "Keine Strecke im gew\u00E4hlten Zeitraum." }) }) }), _jsx(Gruppe, { titel: "B \u00B7 Wildtiererfassung", fuss: "Nur abgeschlossene Z\u00E4hlungen. Z\u00E4hlwert = Summe je Z\u00E4hlung \u00FCber alle Zonen; Wert je 100 ha = gez\u00E4hlte St\u00FCcke \u00F7 gez\u00E4hlte Fl\u00E4che.", children: _jsxs("div", { style: { padding: '4px var(--abstand) 8px' }, children: [modiAlle.size > 1 && _jsx(Hinweis, { art: "warnung", children: "Gemischte Fl\u00E4chenmodi: Die Werte je 100 ha sind nicht streng vergleichbar." }), zeilenB.length === 0 ? (_jsx(Leer, { children: "Keine abgeschlossenen Z\u00E4hlungen im gew\u00E4hlten Zeitraum." })) : (rahmen(_jsxs("table", { className: tab, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: o.gruppe === 'wildart' ? 'Wildart' : 'Jagdjahr' }), _jsx("th", { scope: "col", children: o.gruppe === 'wildart' ? 'Jagdjahr' : 'Wildart' }), _jsx("th", { scope: "col", className: "zahl", children: "Z\u00E4hlungen" }), _jsx("th", { scope: "col", className: "zahl", children: "Max" }), _jsx("th", { scope: "col", className: "zahl", children: "\u00D8" }), _jsx("th", { scope: "col", className: "zahl", children: "Fl\u00E4che (ha)" }), _jsx("th", { scope: "col", className: "zahl", children: "je 100 ha" }), _jsx("th", { scope: "col", children: "Fl\u00E4chenmodus" })] }) }), _jsx("tbody", { children: zeilenB.map((r) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: o.gruppe === 'wildart' ? name(r.wildart_id) : jjLabel(r.jj) }), _jsx("td", { children: o.gruppe === 'wildart' ? jjLabel(r.jj) : name(r.wildart_id) }), _jsx("td", { className: "zahl", children: r.sitzungen }), _jsx("td", { className: "zahl", children: r.maximum }), _jsx("td", { className: "zahl", children: zahl(r.schnitt, 1) }), _jsx("td", { className: "zahl", children: zahl(r.flaeche_ha, 0) }), _jsx("td", { className: "zahl", children: _jsx("strong", { children: zahl(r.je100, 2) }) }), _jsx("td", { children: ausdruck ? r.modi.map((m) => MODUS[m] ?? m).join(' + ') : r.modi.map((m) => _jsx("span", { className: "badge", children: MODUS[m] ?? m }, m)) })] }, `${r.jj}${r.wildart_id}`))) })] }))), aktArt && (_jsxs("div", { className: "diagramm-block", style: { breakInside: 'avoid' }, children: [!ausdruck && (_jsxs("label", { className: "filter", children: [_jsx("span", { children: "Diagramm" }), _jsx("select", { value: aktArt, onChange: (e) => setArt(e.target.value), children: zaehlArten.map((w) => _jsx("option", { value: w, children: name(w) }, w)) })] })), _jsxs("strong", { style: { fontSize: '.9rem' }, children: ["Z\u00E4hlwert je 100 ha \u00FCber die Jagdjahre \u00B7 ", name(aktArt)] }), _jsx(Verlauf, { titel: `${name(aktArt)}: Zählwert je 100 ha`, punkte: verlauf })] }))] }) }), o.kennzahlen && (_jsx(Gruppe, { titel: "C \u00B7 Kennzahlen", fuss: `Strecke = Abschüsse und gefangene Tiere ohne Fallwild. Revierfläche ${zahl(d.revier_ha, 0)} ha. „je 100 ha“ ist der Jahresdurchschnitt im Zeitraum; Verhältnis = Strecke ÷ Summe der Ø-Zählwerte (nur Jagdjahre mit Zählung).`, children: _jsx("div", { style: { padding: '4px var(--abstand) 8px' }, children: rahmen(_jsxs("table", { className: tab, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Wildart" }), _jsx("th", { scope: "col", className: "zahl", children: "Strecke gesamt" }), _jsx("th", { scope: "col", className: "zahl", children: "Strecke je 100 ha Revier / Jahr" }), _jsx("th", { scope: "col", className: "zahl", children: "Strecke \u00F7 Z\u00E4hlwert" })] }) }), _jsx("tbody", { children: kennz.map((r) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: name(r.w) }), _jsx("td", { className: "zahl", children: r.s }), _jsx("td", { className: "zahl", children: zahl(r.je100, 2) }), _jsx("td", { className: "zahl", children: zahl(r.verhaeltnis, 2) })] }, r.w))) })] })) }) }))] }));
}
