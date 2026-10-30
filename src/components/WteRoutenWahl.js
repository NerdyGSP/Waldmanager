import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
// Alle WTE-Routen des Reviers aus WTE-relevanten Ebenen
export function useWteRouten(revierId, aktiv = true) {
    const [routen, setRouten] = useState(null);
    useEffect(() => {
        if (!aktiv)
            return;
        let lebt = true;
        void supabase
            .from('pirschwege')
            .select('id, name, routen_ebenen!inner(name, wte_aktiv, reihenfolge)')
            .eq('revier_id', revierId)
            .eq('typ', 'wte_route')
            .eq('routen_ebenen.wte_aktiv', true)
            .is('geloescht_am', null)
            .order('name')
            .then(({ data }) => {
            if (!lebt)
                return;
            setRouten((data ?? []).map((r) => ({ id: r.id, name: r.name, ebene: r.routen_ebenen.name })));
        });
        return () => {
            lebt = false;
        };
    }, [revierId, aktiv]);
    return routen;
}
// Auswahl der WTE-Routen einer Zählung (mehrfach nutzbar, eine Route kann zu beliebig vielen Zählungen gehören)
export function WteRoutenWahl({ routen, gewaehlt, onAendern, }) {
    if (routen === null)
        return _jsx("p", { className: "gruppe-fuss", style: { margin: 0, padding: '4px var(--abstand)' }, children: "Routen werden geladen \u2026" });
    if (routen.length === 0)
        return (_jsx("p", { className: "gruppe-fuss", style: { margin: 0, padding: '4px var(--abstand)' }, children: "Keine WTE-Routen vorhanden. Lege unter \u201EZonen & Routen\u201C eine WTE-Ebene mit Routen an (H\u00E4kchen \u201EWTE-relevant\u201C) oder zeichne eine Route \u00FCber \u201E+ NEU\u201C auf der Karte." }));
    const alle = gewaehlt.length === routen.length;
    const umschalten = (id, an) => onAendern(an ? [...gewaehlt, id] : gewaehlt.filter((x) => x !== id));
    return (_jsxs("div", { style: { padding: '4px var(--abstand) 8px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("strong", { style: { fontSize: '0.9rem' }, children: "WTE-Routen dieser Z\u00E4hlung" }), _jsx("button", { type: "button", className: "glocke-alle", onClick: () => onAendern(alle ? [] : routen.map((r) => r.id)), children: alle ? 'Keine' : 'Alle' })] }), _jsx("ul", { style: { listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 4 }, children: routen.map((r) => (_jsx("li", { children: _jsxs("label", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: gewaehlt.includes(r.id), onChange: (e) => umschalten(r.id, e.target.checked) }), _jsxs("span", { children: [r.name, " ", _jsxs("small", { style: { color: 'var(--text-leise)' }, children: ["\u00B7 ", r.ebene] })] })] }) }, r.id))) })] }));
}
