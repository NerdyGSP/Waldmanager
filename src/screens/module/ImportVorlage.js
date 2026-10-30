import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { wildartFinden } from '../../lib/csv';
import { useZonenEbenen } from '../../lib/stammdaten';
import { Auswahl, Gruppe, Knopf } from '../../components/ui';
export const HAUPTARTEN = ['Feldhase', 'Rehwild', 'Fuchs', 'Waschbär', 'Dachs', 'Schwarzwild', 'Rebhuhn', 'Waldschnepfe'];
const csvZelle = (s) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
// Matrix-Vorlage: Zeilen = Zonen, Spalten = Wildarten (wie die gedruckte Zusammenfassung)
export function vorlageErzeugen(zonenNamen, arten) {
    const namen = zonenNamen.length ? zonenNamen : ['Fläche 1', 'Fläche 2'];
    const zeilen = [['Zone', ...arten], ...namen.map((n) => [n, ...arten.map(() => '')])];
    return zeilen.map((z) => z.map(csvZelle).join(';')).join('\r\n') + '\r\n';
}
export function VorlageGruppe({ revierId, zonen, wildarten }) {
    const { ebenen } = useZonenEbenen(revierId);
    const [ebeneId, setEbeneId] = useState('');
    const [extra, setExtra] = useState([]);
    const haupt = useMemo(() => HAUPTARTEN.map((n) => wildartFinden(n, wildarten)).filter((x) => !!x), [wildarten]);
    const gewaehlteZonen = zonen.filter((z) => (ebeneId ? z.ebeneId === ebeneId : true));
    const weitere = wildarten.filter((w) => !haupt.includes(w.id));
    function herunterladen() {
        const arten = [...haupt, ...extra].map((id) => wildarten.find((w) => w.id === id)?.name ?? id);
        const text = '﻿' + vorlageErzeugen(gewaehlteZonen.map((z) => z.name), arten);
        const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hegewerk-vorlage-zaehlung-matrix.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
    return (_jsxs(Gruppe, { titel: "Vorlage f\u00FCr eine Z\u00E4hlung herunterladen", fuss: "Zeilen = Zonen, Spalten = Wildarten, wie in der gedruckten Zusammenfassung. Leere Zellen z\u00E4hlen als 0. Datum und Wetter gibst du beim Import an.", children: [ebenen.length > 0 && (_jsxs(Auswahl, { label: "Zonen", value: ebeneId, onChange: (e) => setEbeneId(e.target.value), children: [_jsxs("option", { value: "", children: ["Alle Zonen des Reviers (", zonen.length, ")"] }), ebenen.map((e) => (_jsxs("option", { value: e.id, children: ["Zonenebene \u201E", e.name, "\u201C (", zonen.filter((z) => z.ebeneId === e.id).length, ")"] }, e.id)))] })), weitere.length > 0 && (_jsxs(Auswahl, { label: "Weitere Wildart erg\u00E4nzen", value: "", onChange: (e) => {
                    const id = e.target.value;
                    if (id && !extra.includes(id))
                        setExtra([...extra, id]);
                }, children: [_jsx("option", { value: "", children: "\u2013 ausw\u00E4hlen \u2013" }), weitere.filter((w) => !extra.includes(w.id)).map((w) => (_jsx("option", { value: w.id, children: w.name }, w.id)))] })), extra.length > 0 && (_jsxs("p", { className: "gruppe-fuss", children: ["Zus\u00E4tzlich:", ' ', extra.map((id) => (_jsxs("button", { type: "button", className: "link", onClick: () => setExtra(extra.filter((x) => x !== id)), "aria-label": "Wildart wieder entfernen", children: [wildarten.find((w) => w.id === id)?.name, " \u2715", ' '] }, id)))] })), _jsx(Knopf, { variante: "sekundaer", onClick: herunterladen, children: "Vorlage herunterladen" })] }));
}
