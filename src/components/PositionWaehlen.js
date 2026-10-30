import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Knopf } from './ui';
import { Symbol } from './symbole';
const BjKarte = lazy(() => import('../screens/bewegungsjagd/BjKarte'));
// Knopf „Auf Karte wählen“ mit Kartendialog (gleiche Karte wie der Treffpunkt der Bewegungsjagd).
// Der Marker lässt sich durch Tippen verschieben; erst „Übernehmen“ setzt die Koordinate.
export function PositionWaehlen({ revierId, wert, onWaehlen }) {
    const [offen, setOffen] = useState(false);
    const [vorschlag, setVorschlag] = useState(null);
    const [grenze, setGrenze] = useState(null);
    useEffect(() => {
        if (!offen)
            return;
        setVorschlag(wert);
        if (navigator.onLine)
            void supabase.rpc('karte_daten', { p_revier_id: revierId, p_tage: 1 }).then(({ data }) => setGrenze(data?.grenze ?? null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offen]);
    return (_jsxs(_Fragment, { children: [_jsxs(Knopf, { type: "button", variante: "sekundaer", onClick: () => setOffen(true), children: [_jsx(Symbol, { name: "kartePunkt", className: "symbol klein" }), " Auf Karte w\u00E4hlen"] }), offen &&
                createPortal(_jsxs("div", { className: "schein-fenster", role: "dialog", "aria-modal": "true", "aria-label": "Position auf der Karte w\u00E4hlen", children: [_jsxs("div", { className: "schein-fenster-kopf", children: [_jsx("h2", { children: "Position w\u00E4hlen" }), _jsx(Knopf, { type: "button", variante: "ghost", onClick: () => setOffen(false), children: "Abbrechen" })] }), _jsx("p", { style: { margin: 0, color: 'var(--color-text-muted)' }, children: "Tippe auf die Karte, um den Marker zu setzen oder zu verschieben." }), _jsx(Suspense, { fallback: _jsx("p", { children: "Karte l\u00E4dt \u2026" }), children: _jsx(BjKarte, { className: "bj-karte bj-karte-hoch", marker: vorschlag ? [{ id: 'wahl', lng: vorschlag.lon, lat: vorschlag.lat, art: 'eigener', label: 'Gewählte Position' }] : [], grenze: grenze, waehlbar: true, onWaehlen: (lng, lat) => setVorschlag({ lon: lng, lat }) }) }), _jsx("small", { style: { color: 'var(--color-text-muted)' }, children: "Offline sind nur bereits geladene Kartenausschnitte (Kartenspeicher) sichtbar." }), _jsx(Knopf, { type: "button", disabled: !vorschlag, onClick: () => {
                                if (vorschlag)
                                    onWaehlen(vorschlag);
                                setOffen(false);
                            }, children: "Position \u00FCbernehmen" })] }), document.body)] }));
}
