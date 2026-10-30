import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Schlanke Diagramme ohne Fremdbibliothek, Farben über CSS-Variablen (hell/dunkel)
export function Balken({ zeilen, einheit = '', hervorheben, }) {
    const max = Math.max(...zeilen.map((z) => z.wert), 0) || 1;
    return (_jsx("div", { className: "balken", children: zeilen.map((z) => {
            const art = z.schluessel && hervorheben ? hervorheben(z.schluessel) : null;
            return (_jsxs("div", { className: `balken-zeile ${art ?? ''}`, children: [_jsx("span", { className: "balken-label", children: z.label }), _jsx("span", { className: "balken-spur", children: _jsx("span", { className: "balken-wert", style: { width: `${(z.wert / max) * 100}%` } }) }), _jsxs("span", { className: "balken-zahl", children: [z.wert.toLocaleString('de-DE', { maximumFractionDigits: 2 }), einheit, z.zusatz && _jsx("small", { children: z.zusatz })] })] }, z.schluessel ?? z.label));
        }) }));
}
export function Verlauf({ punkte, titel }) {
    if (punkte.length === 0)
        return null;
    const B = 640;
    const H = 220;
    const rand = { l: 36, r: 16, o: 16, u: 34 };
    const max = Math.max(...punkte.map((p) => p.wert), 1);
    const schritte = niceSchritte(max);
    const oben = schritte[schritte.length - 1] ?? max;
    const x = (i) => rand.l + (punkte.length === 1 ? (B - rand.l - rand.r) / 2 : (i / (punkte.length - 1)) * (B - rand.l - rand.r));
    const y = (v) => H - rand.u - (v / oben) * (H - rand.o - rand.u);
    const linie = punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.wert).toFixed(1)}`).join(' ');
    const jedes = Math.ceil(punkte.length / 8);
    return (_jsxs("svg", { className: "verlauf", viewBox: `0 0 ${B} ${H}`, role: "img", "aria-label": titel, children: [schritte.map((s) => (_jsxs("g", { children: [_jsx("line", { x1: rand.l, x2: B - rand.r, y1: y(s), y2: y(s), className: "gitter" }), _jsx("text", { x: rand.l - 8, y: y(s) + 4, textAnchor: "end", className: "achse", children: s })] }, s))), _jsx("path", { d: linie, className: "linie" }), punkte.map((p, i) => (_jsxs("g", { children: [_jsx("circle", { cx: x(i), cy: y(p.wert), r: "4", className: "punkt", children: _jsx("title", { children: `${p.label}: ${p.wert}` }) }), i % jedes === 0 && (_jsx("text", { x: x(i), y: H - 10, textAnchor: i === punkte.length - 1 && punkte.length > 2 ? 'end' : 'middle', className: "achse", children: p.label }))] }, `${p.label}-${i}`)))] }));
}
function niceSchritte(max) {
    const roh = max / 4;
    const potenz = 10 ** Math.floor(Math.log10(roh));
    const faktor = [1, 2, 2.5, 5, 10].find((f) => f * potenz >= roh) ?? 10;
    const schritt = Math.max(1, faktor * potenz);
    const liste = [];
    for (let v = 0; v <= max + schritt * 0.999; v += schritt)
        liste.push(Math.round(v * 100) / 100);
    return liste;
}
export const SERIENFARBEN = ['#1e5c3a', '#f26a1b', '#1f6fb2', '#8e44ad', '#5d6d7e', '#c0392b', '#16a085'];
const SERIENSTRICH = ['', '7 4', '2 4', '10 4 2 4', '4 4', '1 5', '12 3'];
const MONATE = ['Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär'];
const MONATSSTART = [0, 30, 61, 91, 122, 153, 183, 214, 244, 275, 306, 334, 365];
/** Mehrere Jagdjahre übereinander: x = Tag im Jagdjahr (1. April bis 31. März), eine Linie je Serie */
export function VerlaufMehrere({ serien, titel, hervorgehoben }) {
    const B = 760;
    const H = 300;
    const rand = { l: 40, r: 16, o: 14, u: 30 };
    const alle = serien.flatMap((s) => s.punkte);
    if (alle.length === 0)
        return null;
    const max = Math.max(...alle.map((p) => p.wert), 1);
    const schritte = niceSchritte(max);
    const oben = schritte[schritte.length - 1] ?? max;
    const x = (tag) => rand.l + (tag / 365) * (B - rand.l - rand.r);
    const y = (v) => H - rand.u - (v / oben) * (H - rand.o - rand.u);
    return (_jsxs("div", { className: "verlauf-mehrere", children: [_jsxs("svg", { className: "verlauf", viewBox: `0 0 ${B} ${H}`, role: "img", "aria-label": titel, children: [schritte.map((s) => (_jsxs("g", { children: [_jsx("line", { x1: rand.l, x2: B - rand.r, y1: y(s), y2: y(s), className: "gitter" }), _jsx("text", { x: rand.l - 8, y: y(s) + 4, textAnchor: "end", className: "achse", children: s })] }, s))), MONATE.map((m, i) => (_jsx("text", { x: x((MONATSSTART[i] + MONATSSTART[i + 1]) / 2), y: H - 8, textAnchor: "middle", className: "achse", children: m }, m))), serien.map((s, i) => {
                        const sortiert = [...s.punkte].sort((a, b) => a.x - b.x);
                        const farbe = SERIENFARBEN[i % SERIENFARBEN.length];
                        const stark = hervorgehoben === s.id;
                        return (_jsxs("g", { stroke: farbe, fill: "none", children: [_jsx("path", { d: sortiert.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)} ${y(p.wert).toFixed(1)}`).join(' '), strokeWidth: stark ? 3 : 2, strokeDasharray: SERIENSTRICH[i % SERIENSTRICH.length], strokeLinejoin: "round" }), sortiert.map((p, j) => (_jsx("circle", { cx: x(p.x), cy: y(p.wert), r: stark ? 4.5 : 3.5, className: "serienpunkt", style: { fill: 'var(--color-surface)' }, children: _jsx("title", { children: `${s.label} · ${p.titel}: ${p.wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })}` }) }, j)))] }, s.id));
                    })] }), _jsx("ul", { className: "serien-legende", children: serien.map((s, i) => (_jsxs("li", { children: [_jsx("svg", { width: "26", height: "10", "aria-hidden": "true", children: _jsx("line", { x1: "0", x2: "26", y1: "5", y2: "5", stroke: SERIENFARBEN[i % SERIENFARBEN.length], strokeWidth: "3", strokeDasharray: SERIENSTRICH[i % SERIENSTRICH.length] }) }), s.label] }, s.id))) })] }));
}
