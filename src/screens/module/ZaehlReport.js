import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Druckrahmen } from '../bewegungsjagd/BjDruck';
import { supabase } from '../../lib/supabase';
import { wildartName } from '../../lib/stammdaten';
import { wetterText } from '../../lib/geo';
import { datumDE } from '../../lib/zeit';
const uhr = (iso) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null);
const zahl = (n, stellen = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
// Zusammenfassung einer Wildzählung (A4 quer): Zonen × Wildarten, Summen und Kennzahlen je 100 ha.
// Geschlecht und Altersklasse werden zusammengefasst; Bezugsfläche ist die Summe der erfassten Zonen.
export function ZaehlReport({ revierId, revierName, sitzung, ebeneName, zeilen, zonen, wildarten, onZu }) {
    const [ha, setHa] = useState({});
    useEffect(() => {
        void supabase.rpc('zonen_flaechen', { p_revier_id: revierId }).then(({ data }) => {
            const m = {};
            for (const r of data ?? [])
                m[r.zone_id] = Number(r.flaeche_ha);
            setHa(m);
        });
    }, [revierId]);
    const d = useMemo(() => {
        const mitWerten = zeilen.filter((z) => z.anzahl > 0);
        const arten = [...new Set(mitWerten.map((z) => z.wildart_id))].sort((a, b) => (wildarten.find((w) => w.id === a)?.sortierung ?? 0) - (wildarten.find((w) => w.id === b)?.sortierung ?? 0));
        // Erfassungszonen: bei Zonenebene alle Zonen der Ebene, sonst die Zonen mit Einträgen
        const imEinsatz = (z) => (sitzung.ebene_id ? z.ebeneId === sitzung.ebene_id : zeilen.some((x) => x.zone_id === z.id));
        const zeilenZonen = [
            ...zonen.filter(imEinsatz).map((z) => ({ id: z.id, name: z.name, ha: ha[z.id] ?? null })),
            ...(zeilen.some((x) => x.zone_id === null && x.anzahl > 0) ? [{ id: null, name: zonen.length ? 'ohne Zone' : 'Revier', ha: null }] : []),
        ];
        const wert = (art, zone) => mitWerten.filter((z) => (art === null || z.wildart_id === art) && (zone === undefined || z.zone_id === zone)).reduce((a, z) => a + z.anzahl, 0);
        const flaeche = zeilenZonen.reduce((a, z) => a + (z.ha ?? 0), 0);
        return { arten, zeilenZonen, wert, flaeche };
    }, [zeilen, zonen, wildarten, ha, sitzung.ebene_id]);
    // Gezählte Fläche: beim Abschluss festgeschrieben (Strecke × Breite oder Zonenfläche), sonst Summe der erfassten Zonen
    const streckeModus = sitzung.flaechenmodus === 'strecke';
    const bezug = sitzung.flaeche_ha != null ? Number(sitzung.flaeche_ha) : streckeModus ? 0 : d.flaeche;
    const modusZeile = streckeModus
        ? `Strecke × ${sitzung.streifenbreite_m ?? 400} m${sitzung.strecke_km != null && bezug > 0 ? `: ${zahl(Number(sitzung.strecke_km), 1)} km × ${sitzung.streifenbreite_m ?? 400} m = ${zahl(bezug)} ha` : ''}`
        : 'Zonenfläche';
    const zeit = [uhr(sitzung.beginn), uhr(sitzung.ende)].filter(Boolean).join(' – ');
    const wetter = sitzung.wetter ? wetterText(sitzung.wetter) : null;
    return (_jsx(Druckrahmen, { querformat: true, onZu: onZu, children: _jsxs("section", { className: "bj-druck-seite", children: [_jsxs("h1", { children: ["Wildz\u00E4hlung ", datumDE(sitzung.datum)] }), _jsxs("p", { className: "art", children: [revierName, ebeneName ? ` · Zonenebene ${ebeneName}` : ''] }), _jsx("table", { className: "bj-druck-tabelle", children: _jsxs("tbody", { children: [zeit && _jsxs("tr", { children: [_jsx("th", { children: "Zeit" }), _jsxs("td", { children: [zeit, " Uhr"] })] }), wetter && _jsxs("tr", { children: [_jsx("th", { children: "Wetter" }), _jsx("td", { children: wetter })] }), sitzung.mondphase && _jsxs("tr", { children: [_jsx("th", { children: "Mond" }), _jsx("td", { children: sitzung.mondphase })] }), sitzung.bemerkung && _jsxs("tr", { children: [_jsx("th", { children: "Bemerkungen" }), _jsx("td", { children: sitzung.bemerkung })] })] }) }), d.arten.length === 0 ? (_jsx("p", { children: "In dieser Z\u00E4hlung wurde nichts erfasst." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "zr-kennzahlen", children: d.arten.map((a) => {
                                const summe = d.wert(a, undefined);
                                return (_jsxs("div", { className: "zr-karte", children: [_jsx("h3", { children: wildartName(wildarten, a) }), _jsx("p", { className: "gross", children: summe }), _jsx("p", { children: "gez\u00E4hlt gesamt" }), _jsx("p", { className: "mittel", children: bezug > 0 ? zahl((summe / bezug) * 100, 2) : '–' }), _jsx("p", { children: "je 100 ha" }), _jsxs("p", { className: "klein", children: ["Gez\u00E4hlte Fl\u00E4che: ", bezug > 0 ? `${zahl(bezug)} ha` : '–'] }), _jsx("p", { className: "klein", children: modusZeile })] }, a));
                            }) }), _jsx("h2", { className: "klein", children: "Ergebnis je Erfassungszone" }), _jsxs("table", { className: "bj-druck-liste zr-tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Zone" }), _jsx("th", { className: "zahl", children: "Fl\u00E4che (ha)" }), d.arten.map((a) => _jsx("th", { className: "zahl", children: wildartName(wildarten, a) }, a)), _jsx("th", { className: "zahl", children: "Summe" })] }) }), _jsx("tbody", { children: d.zeilenZonen.map((z) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: z.name }), _jsx("td", { className: "zahl", children: !streckeModus && z.ha != null ? zahl(z.ha) : '–' }), d.arten.map((a) => _jsx("td", { className: "zahl", children: d.wert(a, z.id) || '–' }, a)), _jsx("td", { className: "zahl", children: _jsx("strong", { children: d.wert(null, z.id) }) })] }, z.id ?? 'ohne'))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { children: _jsx("strong", { children: "Summe" }) }), _jsx("td", { className: "zahl", children: _jsx("strong", { children: bezug > 0 ? zahl(bezug) : '–' }) }), d.arten.map((a) => _jsx("td", { className: "zahl", children: _jsx("strong", { children: d.wert(a, undefined) }) }, a)), _jsx("td", { className: "zahl", children: _jsx("strong", { children: d.wert(null, undefined) }) })] }) })] }), _jsxs("p", { className: "art", style: { marginTop: 8, fontSize: '.8rem' }, children: [streckeModus ? `Bezugsfläche „je 100 ha“ = gezählte Fläche (${modusZeile}); die Zonenzeilen zeigen Zählwerte.` : 'Bezugsfläche „je 100 ha“ = Summe der erfassten Zonen.', " Erstellt am ", new Date().toLocaleDateString('de-DE'), " mit Hegewerk."] })] }))] }) }));
}
