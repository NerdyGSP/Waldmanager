import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Segmente } from '../../components/ui';
export const STANDARD_BREITE_M = 400;
export const modusText = (modus, breite) => (modus === 'strecke' ? `Strecke × ${breite} m` : 'Zonenfläche');
// Umschalter „Fläche berechnen nach“: gefahrene Strecke × Streifenbreite oder Gesamtfläche der WTE-Zonen
export function FlaechenmodusWahl({ modus, breite, onModus, }) {
    return (_jsxs(_Fragment, { children: [_jsx(Segmente, { label: "Fl\u00E4che berechnen nach", wert: modus, onAendern: onModus, optionen: [
                    { wert: 'strecke', label: `gefahrene Strecke × ${breite} m` },
                    { wert: 'zonen', label: 'Gesamtfläche der WTE-Zonen' },
                ] }), modus === 'strecke' && (_jsx(_Fragment, { children: _jsxs("p", { className: "gruppe-fuss", style: { margin: 0 }, children: ["Die Breite ist fest ", breite, " m (", breite / 2, " m links und rechts der Route). Doppelt befahrene Strecken z\u00E4hlen nicht doppelt, Fl\u00E4chen au\u00DFerhalb des Reviers entfallen. F\u00FCr die Berechnung wird eine WTE-Route ben\u00F6tigt (zeichnen, per GPS aufzeichnen oder importieren)."] }) }))] }));
}
