import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { navigieren } from '../lib/router';
import { Fragment, createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
export function Gruppe({ titel, fuss, children }) {
    return (_jsxs("section", { className: "gruppe", children: [titel && _jsx("h2", { className: "gruppe-titel", children: titel }), _jsx("div", { className: "gruppe-inhalt", children: children }), fuss && _jsx("p", { className: "gruppe-fuss", children: fuss })] }));
}
export function Feld({ label, id, ...rest }) {
    // Eindeutige ID je Feld, damit gleich benannte Felder (z. B. „Name“) sich nicht in die Quere kommen
    const autoId = useId();
    const feldId = id ?? autoId;
    return (_jsxs("label", { className: "zeile feld", htmlFor: feldId, children: [_jsx("span", { className: "zeile-label", children: label }), _jsx("input", { id: feldId, ...rest })] }));
}
// Passwortfeld mit Umschalter zum Ein-/Ausblenden der Eingabe
export function PasswortFeld({ label, id, ...rest }) {
    const autoId = useId();
    const feldId = id ?? autoId;
    const [sichtbar, setSichtbar] = useState(false);
    return (_jsxs("div", { className: "zeile feld passwort-feld", children: [_jsx("label", { className: "zeile-label", htmlFor: feldId, children: label }), _jsx("input", { id: feldId, type: sichtbar ? 'text' : 'password', autoCapitalize: "none", spellCheck: false, ...rest }), _jsx("button", { type: "button", className: "auge", onClick: () => setSichtbar((s) => !s), "aria-label": sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen', "aria-pressed": sichtbar, children: sichtbar ? (_jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.4 8 2.8 10.1 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" }) })) : (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: [_jsx("path", { d: "M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] })) })] }));
}
export function Auswahl({ label, id, children, ...rest }) {
    const autoId = useId();
    const feldId = id ?? autoId;
    return (_jsxs("label", { className: "zeile feld", htmlFor: feldId, children: [_jsx("span", { className: "zeile-label", children: label }), _jsx("select", { id: feldId, ...rest, children: children })] }));
}
export function Zeile({ label, wert, children }) {
    return (_jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: label }), wert !== undefined && _jsx("span", { className: "zeile-wert", children: wert }), children] }));
}
export function Knopf({ variante = 'primaer', className, ...rest }) {
    return _jsx("button", { className: `knopf knopf-${variante} ${className ?? ''}`, ...rest });
}
export function Hinweis({ art = 'info', children }) {
    return (_jsx("div", { className: `hinweis hinweis-${art}`, role: art === 'fehler' ? 'alert' : 'status', children: children }));
}
// In der Desktop-Seitenleiste stellt die Leiste selbst den Titel dar
export const EingebettetKontext = createContext(false);
export function Seite({ titel, untertitel, aktion, zurueck, children, }) {
    const eingebettet = useContext(EingebettetKontext);
    if (eingebettet) {
        // Unteransichten (mit eigenem Zurück) behalten ihren Titel, Modul-Startseiten nicht
        return (_jsxs("div", { className: "seite seite-eingebettet", children: [(zurueck || untertitel || aktion) && (_jsxs("div", { className: "seite-kopf", children: [zurueck && (_jsx("button", { className: "zurueck", onClick: zurueck, "aria-label": "Zur\u00FCck", children: "\u2039 Zur\u00FCck" })), _jsxs("div", { className: "seite-titel", children: [zurueck && _jsx("h2", { children: titel }), untertitel && _jsx("p", { children: untertitel })] }), aktion && _jsx("div", { className: "seite-aktion", children: aktion })] })), children] }));
    }
    return (_jsxs("div", { className: "seite", children: [_jsxs("div", { className: "seite-kopf", children: [_jsx("button", { className: "zurueck", onClick: zurueck ?? (() => navigieren('/')), "aria-label": "Zur\u00FCck", children: "\u2039 Zur\u00FCck" }), _jsxs("div", { className: "seite-titel", children: [_jsx("h1", { children: titel }), untertitel && _jsx("p", { children: untertitel })] }), aktion && _jsx("div", { className: "seite-aktion", children: aktion })] }), children] }));
}
export function Zaehler({ wert, onAendern, min = 0, label, }) {
    return (_jsxs("div", { className: "zaehler", role: "group", "aria-label": label, children: [_jsx("button", { type: "button", onClick: () => onAendern(Math.max(min, wert - 1)), disabled: wert <= min, "aria-label": `${label} verringern`, children: "\u2212" }), _jsx("output", { "aria-live": "polite", children: wert }), _jsx("button", { type: "button", onClick: () => onAendern(wert + 1), "aria-label": `${label} erhöhen`, children: "+" })] }));
}
export function Segmente({ optionen, wert, onAendern, label, }) {
    return (_jsx("div", { className: "segmente", role: "radiogroup", "aria-label": label, children: optionen.map((o) => (_jsx("button", { type: "button", role: "radio", "aria-checked": o.wert === wert, onClick: () => onAendern(o.wert), children: o.label }, o.wert))) }));
}
export function Leer({ children }) {
    return _jsx("p", { className: "leer", children: children });
}
export function CodeAnzeige({ code, beschreibung }) {
    async function kopieren() {
        try {
            await navigator.clipboard.writeText(code);
        }
        catch {
            /* Zwischenablage nicht verfügbar */
        }
    }
    return (_jsxs("div", { className: "code-anzeige", children: [_jsx("div", { className: "code-wert", children: code }), _jsx("p", { children: beschreibung }), _jsx(Knopf, { variante: "sekundaer", type: "button", onClick: kopieren, children: "Code kopieren" })] }));
}
/** Farbwahl, die erst nach kurzer Pause speichert (der Farbwähler feuert beim Ziehen laufend) */
export function Farbwahl({ wert, label, onAendern }) {
    const [lokal, setLokal] = useState(wert);
    const timer = useRef(null);
    useEffect(() => setLokal(wert), [wert]);
    useEffect(() => () => { if (timer.current)
        window.clearTimeout(timer.current); }, []);
    return (_jsx("input", { type: "color", className: "farbwahl", "aria-label": label, value: lokal, onChange: (e) => {
            const neu = e.target.value;
            setLokal(neu);
            if (timer.current)
                window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => onAendern(neu), 450);
        } }));
}
// Mausrad scrollt eine horizontale Leiste (Desktop-Browser kennen sonst nur Shift+Rad)
export function useRadHorizontal() {
    const aufraeumen = useRef(null);
    return useCallback((el) => {
        aufraeumen.current?.();
        aufraeumen.current = null;
        if (!el)
            return;
        const rad = (e) => {
            if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY))
                return;
            el.scrollLeft += e.deltaY;
            e.preventDefault();
        };
        el.addEventListener('wheel', rad, { passive: false });
        aufraeumen.current = () => el.removeEventListener('wheel', rad);
    }, []);
}
// Hauptwildarten (Sortierung < 10) zuerst, danach Trennlinie und der Rest
export const HAUPTWILDARTEN_BIS = 10;
export function WildartOptionen({ wildarten }) {
    return (_jsx(_Fragment, { children: wildarten.map((w, i) => (_jsxs(Fragment, { children: [i > 0 && w.sortierung >= HAUPTWILDARTEN_BIS && wildarten[i - 1].sortierung < HAUPTWILDARTEN_BIS && (_jsx("option", { disabled: true, value: "__trenner", children: "----------" })), _jsx("option", { value: w.id, children: w.name })] }, w.id))) }));
}
