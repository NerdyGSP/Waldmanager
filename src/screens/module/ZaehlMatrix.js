import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { wildartName } from '../../lib/stammdaten';
import { useBreit } from '../../lib/useBreit';
import { Leer } from '../../components/ui';
const zahl = (n, nk = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: nk });
/** Gezählte Fläche und Modus-Text einer Sitzung (festgeschrieben, sonst Summe der erfassten Zonen) */
export function useBezug(revierId, sitzung, zonenIds) {
    const [ha, setHa] = useState({});
    useEffect(() => {
        void supabase.rpc('zonen_flaechen', { p_revier_id: revierId }).then(({ data }) => {
            const m = {};
            for (const r of data ?? [])
                m[r.zone_id] = Number(r.flaeche_ha);
            setHa(m);
        });
    }, [revierId]);
    const strecke = sitzung.flaechenmodus === 'strecke';
    const zonenSumme = [...new Set(zonenIds)].reduce((a, id) => a + (id ? (ha[id] ?? 0) : 0), 0);
    const bezug = sitzung.flaeche_ha != null ? Number(sitzung.flaeche_ha) : strecke ? 0 : zonenSumme;
    const breite = sitzung.streifenbreite_m || 400;
    const modus = strecke
        ? `Strecke × ${breite} m${sitzung.strecke_km != null && bezug > 0 ? `: ${zahl(Number(sitzung.strecke_km), 1)} km × ${breite} m = ${zahl(bezug)} ha` : ''}`
        : 'Zonenfläche';
    return { bezug, modus, strecke };
}
// WTE-Übersicht: Zonen in den Zeilen, Wildarten in den Spalten (leere Spalten ausgeblendet), Zonenebenen einklappbar
export function ZaehlMatrix({ revierId, sitzung, zeilen, zonen, ebenen, wildarten }) {
    const breit = useBreit();
    const [zu, setZu] = useState(new Set());
    const mit = useMemo(() => zeilen.filter((z) => z.anzahl > 0), [zeilen]);
    const arten = useMemo(() => [...new Set(mit.map((z) => z.wildart_id))].sort((a, b) => (wildarten.find((w) => w.id === a)?.sortierung ?? 0) - (wildarten.find((w) => w.id === b)?.sortierung ?? 0)), [mit, wildarten]);
    const wert = (art, zone, ids) => mit.filter((z) => (art === null || z.wildart_id === art) && (zone === undefined || z.zone_id === zone) && (!ids || ids.includes(z.zone_id))).reduce((a, z) => a + z.anzahl, 0);
    const zonenZeilen = useMemo(() => {
        const bekannt = zonen.filter((z) => zeilen.some((x) => x.zone_id === z.id)).map((z) => ({ id: z.id, name: z.name, ebene: z.ebeneId }));
        const ohne = zeilen.some((x) => x.zone_id === null) ? [{ id: null, name: zonen.length ? 'ohne Zone' : 'Gesamtrevier', ebene: null }] : [];
        const entfernt = [...new Set(zeilen.map((x) => x.zone_id))].filter((id) => id && !zonen.some((z) => z.id === id)).map((id) => ({ id, name: 'entfernte Zone', ebene: null }));
        return [...bekannt, ...ohne, ...entfernt];
    }, [zeilen, zonen]);
    const gruppen = useMemo(() => {
        const ids = [...new Set(zonenZeilen.map((z) => z.ebene))];
        const sortiert = ids.sort((a, b) => (ebenen.find((e) => e.id === a)?.sortierung ?? 9999) - (ebenen.find((e) => e.id === b)?.sortierung ?? 9999));
        return sortiert.map((id) => ({ id, name: ebenen.find((e) => e.id === id)?.name ?? 'Ohne Ebene', zeilen: zonenZeilen.filter((z) => z.ebene === id) }));
    }, [zonenZeilen, ebenen]);
    const { bezug, modus } = useBezug(revierId, sitzung, zonenZeilen.map((z) => z.id));
    if (arten.length === 0)
        return _jsx(Leer, { children: "Noch keine Sichtungen erfasst." });
    const mitKopf = gruppen.length > 1 || (gruppen[0]?.id ?? null) !== null;
    const umschalten = (id) => setZu((s) => { const n = new Set(s); const k = id ?? '_'; if (n.has(k))
        n.delete(k);
    else
        n.add(k); return n; });
    const zeileZelle = (ids, art) => wert(art, undefined, ids) || '–';
    return (_jsxs(_Fragment, { children: [breit ? (_jsx("div", { className: "tabelle-rahmen matrix", children: _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Zone" }), arten.map((a) => _jsx("th", { className: "zahl", children: wildartName(wildarten, a) }, a)), _jsx("th", { className: "zahl", children: "Summe" })] }) }), _jsx("tbody", { children: gruppen.map((g) => {
                                const geschlossen = zu.has(g.id ?? '_');
                                const ids = g.zeilen.map((z) => z.id);
                                return (_jsxs(FragmentZeilen, { children: [mitKopf && (_jsxs("tr", { className: "matrix-gruppe", children: [_jsx("th", { scope: "row", children: _jsxs("button", { type: "button", className: "link", "aria-expanded": !geschlossen, onClick: () => umschalten(g.id), children: [geschlossen ? '▸' : '▾', " ", g.name] }) }), arten.map((a) => _jsx("td", { className: "zahl leise", children: zeileZelle(ids, a) }, a)), _jsx("td", { className: "zahl stark", children: wert(null, undefined, ids) })] })), !geschlossen && g.zeilen.map((z) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", style: mitKopf ? { paddingLeft: 24 } : undefined, children: z.name }), arten.map((a) => _jsx("td", { className: "zahl", children: wert(a, z.id) || '–' }, a)), _jsx("td", { className: "zahl stark", children: wert(null, z.id) })] }, z.id ?? 'ohne')))] }, g.id ?? '_'));
                            }) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("th", { scope: "row", children: "Gesamt" }), arten.map((a) => _jsx("td", { className: "zahl stark", children: wert(a, undefined) }, a)), _jsx("td", { className: "zahl stark", children: wert(null, undefined) })] }) })] }) })) : (_jsxs("div", { className: "matrix-karten", children: [zonenZeilen.map((z) => (_jsxs("div", { className: "matrix-karte", children: [_jsx("strong", { children: z.name }), _jsx("ul", { children: arten.filter((a) => wert(a, z.id) > 0).map((a) => _jsxs("li", { children: [_jsx("span", { children: wildartName(wildarten, a) }), _jsx("b", { children: wert(a, z.id) })] }, a)) }), _jsxs("small", { children: ["Summe ", wert(null, z.id)] })] }, z.id ?? 'ohne'))), _jsxs("div", { className: "matrix-karte", children: [_jsx("strong", { children: "Gesamt" }), _jsxs("small", { children: [wert(null, undefined), " St\u00FCck"] })] })] })), _jsxs("div", { className: "tabelle-rahmen", style: { marginTop: 10 }, children: [_jsxs("p", { className: "gruppe-fuss", style: { margin: 0, padding: '8px 12px 0' }, children: ["Gez\u00E4hlte Fl\u00E4che: ", _jsx("strong", { children: bezug > 0 ? `${zahl(bezug)} ha` : '–' }), " \u00B7 ", modus] }), _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Wildart" }), _jsx("th", { className: "zahl", children: "Gesamt" }), _jsx("th", { className: "zahl", children: "je 100 ha" })] }) }), _jsx("tbody", { children: arten.map((a) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: wildartName(wildarten, a) }), _jsx("td", { className: "zahl", children: wert(a, undefined) }), _jsx("td", { className: "zahl stark", children: bezug > 0 ? zahl((wert(a, undefined) / bezug) * 100, 2) : '–' })] }, a))) })] })] })] }));
}
function FragmentZeilen({ children }) {
    return _jsx(_Fragment, { children: children });
}
