import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useMitglieder, useWildarten, useZonen, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, datumZeitDE, letzteJagdjahre, lokalDatumZeit } from '../../lib/zeit';
import { aktuellePosition, punktEWKT } from '../../lib/geo';
import { PositionWaehlen } from '../../components/PositionWaehlen';
import { jagdzeitWarnung, useJagdzeiten } from '../../lib/jagdzeiten';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, Zeile, WildartOptionen } from '../../components/ui';
import { Symbol } from '../../components/symbole';
// Fangfähige Arten (Fang melden)
const FANG_WILDARTEN = ['fuchs', 'waschbaer', 'dachs', 'marderhund', 'steinmarder', 'baummarder', 'iltis', 'hermelin', 'mink', 'nutria'];
export function Abschuesse({ k, unterpfad = [] }) {
    const wildarten = useWildarten();
    const { zonen } = useZonen(k.revierId);
    const mitglieder = useMitglieder(k.revierId);
    const [jahr, setJahr] = useState(aktuellesJagdjahr());
    const [liste, setListe] = useState([]);
    const [bearbeiten, setBearbeiten] = useState(unterpfad[0] === 'fang' ? 'neu' : null);
    const startArt = unterpfad[0] === 'fang' ? 'fang' : 'abschuss';
    const falleVor = unterpfad[0] === 'fang' ? (unterpfad[1] ?? '') : ''; // Falle aus dem Einrichtungs-Sheet vorbelegt
    const [fehler, setFehler] = useState(null);
    const laden = useCallback(async () => {
        const { data, error } = await supabase
            .from('abschuesse')
            .select('id, erlegt_am, wildart_id, geschlecht, altersklasse, gewicht_kg, zone_id, erleger_id, erfasst_von, bemerkung, art, einrichtung_id, fang_ergebnis, fang_zustand, erleger_name, bewegungsjagd_id, fallwild_ursache')
            .eq('revier_id', k.revierId)
            .is('geloescht_am', null)
            .gte('erlegt_am', `${jahr.von}T00:00:00`)
            .lte('erlegt_am', `${jahr.bis}T23:59:59`)
            .order('erlegt_am', { ascending: false });
        if (error)
            setFehler(fehlertext(error));
        setListe(data ?? []);
    }, [k.revierId, jahr]);
    useEffect(() => {
        void laden();
    }, [laden]);
    // Strecke = Abschüsse + tatsächlich gefangene Tiere
    const zaehltZurStrecke = (x) => x.art === 'abschuss' || (x.art === 'fang' && x.fang_ergebnis === 'gefangen');
    const strecke = useMemo(() => {
        const m = new Map();
        for (const a of liste.filter((x) => zaehltZurStrecke(x) && x.wildart_id)) {
            const s = m.get(a.wildart_id) ?? { gesamt: 0, m: 0, w: 0 };
            s.gesamt++;
            if (a.geschlecht === 'maennlich')
                s.m++;
            if (a.geschlecht === 'weiblich')
                s.w++;
            m.set(a.wildart_id, s);
        }
        return [...m.entries()].sort((a, b) => b[1].gesamt - a[1].gesamt);
    }, [liste]);
    const name = (id) => mitglieder.find((m) => m.user_id === id)?.name ?? '–';
    const zone = (id) => zonen.find((z) => z.id === id)?.name;
    if (bearbeiten) {
        return (_jsx(AbschussFormular, { k: k, vorlage: bearbeiten === 'neu' ? null : bearbeiten, startArt: startArt, falleVor: falleVor, onFertig: async () => {
                setBearbeiten(null);
                await laden();
            } }));
    }
    return (_jsxs(Seite, { titel: "Strecke", untertitel: `Jagdjahr ${jahr.label} · ${liste.filter(zaehltZurStrecke).length} Stück (Abschüsse und Fänge)${liste.some((x) => x.art === 'fang') ? ` · ${liste.filter((x) => x.art === 'fang').length} Fangmeldungen` : ''}${liste.some((x) => x.art === 'fallwild') ? ` · ${liste.filter((x) => x.art === 'fallwild').length} Fallwild` : ''}`, aktion: _jsx(Knopf, { onClick: () => setBearbeiten('neu'), children: "+ Erfassen" }), children: [_jsxs("label", { className: "filter", children: [_jsx("span", { children: "Jagdjahr" }), _jsx("select", { value: jahr.start, onChange: (e) => setJahr(letzteJagdjahre().find((j) => j.start === Number(e.target.value)) ?? jahr), children: letzteJagdjahre().map((j) => (_jsx("option", { value: j.start, children: j.label }, j.start))) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), strecke.length > 0 && (_jsx(Gruppe, { titel: "Strecke", children: strecke.map(([id, s]) => (_jsx(Zeile, { label: wildartName(wildarten, id), wert: `${s.gesamt} (♂ ${s.m} · ♀ ${s.w})` }, id))) })), _jsxs(Gruppe, { titel: "Einzeleintr\u00E4ge", children: [liste.length === 0 && _jsx(Zeile, { label: "Keine Eintr\u00E4ge in diesem Jagdjahr" }), liste.map((a) => (_jsxs("button", { className: "zeile zeile-knopf", onClick: () => setBearbeiten(a), children: [_jsxs("span", { className: "zeile-label", children: [a.art === 'fang' ? `Fang · ${a.fang_ergebnis === 'leer' ? 'leer' : `${a.wildart_id ? wildartName(wildarten, a.wildart_id) : ''}${a.fang_ergebnis === 'fehlfang' ? ' (Fehlfang)' : a.fang_zustand ? ` (${a.fang_zustand})` : ''}`}` : `${a.art === 'fallwild' ? 'Fallwild · ' : ''}${wildartName(wildarten, a.wildart_id ?? '')} ${GESCHLECHTER.find((g) => g.wert === a.geschlecht)?.kurz}`, a.altersklasse ? ` · ${a.altersklasse}` : '', _jsxs("small", { children: [datumZeitDE(a.erlegt_am), " \u00B7 ", a.erleger_id ? name(a.erleger_id) : (a.erleger_name ?? name(a.erleger_id)), a.bewegungsjagd_id ? ' · Bewegungsjagd' : '', zone(a.zone_id) ? ` · ${zone(a.zone_id)}` : '', a.gewicht_kg ? ` · ${a.gewicht_kg.toLocaleString('de-DE')} kg` : ''] })] }), _jsx("span", { className: "zeile-pfeil", "aria-hidden": "true", children: "\u203A" })] }, a.id)))] })] }));
}
function AbschussFormular({ k, vorlage, startArt, falleVor = '', onFertig }) {
    const wildarten = useWildarten();
    const { zonen } = useZonen(k.revierId);
    const mitglieder = useMitglieder(k.revierId);
    const [art, setArt] = useState(vorlage?.art ?? startArt);
    const [ursache, setUrsache] = useState(vorlage?.fallwild_ursache ?? 'verkehr');
    const fallwild = art === 'fallwild';
    const [falleId, setFalleId] = useState(vorlage?.einrichtung_id ?? falleVor);
    const [ergebnis, setErgebnis] = useState(vorlage?.fang_ergebnis ?? 'gefangen');
    const [zustand, setZustand] = useState(vorlage?.fang_zustand ?? 'tot');
    const [fallen, setFallen] = useState([]);
    useEffect(() => {
        void supabase.from('einrichtungen').select('id, name').eq('revier_id', k.revierId).eq('typ', 'falle').is('geloescht_am', null).order('name').then(({ data }) => setFallen(data ?? []));
    }, [k.revierId]);
    const [wildartId, setWildartId] = useState(vorlage?.wildart_id ?? ((vorlage?.art ?? startArt) === 'fang' ? FANG_WILDARTEN[0] : 'rehwild'));
    useEffect(() => {
        if (art === 'fang' && !FANG_WILDARTEN.includes(wildartId))
            setWildartId(FANG_WILDARTEN[0]);
    }, [art, wildartId]);
    const [geschlecht, setGeschlecht] = useState(vorlage?.geschlecht ?? 'unbekannt');
    const [altersklasse, setAltersklasse] = useState(vorlage?.altersklasse ?? '');
    const [zeitpunkt, setZeitpunkt] = useState(vorlage ? lokalDatumZeit(new Date(vorlage.erlegt_am)) : lokalDatumZeit());
    // Nur Hinweis, keine Sperre: Wildart und Datum gegen die hinterlegten Jagdzeiten halten
    const { zeilen: jagdzeiten } = useJagdzeiten(k.bundesland);
    const jzWarnung = fallwild || (art === 'fang' && ergebnis === 'leer') ? null : jagdzeitWarnung(jagdzeiten, wildartId, new Date(zeitpunkt.length >= 10 ? zeitpunkt : Date.now()));
    const [gewicht, setGewicht] = useState(vorlage?.gewicht_kg ? String(vorlage.gewicht_kg).replace('.', ',') : '');
    const [zoneId, setZoneId] = useState(vorlage?.zone_id ?? '');
    const [erlegerId, setErlegerId] = useState(vorlage?.erleger_id ?? k.userId);
    const [bemerkung, setBemerkung] = useState(vorlage?.bemerkung ?? '');
    const [position, setPosition] = useState(null);
    const [ortStatus, setOrtStatus] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [speichert, setSpeichert] = useState(false);
    const klassen = wildarten.find((w) => w.id === wildartId)?.altersklassen ?? [];
    const darfLoeschen = vorlage && (k.istInhaber || vorlage.erfasst_von === k.userId);
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
        const kg = gewicht.trim() ? Number(gewicht.replace(',', '.')) : null;
        if (kg !== null && (!Number.isFinite(kg) || kg <= 0)) {
            setFehler('Bitte ein gültiges Gewicht angeben.');
            return;
        }
        if (art === 'fang' && !falleId) {
            setFehler('Bitte die Falle auswählen.');
            return;
        }
        setSpeichert(true);
        const fang = art === 'fang';
        const daten = {
            revier_id: k.revierId,
            art,
            wildart_id: fang && ergebnis === 'leer' ? null : wildartId,
            geschlecht: fang ? 'unbekannt' : geschlecht,
            altersklasse: fang ? null : altersklasse || null,
            erlegt_am: new Date(zeitpunkt).toISOString(),
            gewicht_kg: fang ? null : kg,
            zone_id: zoneId || null,
            erleger_id: fang ? k.userId : fallwild ? null : erlegerId || null,
            fallwild_ursache: fallwild ? ursache : null,
            ...(fallwild ? { erleger_name: null, erleger_teilnehmer_id: null } : {}),
            einrichtung_id: fang ? falleId : null,
            fang_ergebnis: fang ? ergebnis : null,
            fang_zustand: fang && ergebnis === 'gefangen' ? zustand : null,
            bemerkung: bemerkung.trim() || null,
            ...(position ? { geom: punktEWKT(position.lon, position.lat) } : {}),
        };
        const { error } = vorlage
            ? await supabase.from('abschuesse').update(daten).eq('id', vorlage.id)
            : await supabase.from('abschuesse').insert(daten);
        setSpeichert(false);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    async function loeschen() {
        if (!vorlage || !window.confirm('Diesen Abschuss löschen?'))
            return;
        const { error } = await supabase.from('abschuesse').delete().eq('id', vorlage.id);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    return (_jsx(Seite, { titel: `${art === 'fang' ? 'Fang' : art === 'fallwild' ? 'Fallwild' : 'Abschuss'} ${vorlage ? 'bearbeiten' : 'erfassen'}`, zurueck: () => void onFertig(), children: _jsxs("form", { onSubmit: speichern, children: [_jsx(Segmente, { label: "Art", wert: art, onAendern: setArt, optionen: [{ wert: 'abschuss', label: 'Abschuss' }, { wert: 'fallwild', label: 'Fallwild' }, { wert: 'fang', label: 'Fang' }] }), art === 'fang' ? (_jsxs(Gruppe, { children: [_jsxs(Auswahl, { label: "Falle", required: true, value: falleId, onChange: (e) => setFalleId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013 bitte w\u00E4hlen \u2013" }), fallen.map((f) => (_jsx("option", { value: f.id, children: f.name ?? 'Falle ohne Namen' }, f.id)))] }), fallen.length === 0 && _jsx(Leer, { children: "Noch keine Einrichtung vom Typ \u201EFalle\u201C angelegt (Karte \u2192 WTE \u2192 Einrichtung anlegen)." }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Ergebnis" }), _jsx(Segmente, { label: "Ergebnis", wert: ergebnis, onAendern: setErgebnis, optionen: [{ wert: 'gefangen', label: 'Gefangen' }, { wert: 'leer', label: 'Leer' }, { wert: 'fehlfang', label: 'Fehlfang' }] })] }), ergebnis !== 'leer' && (_jsx(Auswahl, { label: "Wildart", value: wildartId, onChange: (e) => setWildartId(e.target.value), children: FANG_WILDARTEN.map((id) => (_jsx("option", { value: id, children: wildartName(wildarten, id) }, id))) })), ergebnis === 'gefangen' && (_jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Zustand" }), _jsx(Segmente, { label: "Zustand", wert: zustand, onAendern: setZustand, optionen: [{ wert: 'lebend', label: 'Lebend' }, { wert: 'tot', label: 'Tot' }] })] })), _jsx(Feld, { label: "Kontrolle am", type: "datetime-local", required: true, value: zeitpunkt, onChange: (e) => setZeitpunkt(e.target.value) })] })) : (_jsxs(Gruppe, { children: [_jsx(Auswahl, { label: "Wildart", value: wildartId, onChange: (e) => {
                                setWildartId(e.target.value);
                                setAltersklasse('');
                            }, children: _jsx(WildartOptionen, { wildarten: wildarten }) }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Geschlecht" }), _jsx(Segmente, { label: "Geschlecht", wert: geschlecht, onAendern: setGeschlecht, optionen: GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.label })) })] }), klassen.length > 0 ? (_jsxs(Auswahl, { label: "Altersklasse", value: altersklasse, onChange: (e) => setAltersklasse(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), klassen.map((a) => (_jsx("option", { value: a, children: a }, a)))] })) : (_jsx(Feld, { label: "Altersklasse", placeholder: "optional", value: altersklasse, onChange: (e) => setAltersklasse(e.target.value) })), fallwild && (_jsxs(Auswahl, { label: "Ursache", value: ursache, onChange: (e) => setUrsache(e.target.value), children: [_jsx("option", { value: "verkehr", children: "Verkehr" }), _jsx("option", { value: "krankheit", children: "Krankheit" }), _jsx("option", { value: "sonstiges", children: "Sonstiges" })] })), _jsx(Feld, { label: fallwild ? 'Fundzeitpunkt' : 'Erlegt am', type: "datetime-local", required: true, value: zeitpunkt, onChange: (e) => setZeitpunkt(e.target.value) }), _jsx(Feld, { label: "Gewicht (kg)", inputMode: "decimal", placeholder: "aufgebrochen, optional", value: gewicht, onChange: (e) => setGewicht(e.target.value) })] })), _jsxs(Gruppe, { children: [art === 'abschuss' && (_jsxs(Auswahl, { label: "Erleger", value: erlegerId, onChange: (e) => setErlegerId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), mitglieder.map((m) => (_jsx("option", { value: m.user_id, children: m.name }, m.user_id)))] })), _jsxs(Auswahl, { label: "Zone", value: zoneId, onChange: (e) => setZoneId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), zonen.map((z) => (_jsx("option", { value: z.id, children: z.name }, z.id)))] }), _jsx(Feld, { label: "Bemerkung", value: bemerkung, onChange: (e) => setBemerkung(e.target.value) })] }), _jsxs(Knopf, { type: "button", variante: "sekundaer", onClick: ortUebernehmen, children: [_jsx(Symbol, { name: "position", className: "symbol klein" }), " Aktuelle Position als ", art === 'fang' ? 'Fangort' : fallwild ? 'Fundort' : 'Erlegeort'] }), _jsx(PositionWaehlen, { revierId: k.revierId, wert: position, onWaehlen: async (p) => {
                        setPosition(p);
                        const { data } = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: p.lon, p_lat: p.lat });
                        if (data)
                            setZoneId(data);
                        setOrtStatus(`${fallwild ? 'Fundort' : 'Erlegeort'} auf der Karte gewählt${data ? ', Zone automatisch gesetzt' : ''}`);
                    } }), ortStatus && _jsx(Leer, { children: ortStatus }), jzWarnung && _jsxs(Hinweis, { art: jzWarnung.art === 'warnung' ? 'warnung' : 'info', children: [jzWarnung.text, " (Hinweis, kein Speicherverbot \u2013 verbindlich ist die Landesverordnung.)"] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", disabled: speichert, children: speichert ? 'Speichern …' : 'Speichern' }), _jsx(Knopf, { type: "button", variante: "sekundaer", onClick: () => void onFertig(), children: "Abbrechen" }), darfLoeschen && (_jsx(Knopf, { type: "button", variante: "gefahr", onClick: loeschen, children: "Abschuss l\u00F6schen" }))] }) }));
}
