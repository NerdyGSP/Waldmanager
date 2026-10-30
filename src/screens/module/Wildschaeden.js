import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, useZonen, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, datumDE, heuteISO, letzteJagdjahre } from '../../lib/zeit';
import { aktuellePosition, punktEWKT } from '../../lib/geo';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile, WildartOptionen } from '../../components/ui';
const STATUS = [
    { wert: 'erfasst', label: 'Erfasst' },
    { wert: 'angemeldet', label: 'Angemeldet' },
    { wert: 'besichtigt', label: 'Besichtigt' },
    { wert: 'reguliert', label: 'Reguliert' },
    { wert: 'abgelehnt', label: 'Abgelehnt' },
];
const KULTUREN = ['Mais', 'Weizen', 'Gerste', 'Roggen', 'Raps', 'Zuckerrüben', 'Kartoffeln', 'Grünland', 'Wiese', 'Obst/Sonderkultur', 'Forst/Verjüngung', 'Sonstiges'];
const TAG = 86400000;
const tageSeit = (iso) => {
    const [j, m, t] = iso.split('-').map(Number);
    const heute = new Date();
    return Math.round((Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate()) - Date.UTC(j, m - 1, t)) / TAG);
};
const plusTage = (iso, n) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
};
/** Anmeldefrist: eine Woche ab Kenntnis (§ 34 BJagdG) */
export function fristStand(s) {
    const frist = plusTage(s.kenntnis_am, 7);
    if (s.angemeldet_am || s.status !== 'erfasst') {
        const a = s.angemeldet_am;
        if (a && a > frist)
            return { art: 'spaet', text: `verspätet angemeldet (${datumDE(a)})`, frist };
        return { art: 'ok', text: a ? `fristgerecht angemeldet (${datumDE(a)})` : 'Anmeldung abgeschlossen', frist };
    }
    const rest = -tageSeit(frist);
    if (rest < 0)
        return { art: 'abgelaufen', text: `Frist seit ${-rest} ${-rest === 1 ? 'Tag' : 'Tagen'} abgelaufen`, frist };
    if (rest === 0)
        return { art: 'heute', text: 'Heute letzter Tag der Anmeldefrist', frist };
    return { art: rest <= 2 ? 'bald' : 'offen-aus', text: `Anmeldung bis ${datumDE(frist)} (noch ${rest} ${rest === 1 ? 'Tag' : 'Tage'})`, frist };
}
function FristBadge({ s }) {
    const f = fristStand(s);
    const klasse = f.art === 'ok' ? 'badge-gruen' : f.art === 'offen-aus' ? '' : f.art === 'bald' || f.art === 'heute' ? 'badge-orange' : 'badge-rot';
    return _jsx("span", { className: `badge ${klasse}`, children: f.text });
}
export function Wildschaeden({ k }) {
    const wildarten = useWildarten();
    const { zonen } = useZonen(k.revierId);
    const [jahr, setJahr] = useState(aktuellesJagdjahr());
    const [liste, setListe] = useState([]);
    const [offeneFristen, setOffeneFristen] = useState([]);
    const [bearbeiten, setBearbeiten] = useState(null);
    const [fehler, setFehler] = useState(null);
    const laden = useCallback(async () => {
        const spalten = 'id, kenntnis_am, angemeldet_am, status, kultur, flaeche_ha, wildart_id, zone_id, ort, geschaedigter, kontakt, schaden_eur, bemerkung, erfasst_von';
        const [a, b] = await Promise.all([
            supabase
                .from('wildschaeden')
                .select(spalten)
                .eq('revier_id', k.revierId)
                .is('geloescht_am', null)
                .gte('kenntnis_am', jahr.von)
                .lte('kenntnis_am', jahr.bis)
                .order('kenntnis_am', { ascending: false }),
            // Noch nicht angemeldete Schäden, unabhängig vom gewählten Jagdjahr
            supabase
                .from('wildschaeden')
                .select(spalten)
                .eq('revier_id', k.revierId)
                .is('geloescht_am', null)
                .eq('status', 'erfasst')
                .is('angemeldet_am', null)
                .order('kenntnis_am'),
        ]);
        const err = a.error ?? b.error;
        if (err)
            setFehler(fehlertext(err));
        setListe(a.data ?? []);
        setOffeneFristen(b.data ?? []);
    }, [k.revierId, jahr]);
    useEffect(() => {
        void laden();
    }, [laden]);
    const summe = useMemo(() => ({
        flaeche: liste.reduce((a, s) => a + (s.flaeche_ha ?? 0), 0),
        eur: liste.reduce((a, s) => a + (s.schaden_eur ?? 0), 0),
    }), [liste]);
    const dringend = offeneFristen.filter((s) => ['bald', 'heute', 'abgelaufen'].includes(fristStand(s).art));
    if (bearbeiten) {
        return (_jsx(SchadenFormular, { k: k, vorlage: bearbeiten === 'neu' ? null : bearbeiten, onFertig: async () => {
                setBearbeiten(null);
                await laden();
            } }));
    }
    return (_jsxs(Seite, { titel: "Wildsch\u00E4den", untertitel: `Jagdjahr ${jahr.label} · ${liste.length} ${liste.length === 1 ? 'Meldung' : 'Meldungen'}`, aktion: _jsx(Knopf, { variante: "akzent", onClick: () => setBearbeiten('neu'), children: "+ Schaden" }), children: [_jsxs(Hinweis, { children: [_jsx("strong", { children: "Anmeldefrist: eine Woche." }), " Ein Wildschaden muss innerhalb einer Woche, nachdem der Gesch\u00E4digte davon Kenntnis erhalten hat (oder h\u00E4tte erhalten m\u00FCssen), bei der zust\u00E4ndigen Stelle angemeldet werden (\u00A7 34 BJagdG). F\u00FCr forstliche Fl\u00E4chen gen\u00FCgt eine Sammelmeldung zum 1. Mai und 1. Oktober. Landesrecht und Pachtvertrag k\u00F6nnen abweichen."] }), dringend.length > 0 && (_jsxs("div", { className: "hinweis frist", role: "alert", children: [_jsx("strong", { children: "Frist beachten:" }), _jsx("ul", { className: "frist-liste", children: dringend.map((s) => (_jsxs("li", { children: [_jsxs("button", { className: "link", onClick: () => setBearbeiten(s), children: [s.kultur, s.geschaedigter ? ` · ${s.geschaedigter}` : ''] }), ' ', "\u2013 ", fristStand(s).text] }, s.id))) })] })), _jsxs("label", { className: "filter", children: [_jsx("span", { children: "Jagdjahr" }), _jsx("select", { value: jahr.start, onChange: (e) => setJahr(letzteJagdjahre().find((j) => j.start === Number(e.target.value)) ?? jahr), children: letzteJagdjahre().map((j) => (_jsx("option", { value: j.start, children: j.label }, j.start))) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), liste.length > 0 && (_jsxs("div", { className: "kennzahlen", children: [_jsxs("div", { className: "kennzahl", children: [_jsx("strong", { children: liste.length }), _jsx("span", { children: "Meldungen" })] }), _jsxs("div", { className: "kennzahl", children: [_jsx("strong", { children: summe.flaeche.toLocaleString('de-DE', { maximumFractionDigits: 2 }) }), _jsx("span", { children: "Fl\u00E4che in ha" })] }), _jsxs("div", { className: "kennzahl", children: [_jsx("strong", { children: summe.eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) }), _jsx("span", { children: "gesch\u00E4tzter Schaden" })] })] })), _jsxs(Gruppe, { titel: "Meldungen", children: [liste.length === 0 && _jsx(Zeile, { label: "Keine Wildsch\u00E4den in diesem Jagdjahr" }), liste.map((s) => (_jsxs("button", { className: "zeile zeile-knopf", onClick: () => setBearbeiten(s), children: [_jsxs("span", { className: "zeile-label", children: [s.kultur, s.wildart_id ? ` · ${wildartName(wildarten, s.wildart_id)}` : '', _jsxs("small", { children: [datumDE(s.kenntnis_am), s.geschaedigter ? ` · ${s.geschaedigter}` : '', s.flaeche_ha ? ` · ${s.flaeche_ha.toLocaleString('de-DE')} ha` : '', s.zone_id ? ` · ${zonen.find((z) => z.id === s.zone_id)?.name ?? ''}` : ''] }), _jsxs("span", { className: "zeile-badges", children: [_jsx("span", { className: "badge", children: STATUS.find((x) => x.wert === s.status)?.label }), _jsx(FristBadge, { s: s })] })] }), _jsx("span", { className: "zeile-pfeil", "aria-hidden": "true", children: "\u203A" })] }, s.id)))] })] }));
}
function SchadenFormular({ k, vorlage, onFertig }) {
    const wildarten = useWildarten();
    const { zonen } = useZonen(k.revierId);
    const [kenntnis, setKenntnis] = useState(vorlage?.kenntnis_am ?? heuteISO());
    const [angemeldet, setAngemeldet] = useState(vorlage?.angemeldet_am ?? '');
    const [status, setStatus] = useState(vorlage?.status ?? 'erfasst');
    const [kultur, setKultur] = useState(vorlage?.kultur ?? 'Mais');
    const [flaeche, setFlaeche] = useState(vorlage?.flaeche_ha ? String(vorlage.flaeche_ha).replace('.', ',') : '');
    const [wildart, setWildart] = useState(vorlage?.wildart_id ?? '');
    const [zoneId, setZoneId] = useState(vorlage?.zone_id ?? '');
    const [ort, setOrt] = useState(vorlage?.ort ?? '');
    const [geschaedigter, setGeschaedigter] = useState(vorlage?.geschaedigter ?? '');
    const [kontakt, setKontakt] = useState(vorlage?.kontakt ?? '');
    const [eur, setEur] = useState(vorlage?.schaden_eur ? String(vorlage.schaden_eur).replace('.', ',') : '');
    const [bemerkung, setBemerkung] = useState(vorlage?.bemerkung ?? '');
    const [position, setPosition] = useState(null);
    const [ortStatus, setOrtStatus] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [speichert, setSpeichert] = useState(false);
    const frist = fristStand({ kenntnis_am: kenntnis, angemeldet_am: angemeldet || null, status });
    const darfAendern = !vorlage || k.istInhaber || vorlage.erfasst_von === k.userId;
    const zahl = (s) => (s.trim() ? Number(s.replace(',', '.')) : null);
    async function ortUebernehmen() {
        setOrtStatus('Position wird bestimmt …');
        const p = await aktuellePosition();
        if (!p) {
            setOrtStatus('Position nicht verfügbar – bitte Ortungsfreigabe prüfen.');
            return;
        }
        setPosition({ lon: p.lon, lat: p.lat });
        const { data } = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: p.lon, p_lat: p.lat });
        if (data)
            setZoneId(data);
        setOrtStatus(`Position übernommen (± ${p.genauigkeit} m)${data ? ', Zone automatisch gesetzt' : ''}`);
    }
    async function speichern(e) {
        e.preventDefault();
        setFehler(null);
        const ha = zahl(flaeche);
        const betrag = zahl(eur);
        if ((ha !== null && (!Number.isFinite(ha) || ha < 0)) || (betrag !== null && (!Number.isFinite(betrag) || betrag < 0))) {
            setFehler('Bitte gültige Zahlen für Fläche und Schaden angeben.');
            return;
        }
        setSpeichert(true);
        const daten = {
            revier_id: k.revierId,
            kenntnis_am: kenntnis,
            angemeldet_am: angemeldet || null,
            status: status === 'erfasst' && angemeldet ? 'angemeldet' : status,
            kultur: kultur.trim(),
            flaeche_ha: ha,
            wildart_id: wildart || null,
            zone_id: zoneId || null,
            ort: ort.trim() || null,
            geschaedigter: geschaedigter.trim() || null,
            kontakt: kontakt.trim() || null,
            schaden_eur: betrag,
            bemerkung: bemerkung.trim() || null,
            ...(position ? { geom: punktEWKT(position.lon, position.lat) } : {}),
        };
        const { error } = vorlage
            ? await supabase.from('wildschaeden').update(daten).eq('id', vorlage.id)
            : await supabase.from('wildschaeden').insert(daten);
        setSpeichert(false);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    async function loeschen() {
        if (!vorlage || !window.confirm('Diese Schadensmeldung löschen?'))
            return;
        const { error } = await supabase.from('wildschaeden').update({ geloescht_am: new Date().toISOString() }).eq('id', vorlage.id);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    return (_jsx(Seite, { titel: vorlage ? 'Wildschaden bearbeiten' : 'Wildschaden erfassen', zurueck: () => void onFertig(), children: _jsxs("form", { onSubmit: speichern, children: [_jsxs("div", { className: `hinweis ${['abgelaufen', 'spaet'].includes(frist.art) ? 'hinweis-fehler' : ['heute', 'bald'].includes(frist.art) ? 'frist' : ''}`, role: "status", children: [_jsx("strong", { children: "Anmeldefrist 1 Woche:" }), " ", frist.text, !angemeldet && status === 'erfasst' && frist.art === 'offen-aus' && _jsx(_Fragment, { children: " \u2013 danach nicht mehr fristgerecht." })] }), _jsxs(Gruppe, { titel: "Schaden", children: [_jsx(Auswahl, { label: "Kultur", value: KULTUREN.includes(kultur) ? kultur : 'Sonstiges', onChange: (e) => setKultur(e.target.value), children: KULTUREN.map((x) => (_jsx("option", { children: x }, x))) }), _jsx(Feld, { label: "Kenntnis am", type: "date", required: true, value: kenntnis, max: heuteISO(), onChange: (e) => setKenntnis(e.target.value) }), _jsx(Feld, { label: "Fl\u00E4che (ha)", inputMode: "decimal", placeholder: "optional", value: flaeche, onChange: (e) => setFlaeche(e.target.value) }), _jsxs(Auswahl, { label: "Verursacher (vermutet)", value: wildart, onChange: (e) => setWildart(e.target.value), children: [_jsx("option", { value: "", children: "unbekannt" }), _jsx(WildartOptionen, { wildarten: wildarten })] }), _jsx(Feld, { label: "Schaden (\u20AC)", inputMode: "decimal", placeholder: "gesch\u00E4tzt, optional", value: eur, onChange: (e) => setEur(e.target.value) })] }), _jsxs(Gruppe, { titel: "Ort", children: [_jsxs(Auswahl, { label: "Zone", value: zoneId, onChange: (e) => setZoneId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), zonen.map((z) => (_jsx("option", { value: z.id, children: z.name }, z.id)))] }), _jsx(Feld, { label: "Flurst\u00FCck / Lage", placeholder: "optional", value: ort, onChange: (e) => setOrt(e.target.value) })] }), _jsx(Knopf, { type: "button", variante: "sekundaer", onClick: ortUebernehmen, children: "\uD83D\uDCCD Aktuelle Position \u00FCbernehmen" }), ortStatus && _jsx(Leer, { children: ortStatus }), _jsxs(Gruppe, { titel: "Gesch\u00E4digter", children: [_jsx(Feld, { label: "Name", placeholder: "Landwirt / Eigent\u00FCmer", value: geschaedigter, onChange: (e) => setGeschaedigter(e.target.value) }), _jsx(Feld, { label: "Kontakt", placeholder: "Telefon oder E-Mail", value: kontakt, onChange: (e) => setKontakt(e.target.value) })] }), _jsxs(Gruppe, { titel: "Bearbeitungsstand", children: [_jsx(Auswahl, { label: "Status", value: status, onChange: (e) => setStatus(e.target.value), children: STATUS.map((s) => (_jsx("option", { value: s.wert, children: s.label }, s.wert))) }), _jsx(Feld, { label: "Angemeldet am", type: "date", value: angemeldet, max: heuteISO(), onChange: (e) => setAngemeldet(e.target.value) }), _jsx(Feld, { label: "Bemerkung", value: bemerkung, onChange: (e) => setBemerkung(e.target.value) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), darfAendern ? (_jsx(Knopf, { type: "submit", disabled: speichert, children: speichert ? 'Speichern …' : 'Speichern' })) : (_jsx(Leer, { children: "Nur der Revierinhaber und die erfassende Person k\u00F6nnen diese Meldung \u00E4ndern." })), _jsx(Knopf, { type: "button", variante: "ghost", onClick: () => void onFertig(), children: "Abbrechen" }), vorlage && k.istInhaber && (_jsx(Knopf, { type: "button", variante: "gefahr", onClick: loeschen, children: "Meldung l\u00F6schen" }))] }) }));
}
