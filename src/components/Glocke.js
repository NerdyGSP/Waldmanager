import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ereignisOeffnen, symbolFuer, useEreignisse } from '../lib/ereignisse';
function tagesSchluessel(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function gruppieren(liste) {
    const heute = new Date();
    const gestern = new Date(heute.getTime() - 86400000);
    const gruppen = [
        { titel: 'Heute', eintraege: [] },
        { titel: 'Gestern', eintraege: [] },
        { titel: 'Älter', eintraege: [] },
    ];
    for (const e of liste) {
        const k = tagesSchluessel(new Date(e.erstellt_am));
        (k === tagesSchluessel(heute) ? gruppen[0] : k === tagesSchluessel(gestern) ? gruppen[1] : gruppen[2]).eintraege.push(e);
    }
    return gruppen.filter((g) => g.eintraege.length > 0);
}
function zeitText(e, mitDatum) {
    const d = new Date(e.erstellt_am);
    const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return mitDatum ? `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${uhr}` : uhr;
}
export function Glocke({ revierId, userId, className = '' }) {
    const { liste, ungelesen, gelesenBis, ladeFehler, markieren } = useEreignisse(revierId, userId);
    const [offen, setOffen] = useState(false);
    const knopf = useRef(null);
    const [lage, setLage] = useState(null);
    useEffect(() => {
        if (!offen)
            return;
        const r = knopf.current?.getBoundingClientRect();
        if (r)
            setLage({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 368)) });
        const taste = (ev) => ev.key === 'Escape' && setOffen(false);
        window.addEventListener('keydown', taste);
        return () => window.removeEventListener('keydown', taste);
    }, [offen]);
    if (!revierId)
        return null;
    const badge = ungelesen > 9 ? '9+' : String(ungelesen);
    async function antippen(e) {
        setOffen(false);
        void markieren(e.erstellt_am);
        await ereignisOeffnen(e, revierId);
    }
    return (_jsxs(_Fragment, { children: [_jsxs("button", { ref: knopf, type: "button", className: `glocke ${offen ? 'aktiv' : ''} ${className}`, onClick: () => setOffen((o) => !o), "aria-label": ungelesen > 0 ? `Benachrichtigungen, ${ungelesen} ungelesen` : 'Benachrichtigungen', "aria-expanded": offen, title: "Benachrichtigungen", children: [_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: [_jsx("path", { d: "M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" }), _jsx("path", { d: "M10 19a2 2 0 004 0" })] }), ungelesen > 0 && _jsx("span", { className: "glocke-badge", children: badge })] }), offen &&
                createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: "glocke-schleier", onClick: () => setOffen(false) }), _jsxs("div", { className: "glocke-panel", role: "dialog", "aria-label": "Benachrichtigungen", style: lage ? { top: lage.top, left: lage.left } : undefined, children: [_jsxs("header", { children: [_jsx("strong", { children: "Benachrichtigungen" }), _jsx("button", { type: "button", className: "glocke-alle", disabled: ungelesen === 0, onClick: () => void markieren(), children: "Alle als gelesen" })] }), _jsxs("div", { className: "glocke-liste", children: [ladeFehler && _jsx("p", { className: "glocke-leer", children: "Benachrichtigungen konnten nicht geladen werden." }), !ladeFehler && liste.length === 0 && _jsx("p", { className: "glocke-leer", children: "Keine Neuigkeiten." }), gruppieren(liste).map((g) => (_jsxs("section", { children: [_jsx("h3", { children: g.titel }), g.eintraege.map((e) => {
                                                    const neu = !gelesenBis || e.erstellt_am > gelesenBis;
                                                    return (_jsxs("button", { type: "button", className: `glocke-zeile ${neu ? 'neu' : ''} ${e.hervorgehoben ? 'hervor' : ''}`, onClick: () => void antippen(e), children: [_jsx("span", { className: "glocke-symbol", "aria-hidden": "true", children: symbolFuer(e) }), _jsxs("span", { className: "glocke-text", children: [_jsx("strong", { children: e.titel }), _jsxs("small", { children: [e.akteur_name ?? 'Unbekannt', " \u00B7 ", zeitText(e, g.titel === 'Älter')] })] }), neu && _jsx("span", { className: "glocke-punkt", "aria-label": "ungelesen" })] }, e.id));
                                                })] }, g.titel)))] })] })] }), document.body)] }));
}
