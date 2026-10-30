import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { himmelsrichtung } from '../../lib/geo';
import { sonneMond, wetterDetail } from '../../lib/wetterPanel';
import { Segmente } from '../../components/ui';
import { Symbol } from '../../components/symbole';
const zeitFmt = (d) => (d ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–');
// Panel zur Wetter-Chip-Anzeige: Wetter (Open-Meteo) und Sonne & Mond (lokal berechnet)
export function WetterPanel({ lat, lon, mitte, onSchliessen, }) {
    const [reiter, setReiter] = useState('wetter');
    const [w, setW] = useState(null);
    const [laedt, setLaedt] = useState(true);
    const [tag, setTag] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const laden = useCallback(async (erzwingen) => {
        setLaedt(true);
        setW(await wetterDetail(lat, lon, erzwingen));
        setLaedt(false);
    }, [lat, lon]);
    useEffect(() => {
        void laden(false);
    }, [laden]);
    const heute = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const stunden = (w?.stunden ?? []).filter((s) => {
        const t = s.zeit.slice(0, 10);
        // heute: ab der aktuellen Stunde, morgen: ganzer Tag in 3-Stunden-Schritten
        return t === heute ? new Date(s.zeit).getTime() >= Date.now() - 3600000 : t === morgen && Number(s.zeit.slice(11, 13)) % 3 === 0;
    });
    const sm = mitte ? sonneMond(mitte[1], mitte[0], new Date(`${tag}T12:00:00`)) : null;
    return (_jsxs("div", { className: "wetter-panel", role: "dialog", "aria-label": "Wetter, Sonne und Mond", children: [_jsxs("div", { className: "wetter-kopf", children: [_jsx(Segmente, { label: "Ansicht", wert: reiter, onAendern: setReiter, optionen: [{ wert: 'wetter', label: 'Wetter' }, { wert: 'sonne', label: 'Sonne & Mond' }] }), _jsx("button", { type: "button", className: "link", onClick: onSchliessen, "aria-label": "Schlie\u00DFen", children: _jsx(Symbol, { name: "schliessen", className: "symbol klein" }) })] }), reiter === 'wetter' && (_jsxs(_Fragment, { children: [!w && _jsx("p", { className: "leer", children: laedt ? 'Wetter wird geladen …' : 'Wetter nicht verfügbar (offline?).' }), w && (_jsxs(_Fragment, { children: [_jsxs("dl", { className: "wetter-werte", children: [_jsxs("div", { children: [_jsx("dt", { children: "Temperatur" }), _jsxs("dd", { children: [Math.round(w.temperatur), " \u00B0C ", _jsxs("small", { children: ["gef\u00FChlt ", Math.round(w.gefuehlt), " \u00B0C"] })] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Wind" }), _jsxs("dd", { children: [Math.round(w.windKmh), " km/h aus ", himmelsrichtung(w.windRichtung), " ", _jsxs("small", { children: ["B\u00F6en ", Math.round(w.boeen)] })] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Niederschlag" }), _jsxs("dd", { children: [w.niederschlag.toLocaleString('de-DE'), " mm"] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Bew\u00F6lkung" }), _jsxs("dd", { children: [w.bewoelkung, " %"] })] })] }), _jsxs("div", { className: "wetter-stunden", role: "table", "aria-label": "Stundenprognose", children: [_jsxs("div", { role: "row", className: "kopf", children: [_jsx("span", { children: "Zeit" }), _jsx("span", { children: "\u00B0C" }), _jsx("span", { children: "Wind / B\u00F6en" }), _jsx("span", { children: "mm" }), _jsx("span", { children: "Wolken" })] }), stunden.map((s) => (_jsxs("div", { role: "row", children: [_jsxs("span", { children: [s.zeit.slice(0, 10) === heute ? '' : 'morgen ', s.zeit.slice(11, 16)] }), _jsx("span", { children: Math.round(s.temperatur) }), _jsxs("span", { children: [Math.round(s.windKmh), " / ", Math.round(s.boeen)] }), _jsx("span", { children: s.niederschlag.toLocaleString('de-DE') }), _jsxs("span", { children: [s.bewoelkung, " %"] })] }, s.zeit)))] }), _jsxs("small", { className: "leer", children: ["Open-Meteo \u00B7 Stand ", new Date(w.stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })] }), _jsx("button", { type: "button", className: "link", onClick: () => void laden(true), children: "Aktualisieren" })] }))] })), reiter === 'sonne' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "zeile feld", children: [_jsx("span", { className: "zeile-label", children: "Datum" }), _jsx("input", { type: "date", value: tag, onChange: (e) => e.target.value && setTag(e.target.value) })] }), !sm && _jsx("p", { className: "leer", children: "Bitte Revier-Grenze anlegen \u2013 Sonne und Mond werden f\u00FCr die Reviermitte berechnet." }), sm && (_jsxs("dl", { className: "wetter-werte", children: [_jsxs("div", { children: [_jsx("dt", { children: "Sonnenaufgang" }), _jsx("dd", { children: zeitFmt(sm.aufgang) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Sonnenuntergang" }), _jsx("dd", { children: zeitFmt(sm.untergang) })] }), _jsxs("div", { children: [_jsx("dt", { children: "B\u00FCchsenlicht" }), _jsxs("dd", { children: [zeitFmt(sm.buechsenlichtVon), " \u2013 ", zeitFmt(sm.buechsenlichtBis), " ", _jsx("small", { children: "Richtwert: 1,5 Std. vor Aufgang bis 1,5 Std. nach Untergang" })] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Mondaufgang" }), _jsx("dd", { children: zeitFmt(sm.mondAufgang) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Monduntergang" }), _jsx("dd", { children: zeitFmt(sm.mondUntergang) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Mondphase" }), _jsxs("dd", { children: [sm.mondphase, " ", _jsxs("small", { children: [sm.beleuchtung, " % beleuchtet"] })] })] })] })), _jsx("small", { className: "leer", children: "Lokal berechnet f\u00FCr die Reviermitte (Zeiten in deiner Ortszeit)." })] }))] }));
}
