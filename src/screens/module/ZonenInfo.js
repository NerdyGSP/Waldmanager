import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AuditZeile } from '../../components/AuditZeile';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import { Verlauf } from '../../components/diagramme';
import { Symbol } from '../../components/symbole';
const ANZAHL_ZAEHLUNGEN = 12;
const ANZAHL_SPALTEN = 6;
/** Informationsfenster am unteren Kartenrand: letzte Zählungen einer Zone als Tabelle und als Verlauf je Wildart */
export function ZonenInfo({ zone, onSchliessen, onBearbeiten }) {
    const wildarten = useWildarten();
    const [messungen, setMessungen] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [verlaufArt, setVerlaufArt] = useState('');
    useEffect(() => {
        let aktiv = true;
        setMessungen(null);
        setFehler(null);
        void supabase
            .from('zaehlungen')
            .select('wildart_id, anzahl, sitzung:zaehlsitzungen!inner(id, datum, status, geloescht_am)')
            .eq('zone_id', zone.id)
            .is('geloescht_am', null)
            .eq('sitzung.status', 'abgeschlossen')
            .is('sitzung.geloescht_am', null)
            .then(({ data, error }) => {
            if (!aktiv)
                return;
            if (error) {
                setFehler(fehlertext(error));
                return;
            }
            setMessungen((data ?? []).flatMap((z) => {
                const s = Array.isArray(z.sitzung) ? z.sitzung[0] : z.sitzung;
                return s ? [{ sitzungId: s.id, datum: s.datum, wildartId: z.wildart_id, anzahl: z.anzahl }] : [];
            }));
        });
        return () => {
            aktiv = false;
        };
    }, [zone.id]);
    // Letzte Zählungen (neueste zuerst), je Zählung die Summe je Wildart
    const auswertung = useMemo(() => {
        const sitzungen = new Map();
        for (const m of messungen ?? []) {
            const s = sitzungen.get(m.sitzungId) ?? { datum: m.datum, arten: new Map() };
            s.arten.set(m.wildartId, (s.arten.get(m.wildartId) ?? 0) + m.anzahl);
            sitzungen.set(m.sitzungId, s);
        }
        const liste = [...sitzungen.entries()]
            .map(([id, s]) => ({ id, ...s }))
            .sort((a, b) => b.datum.localeCompare(a.datum))
            .slice(0, ANZAHL_ZAEHLUNGEN);
        const artIds = new Set(liste.flatMap((s) => [...s.arten.keys()]));
        const arten = wildarten
            .filter((w) => artIds.has(w.id))
            .map((w) => {
            const werte = liste.map((s) => s.arten.get(w.id) ?? 0);
            return {
                id: w.id,
                name: w.name,
                werte,
                max: Math.max(...werte),
                schnitt: werte.reduce((a, n) => a + n, 0) / (werte.length || 1),
            };
        })
            .sort((a, b) => b.max - a.max);
        return { liste, arten };
    }, [messungen, wildarten]);
    useEffect(() => {
        if (auswertung.arten.length && !auswertung.arten.some((a) => a.id === verlaufArt))
            setVerlaufArt(auswertung.arten[0].id);
    }, [auswertung.arten, verlaufArt]);
    const spalten = auswertung.liste.slice(0, ANZAHL_SPALTEN);
    const verlaufsart = auswertung.arten.find((a) => a.id === verlaufArt);
    const mehrereJahre = new Set(auswertung.liste.map((s) => s.datum.slice(0, 4))).size > 1;
    const kurz = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', mehrereJahre ? { day: '2-digit', month: '2-digit', year: '2-digit' } : { day: '2-digit', month: '2-digit' });
    return (_jsxs("section", { className: "zonen-info", role: "dialog", "aria-label": `Zone ${zone.name}`, children: [_jsxs("header", { className: "zonen-info-kopf", children: [_jsx("i", { className: "farbpunkt", style: { background: zone.farbe ?? 'var(--color-primary)' } }), _jsxs("div", { children: [_jsx("strong", { children: zone.name }), _jsx(AuditZeile, { tabelle: "zonen", id: zone.id }), _jsxs("small", { children: [zone.flaecheHa ? `${zone.flaecheHa.toLocaleString('de-DE')} ha · ` : '', messungen === null && !fehler
                                        ? 'Zählungen werden geladen …'
                                        : auswertung.liste.length
                                            ? `${auswertung.liste.length} ${auswertung.liste.length === 1 ? 'Zählung' : 'Zählungen'}, zuletzt am ${datumDE(auswertung.liste[0].datum)}`
                                            : 'Noch keine abgeschlossene Zählung'] })] }), onBearbeiten && (_jsx("button", { className: "knopf knopf-sekundaer klein", onClick: onBearbeiten, children: "Punkte bearbeiten" })), _jsx("button", { className: "knopf knopf-ghost klein", onClick: () => navigieren('/zaehlung'), children: "Zur Wildz\u00E4hlung" }), _jsx("button", { className: "zonen-info-zu", onClick: onSchliessen, "aria-label": "Informationsfenster schlie\u00DFen", children: _jsx(Symbol, { name: "schliessen", className: "symbol klein" }) })] }), fehler && _jsx("p", { className: "feld-fehler", children: fehler }), auswertung.arten.length > 0 && (_jsxs("div", { className: "zonen-info-inhalt", children: [_jsx("div", { className: "zonen-info-tabelle tabelle-rahmen", children: _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Wildart" }), spalten.map((s) => (_jsx("th", { scope: "col", className: "zahl", children: kurz(s.datum) }, s.id))), _jsx("th", { scope: "col", className: "zahl", children: "\u00D8" }), _jsx("th", { scope: "col", className: "zahl", children: "Max" })] }) }), _jsx("tbody", { children: auswertung.arten.map((a) => (_jsxs("tr", { "aria-selected": a.id === verlaufArt, onClick: () => setVerlaufArt(a.id), className: "klickbar", children: [_jsx("th", { scope: "row", children: a.name }), a.werte.slice(0, ANZAHL_SPALTEN).map((w, i) => (_jsx("td", { className: `zahl ${w === 0 ? 'leise' : ''}`, children: w }, spalten[i].id))), _jsx("td", { className: "zahl leise", children: a.schnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 }) }), _jsx("td", { className: "zahl stark", children: a.max })] }, a.id))) })] }) }), _jsxs("div", { className: "zonen-info-verlauf", children: [_jsxs("label", { className: "filter", children: [_jsx("span", { children: "Verlauf" }), _jsx("select", { value: verlaufArt, onChange: (e) => setVerlaufArt(e.target.value), "aria-label": "Wildart im Verlauf", children: auswertung.arten.map((a) => (_jsx("option", { value: a.id, children: a.name }, a.id))) })] }), verlaufsart && (_jsx(Verlauf, { titel: `${verlaufsart.name} in ${zone.name}`, punkte: [...auswertung.liste]
                                    .reverse()
                                    .map((s) => ({ label: kurz(s.datum), wert: s.arten.get(verlaufsart.id) ?? 0 })) }))] })] }))] }));
}
