import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AuditZeile } from '../../components/AuditZeile';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigationsLinks } from '../../lib/bewegungsjagd';
import { EinrichtungsIcon } from '../../lib/einrichtungsIcons';
import { EINRICHTUNGSTYPEN, nameVergeben } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import { EinrichtungsOptionen } from '../../components/EinrichtungsOptionen';
import { Auswahl, Feld, Hinweis, Knopf } from '../../components/ui';
import { abstandM } from '../../lib/gpsPruefung';
const WARN_GENAUIGKEIT_M = 15;
const entfernungText = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);
// Bottom-Sheet zu einer angetippten Einrichtung (gleiche Optik wie das WTE-Zonen-Sheet)
export function EinrichtungSheet({ k, einr, vergebeneNamen, onSchliessen, onGeaendert, onVerschieben, onPosition, startAnsicht, }) {
    const typ = EINRICHTUNGSTYPEN.find((t) => t.wert === einr.typ);
    const [pos, setPos] = useState(null);
    const [ansicht, setAnsicht] = useState(startAnsicht ?? 'start');
    const [fehler, setFehler] = useState(null);
    const [laeuft, setLaeuft] = useState(false);
    // bearbeiten
    const [name, setName] = useState(einr.name ?? '');
    const [typWert, setTypWert] = useState(einr.typ);
    const [bemerkung, setBemerkung] = useState(einr.bemerkung ?? '');
    // einmessen
    const [messung, setMessung] = useState(null);
    const [misst, setMisst] = useState(false);
    // löschen
    const [jagden, setJagden] = useState([]);
    useEffect(() => {
        // Entfernung zur aktuellen Position (einmalig, grob)
        if (!navigator.geolocation)
            return;
        navigator.geolocation.getCurrentPosition((p) => setPos({ lng: p.coords.longitude, lat: p.coords.latitude }), () => undefined, { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 });
    }, [einr.id]);
    useEffect(() => {
        if (startAnsicht === 'loeschen')
            void loeschenPruefen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const zurueck = () => (startAnsicht ? onSchliessen() : setAnsicht('start'));
    const links = navigationsLinks(einr.lat, einr.lng);
    const distanz = pos ? abstandM(pos, { lng: einr.lng, lat: einr.lat }) : null;
    const doppelt = !!name.trim() && nameVergeben(vergebeneNamen, name, einr.name);
    async function speichernBearbeiten() {
        setFehler(null);
        if (doppelt)
            return;
        setLaeuft(true);
        const { error } = await supabase.from('einrichtungen').update({ name: name.trim() || null, typ: typWert, bemerkung: bemerkung.trim() || null }).eq('id', einr.id);
        setLaeuft(false);
        if (error)
            setFehler(error.code === '23505' ? `Eine Einrichtung „${name.trim()}“ gibt es in diesem Revier bereits.` : fehlertext(error));
        else
            onGeaendert('Einrichtung gespeichert');
    }
    function messen() {
        setAnsicht('einmessen');
        setMessung(null);
        setFehler(null);
        if (!navigator.geolocation) {
            setFehler('Dieses Gerät kann den Standort nicht bestimmen.');
            return;
        }
        setMisst(true);
        navigator.geolocation.getCurrentPosition((p) => {
            setMessung({ lng: p.coords.longitude, lat: p.coords.latitude, genau: p.coords.accuracy });
            setMisst(false);
        }, () => {
            setMisst(false);
            setFehler('Standort nicht verfügbar – bitte Ortungsfreigabe prüfen.');
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    }
    async function uebernehmen() {
        if (!messung)
            return;
        setLaeuft(true);
        try {
            const r = await onPosition(messung.lng, messung.lat);
            onGeaendert(r === 'gemerkt' ? 'Position auf dem Gerät gespeichert – wird übertragen, sobald du online bist' : 'Position eingemessen');
        }
        catch (err) {
            setFehler(fehlertext(err));
        }
        finally {
            setLaeuft(false);
        }
    }
    async function loeschenPruefen() {
        setAnsicht('loeschen');
        setFehler(null);
        const { data } = await supabase.from('bewegungsjagd_teilnehmer').select('bewegungsjagden(titel, datum)').eq('zugeordnete_einrichtung_id', einr.id);
        const titel = (data ?? []).map((x) => x.bewegungsjagden).filter((j) => !!j).map((j) => `${j.titel}${j.datum ? ` (${datumDE(j.datum)})` : ''}`);
        setJagden([...new Set(titel)]);
    }
    async function loeschen() {
        setLaeuft(true);
        setFehler(null);
        // Zuordnungen lösen (wie ON DELETE SET NULL), Erfassungen bleiben erhalten
        const e1 = await supabase.from('bewegungsjagd_teilnehmer').update({ zugeordnete_einrichtung_id: null }).eq('zugeordnete_einrichtung_id', einr.id);
        const e2 = e1.error ? e1 : await supabase.from('einrichtungen').update({ geloescht_am: new Date().toISOString() }).eq('id', einr.id);
        setLaeuft(false);
        if (e2.error)
            setFehler(fehlertext(e2.error));
        else
            onGeaendert('Einrichtung gelöscht');
    }
    return (_jsxs("div", { className: "wte-sheet einr-sheet", role: "dialog", "aria-label": `Einrichtung ${einr.name ?? typ?.label ?? ''}`, children: [_jsxs("div", { className: "wte-sheet-kopf", children: [_jsxs("span", { style: { display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }, children: [_jsx(EinrichtungsIcon, { typ: einr.typ, farbe: typ?.farbe ?? '#5d6d7e', groesse: 34 }), _jsxs("span", { style: { minWidth: 0 }, children: [_jsx("strong", { style: { display: 'block' }, children: einr.name || typ?.label }), _jsxs("small", { style: { color: 'var(--color-text-muted)' }, children: [typ?.label, distanz !== null ? ` · ${entfernungText(distanz)} entfernt` : ''] })] })] }), _jsx("button", { type: "button", className: "link", onClick: onSchliessen, "aria-label": "Schlie\u00DFen", children: "\u2715" })] }), einr.bemerkung && ansicht === 'start' && _jsx("p", { style: { margin: '0 0 6px' }, children: einr.bemerkung }), ansicht === 'start' && _jsx(AuditZeile, { tabelle: "einrichtungen", id: einr.id }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), ansicht === 'start' && (_jsxs("div", { className: "einr-aktionen", children: [_jsx("a", { className: "knopf knopf-sekundaer", href: links.apple, target: "_blank", rel: "noreferrer", children: "Navigieren \u00B7 Apple Karten" }), _jsx("a", { className: "knopf knopf-sekundaer", href: links.google, target: "_blank", rel: "noreferrer", children: "Navigieren \u00B7 Google Maps" }), einr.typ === 'falle' && (_jsx(Knopf, { variante: "akzent", onClick: () => navigieren(`/abschuesse/fang/${einr.id}`), children: "Fang melden" })), k.istInhaber && (_jsxs(_Fragment, { children: [_jsx(Knopf, { variante: "sekundaer", onClick: messen, children: "Position einmessen" }), _jsx(Knopf, { variante: "sekundaer", onClick: onVerschieben, children: "Verschieben" }), _jsx(Knopf, { variante: "sekundaer", onClick: () => setAnsicht('bearbeiten'), children: "Bearbeiten" }), _jsx(Knopf, { variante: "gefahr", onClick: () => void loeschenPruefen(), children: "L\u00F6schen" })] }))] })), ansicht === 'bearbeiten' && (_jsxs(_Fragment, { children: [_jsx(Feld, { label: "Name", value: name, onChange: (e) => setName(e.target.value) }), doppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Einrichtung \u201E", name.trim(), "\u201C gibt es in diesem Revier bereits."] }), _jsx(Auswahl, { label: "Typ", value: typWert, onChange: (e) => setTypWert(e.target.value), children: _jsx(EinrichtungsOptionen, {}) }), _jsx(Feld, { label: "Bemerkung", value: bemerkung, onChange: (e) => setBemerkung(e.target.value) }), _jsxs("div", { className: "einr-aktionen", children: [_jsx(Knopf, { variante: "ghost", onClick: zurueck, children: "Zur\u00FCck" }), _jsx(Knopf, { variante: "akzent", disabled: laeuft || doppelt, onClick: () => void speichernBearbeiten(), children: laeuft ? 'Speichern …' : 'Speichern' })] })] })), ansicht === 'einmessen' && (_jsxs(_Fragment, { children: [misst && _jsx(Hinweis, { art: "info", children: "Position wird bestimmt \u2026" }), messung && (_jsx(_Fragment, { children: _jsxs(Hinweis, { art: messung.genau > WARN_GENAUIGKEIT_M ? 'warnung' : 'info', children: ["Genauigkeit \u00B1 ", Math.round(messung.genau), " m.", messung.genau > WARN_GENAUIGKEIT_M && ` Das ist ungenau (über ${WARN_GENAUIGKEIT_M} m) – besser kurz warten und neu messen.`, " Die jetzige Position (", entfernungText(abstandM(messung, { lng: einr.lng, lat: einr.lat })), " von der gespeicherten entfernt) als Standort der Einrichtung \u00FCbernehmen?"] }) })), _jsxs("div", { className: "einr-aktionen", children: [_jsx(Knopf, { variante: "ghost", onClick: zurueck, children: "Abbrechen" }), _jsx(Knopf, { variante: "sekundaer", disabled: misst, onClick: messen, children: "Neu messen" }), _jsx(Knopf, { variante: "akzent", disabled: !messung || laeuft, onClick: () => void uebernehmen(), children: "Position \u00FCbernehmen" })] })] })), ansicht === 'loeschen' && (_jsxs(_Fragment, { children: [_jsxs(Hinweis, { art: "warnung", children: ["\u201E", einr.name || typ?.label, "\u201C wirklich l\u00F6schen? Erfassungen (Absch\u00FCsse, F\u00E4nge, Aufgaben) bleiben erhalten.", jagden.length > 0 && ` Die Einrichtung ist bei ${jagden.length === 1 ? 'der Bewegungsjagd' : 'den Bewegungsjagden'} ${jagden.join(', ')} als Stand zugewiesen – diese Zuweisungen werden aufgehoben.`] }), _jsxs("div", { className: "einr-aktionen", children: [_jsx(Knopf, { variante: "ghost", onClick: zurueck, children: "Abbrechen" }), _jsx(Knopf, { variante: "gefahr", disabled: laeuft, onClick: () => void loeschen(), children: laeuft ? 'Lösche …' : 'Endgültig löschen' })] })] }))] }));
}
// Bestätigungsleiste beim Verschieben (Marker ziehen, dann bestätigen oder abbrechen)
export function VerschiebeLeiste({ name, laeuft, geaendert, onOk, onAbbrechen }) {
    return (_jsxs("div", { className: "wte-leiste", role: "status", children: [_jsx("strong", { children: "Verschieben" }), _jsxs("span", { children: ["\u201E", name, "\u201C auf der Karte an die neue Stelle ziehen"] }), _jsx("button", { type: "button", className: "link", disabled: !geaendert || laeuft, onClick: onOk, children: "Best\u00E4tigen" }), _jsx("button", { type: "button", className: "link", onClick: onAbbrechen, disabled: laeuft, children: "Abbrechen" })] }));
}
