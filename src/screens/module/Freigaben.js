import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten } from '../../lib/stammdaten';
import { Gruppe, Hinweis, Seite, Zeile } from '../../components/ui';
export function Freigaben({ k }) {
    const wildarten = useWildarten();
    const [freigegeben, setFreigegeben] = useState(new Set());
    const [fehler, setFehler] = useState(null);
    const laden = useCallback(async () => {
        const { data, error } = await supabase.from('freigaben').select('wildart_id').eq('revier_id', k.revierId);
        if (error)
            setFehler(fehlertext(error));
        setFreigegeben(new Set((data ?? []).map((f) => f.wildart_id)));
    }, [k.revierId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    async function umschalten(wildartId, an) {
        setFehler(null);
        // Optimistisch umschalten
        setFreigegeben((alt) => {
            const neu = new Set(alt);
            if (an)
                neu.add(wildartId);
            else
                neu.delete(wildartId);
            return neu;
        });
        const { error } = an
            ? await supabase.from('freigaben').insert({ revier_id: k.revierId, wildart_id: wildartId })
            : await supabase.from('freigaben').delete().eq('revier_id', k.revierId).eq('wildart_id', wildartId);
        if (error) {
            setFehler(fehlertext(error));
            await laden();
        }
    }
    const gruppen = useMemo(() => {
        const m = new Map();
        for (const w of wildarten)
            m.set(w.gruppe, [...(m.get(w.gruppe) ?? []), w]);
        return [...m.entries()];
    }, [wildarten]);
    return (_jsxs(Seite, { titel: "Freigaben", untertitel: `${freigegeben.size} von ${wildarten.length} Wildarten freigegeben`, children: [_jsx(Hinweis, { children: "Freigegeben werden nur Z\u00E4hlergebnisse und Absch\u00FCsse \u2013 keine Koordinaten, Grenzen oder Einrichtungen. Im Quervergleich siehst du von anderen Revieren nur die Wildarten, die du selbst freigibst." }), !k.istInhaber && _jsx(Hinweis, { children: "Nur der Revierinhaber kann Freigaben \u00E4ndern." }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), gruppen.map(([gruppe, liste]) => (_jsx(Gruppe, { titel: gruppe, children: liste.map((w) => (_jsx(Zeile, { label: w.name, children: _jsxs("label", { className: "schalter", children: [_jsxs("span", { className: "visuell-versteckt", children: [w.name, " freigeben"] }), _jsx("input", { type: "checkbox", role: "switch", checked: freigegeben.has(w.id), disabled: !k.istInhaber, onChange: (e) => umschalten(w.id, e.target.checked) }), _jsx("span", { "aria-hidden": "true" })] }) }, w.id))) }, gruppe)))] }));
}
