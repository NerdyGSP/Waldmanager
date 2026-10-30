import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { nameVergeben } from '../lib/stammdaten';
import { routenTypLabel } from '../lib/routen';
import { Auswahl, Feld, Hinweis } from './ui';
// Zielebene für Routen: Auswahl gefiltert nach Routentyp, auf Wunsch mit „Neue Ebene anlegen“
export function RoutenEbenenWahl({ typ, ebenen, ebeneId, neuerName, darfAnlegen, onAendern, }) {
    const passend = ebenen.filter((e) => e.typ === typ);
    if (!passend.length && !darfAnlegen)
        return null;
    const doppelt = ebeneId === '__neu' && !!neuerName.trim() && nameVergeben(ebenen.map((e) => e.name), neuerName) && !passend.some((e) => e.name.trim().toLowerCase() === neuerName.trim().toLowerCase());
    return (_jsxs(_Fragment, { children: [_jsxs(Auswahl, { label: `Ebene (${routenTypLabel(typ)})`, value: ebeneId, onChange: (e) => onAendern(e.target.value, neuerName), children: [_jsx("option", { value: "", children: "Ohne Ebene" }), passend.map((e) => (_jsx("option", { value: e.id, children: e.name }, e.id))), darfAnlegen && _jsx("option", { value: "__neu", children: "+ Neue Ebene anlegen \u2026" })] }), ebeneId === '__neu' && _jsx(Feld, { label: "Name der neuen Ebene", value: neuerName, onChange: (e) => onAendern(ebeneId, e.target.value) }), doppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Ebene \u201E", neuerName.trim(), "\u201C gibt es bereits (anderer Routentyp)."] })] }));
}
export const ebeneUngueltig = (ebeneId, neuerName) => ebeneId === '__neu' && !neuerName.trim();
