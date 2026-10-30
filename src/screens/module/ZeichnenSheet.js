import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { datumDE } from '../../lib/zeit';
import { nameVergeben, ZONENFARBEN } from '../../lib/stammdaten';
import { freierName, routenTypLabel } from '../../lib/routen';
import { Auswahl, Farbwahl, Feld, Hinweis, Knopf } from '../../components/ui';
const TITEL = {
    grenze: 'Reviergrenze speichern',
    zone: 'Zone speichern',
    pirschweg: 'Pirschweg speichern',
    treiberroute: 'Treiberroute speichern',
    wte_route: 'WTE-Route speichern',
};
const STANDARDNAME = { pirschweg: 'Pirschweg', treiberroute: 'Treiberroute', wte_route: 'WTE-Route' };
// Bottom-Sheet für Benennung und Details nach dem Zeichnen bzw. Aufzeichnen
export function ZeichnenSheet({ art, revierId, zonen, ebenen, hatGrenze, info, speichert, fehler, onSpeichern, onAbbrechen, standardSitzungId, routenEbenen = [], routenNamen = [], darfEbenenAnlegen = false, }) {
    const [name, setName] = useState(art === 'zone' ? `Zone ${zonen.length + 1}` : art === 'grenze' ? '' : freierName(routenNamen, STANDARDNAME[art]));
    const [routenEbeneId, setRoutenEbeneId] = useState('');
    const [neueEbeneName, setNeueEbeneName] = useState('');
    const [bemerkung, setBemerkung] = useState('');
    const [zoneId, setZoneId] = useState('');
    const [ebeneId, setEbeneId] = useState('');
    const [farbe, setFarbe] = useState(ZONENFARBEN[zonen.length % ZONENFARBEN.length]);
    const [wteAktiv, setWteAktiv] = useState(false);
    const [bewegungsjagdId, setBewegungsjagdId] = useState('');
    const [sitzungId, setSitzungId] = useState(standardSitzungId ?? '');
    const [bestaetigt, setBestaetigt] = useState(false);
    const [jagden, setJagden] = useState([]);
    const [sitzungen, setSitzungen] = useState([]);
    useEffect(() => {
        if (art === 'treiberroute') {
            void supabase.from('bewegungsjagden').select('id, titel, datum').eq('revier_id', revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(30).then(({ data }) => setJagden(data ?? []));
        }
        if (art === 'wte_route') {
            void supabase.from('zaehlsitzungen').select('id, datum, status').eq('revier_id', revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(20).then(({ data }) => {
                setSitzungen(data ?? []);
                // Läuft gerade eine Zählung, wird die WTE-Route ihr automatisch zugeordnet
                const offen = (data ?? []).find((s) => s.status === 'offen');
                if (offen)
                    setSitzungId((alt) => alt || offen.id);
            });
        }
    }, [art, revierId]);
    const ebene = ebenen.find((e) => e.id === ebeneId);
    const neueZone = art === 'zone' && !zoneId;
    const doppelt = neueZone && nameVergeben(zonen.map((z) => z.name), name);
    const istRoute = art === 'pirschweg' || art === 'treiberroute' || art === 'wte_route';
    const passendeEbenen = istRoute ? routenEbenen.filter((e) => e.typ === art) : [];
    const routeDoppelt = istRoute && nameVergeben(routenNamen, name);
    const ebeneNeu = routenEbeneId === '__neu';
    const neueEbeneDoppelt = ebeneNeu && !!neueEbeneName.trim() && nameVergeben(routenEbenen.map((e) => e.name), neueEbeneName);
    const gueltig = art === 'grenze'
        ? !hatGrenze || bestaetigt
        : art === 'zone'
            ? !!zoneId || (!!name.trim() && !doppelt)
            : !!name.trim() && !routeDoppelt && (!ebeneNeu || (!!neueEbeneName.trim() && !neueEbeneDoppelt));
    return (_jsxs("div", { className: "wte-sheet zeichnen-sheet", role: "dialog", "aria-modal": "false", "aria-label": TITEL[art], children: [_jsxs("div", { className: "wte-sheet-kopf", children: [_jsx("strong", { children: TITEL[art] }), _jsx("button", { type: "button", className: "link", onClick: onAbbrechen, children: "Zur\u00FCck zur Karte" })] }), _jsx("p", { className: "leer", style: { margin: 0 }, children: info }), art === 'grenze' && hatGrenze && (_jsxs(Hinweis, { art: "warnung", children: ["Die neue Grenze ", _jsx("strong", { children: "ersetzt die bestehende Reviergrenze" }), ".", _jsxs("label", { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }, children: [_jsx("input", { type: "checkbox", checked: bestaetigt, onChange: (e) => setBestaetigt(e.target.checked) }), " Ja, bestehende Grenze ersetzen"] })] })), art === 'zone' && (_jsxs(_Fragment, { children: [zonen.length > 0 && (_jsxs(Auswahl, { label: "Zuordnen zu", value: zoneId, onChange: (e) => setZoneId(e.target.value), children: [_jsx("option", { value: "", children: "Neue Zone" }), zonen.map((z) => (_jsxs("option", { value: z.id, children: ["Fl\u00E4che von \u201E", z.name, "\u201C ersetzen", z.hatGeometrie ? '' : ' (noch ohne Fläche)'] }, z.id)))] })), neueZone && (_jsxs(_Fragment, { children: [_jsx(Feld, { label: "Name", value: name, onChange: (e) => setName(e.target.value) }), doppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Zone \u201E", name.trim(), "\u201C gibt es in diesem Revier bereits."] }), ebenen.length > 0 && (_jsxs(Auswahl, { label: "Zonenebene", value: ebeneId, onChange: (e) => {
                                    setEbeneId(e.target.value);
                                    const x = ebenen.find((y) => y.id === e.target.value);
                                    setWteAktiv(!!x?.wte_aktiv);
                                    if (x?.farbe)
                                        setFarbe(x.farbe);
                                }, children: [_jsx("option", { value: "", children: "Ohne Ebene" }), ebenen.map((x) => (_jsx("option", { value: x.id, children: x.name }, x.id)))] })), _jsxs("label", { className: "ebene", style: { display: 'flex', gap: 8, alignItems: 'center' }, children: ["Farbe", _jsx(Farbwahl, { wert: farbe, label: "Farbe der Zone", onAendern: setFarbe })] }), ebene && (_jsxs("label", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: wteAktiv, onChange: (e) => setWteAktiv(e.target.checked) }), " WTE-relevant (Ebene \u201E", ebene.name, "\u201C im WTE-Modus anzeigen)"] }))] }))] })), (art === 'pirschweg' || art === 'treiberroute' || art === 'wte_route') && (_jsxs(_Fragment, { children: [_jsx(Feld, { label: "Name", value: name, onChange: (e) => setName(e.target.value) }), art === 'treiberroute' && (_jsxs(Auswahl, { label: "Bewegungsjagd (optional)", value: bewegungsjagdId, onChange: (e) => setBewegungsjagdId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013 keine, revierweit \u2013" }), jagden.map((j) => (_jsxs("option", { value: j.id, children: [j.titel, " \u00B7 ", datumDE(j.datum)] }, j.id)))] })), art === 'wte_route' && (_jsxs(Auswahl, { label: "Z\u00E4hlsitzung (optional)", value: sitzungId, onChange: (e) => setSitzungId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013 keine \u2013" }), sitzungen.map((s) => (_jsxs("option", { value: s.id, children: ["Z\u00E4hlung ", datumDE(s.datum), s.status === 'offen' ? ' (läuft)' : ''] }, s.id)))] })), routeDoppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Route \u201E", name.trim(), "\u201C gibt es in diesem Revier bereits."] }), (passendeEbenen.length > 0 || darfEbenenAnlegen) && (_jsxs(Auswahl, { label: `Ebene (${routenTypLabel(art)})`, value: routenEbeneId, onChange: (e) => setRoutenEbeneId(e.target.value), children: [_jsx("option", { value: "", children: "Ohne Ebene" }), passendeEbenen.map((x) => (_jsx("option", { value: x.id, children: x.name }, x.id))), darfEbenenAnlegen && _jsx("option", { value: "__neu", children: "+ Neue Ebene anlegen \u2026" })] })), ebeneNeu && (_jsxs(_Fragment, { children: [_jsx(Feld, { label: "Name der neuen Ebene", value: neueEbeneName, onChange: (e) => setNeueEbeneName(e.target.value) }), neueEbeneDoppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Ebene \u201E", neueEbeneName.trim(), "\u201C gibt es bereits."] })] })), _jsx(Feld, { label: "Bemerkung (optional)", value: bemerkung, onChange: (e) => setBemerkung(e.target.value) })] })), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsxs("div", { className: "bj-dialog-knoepfe", children: [_jsx(Knopf, { variante: "ghost", onClick: onAbbrechen, children: "Weiter zeichnen" }), _jsx(Knopf, { variante: "akzent", disabled: speichert || !gueltig, onClick: () => onSpeichern({ name: name.trim(), bemerkung: bemerkung.trim(), zoneId: zoneId || null, ebeneId, farbe, wteAktiv, bewegungsjagdId, sitzungId, routenEbeneId: ebeneNeu ? '' : routenEbeneId, neueEbeneName: ebeneNeu ? neueEbeneName.trim() : '' }), children: speichert ? 'Speichere …' : 'Speichern' })] })] }));
}
