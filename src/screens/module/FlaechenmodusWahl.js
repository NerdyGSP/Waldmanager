import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Feld, Segmente } from '../../components/ui';
export const STANDARD_BREITE_M = 400;
export const modusText = (modus, breite) => (modus === 'strecke' ? `Strecke × ${breite} m` : 'Zonenfläche');
// Umschalter „Fläche berechnen nach“: gefahrene Strecke × Streifenbreite oder Gesamtfläche der WTE-Zonen
export function FlaechenmodusWahl({ modus, breite, onModus, onBreite, }) {
    return (_jsxs(_Fragment, { children: [_jsx(Segmente, { label: "Fl\u00E4che berechnen nach", wert: modus, onAendern: onModus, optionen: [
                    { wert: 'strecke', label: `gefahrene Strecke × ${breite} m` },
                    { wert: 'zonen', label: 'Gesamtfläche der WTE-Zonen' },
                ] }), modus === 'strecke' && (_jsxs(_Fragment, { children: [_jsx(Feld, { label: "Streifenbreite (m)", inputMode: "numeric", value: String(breite), onChange: (e) => onBreite(Math.min(2000, Math.max(0, Math.floor(Number(e.target.value) || 0)))) }), _jsxs("p", { className: "gruppe-fuss", style: { margin: 0 }, children: ["Die Breite gilt beidseits der Route (", breite / 2, " m links und rechts). Doppelt befahrene Strecken z\u00E4hlen nicht doppelt, Fl\u00E4chen au\u00DFerhalb des Reviers entfallen. F\u00FCr die Berechnung wird eine WTE-Route ben\u00F6tigt (zeichnen, per GPS aufzeichnen oder importieren)."] })] }))] }));
}
