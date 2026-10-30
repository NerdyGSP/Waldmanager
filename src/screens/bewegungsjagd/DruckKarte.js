import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
// Statische Druckkarte: LGLN-Luftbild (WMS, 300 dpi) mit SVG-Overlay – keine MapLibre-Karte,
// damit Vorschau und PDF zuverlässig sind. Alle Maße im SVG sind Millimeter.
const R = 6378137;
export const mx = (lng) => (lng * Math.PI * R) / 180;
export const my = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const FARBE = { belegt: '#1f4f8a', treffpunkt: '#c0392b', rettung: '#c0392b', eigener: '#e67e22' };
const RADIUS = 2.2;
// Bestehende Punkte in Gruppen von höchstens `max` Punkten teilen (Median-Schnitt an der längeren Achse)
export function teilePunkte(punkte, max) {
    if (punkte.length <= max)
        return [punkte];
    const xs = punkte.map((p) => mx(p.lng));
    const ys = punkte.map((p) => my(p.lat));
    const breit = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    const sortiert = [...punkte].sort((a, b) => (breit ? mx(a.lng) - mx(b.lng) : my(a.lat) - my(b.lat)));
    const mitte = Math.ceil(sortiert.length / 2);
    return [...teilePunkte(sortiert.slice(0, mitte), max), ...teilePunkte(sortiert.slice(mitte), max)];
}
const flaeche = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
function Symbol({ art, x, y }) {
    const r = RADIUS;
    switch (art) {
        case 'belegt':
            return _jsx("circle", { cx: x, cy: y, r: r, fill: FARBE.belegt, stroke: "#fff", strokeWidth: 0.6 });
        case 'frei':
            return _jsx("circle", { cx: x, cy: y, r: r, fill: "#fff", stroke: "#000", strokeWidth: 0.7 });
        case 'eigener':
            return (_jsxs("g", { children: [_jsx("circle", { cx: x, cy: y, r: r + 1.5, fill: "none", stroke: "#000", strokeWidth: 0.6 }), _jsx("circle", { cx: x, cy: y, r: r, fill: FARBE.eigener, stroke: "#000", strokeWidth: 0.7 })] }));
        case 'treffpunkt':
            return _jsx("polygon", { points: `${x},${y - r * 1.5} ${x + r * 1.4},${y + r} ${x - r * 1.4},${y + r}`, fill: FARBE.treffpunkt, stroke: "#fff", strokeWidth: 0.6 });
        case 'rettung':
            return (_jsxs("g", { children: [_jsx("rect", { x: x - r, y: y - r, width: 2 * r, height: 2 * r, fill: "#fff", stroke: "#000", strokeWidth: 0.7 }), _jsx("path", { d: `M${x - r * 0.6} ${y}H${x + r * 0.6}M${x} ${y - r * 0.6}V${y + r * 0.6}`, stroke: FARBE.rettung, strokeWidth: 0.9 })] }));
    }
}
const LEGENDE = [
    { art: 'treffpunkt', text: 'Treffpunkt' },
    { art: 'belegt', text: 'Stand belegt' },
    { art: 'frei', text: 'Stand frei' },
    { art: 'rettung', text: 'Rettungspunkt' },
];
export function DruckKarte({ punkte, breiteMm, hoeheMm, schriftMm = 3.4, mindestBreiteM = 500, pflichtLabels = true, legende = true, alt, }) {
    const k = useMemo(() => {
        if (punkte.length === 0)
            return null;
        const xs = punkte.map((p) => mx(p.lng));
        const ys = punkte.map((p) => my(p.lat));
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const seite = breiteMm / hoeheMm;
        // Rand für Beschriftungen: 12 % je Seite
        let b = Math.max((Math.max(...xs) - Math.min(...xs)) * 1.3, ((Math.max(...ys) - Math.min(...ys)) * 1.4) * seite, mindestBreiteM);
        let h = b / seite;
        const bbox = [cx - b / 2, cy - h / 2, cx + b / 2, cy + h / 2];
        const mProMm = b / breiteMm; // Mercator-Meter je Millimeter
        const pxB = Math.min(2600, Math.round((breiteMm / 25.4) * 300));
        const pxH = Math.round(pxB / seite);
        const url = 'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/jpeg&LAYERS=ni_dop20&STYLES=&CRS=EPSG:3857' +
            `&WIDTH=${pxB}&HEIGHT=${pxH}&BBOX=${bbox.join(',')}`;
        const pos = (p) => ({ x: ((mx(p.lng) - bbox[0]) / b) * breiteMm, y: (1 - (my(p.lat) - bbox[1]) / h) * hoeheMm });
        // Maßstabsleiste in echten Metern (Mercator-Maßstab durch cos(Breite) korrigiert)
        const lat0 = punkte.reduce((s, p) => s + p.lat, 0) / punkte.length;
        const echteMProMm = mProMm * Math.cos((lat0 * Math.PI) / 180);
        const wahl = [20, 50, 100, 200, 500, 1000].find((m) => m / echteMProMm >= 18) ?? 1000;
        const massstab = { m: wahl, mm: wahl / echteMProMm };
        // Beschriftungen platzieren (Kollisionsvermeidung mit Weißrand-Text)
        const punktePos = punkte.map((p) => ({ p, ...pos(p) }));
        const marker = punktePos.map(({ x, y }) => ({ x0: x - RADIUS - 0.8, y0: y - RADIUS * 1.5 - 0.8, x1: x + RADIUS + 0.8, y1: y + RADIUS + 0.8 }));
        const belegt = [];
        const prio = { eigener: 0, treffpunkt: 1, rettung: 2, belegt: 3, frei: 3 };
        const labels = new Map();
        for (const { p, x, y } of [...punktePos].sort((a, b) => prio[a.p.art] - prio[b.p.art])) {
            if (!p.label)
                continue;
            const zeilen = p.label2 ? 2 : 1;
            const w = Math.max(p.label.length, p.label2?.length ?? 0) * schriftMm * 0.56 + 1;
            const hh = zeilen * schriftMm * 1.15 + 0.6;
            const d = RADIUS + 1.2;
            const kandidaten = [
                { x, y: y + d + schriftMm, anker: 'middle', r: { x0: x - w / 2, y0: y + d, x1: x + w / 2, y1: y + d + hh } },
                { x, y: y - d - hh + schriftMm * 1.0, anker: 'middle', r: { x0: x - w / 2, y0: y - d - hh, x1: x + w / 2, y1: y - d } },
                { x: x + d + 0.5, y: y + schriftMm * 0.35, anker: 'start', r: { x0: x + d, y0: y - hh / 2, x1: x + d + w, y1: y + hh / 2 } },
                { x: x - d - 0.5, y: y + schriftMm * 0.35, anker: 'end', r: { x0: x - d - w, y0: y - hh / 2, x1: x - d, y1: y + hh / 2 } },
                { x: x + d, y: y + d + schriftMm, anker: 'start', r: { x0: x + d - 1, y0: y + d, x1: x + d - 1 + w, y1: y + d + hh } },
                { x: x - d, y: y + d + schriftMm, anker: 'end', r: { x0: x - d + 1 - w, y0: y + d, x1: x - d + 1, y1: y + d + hh } },
                { x: x + d, y: y - d - hh + schriftMm, anker: 'start', r: { x0: x + d - 1, y0: y - d - hh, x1: x + d - 1 + w, y1: y - d } },
                { x: x - d, y: y - d - hh + schriftMm, anker: 'end', r: { x0: x - d + 1 - w, y0: y - d - hh, x1: x - d + 1, y1: y - d } },
            ];
            const innen = (r) => r.x0 >= 0.5 && r.y0 >= 0.5 && r.x1 <= breiteMm - 0.5 && r.y1 <= hoeheMm - 6;
            const kosten = kandidaten.map((c) => ({
                c,
                kosten: [...belegt, ...marker].reduce((s, r) => s + flaeche(c.r, r), 0) + (innen(c.r) ? 0 : 1000),
            }));
            const frei = kosten.find((kk) => kk.kosten === 0);
            const best = frei ?? kosten.reduce((a, b2) => (b2.kosten < a.kosten ? b2 : a));
            if (!frei && !pflichtLabels)
                continue;
            belegt.push(best.c.r);
            labels.set(p.id, { x: best.c.x, y: best.c.y, anker: best.c.anker });
        }
        return { url, punktePos, labels, massstab };
    }, [punkte, breiteMm, hoeheMm, schriftMm, mindestBreiteM, pflichtLabels]);
    if (!k)
        return null;
    return (_jsxs("figure", { className: "bj-druck-dkarte", style: { width: `${breiteMm}mm` }, children: [_jsxs("div", { className: "bj-druck-dkarte-rahmen", style: { aspectRatio: `${breiteMm} / ${hoeheMm}` }, children: [_jsx("img", { src: k.url, alt: alt }), _jsxs("svg", { viewBox: `0 0 ${breiteMm} ${hoeheMm}`, preserveAspectRatio: "none", role: "img", "aria-label": alt, children: [k.punktePos.map(({ p, x, y }) => (_jsx(Symbol, { art: p.art, x: x, y: y }, p.id))), k.punktePos.map(({ p }) => {
                                const l = k.labels.get(p.id);
                                if (!l || !p.label)
                                    return null;
                                const stil = { fontSize: schriftMm, fontWeight: 700, fontFamily: 'Arial, Helvetica, sans-serif', stroke: '#fff', strokeWidth: schriftMm * 0.38, paintOrder: 'stroke', strokeLinejoin: 'round' };
                                return (_jsxs("text", { x: l.x, y: l.y, textAnchor: l.anker, style: stil, fill: "#000", children: [p.label, p.label2 && (_jsx("tspan", { x: l.x, dy: schriftMm * 1.15, style: { fontWeight: 500 }, children: p.label2 }))] }, p.id));
                            }), _jsxs("g", { children: [_jsx("rect", { x: 2, y: hoeheMm - 8, width: k.massstab.mm + 14, height: 6, fill: "#fff", opacity: 0.85 }), _jsx("path", { d: `M3 ${hoeheMm - 3.5}H${3 + k.massstab.mm}M3 ${hoeheMm - 5}V${hoeheMm - 2}M${3 + k.massstab.mm} ${hoeheMm - 5}V${hoeheMm - 2}`, stroke: "#000", strokeWidth: 0.5, fill: "none" }), _jsxs("text", { x: 5 + k.massstab.mm, y: hoeheMm - 2.6, style: { fontSize: 3.2, fontFamily: 'Arial, Helvetica, sans-serif' }, children: [k.massstab.m, " m"] })] }), _jsxs("text", { x: breiteMm - 1.5, y: hoeheMm - 1.5, textAnchor: "end", style: { fontSize: 2.6, fontFamily: 'Arial, Helvetica, sans-serif', stroke: '#fff', strokeWidth: 0.9, paintOrder: 'stroke' }, fill: "#000", children: ["\u00A9 GeoBasis-DE/LGLN ", new Date().getFullYear(), ", Daten ge\u00E4ndert"] })] })] }), legende && (_jsxs("figcaption", { className: "bj-druck-legende", children: [LEGENDE.filter((l) => punkte.some((p) => p.art === l.art) || (l.art === 'belegt' && punkte.some((p) => p.art === 'eigener'))).map((l) => (_jsxs("span", { children: [_jsx("svg", { viewBox: "-4 -4 8 8", width: "14", height: "14", "aria-hidden": "true", children: _jsx(Symbol, { art: l.art, x: 0, y: 0 }) }), ' ', l.text] }, l.art))), punkte.some((p) => p.art === 'eigener') && (_jsxs("span", { children: [_jsx("svg", { viewBox: "-6 -6 12 12", width: "16", height: "16", "aria-hidden": "true", children: _jsx(Symbol, { art: "eigener", x: 0, y: 0 }) }), ' ', "Dein Stand"] }))] }))] }));
}
