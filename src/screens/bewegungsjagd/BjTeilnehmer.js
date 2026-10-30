import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { codeAnzeigen, navigationsLinks } from '../../lib/bewegungsjagd';
import { datumDE } from '../../lib/zeit';
import { Feld, Hinweis, Knopf, Gruppe, Segmente } from '../../components/ui';
import { TeilnehmerSelbstDruck } from './BjDruck';
const BjKarte = lazy(() => import('./BjKarte'));
// Öffentliche Anmeldeseite /bj/:id – Zugang nur mit Einladungscode, ohne Konto
export function BjTeilnehmer({ jagdId }) {
    const [code, setCode] = useState(() => codeAnzeigen(new URLSearchParams(window.location.search).get('code') ?? ''));
    const [daten, setDaten] = useState(null);
    const [laedt, setLaedt] = useState(false);
    const [fehler, setFehler] = useState(null);
    const [schritt, setSchritt] = useState(0);
    const [fertig, setFertig] = useState(null);
    const [warnung, setWarnung] = useState(false);
    const [druck, setDruck] = useState(false);
    const [name, setName] = useState('');
    const [anschrift, setAnschrift] = useState('');
    const [telefon, setTelefon] = useState('');
    const [zusage, setZusage] = useState(null);
    const [hund, setHund] = useState(false);
    const [horn, setHorn] = useState(false);
    const [auto, setAuto] = useState(false);
    const [plaetze, setPlaetze] = useState('0');
    const [schuessel, setSchuessel] = useState(false);
    async function laden(c = code) {
        setLaedt(true);
        setFehler(null);
        const { data, error } = await supabase.rpc('bj_laden', { p_jagd: jagdId, p_code: c });
        setLaedt(false);
        if (error)
            return setFehler(fehlertext(error));
        if (!data)
            return setFehler('Der Code ist ungültig oder abgelaufen. Bitte prüfe ihn in deiner Einladungs-E-Mail.');
        const d = data;
        setDaten(d);
        setName(d.ich.name);
        setAnschrift(d.ich.anschrift ?? '');
        setTelefon(d.ich.telefon ?? '');
        setHund(!!d.ich.hat_hund);
        setHorn(!!d.ich.hat_hornblaeser);
        setAuto(!!d.ich.auto_vorhanden);
        setPlaetze(String(d.ich.mitfahrplaetze ?? 0));
        setSchuessel(!!d.ich.schuesseltreiben_teilnahme);
        if (d.ich.status === 'zugesagt')
            setZusage(true);
    }
    useEffect(() => {
        if (code.replace('-', '').length === 8)
            void laden();
        // einmalig mit dem Code aus dem Link
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const marker = useMemo(() => {
        if (!daten)
            return [];
        const m = [];
        if (daten.jagd.lng != null && daten.jagd.lat != null)
            m.push({ id: 'tp', lng: daten.jagd.lng, lat: daten.jagd.lat, art: 'treffpunkt', label: 'Treffpunkt' });
        for (const b of daten.boecke) {
            const eigener = b.id === daten.ich.einrichtung_id;
            m.push({ id: b.id, lng: b.lng, lat: b.lat, art: eigener ? 'eigener' : 'bock', label: eigener ? `Dein Stand${b.name ? `: ${b.name}` : ''}` : (b.name ?? 'Drückjagdbock') });
        }
        for (const r of daten.rettungspunkte ?? [])
            m.push({ id: `r${r.id}`, lng: r.lng, lat: r.lat, art: 'rettung', label: r.name });
        return m;
    }, [daten]);
    if (fertig) {
        return (_jsxs("main", { className: "bj-teiln", children: [_jsx(Hinweis, { art: "erfolg", children: fertig === 'zusage' ? 'Danke! Deine Zusage ist gespeichert. Du kannst sie über den Link in der E-Mail jederzeit ändern.' : 'Deine Absage ist eingegangen und deine Daten wurden gelöscht.' }), fertig === 'zusage' && daten && (_jsxs(_Fragment, { children: [_jsx(Anstellinfo, { daten: daten }), _jsx(Knopf, { variante: "akzent", onClick: () => setDruck(true), children: "Zusammenfassung drucken" }), druck && (_jsx(TeilnehmerSelbstDruck, { jagd: {
                                titel: daten.jagd.titel,
                                art: daten.jagd.art,
                                datum: daten.jagd.datum,
                                uhrzeit: daten.jagd.uhrzeit,
                                lng: daten.jagd.lng,
                                lat: daten.jagd.lat,
                                schuesseltreiben: daten.jagd.schuesseltreiben,
                                schuesseltreiben_adresse: daten.jagd.schuesseltreiben_adresse,
                                anmeldung_pflicht: daten.jagd.anmeldung_pflicht,
                                hegebeitrag_aktiv: daten.jagd.hegebeitrag_aktiv,
                                hegebeitrag_betrag: daten.jagd.hegebeitrag_betrag,
                                einladungstext: daten.jagd.einladungstext,
                            }, tn: { name, anschrift, telefon, hund, horn, auto, plaetze: Number(plaetze) || 0, schuessel }, stand: daten.stand ?? undefined, boecke: daten.boecke, rettung: daten.rettungspunkte ?? [], leitung: daten.jagdleitung ?? [], ansteller: daten.ansteller ?? null, onZu: () => setDruck(false) }))] }))] }));
    }
    if (!daten) {
        return (_jsxs("main", { className: "bj-teiln", children: [_jsx("h1", { children: "Einladung zur Bewegungsjagd" }), _jsx(Gruppe, { titel: "Einladungscode", fuss: "Den Code findest du in deiner Einladungs-E-Mail (Format XXXX-XXXX).", children: _jsx(Feld, { label: "Code", value: code, autoCapitalize: "characters", autoComplete: "off", spellCheck: false, maxLength: 9, onChange: (e) => setCode(codeAnzeigen(e.target.value)) }) }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { variante: "akzent", disabled: laedt || code.replace('-', '').length !== 8, onClick: () => void laden(), children: laedt ? 'Prüfe …' : 'Weiter' })] }));
    }
    const j = daten.jagd;
    const links = j.lat != null && j.lng != null ? navigationsLinks(j.lat, j.lng) : null;
    const betrag = j.hegebeitrag_betrag != null ? Number(j.hegebeitrag_betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '';
    const geschlossen = j.status !== 'offen';
    async function absagen() {
        setLaedt(true);
        const { data, error } = await supabase.rpc('bj_absagen_loeschen', { p_jagd: jagdId, p_code: code });
        setLaedt(false);
        if (error || !data)
            return setFehler(error ? fehlertext(error) : 'Die Absage konnte nicht gespeichert werden.');
        setFertig('absage');
    }
    async function senden() {
        setLaedt(true);
        setFehler(null);
        const { data, error } = await supabase.rpc('bj_antworten', {
            p_jagd: jagdId,
            p_code: code,
            p_name: name,
            p_anschrift: anschrift,
            p_telefon: telefon,
            p_zusage: true,
            p_hund: hund,
            p_hornblaeser: horn,
            p_auto: auto,
            p_plaetze: Number(plaetze) || 0,
            p_schuesseltreiben: j.schuesseltreiben ? schuessel || j.anmeldung_pflicht : false,
        });
        setLaedt(false);
        if (error || !data)
            return setFehler(error ? fehlertext(error) : 'Die Zusage konnte nicht gespeichert werden.');
        setFertig('zusage');
    }
    return (_jsxs("main", { className: "bj-teiln", children: [_jsxs("div", { children: [_jsx("h1", { children: j.titel }), _jsxs("p", { style: { margin: '4px 0 0', color: 'var(--color-text-muted)' }, children: [j.art, " \u00B7 ", datumDE(j.datum), j.uhrzeit ? `, ${j.uhrzeit.slice(0, 5)} Uhr` : ''] })] }), _jsx(Suspense, { fallback: _jsx("div", { className: "laden", children: "Karte wird geladen \u2026" }), children: _jsx(BjKarte, { marker: marker }) }), _jsxs("div", { className: "bj-legende", "aria-hidden": "true", children: [_jsx("span", { children: "\u2691 Treffpunkt" }), _jsx("span", { style: { color: '#c0392b' }, children: "\u25CF Dr\u00FCckjagdb\u00F6cke" }), daten.ich.einrichtung_id && _jsx("span", { style: { color: '#f26a1b' }, children: "\u2605 Dein Stand" })] }), daten.ich.einrichtung_id ? _jsx(Hinweis, { art: "info", children: "Dein Stand ist auf der Karte mit \u2605 markiert." }) : _jsx(Hinweis, { children: "Dir wurde noch kein Stand zugewiesen." }), daten.ich.status === 'zugesagt' && _jsx(Anstellinfo, { daten: daten }), geschlossen && _jsx(Hinweis, { art: "fehler", children: "Diese Jagd ist abgeschlossen. Antworten sind nicht mehr m\u00F6glich." }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), !geschlossen && schritt === 0 && (_jsxs(_Fragment, { children: [_jsxs(Gruppe, { titel: "1 \u00B7 Deine Angaben", children: [_jsx(Feld, { label: "Name", value: name, onChange: (e) => setName(e.target.value), autoComplete: "name" }), _jsx(Feld, { label: "Anschrift", value: anschrift, onChange: (e) => setAnschrift(e.target.value), autoComplete: "street-address", placeholder: "Stra\u00DFe, PLZ Ort" }), _jsx(Feld, { label: "Telefon (optional)", type: "tel", value: telefon, onChange: (e) => setTelefon(e.target.value), autoComplete: "tel", placeholder: "f\u00FCr R\u00FCckfragen am Jagdtag" })] }), _jsx(Knopf, { variante: "akzent", disabled: !name.trim(), onClick: () => setSchritt(1), children: "Weiter" })] })), !geschlossen && schritt === 1 && (_jsxs(_Fragment, { children: [_jsx(Gruppe, { titel: "2 \u00B7 Nimmst du teil?", children: _jsx("div", { style: { padding: '10px var(--abstand)' }, children: _jsx(Segmente, { label: "Teilnahme", optionen: [{ wert: 'ja', label: 'Zusage' }, { wert: 'nein', label: 'Absage' }], wert: zusage === null ? '' : zusage ? 'ja' : 'nein', onAendern: (v) => { setZusage(v === 'ja'); setWarnung(v === 'nein'); } }) }) }), warnung && zusage === false && (_jsxs("div", { className: "bj-warnung", role: "alertdialog", "aria-label": "Absage best\u00E4tigen", children: [_jsx("strong", { children: "Wirklich absagen?" }), _jsx("span", { children: "Wenn du absagst, werden deine Daten sofort gel\u00F6scht. Danach kannst du dich nur noch mit einer neuen Einladung anmelden." }), _jsxs("div", { className: "bj-dialog-knoepfe", children: [_jsx(Knopf, { variante: "ghost", onClick: () => { setWarnung(false); setZusage(null); }, children: "Abbrechen" }), _jsx(Knopf, { variante: "gefahr", disabled: laedt, onClick: () => void absagen(), children: "Endg\u00FCltig absagen" })] })] })), _jsxs("div", { className: "bj-dialog-knoepfe", children: [_jsx(Knopf, { variante: "ghost", onClick: () => setSchritt(0), children: "Zur\u00FCck" }), zusage && _jsx(Knopf, { variante: "akzent", onClick: () => setSchritt(2), children: "Weiter" })] })] })), !geschlossen && schritt === 2 && (_jsxs(_Fragment, { children: [_jsxs(Gruppe, { titel: "3 \u00B7 Details zur Jagd", children: [links && (_jsxs("div", { className: "bj-text", children: [_jsx("span", { children: "Treffpunkt \u2013 Navigation starten" }), _jsxs("div", { className: "bj-nav-links", children: [_jsx("a", { className: "knopf knopf-sekundaer", href: links.apple, target: "_blank", rel: "noreferrer", children: "Apple Karten" }), _jsx("a", { className: "knopf knopf-sekundaer", href: links.google, target: "_blank", rel: "noreferrer", children: "Google Maps" })] })] })), j.einladungstext && _jsx("div", { className: "bj-text", children: _jsx("span", { style: { whiteSpace: 'pre-wrap', color: 'inherit' }, children: j.einladungstext }) }), j.schuesseltreiben && (_jsxs("div", { className: "bj-text", children: [_jsxs("span", { children: ["Sch\u00FCsseltreiben", j.schuesseltreiben_adresse ? `: ${j.schuesseltreiben_adresse}` : ''] }), j.anmeldung_pflicht ? (_jsx("span", { style: { color: 'inherit' }, children: "Die Anmeldung zum Sch\u00FCsseltreiben ist verpflichtend \u2013 mit deiner Zusage meldest du dich an." })) : (_jsxs("label", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: schuessel, onChange: (e) => setSchuessel(e.target.checked) }), " Ich nehme am Sch\u00FCsseltreiben teil"] }))] })), j.hegebeitrag_aktiv && _jsx("div", { className: "bj-text", children: _jsxs("span", { style: { color: 'inherit' }, children: ["Hegebeitrag: ", _jsx("strong", { children: betrag })] }) })] }), _jsxs(Gruppe, { titel: "Deine Angaben f\u00FCr die Planung", children: [_jsxs("label", { className: "bj-ja-nein", children: [_jsx("span", { children: "Ich bringe einen Hund mit" }), _jsx("input", { type: "checkbox", checked: hund, onChange: (e) => setHund(e.target.checked) })] }), _jsxs("label", { className: "bj-ja-nein", children: [_jsx("span", { children: "Ich bin Jagdhornbl\u00E4ser" }), _jsx("input", { type: "checkbox", checked: horn, onChange: (e) => setHorn(e.target.checked) })] }), _jsxs("label", { className: "bj-ja-nein", children: [_jsx("span", { children: "Ich komme mit dem Auto" }), _jsx("input", { type: "checkbox", checked: auto, onChange: (e) => setAuto(e.target.checked) })] }), auto && _jsx(Feld, { label: "Freie Mitfahrpl\u00E4tze", type: "number", min: 0, max: 20, inputMode: "numeric", value: plaetze, onChange: (e) => setPlaetze(e.target.value) })] }), _jsxs("div", { className: "bj-dialog-knoepfe", children: [_jsx(Knopf, { variante: "ghost", onClick: () => setSchritt(1), children: "Zur\u00FCck" }), _jsx(Knopf, { variante: "akzent", disabled: laedt, onClick: () => void senden(), children: laedt ? 'Sende …' : 'Zusage senden' })] })] }))] }));
}
// Anstellinformation nach der Zusage: Ansteller, Jagdleitung, Treffpunkt/Zeit, Rettungspunkte
function Anstellinfo({ daten }) {
    const j = daten.jagd;
    const leitung = daten.jagdleitung ?? [];
    const rettung = daten.rettungspunkte ?? [];
    const telLink = (t) => (t ? _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("a", { href: `tel:${t.replace(/[^+\d]/g, '')}`, children: t })] }) : null);
    if (!daten.ansteller && leitung.length === 0 && rettung.length === 0)
        return null;
    return (_jsx(Gruppe, { titel: "Deine Anstellinformation", children: _jsxs("div", { className: "bj-text", children: [_jsxs("span", { style: { color: 'inherit' }, children: [_jsx("strong", { children: "Treffpunkt und Zeit:" }), " ", datumDE(j.datum), j.uhrzeit ? `, ${j.uhrzeit.slice(0, 5)} Uhr` : ''] }), daten.ansteller && (_jsxs("span", { style: { color: 'inherit' }, children: [_jsx("strong", { children: "Dein Ansteller:" }), " ", daten.ansteller.name, telLink(daten.ansteller.telefon)] })), leitung.map((l, i) => (_jsxs("span", { style: { color: 'inherit' }, children: [_jsxs("strong", { children: [l.funktion || 'Jagdleitung', ":"] }), " ", l.name, telLink(l.telefon)] }, i))), rettung.length > 0 && (_jsxs("span", { style: { color: 'inherit' }, children: [_jsx("strong", { children: "Rettungspunkte" }), " (auf der Karte mit + markiert):", _jsx("ul", { style: { margin: '4px 0 0', paddingLeft: 20 }, children: rettung.map((r) => (_jsxs("li", { children: [r.name, r.bemerkung ? ` – ${r.bemerkung}` : '', ' ', _jsx("a", { href: navigationsLinks(r.lat, r.lng).google, target: "_blank", rel: "noreferrer", children: "Navigation" })] }, r.id))) })] }))] }) }));
}
