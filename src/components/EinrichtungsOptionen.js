import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { EINRICHTUNGS_GRUPPEN } from '../lib/einrichtungsIcons';
import { EINRICHTUNGSTYPEN } from '../lib/stammdaten';
// Optionen für Auswahllisten, gruppiert (Ansitz · Revierpflege · Technik und Fang · Sonstiges).
// bockZuerst: Drückjagdbock steht vorn (Standzuweisung der Bewegungsjagd).
export function EinrichtungsOptionen({ zaehler, bockZuerst = false, nur }) {
    const opt = (wert) => {
        const t = EINRICHTUNGSTYPEN.find((x) => x.wert === wert);
        if (!t || (nur && !nur(wert)))
            return null;
        return (_jsxs("option", { value: wert, children: [t.label, zaehler ? ` (${zaehler(wert)})` : ''] }, wert));
    };
    return (_jsxs(_Fragment, { children: [bockZuerst && opt('drueckjagdbock'), EINRICHTUNGS_GRUPPEN.map((g) => {
                const eintraege = g.typen.filter((t) => !(bockZuerst && t === 'drueckjagdbock')).map(opt).filter(Boolean);
                return eintraege.length ? (_jsx("optgroup", { label: g.name, children: eintraege }, g.name)) : null;
            })] }));
}
