import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useState } from 'react';
import { DruckPortal } from '../../components/DruckPortal';
import { datumDE } from '../../lib/zeit';
import { Knopf } from '../../components/ui';
import { QrCode } from '../../components/QrCode';
import { navigationsLinks } from '../../lib/bewegungsjagd';
import { EINRICHTUNGSTYPEN } from '../../lib/stammdaten';
import { nachAnstellern } from '../../lib/bjGruppen';
import { DruckKarte, teilePunkte } from './DruckKarte';
// Gemeinsamer Rahmen: Vollbild-Ebene mit Werkzeugleiste, beim Drucken nur das Blatt
export function Druckrahmen({ querformat, onZu, leiste, children }) {
    useEffect(() => {
        const stil = document.createElement('style');
        stil.textContent = `@page { size: A4 ${querformat ? 'landscape' : 'portrait'}; margin: 12mm; }`;
        document.head.appendChild(stil);
        return () => {
            stil.remove();
        };
    }, [querformat]);
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && onZu();
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onZu]);
    return (_jsx(DruckPortal, { children: _jsxs("div", { className: "bj-druck-ebene", role: "dialog", "aria-modal": "true", children: [_jsxs("div", { className: "bj-druck-leiste", children: [_jsx(Knopf, { variante: "ghost", onClick: onZu, children: "\u2039 Zur\u00FCck" }), _jsx(Knopf, { variante: "akzent", onClick: () => window.print(), children: "Drucken / als PDF" }), leiste] }), _jsx("div", { className: `bj-druck-blatt ${querformat ? 'quer' : 'hoch'}`, children: children })] }) }));
}
// ---------- Teilnehmerinfo / Anstellinformation (A4 hoch) ----------
const STANDARD_HINWEIS = 'Bitte pünktlich am Treffpunkt sein. Jagdschein, Waffenbesitzkarte und Schießnachweis (Gültigkeit im Bundesland prüfen) sind mitzuführen. Signalkleidung ist Pflicht. Den Anweisungen der Jagdleitung ist uneingeschränkt Folge zu leisten.';
const jagdInfo = (j) => ({
    titel: j.titel,
    art: j.art,
    datum: j.datum,
    uhrzeit: j.uhrzeit,
    lng: j.treffpunkt_lng,
    lat: j.treffpunkt_lat,
    schuesseltreiben: j.schuesseltreiben,
    schuesseltreiben_adresse: j.schuesseltreiben_adresse,
    anmeldung_pflicht: j.schuesseltreiben_anmeldung_pflicht,
    hegebeitrag_aktiv: j.hegebeitrag_aktiv,
    hegebeitrag_betrag: j.hegebeitrag_betrag,
    einladungstext: j.einladungstext,
});
const tnInfo = (t) => ({
    name: t.name,
    anschrift: t.anschrift,
    telefon: t.telefon,
    hund: !!t.hat_hund,
    horn: !!t.hat_hornblaeser,
    auto: !!t.auto_vorhanden,
    plaetze: t.mitfahrplaetze ?? 0,
    schuessel: !!t.schuesseltreiben_teilnahme,
});
const typLabel = (typ) => EINRICHTUNGSTYPEN.find((t) => t.wert === typ)?.label ?? typ;
const standLabel = (e) => e.name || typLabel(e.typ);
const zeitText = (j) => `${new Date(`${j.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}${j.uhrzeit ? `, ${j.uhrzeit.slice(0, 5)} Uhr` : ''}`;
// Adresse des Treffpunkts (OpenStreetMap Nominatim), nur ein einzelner Abruf
function useAdresse(lat, lng) {
    const [adresse, setAdresse] = useState(null);
    useEffect(() => {
        if (lat == null || lng == null)
            return;
        void fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=de&lat=${lat}&lon=${lng}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => setAdresse(j?.display_name ?? null))
            .catch(() => setAdresse(null));
    }, [lat, lng]);
    return adresse;
}
const tel = (t) => (t ? ` · Tel. ${t}` : '');
// Eine Seite der Anstellinformation (A4 hoch)
function InfoSeite({ jagd, tn, stand, boecke, rettung, leitung, ansteller, hinweise, adresse, folge }) {
    const hatTreffpunkt = jagd.lng != null && jagd.lat != null;
    const ja = (b) => (b ? 'ja' : 'nein');
    const punkte = useMemo(() => {
        const l = [];
        if (hatTreffpunkt)
            l.push({ id: 'tp', lng: jagd.lng, lat: jagd.lat, art: 'treffpunkt', label: 'Treffpunkt' });
        for (const r of rettung)
            l.push({ id: `r${r.id}`, lng: r.lng, lat: r.lat, art: 'rettung', label: r.name });
        // Nur der eigene Stand wird benannt; die übrigen Stände erscheinen ohne Namen
        for (const b of boecke)
            if (!stand || b.id !== stand.id)
                l.push({ id: `b${b.id}`, lng: b.lng, lat: b.lat, art: 'frei' });
        if (stand)
            l.push({ id: 'eigener', lng: stand.lng, lat: stand.lat, art: 'eigener', label: 'Dein Stand' });
        return l;
    }, [hatTreffpunkt, jagd.lng, jagd.lat, rettung, boecke, stand]);
    return (_jsxs("section", { className: folge ? 'bj-druck-seite folge' : 'bj-druck-seite', children: [_jsx("h1", { children: jagd.titel }), _jsxs("p", { className: "art", children: [jagd.art, tn ? ` · Teilnehmer: ${tn.name}` : ''] }), _jsx("table", { className: "bj-druck-tabelle", children: _jsxs("tbody", { children: [_jsxs("tr", { children: [_jsx("th", { children: "Datum" }), _jsx("td", { children: new Date(`${jagd.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) })] }), jagd.uhrzeit && _jsxs("tr", { children: [_jsx("th", { children: "Uhrzeit" }), _jsxs("td", { children: [jagd.uhrzeit.slice(0, 5), " Uhr"] })] }), hatTreffpunkt && (_jsxs("tr", { children: [_jsx("th", { children: "Treffpunkt" }), _jsxs("td", { children: [adresse && _jsxs(_Fragment, { children: [adresse, _jsx("br", {})] }), _jsxs("small", { children: [jagd.lat.toFixed(5), ", ", jagd.lng.toFixed(5)] })] })] })), tn && (_jsxs("tr", { children: [_jsx("th", { children: "Dein Stand" }), _jsx("td", { children: stand ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: standLabel(stand) }), " (", typLabel(stand.typ), ")", _jsx("br", {}), _jsxs("small", { children: [stand.lat.toFixed(5), ", ", stand.lng.toFixed(5)] }), stand.bemerkung && _jsxs(_Fragment, { children: [_jsx("br", {}), _jsx("small", { children: stand.bemerkung })] })] })) : ('Noch kein Stand zugewiesen – Zuweisung vor Ort durch die Jagdleitung.') })] })), tn && ansteller && (_jsxs("tr", { children: [_jsx("th", { children: "Dein Ansteller" }), _jsxs("td", { children: [_jsx("strong", { children: ansteller.name }), tel(ansteller.telefon)] })] })), leitung.length > 0 && (_jsxs("tr", { children: [_jsx("th", { children: "Jagdleitung" }), _jsx("td", { children: leitung.map((l, i) => (_jsxs("span", { children: [i > 0 && _jsx("br", {}), _jsx("strong", { children: l.name }), l.funktion ? ` (${l.funktion})` : '', tel(l.telefon)] }, i))) })] })), jagd.schuesseltreiben && (_jsxs("tr", { children: [_jsx("th", { children: "Sch\u00FCsseltreiben" }), _jsxs("td", { children: [jagd.schuesseltreiben_adresse || 'ja', jagd.anmeldung_pflicht ? ' · Anmeldung erforderlich' : '', tn ? ` · Teilnahme: ${ja(tn.schuessel || jagd.anmeldung_pflicht)}` : ''] })] })), jagd.hegebeitrag_aktiv && _jsxs("tr", { children: [_jsx("th", { children: "Hegebeitrag" }), _jsx("td", { children: Number(jagd.hegebeitrag_betrag ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) })] }), tn && (_jsxs("tr", { children: [_jsx("th", { children: "Deine Angaben" }), _jsx("td", { children: _jsxs("small", { children: ["Hund: ", ja(tn.hund), " \u00B7 Jagdhornbl\u00E4ser: ", ja(tn.horn), " \u00B7 Auto: ", tn.auto ? `ja, ${tn.plaetze} Mitfahrplätze` : 'nein', tn.telefon ? ` · Tel. ${tn.telefon}` : ''] }) })] }))] }) }), (hatTreffpunkt || stand) && (_jsxs("div", { className: "bj-druck-qrreihe", children: [hatTreffpunkt && (_jsxs("figure", { children: [_jsx(QrCode, { text: navigationsLinks(jagd.lat, jagd.lng).google, groesse: 110, titel: "Navigation zum Treffpunkt" }), _jsxs("figcaption", { children: ["Navigation zum ", _jsx("strong", { children: "Treffpunkt" }), _jsx("br", {}), "QR-Code mit dem Handy scannen"] })] })), stand && (_jsxs("figure", { children: [_jsx(QrCode, { text: navigationsLinks(stand.lat, stand.lng).google, groesse: 110, titel: "Navigation zum Stand" }), _jsxs("figcaption", { children: ["Navigation zu ", _jsx("strong", { children: "deinem Stand" }), _jsx("br", {}), "QR-Code mit dem Handy scannen"] })] }))] })), jagd.einladungstext && _jsx("p", { className: "text", children: jagd.einladungstext }), hinweise.trim() && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Hinweise" }), _jsx("p", { className: "text", children: hinweise })] })), rettung.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Rettungspunkte" }), _jsx("ul", { style: { margin: '4px 0', paddingLeft: 20 }, children: rettung.map((r) => (_jsxs("li", { children: [_jsx("strong", { children: r.name }), r.bemerkung ? ` – ${r.bemerkung}` : '', " ", _jsxs("small", { children: ["(", r.lat.toFixed(5), ", ", r.lng.toFixed(5), ")"] })] }, r.id))) })] })), punkte.length > 0 && _jsx(DruckKarte, { punkte: punkte, breiteMm: 186, hoeheMm: 82, mindestBreiteM: 700, pflichtLabels: true, alt: "Luftbild mit Treffpunkt, St\u00E4nden und Rettungspunkten" })] }));
}
// Organisator: allgemein, je Teilnehmer oder alle Zusagen
export function TeilnehmerInfoDruck({ jagd, leitung, rettung, boecke, staende, tn, onZu }) {
    const [hinweise, setHinweise] = useState(STANDARD_HINWEIS);
    const [fuer, setFuer] = useState(''); // '' = allgemein, 'alle' = je Zusage eine Seite, sonst Teilnehmer-ID
    const adresse = useAdresse(jagd.treffpunkt_lat, jagd.treffpunkt_lng);
    const zusagen = useMemo(() => tn.filter((t) => t.status === 'zugesagt' && t.aktiv).sort((a, b) => a.name.localeCompare(b.name, 'de')), [tn]);
    const info = useMemo(() => jagdInfo(jagd), [jagd]);
    const seiten = fuer === 'alle' ? zusagen : fuer ? [tn.find((t) => t.id === fuer) ?? null] : [null];
    return (_jsx(Druckrahmen, { querformat: false, onZu: onZu, leiste: _jsxs(_Fragment, { children: [_jsxs("label", { className: "bj-druck-hinweise", style: { flex: '0 1 260px' }, children: ["Ausgabe f\u00FCr", _jsxs("select", { value: fuer, onChange: (e) => setFuer(e.target.value), children: [_jsx("option", { value: "", children: "Allgemein (ohne Stand)" }), zusagen.length > 0 && _jsx("option", { value: "alle", children: "Alle Zusagen \u2013 eine Seite je Teilnehmer" }), zusagen.map((t) => (_jsx("option", { value: t.id, children: t.name }, t.id)))] })] }), _jsxs("label", { className: "bj-druck-hinweise", children: ["Hinweise (anpassbar)", _jsx("textarea", { value: hinweise, onChange: (e) => setHinweise(e.target.value), rows: 4 })] })] }), children: seiten.map((t, i) => {
            const a = t?.ansteller_id ? tn.find((x) => x.id === t.ansteller_id) : undefined;
            return (_jsx(InfoSeite, { jagd: info, tn: t ? tnInfo(t) : null, stand: t?.zugeordnete_einrichtung_id ? staende.find((e) => e.id === t.zugeordnete_einrichtung_id) : undefined, boecke: boecke, rettung: rettung, leitung: leitung, ansteller: a ? { name: a.name, telefon: a.telefon } : null, hinweise: hinweise, adresse: adresse, folge: i > 0 }, t?.id ?? 'allgemein'));
        }) }));
}
// Teilnehmer (ohne Konto): dieselbe Anstellinformation für die eigene Zusage
export function TeilnehmerSelbstDruck({ jagd, tn, stand, boecke, rettung, leitung, ansteller, onZu }) {
    const adresse = useAdresse(jagd.lat, jagd.lng);
    return (_jsx(Druckrahmen, { querformat: false, onZu: onZu, children: _jsx(InfoSeite, { jagd: jagd, tn: tn, stand: stand, boecke: boecke, rettung: rettung, leitung: leitung, ansteller: ansteller, hinweise: STANDARD_HINWEIS, adresse: adresse, folge: false }) }));
}
const STATUSTEXT = { eingeladen: 'offen', zugesagt: 'zugesagt', abgesagt: 'abgesagt' };
export function TeilnehmerListeDruck({ jagd, tn, standName, onZu }) {
    const [filter, setFilter] = useState('zugesagt');
    const [sort, setSort] = useState('name');
    const liste = useMemo(() => {
        const l = tn.filter((t) => filter === 'alle' || t.status === filter);
        return [...l].sort((a, b) => (sort === 'status' ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name, 'de') : a.name.localeCompare(b.name, 'de')));
    }, [tn, filter, sort]);
    const zu = liste.filter((t) => t.status === 'zugesagt');
    const summe = {
        zusagen: zu.length,
        hunde: zu.filter((t) => t.hat_hund).length,
        plaetze: zu.reduce((s, t) => s + (t.auto_vorhanden ? t.mitfahrplaetze ?? 0 : 0), 0),
        hege: jagd.hegebeitrag_aktiv ? zu.length * Number(jagd.hegebeitrag_betrag ?? 0) : 0,
    };
    const gruppiert = tn.some((t) => t.ist_ansteller);
    const spalten = 10 + (jagd.schuesseltreiben ? 1 : 0) + (jagd.hegebeitrag_aktiv ? 1 : 0);
    const zeile = (t) => (_jsxs("tr", { children: [_jsx("td", { children: t.name }), _jsx("td", { children: t.anschrift ?? '' }), _jsx("td", { children: t.email }), _jsx("td", { children: t.telefon ?? '' }), _jsx("td", { children: STATUSTEXT[t.status] ?? t.status }), _jsx("td", { children: standName(t.zugeordnete_einrichtung_id) }), _jsx("td", { children: ja(t.hat_hund) }), _jsx("td", { children: ja(t.hat_hornblaeser) }), _jsx("td", { children: ja(t.auto_vorhanden) }), _jsx("td", { children: t.auto_vorhanden ? t.mitfahrplaetze ?? 0 : '' }), jagd.schuesseltreiben && _jsx("td", { children: ja(t.schuesseltreiben_teilnahme) }), jagd.hegebeitrag_aktiv && _jsx("td", { children: t.status === 'zugesagt' ? Number(jagd.hegebeitrag_betrag ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '' })] }, t.id));
    const ja = (b) => (b ? 'ja' : '–');
    const stand = new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    return (_jsxs(Druckrahmen, { querformat: true, onZu: onZu, leiste: _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Status", ' ', _jsxs("select", { value: filter, onChange: (e) => setFilter(e.target.value), children: [_jsx("option", { value: "alle", children: "Alle" }), _jsx("option", { value: "zugesagt", children: "Zugesagt" }), _jsx("option", { value: "eingeladen", children: "Offen" }), _jsx("option", { value: "abgesagt", children: "Abgesagt" })] })] }), _jsxs("label", { children: ["Sortierung", ' ', _jsxs("select", { value: sort, onChange: (e) => setSort(e.target.value), children: [_jsx("option", { value: "name", children: "Name" }), _jsx("option", { value: "status", children: "Status, dann Name" })] })] })] }), children: [_jsxs("h1", { style: { fontSize: '1.3rem' }, children: ["Teilnehmerliste \u00B7 ", jagd.titel] }), _jsxs("p", { className: "art", children: [jagd.art, " \u00B7 ", datumDE(jagd.datum), jagd.uhrzeit ? `, ${jagd.uhrzeit.slice(0, 5)} Uhr` : '', " \u00B7 Stand ", stand] }), _jsxs("table", { className: "bj-druck-liste", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Anschrift" }), _jsx("th", { children: "E-Mail" }), _jsx("th", { children: "Telefon" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Stand" }), _jsx("th", { children: "Hund" }), _jsx("th", { children: "Horn" }), _jsx("th", { children: "Auto" }), _jsx("th", { children: "Pl\u00E4tze" }), jagd.schuesseltreiben && _jsx("th", { children: "Sch\u00FCsseltr." }), jagd.hegebeitrag_aktiv && _jsx("th", { children: "Hegebeitrag" })] }) }), _jsxs("tbody", { children: [!gruppiert && liste.map((t) => zeile(t)), gruppiert &&
                                nachAnstellern(liste).map((g) => (_jsxs(Fragment, { children: [_jsx("tr", { className: "gruppe", children: _jsx("td", { colSpan: spalten, children: g.ansteller ? `Gruppe ${g.ansteller.name}${g.ansteller.telefon ? ` · Tel. ${g.ansteller.telefon}` : ''}` : 'Ohne Gruppe' }) }), g.ansteller && zeile(g.ansteller), g.mitglieder.map((t) => zeile(t))] }, g.ansteller?.id ?? 'ohne')))] }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 4, children: _jsx("strong", { children: "Summe (Zusagen in der Ansicht)" }) }), _jsx("td", { children: _jsx("strong", { children: summe.zusagen }) }), _jsx("td", {}), _jsx("td", { children: _jsx("strong", { children: summe.hunde }) }), _jsx("td", { colSpan: 2 }), _jsx("td", { children: _jsx("strong", { children: summe.plaetze }) }), jagd.schuesseltreiben && _jsx("td", { children: _jsx("strong", { children: zu.filter((t) => t.schuesseltreiben_teilnahme).length }) }), jagd.hegebeitrag_aktiv && _jsx("td", { children: _jsx("strong", { children: summe.hege.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }) })] }) })] }), _jsx("small", { className: "art", children: "Einladungscodes sind bewusst nicht aufgef\u00FChrt." })] }));
}
// ---------- Jagdtag-Mappe (A4 quer) ----------
const Haken = ({ an }) => _jsx("span", { className: `bj-druck-haken ${an ? 'an' : ''}`, "aria-label": an ? 'ja' : 'offen' });
export function JagdtagMappeDruck({ jagd, tn, leitung, rettung, staende, standName, onZu }) {
    const [detail, setDetail] = useState(true);
    const [anhang, setAnhang] = useState(true);
    const adresse = useAdresse(jagd.treffpunkt_lat, jagd.treffpunkt_lng);
    const zu = useMemo(() => tn.filter((t) => t.status === 'zugesagt' && t.aktiv), [tn]);
    const gruppiert = zu.some((t) => t.ist_ansteller);
    const boecke = useMemo(() => staende.filter((e) => e.typ === 'drueckjagdbock'), [staende]);
    const inhaber = (eid) => zu.find((t) => t.zugeordnete_einrichtung_id === eid);
    const hatTp = jagd.treffpunkt_lng != null && jagd.treffpunkt_lat != null;
    const sonst = useMemo(() => [
        ...(hatTp ? [{ id: 'tp', lng: jagd.treffpunkt_lng, lat: jagd.treffpunkt_lat, art: 'treffpunkt', label: 'Treffpunkt' }] : []),
        ...rettung.map((r) => ({ id: `r${r.id}`, lng: r.lng, lat: r.lat, art: 'rettung', label: r.name })),
    ], [hatTp, jagd.treffpunkt_lng, jagd.treffpunkt_lat, rettung]);
    const standPunkt = (e, mitName) => {
        const t = inhaber(e.id);
        return { id: `b${e.id}`, lng: e.lng, lat: e.lat, art: t ? 'belegt' : 'frei', label: standLabel(e), label2: mitName && t ? t.name : undefined };
    };
    const uebersicht = useMemo(() => [...sonst, ...boecke.map((e) => standPunkt(e, false))], [sonst, boecke, zu]); // eslint-disable-line react-hooks/exhaustive-deps
    const blaetter = useMemo(() => {
        return teilePunkte(boecke, 8).map((gruppe) => {
            const xs = gruppe.map((e) => e.lng);
            const ys = gruppe.map((e) => e.lat);
            const rand = 0.0015;
            const nah = sonst.filter((p) => p.lng >= Math.min(...xs) - rand && p.lng <= Math.max(...xs) + rand && p.lat >= Math.min(...ys) - rand && p.lat <= Math.max(...ys) + rand);
            return [...nah, ...gruppe.map((e) => standPunkt(e, true))];
        });
    }, [boecke, sonst, zu]); // eslint-disable-line react-hooks/exhaustive-deps
    const gruppenFuerListe = gruppiert ? nachAnstellern(zu) : [{ ansteller: null, mitglieder: [...zu].sort((a, b) => a.name.localeCompare(b.name, 'de')) }];
    const ja = (b) => (b ? 'ja' : '–');
    const zeile = (t) => (_jsxs("tr", { children: [_jsxs("td", { children: [t.name, t.ist_ansteller ? ' (Ansteller)' : ''] }), _jsx("td", { children: t.anschrift ?? '' }), _jsx("td", { children: t.telefon ?? '' }), _jsx("td", { children: t.email }), _jsx("td", { children: standName(t.zugeordnete_einrichtung_id) }), _jsx("td", { children: ja(t.hat_hund) }), _jsx("td", { children: ja(t.hat_hornblaeser) }), _jsx("td", { children: t.auto_vorhanden ? `ja, ${t.mitfahrplaetze ?? 0} Pl.` : '–' }), jagd.schuesseltreiben && _jsx("td", { children: ja(t.schuesseltreiben_teilnahme) }), jagd.hegebeitrag_aktiv && _jsx("td", { style: { textAlign: 'center' }, children: _jsx(Haken, { an: false }) }), jagd.schuesseltreiben && _jsx("td", { style: { textAlign: 'center' }, children: _jsx(Haken, { an: false }) }), _jsx("td", { style: { textAlign: 'center' }, children: _jsx(Haken, { an: false }) })] }, t.id));
    const spalten = 9 + (jagd.hegebeitrag_aktiv ? 1 : 0) + (jagd.schuesseltreiben ? 2 : 0);
    const gesamtZaehler = { zu: zu.length, hunde: zu.filter((t) => t.hat_hund).length, horn: zu.filter((t) => t.hat_hornblaeser).length };
    const ansteller = zu.filter((t) => t.ist_ansteller);
    return (_jsxs(Druckrahmen, { querformat: true, onZu: onZu, leiste: _jsxs(_Fragment, { children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: detail, onChange: (e) => setDetail(e.target.checked) }), " Detailkarten"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: anhang, onChange: (e) => setAnhang(e.target.checked) }), " Anstellerlisten als Anhang"] })] }), children: [_jsxs("section", { className: "bj-druck-seite quer", children: [_jsxs("h1", { children: ["Jagdtag-Mappe \u00B7 ", jagd.titel] }), _jsxs("p", { className: "art", children: [jagd.art, " \u00B7 ", zeitText(jagd)] }), _jsx("table", { className: "bj-druck-tabelle", children: _jsxs("tbody", { children: [hatTp && _jsxs("tr", { children: [_jsx("th", { children: "Treffpunkt" }), _jsxs("td", { children: [adresse ? `${adresse} · ` : '', _jsxs("small", { children: [jagd.treffpunkt_lat.toFixed(5), ", ", jagd.treffpunkt_lng.toFixed(5)] })] })] }), _jsxs("tr", { children: [_jsx("th", { children: "Jagdleitung" }), _jsx("td", { children: leitung.length === 0 ? '–' : leitung.map((l, i) => (_jsxs("span", { children: [i > 0 && _jsx("br", {}), _jsx("strong", { children: l.name }), l.funktion ? ` (${l.funktion})` : '', tel(l.telefon)] }, i))) })] }), _jsxs("tr", { children: [_jsx("th", { children: "Teilnehmer" }), _jsxs("td", { children: [gesamtZaehler.zu, " Zusagen \u00B7 ", gesamtZaehler.hunde, " Hunde \u00B7 ", gesamtZaehler.horn, " Hornbl\u00E4ser"] })] })] }) }), jagd.info_jagdleitung && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "klein", children: "Infos f\u00FCr die Jagdleitung" }), _jsx("div", { className: "bj-druck-kasten", children: jagd.info_jagdleitung })] })), _jsxs("h2", { className: "klein", children: ["Teilnehmer", gruppiert ? ' nach Anstellergruppen' : ''] }), _jsxs("table", { className: "bj-druck-liste", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Anschrift" }), _jsx("th", { children: "Telefon" }), _jsx("th", { children: "E-Mail" }), _jsx("th", { children: "Stand" }), _jsx("th", { children: "Hund" }), _jsx("th", { children: "Horn" }), _jsx("th", { children: "Auto" }), jagd.schuesseltreiben && _jsx("th", { children: "Sch\u00FCsseltr." }), jagd.hegebeitrag_aktiv && _jsx("th", { children: "Hege bezahlt" }), jagd.schuesseltreiben && _jsx("th", { children: "Sch\u00FCsseltr. teilgen." }), _jsx("th", { children: "bei Ansprache da" })] }) }), _jsx("tbody", { children: gruppenFuerListe.map((g) => (_jsxs(Fragment, { children: [gruppiert && (_jsx("tr", { className: "gruppe", children: _jsx("td", { colSpan: spalten + 1, children: g.ansteller ? `Gruppe ${g.ansteller.name}${g.ansteller.telefon ? ` · Tel. ${g.ansteller.telefon}` : ''}` : 'Ohne Gruppe' }) })), g.ansteller && zeile(g.ansteller), g.mitglieder.map((t) => zeile(t))] }, g.ansteller?.id ?? 'ohne'))) })] }), _jsx("small", { className: "art", children: "Leere K\u00E4stchen zum Abhaken vor Ort; gespeicherte Angaben erscheinen angehakt." })] }), (uebersicht.length > 0) && (_jsxs("section", { className: "bj-druck-seite quer", children: [_jsxs("h1", { style: { fontSize: '1.2rem' }, children: ["\u00DCbersichtskarte \u00B7 ", jagd.titel] }), _jsx(DruckKarte, { punkte: uebersicht, breiteMm: 273, hoeheMm: 158, mindestBreiteM: 800, pflichtLabels: false, alt: "\u00DCbersichtskarte aller St\u00E4nde" })] })), detail &&
                blaetter.map((punkte, i) => (_jsxs("section", { className: "bj-druck-seite quer", children: [_jsxs("h1", { style: { fontSize: '1.2rem' }, children: ["Detailkarte ", i + 1, " von ", blaetter.length, " \u00B7 ", jagd.titel] }), _jsx(DruckKarte, { punkte: punkte, breiteMm: 273, hoeheMm: 158, mindestBreiteM: 450, pflichtLabels: true, alt: `Detailkarte ${i + 1}` })] }, i))), anhang &&
                ansteller.map((a) => {
                    const gruppe = zu.filter((t) => t.ansteller_id === a.id).sort((x, y) => x.name.localeCompare(y.name, 'de'));
                    const uebrige = zu.filter((t) => t.id !== a.id && t.ansteller_id !== a.id).sort((x, y) => x.name.localeCompare(y.name, 'de'));
                    const kurz = (t) => (_jsxs("tr", { children: [_jsx("td", { children: t.name }), _jsx("td", { children: standName(t.zugeordnete_einrichtung_id) }), _jsx("td", { children: t.telefon ?? '' })] }, t.id));
                    return (_jsxs("section", { className: "bj-druck-seite quer", children: [_jsxs("h1", { style: { fontSize: '1.3rem' }, children: ["Anstellerliste \u00B7 ", a.name] }), _jsxs("p", { className: "art", children: [jagd.titel, " \u00B7 ", zeitText(jagd), a.telefon ? ` · Tel. ${a.telefon}` : ''] }), _jsxs("table", { className: "bj-druck-liste", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Stand" }), _jsx("th", { children: "Telefon" })] }) }), _jsxs("tbody", { children: [_jsx("tr", { className: "gruppe", children: _jsx("td", { colSpan: 3, children: "Deine Gruppe" }) }), kurz(a), gruppe.map(kurz), uebrige.length > 0 && _jsx("tr", { className: "gruppe", children: _jsx("td", { colSpan: 3, children: "\u00DCbrige Teilnehmer" }) }), uebrige.map(kurz)] })] })] }, a.id));
                })] }));
}
