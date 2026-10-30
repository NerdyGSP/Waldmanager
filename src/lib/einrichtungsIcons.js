import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { EINRICHTUNGS_PFADE_512 } from './einrichtungsPfade';
// Feste Reihenfolge der Einrichtungstypen, gruppiert (gilt für Auswahllisten, Filter und Legende)
export const EINRICHTUNGS_GRUPPEN = [
    { name: 'Ansitz', typen: ['hochsitz', 'kanzel', 'ansitzleiter', 'bodensitz', 'drueckjagdbock'] },
    { name: 'Revierpflege', typen: ['kirrung', 'salzlecke', 'fuetterung', 'wildacker'] },
    { name: 'Technik und Fang', typen: ['wildkamera', 'falle'] },
    { name: 'Sonstiges', typen: ['sonstiges'] },
];
export const EINRICHTUNGS_REIHENFOLGE = EINRICHTUNGS_GRUPPEN.flatMap((g) => g.typen);
// game-icons.net (CC BY 3.0) – weiß auf farbigem Grund
export const EINRICHTUNGS_PFADE = EINRICHTUNGS_PFADE_512;
// Wird in die Karte als Bild eingetragen (Kreis + Symbol, 2× aufgelöst)
export function einrichtungsBild(typ, farbe) {
    const px = 56;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.beginPath();
    g.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2);
    g.fillStyle = farbe;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#ffffff';
    g.stroke();
    const s = (px * 0.66) / 512;
    g.translate(px / 2 - 256 * s, px / 2 - 256 * s);
    g.scale(s, s);
    g.fillStyle = '#ffffff';
    g.fill(new Path2D(EINRICHTUNGS_PFADE[typ]));
    return g.getImageData(0, 0, px, px);
}
export function EinrichtungsIcon({ typ, farbe, groesse = 20 }) {
    return (_jsxs("svg", { width: groesse, height: groesse, viewBox: "-3 -3 30 30", "aria-hidden": "true", style: { flex: 'none' }, children: [_jsx("circle", { cx: "12", cy: "12", r: "14", fill: farbe }), _jsx("circle", { cx: "12", cy: "12", r: "13.2", fill: "none", stroke: "#fff", strokeWidth: "1.2" }), _jsx("path", { d: EINRICHTUNGS_PFADE[typ], fill: "#fff", transform: "translate(4.32 4.32) scale(0.03)" })] }));
}
