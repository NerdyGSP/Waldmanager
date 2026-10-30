import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useWildarten, wildartName } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { RECHTSHINWEIS, STATUS_TEXT, klassen, monatsbalken, statusAm, useJagdzeiten, zeitraumText, } from '../../lib/jagdzeiten';
import { datumDE } from '../../lib/zeit';
import { Auswahl, Gruppe, Hinweis, Leer, Seite, Zeile } from '../../components/ui';
const MONATE = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function Balken({ zeilen, heute }) {
    const b = useMemo(() => monatsbalken(zeilen), [zeilen]);
    return (_jsx("div", { className: "jz-balken", role: "img", "aria-label": b.map((s, i) => `${MONATSNAMEN[i]}: ${s === 'voll' ? 'jagdbar' : s === 'teil' ? 'teilweise jagdbar' : 'Schonzeit'}`).join(', '), children: b.map((s, i) => (_jsx("span", { className: `jz-monat jz-${s} ${i === heute.getMonth() ? 'jz-heute' : ''}`, children: MONATE[i] }, i))) }));
}
export function Jagdzeiten({ k, unterpfad }) {
    const wildarten = useWildarten();
    const { zeilen, geladen, fehler } = useJagdzeiten(k.bundesland);
    const [wildartFilter, setWildartFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [nurJagdbar, setNurJagdbar] = useState(false);
    const heute = useMemo(() => new Date(), []);
    const proArt = useMemo(() => {
        const m = new Map();
        for (const z of zeilen ?? [])
            m.set(z.wildart_id, [...(m.get(z.wildart_id) ?? []), z]);
        return m;
    }, [zeilen]);
    const liste = useMemo(() => wildarten
        .filter((w) => proArt.has(w.id))
        .map((w) => ({ w, zeilen: proArt.get(w.id), s: statusAm(proArt.get(w.id), heute) }))
        .filter((x) => (!wildartFilter || x.w.id === wildartFilter) && (!statusFilter || x.s.status === statusFilter) && (!nurJagdbar || x.s.status !== 'schonzeit')), [wildarten, proArt, heute, wildartFilter, statusFilter, nurJagdbar]);
    const kopf = (_jsxs(_Fragment, { children: [_jsxs(Hinweis, { children: [RECHTSHINWEIS, " Bundesland: ", _jsx("strong", { children: k.bundesland }), k.istInhaber ? ' (änderbar unter Reviermanagement → Revier).' : '.'] }), fehler && !geladen && _jsxs(Hinweis, { art: "fehler", children: ["Jagdzeiten konnten nicht geladen werden: ", fehler] })] }));
    // ----- Detail einer Wildart -----
    const detailId = unterpfad[0];
    if (detailId) {
        const z = proArt.get(detailId) ?? [];
        const s = z.length ? statusAm(z, heute) : null;
        const ks = klassen(z);
        const stand = z[0]?.gueltig_ab;
        return (_jsxs(Seite, { titel: wildartName(wildarten, detailId), untertitel: s ? `Heute: ${STATUS_TEXT[s.status]}` : undefined, zurueck: () => navigieren('/jagdzeiten'), children: [kopf, !z.length ? (_jsxs(Leer, { children: ["F\u00FCr diese Wildart sind f\u00FCr ", k.bundesland, " keine Zeiten hinterlegt."] })) : (_jsxs(_Fragment, { children: [_jsx(Gruppe, { titel: "Jahres\u00FCbersicht", fuss: "Gr\u00FCn: ganzer Monat jagdbar \u00B7 hell: zeitweise bzw. nur einzelne Klassen \u00B7 grau: Schonzeit. Heutiger Monat umrandet.", children: _jsx(Balken, { zeilen: z, heute: heute }) }), ks.map((c) => {
                            const jetzt = statusAm(c.zeilen, heute).status === 'jagdbar';
                            return (_jsxs(Gruppe, { titel: c.name ?? 'Alle Klassen', children: [_jsx(Zeile, { label: "Jagdzeit", wert: c.zeilen.map(zeitraumText).join(' und ') }), _jsx(Zeile, { label: "Schonzeit", wert: c.schonzeit ?? '–' }), _jsx(Zeile, { label: "Heute", wert: jetzt ? 'jagdbar' : 'Schonzeit' }), c.sonderregel && _jsx(Zeile, { label: "Sonderregel", wert: c.sonderregel })] }, c.name ?? 'alle'));
                        }), _jsxs(Gruppe, { titel: "Quelle", fuss: "Verbindlich bleibt die Landesverordnung.", children: [_jsx(Zeile, { label: "Verordnung", wert: z[0].quelle }), _jsx(Zeile, { label: "Stand", wert: stand ? datumDE(stand) : '–' }), z[0].quelle_url && (_jsx(Zeile, { label: "Link", wert: _jsx("a", { href: z[0].quelle_url, target: "_blank", rel: "noreferrer", children: "Verordnung / \u00DCbersicht \u00F6ffnen" }) }))] })] }))] }));
    }
    // ----- Übersicht -----
    return (_jsxs(Seite, { titel: "Jagd- & Schonzeiten", untertitel: `${k.bundesland} · heute ${datumDE(heute.toISOString().slice(0, 10))}`, children: [kopf, geladen && zeilen.length === 0 ? (_jsx(Hinweis, { children: "Daten f\u00FCr dieses Bundesland noch nicht hinterlegt." })) : (_jsxs(_Fragment, { children: [_jsxs(Gruppe, { titel: "Filter", children: [_jsxs(Auswahl, { label: "Wildart", value: wildartFilter, onChange: (e) => setWildartFilter(e.target.value), children: [_jsx("option", { value: "", children: "Alle" }), wildarten.filter((w) => proArt.has(w.id)).map((w) => (_jsx("option", { value: w.id, children: w.name }, w.id)))] }), _jsxs(Auswahl, { label: "Status heute", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "Alle" }), _jsx("option", { value: "jagdbar", children: "jagdbar" }), _jsx("option", { value: "teilweise", children: "Sonderregel" }), _jsx("option", { value: "schonzeit", children: "Schonzeit" })] }), _jsxs("label", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Nur jagdbare Arten (auch teilweise)" }), _jsx("input", { type: "checkbox", checked: nurJagdbar, onChange: (e) => setNurJagdbar(e.target.checked) })] })] }), !geladen && _jsx(Leer, { children: "Jagdzeiten werden geladen \u2026" }), geladen && liste.length === 0 && _jsx(Leer, { children: "Keine Wildart entspricht dem Filter." }), _jsx("div", { className: "jz-liste", children: liste.map(({ w, zeilen: z, s }) => (_jsxs("button", { type: "button", className: "jz-karte", onClick: () => navigieren(`/jagdzeiten/${w.id}`), children: [_jsxs("span", { className: "jz-kopf", children: [_jsx("strong", { children: w.name }), _jsx("span", { className: `jz-status jz-s-${s.status}`, children: STATUS_TEXT[s.status] })] }), _jsx(Balken, { zeilen: z, heute: heute }), s.status === 'teilweise' && _jsxs("small", { children: ["Jagdbar: ", s.jagdbar.join(', ')] })] }, w.id))) })] }))] }));
}
