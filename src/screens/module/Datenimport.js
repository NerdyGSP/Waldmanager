import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { csvLesen, datumLesen, geschlechtLesen, normalisieren, textAusDatei, uhrzeitLesen, wildartFinden, zahlLesen } from '../../lib/csv';
import { useWildarten, useZonen, ZONENFARBEN } from '../../lib/stammdaten';
import { datumDE } from '../../lib/zeit';
import { Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, WildartOptionen } from '../../components/ui';
import { VorlageGruppe } from './ImportVorlage';
import { Geoimport } from './Geoimport';
import { GpsImport } from './GpsImport';
import { SitzungsdatenFormular } from './SitzungsdatenFormular';
import { alsSitzungsZeile, leereSitzungsdaten } from '../../lib/sitzungsdaten';
const FELDER = {
    zaehlung: [
        { schluessel: 'datum', label: 'Datum', pflicht: true, erkennung: /datum|date|tag|zaehldatum/ },
        { schluessel: 'wildart', label: 'Wildart', pflicht: true, erkennung: /wildart|art|tier|wild/ },
        { schluessel: 'anzahl', label: 'Anzahl', pflicht: true, erkennung: /anzahl|stueck|menge|summe|gezaehlt|zahl/ },
        { schluessel: 'zone', label: 'Zone', erkennung: /zone|flaeche|gebiet|bereich|schlag|abteilung/ },
        { schluessel: 'geschlecht', label: 'Geschlecht', erkennung: /geschlecht|sex/ },
        { schluessel: 'altersklasse', label: 'Altersklasse', erkennung: /alter|klasse/ },
        { schluessel: 'bemerkung', label: 'Bemerkung', erkennung: /bemerk|notiz|kommentar|info/ },
    ],
    abschuss: [
        { schluessel: 'datum', label: 'Datum', pflicht: true, erkennung: /datum|date|erlegt|tag|strecke/ },
        { schluessel: 'uhrzeit', label: 'Uhrzeit', erkennung: /uhrzeit|zeit|time/ },
        { schluessel: 'wildart', label: 'Wildart', pflicht: true, erkennung: /wildart|art|tier|wild/ },
        { schluessel: 'geschlecht', label: 'Geschlecht', erkennung: /geschlecht|sex/ },
        { schluessel: 'altersklasse', label: 'Altersklasse', erkennung: /alter|klasse/ },
        { schluessel: 'gewicht', label: 'Gewicht (kg)', erkennung: /gewicht|kg|aufbruch/ },
        { schluessel: 'zone', label: 'Zone', erkennung: /zone|flaeche|gebiet|bereich|revierteil/ },
        { schluessel: 'bemerkung', label: 'Bemerkung', erkennung: /bemerk|notiz|kommentar|info/ },
    ],
};
const VORLAGEN = {
    zaehlung: 'Datum;Wildart;Anzahl;Zone;Geschlecht;Altersklasse;Bemerkung\n14.03.2021;Rehwild;12;Feldmark Nord;;;Scheinwerferzählung\n14.03.2021;Schwarzwild;4;Feldmark Nord;;;\n',
    abschuss: 'Datum;Uhrzeit;Wildart;Geschlecht;Altersklasse;Gewicht;Zone;Bemerkung\n02.06.2021;05:40;Rehwild;männlich;Jährling;14,5;Feldmark Nord;\n',
};
const MAX_ZEILEN = 20000;
const SUMMENKOPF = /^(summe|gesamt|total|insgesamt|σ)\b/i;
const heute = () => new Date().toLocaleDateString('sv-SE');
const ZONE_UEBERSPRINGEN = '__skip';
const lokalISO = (datum, stunde, minute) => {
    const [j, m, t] = datum.split('-').map(Number);
    return new Date(j, m - 1, t, stunde ?? 12, minute ?? 0).toISOString();
};
const stuecke = (liste, n) => Array.from({ length: Math.ceil(liste.length / n) }, (_, i) => liste.slice(i * n, i * n + n));
export function Datenimport({ k }) {
    const wildarten = useWildarten();
    const { zonen, laden: zonenLaden } = useZonen(k.revierId);
    const [bereich, setBereich] = useState('csv');
    const [typ, setTyp] = useState('zaehlung');
    const [dateiname, setDateiname] = useState('');
    const [tabelle, setTabelle] = useState(null);
    const [zuordnung, setZuordnung] = useState({});
    const [artZuordnung, setArtZuordnung] = useState({});
    const [zonenAnlegen, setZonenAnlegen] = useState(false);
    const [zonenWahl, setZonenWahl] = useState({});
    const [sitz, setSitz] = useState(() => leereSitzungsdaten(heute()));
    const datum = sitz.datum;
    const [flModus, setFlModus] = useState('zonen');
    const [streckeKm, setStreckeKm] = useState('');
    const [mitte, setMitte] = useState(null);
    useEffect(() => {
        // Reviermitte für die Wetter-Vorauswahl
        void supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 1 }).then(({ data }) => {
            const m = data?.mitte?.coordinates;
            if (m && m.length >= 2)
                setMitte([m[0], m[1]]);
        });
    }, [k.revierId]);
    const [fehler, setFehler] = useState(null);
    const [meldung, setMeldung] = useState(null);
    const [laeuft, setLaeuft] = useState(false);
    const [gpsOffen, setGpsOffen] = useState(false);
    const kopf = tabelle?.[0] ?? [];
    // Matrixformat (Zeilen = Zonen, Spalten = Wildarten): mindestens zwei Spaltenköpfe sind Wildarten
    const matrix = typ === 'zaehlung' && kopf.slice(1).filter((h) => wildartFinden(h, wildarten)).length >= 2;
    function neuStart(t) {
        setTyp(t);
        setTabelle(null);
        setDateiname('');
        setZuordnung({});
        setArtZuordnung({});
        setZonenWahl({});
        setFehler(null);
        setMeldung(null);
    }
    async function dateiLesen(datei) {
        setFehler(null);
        setMeldung(null);
        try {
            const zeilen = csvLesen(textAusDatei(await datei.arrayBuffer()));
            if (zeilen.length < 2)
                throw new Error('Die Datei enthält keine Datenzeilen.');
            if (zeilen.length - 1 > MAX_ZEILEN)
                throw new Error(`Die Datei hat mehr als ${MAX_ZEILEN.toLocaleString('de-DE')} Zeilen – bitte in Teile aufteilen.`);
            setTabelle(zeilen);
            setDateiname(datei.name);
            // Spalten anhand der Überschriften vorschlagen
            const vorschlag = {};
            const belegt = new Set();
            for (const f of FELDER[typ]) {
                const i = zeilen[0].findIndex((h, idx) => !belegt.has(idx) && f.erkennung.test(normalisieren(h)));
                vorschlag[f.schluessel] = i;
                if (i >= 0)
                    belegt.add(i);
            }
            setZuordnung(vorschlag);
            setArtZuordnung({});
        }
        catch (err) {
            setTabelle(null);
            setFehler(fehlertext(err));
        }
    }
    const zelle = (z, feld) => {
        const i = zuordnung[feld] ?? -1;
        return i >= 0 ? (z[i] ?? '').trim() : '';
    };
    // Zeilen interpretieren
    const auswertung = useMemo(() => {
        const ok = [];
        const probleme = [];
        let nullzeilen = 0;
        if (!tabelle)
            return { ok, probleme, nullzeilen, fehlendePflicht: [] };
        if (matrix) {
            if (!datumLesen(datum))
                return { ok, probleme, nullzeilen, fehlendePflicht: ['Datum der Zählung'] };
            const spalten = tabelle[0].map((h, i) => ({ h: h.trim(), i })).filter((c) => c.i > 0 && c.h && !SUMMENKOPF.test(c.h));
            for (const [i, z] of tabelle.slice(1).entries()) {
                const zone = (z[0] ?? '').trim();
                if (!zone || SUMMENKOPF.test(zone))
                    continue; // leere Zeilen und Summenzeilen
                for (const c of spalten) {
                    const roh = (z[c.i] ?? '').trim();
                    if (!roh)
                        continue; // leer = 0
                    const a = zahlLesen(roh);
                    if (a === null || a < 0 || !Number.isInteger(a)) {
                        probleme.push(`Zeile ${i + 2}, „${c.h}“: Anzahl „${roh}“ ungültig`);
                        continue;
                    }
                    if (a === 0) {
                        nullzeilen++;
                        continue;
                    }
                    ok.push({ nr: i + 2, datum, stunde: null, minute: null, wildartRoh: c.h, anzahl: a, geschlecht: 'unbekannt', altersklasse: null, gewicht: null, zoneRoh: zone, bemerkung: null });
                }
            }
            return { ok, probleme, nullzeilen, fehlendePflicht: [] };
        }
        const fehlendePflicht = FELDER[typ].filter((f) => f.pflicht && (zuordnung[f.schluessel] ?? -1) < 0).map((f) => f.label);
        if (fehlendePflicht.length)
            return { ok, probleme, nullzeilen, fehlendePflicht };
        for (const [i, z] of tabelle.slice(1).entries()) {
            const nr = i + 2;
            const d = datumLesen(zelle(z, 'datum'));
            if (!d) {
                probleme.push(`Zeile ${nr}: Datum „${zelle(z, 'datum')}“ nicht lesbar`);
                continue;
            }
            const wildartRoh = zelle(z, 'wildart');
            if (!wildartRoh) {
                probleme.push(`Zeile ${nr}: keine Wildart`);
                continue;
            }
            let anzahl = 1;
            if (typ === 'zaehlung') {
                const a = zahlLesen(zelle(z, 'anzahl'));
                if (a === null || a < 0 || !Number.isInteger(a)) {
                    probleme.push(`Zeile ${nr}: Anzahl „${zelle(z, 'anzahl')}“ ungültig`);
                    continue;
                }
                if (a === 0) {
                    nullzeilen++;
                    continue;
                }
                anzahl = a;
            }
            const uhr = typ === 'abschuss' ? uhrzeitLesen(zelle(z, 'uhrzeit')) : null;
            const gewicht = typ === 'abschuss' ? zahlLesen(zelle(z, 'gewicht')) : null;
            ok.push({
                nr,
                datum: d.datum,
                stunde: uhr?.stunde ?? d.stunde,
                minute: uhr?.minute ?? d.minute,
                wildartRoh,
                anzahl,
                geschlecht: geschlechtLesen(zelle(z, 'geschlecht')),
                altersklasse: zelle(z, 'altersklasse') || null,
                gewicht: gewicht && gewicht > 0 ? gewicht : null,
                zoneRoh: zelle(z, 'zone'),
                bemerkung: zelle(z, 'bemerkung') || null,
            });
        }
        return { ok, probleme, nullzeilen, fehlendePflicht };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabelle, zuordnung, typ, matrix, datum]);
    // Wildart-Werte: automatisch erkannt oder manuell zugeordnet
    const artWerte = useMemo(() => {
        const m = new Map();
        for (const z of auswertung.ok) {
            const e = m.get(z.wildartRoh) ?? { anzahl: 0, id: wildartFinden(z.wildartRoh, wildarten) };
            e.anzahl++;
            m.set(z.wildartRoh, e);
        }
        return [...m.entries()].map(([roh, e]) => ({ roh, anzahl: e.anzahl, auto: e.id }));
    }, [auswertung.ok, wildarten]);
    const artFuer = (roh) => artWerte.find((a) => a.roh === roh)?.auto ?? (artZuordnung[roh] || null);
    const offeneArten = artWerte.filter((a) => !a.auto && !artZuordnung[a.roh]);
    const zonenWerte = useMemo(() => {
        const m = new Map();
        for (const z of auswertung.ok)
            if (z.zoneRoh)
                m.set(z.zoneRoh, (m.get(z.zoneRoh) ?? 0) + 1);
        return [...m.entries()].map(([roh, anzahl]) => ({ roh, anzahl, vorhanden: zonen.some((x) => normalisieren(x.name) === normalisieren(roh)) }));
    }, [auswertung.ok, zonen]);
    const unbekannteZonen = zonenWerte.filter((z) => !z.vorhanden);
    // Unbekannte Zonen: einer vorhandenen Zone zuordnen, neu anlegen, ohne Zone übernehmen (Liste) oder überspringen (Matrix)
    const wahlFuer = (roh) => zonenWahl[roh] ?? (matrix ? ZONE_UEBERSPRINGEN : '');
    const zoneUebersprungen = (roh) => !!roh && !zonen.some((x) => normalisieren(x.name) === normalisieren(roh)) && !zonenAnlegen && wahlFuer(roh) === ZONE_UEBERSPRINGEN;
    const importierbar = auswertung.ok.filter((z) => artFuer(z.wildartRoh) && !zoneUebersprungen(z.zoneRoh));
    const tage = useMemo(() => [...new Set(importierbar.map((z) => z.datum))].sort(), [importierbar]);
    const einzeltag = typ === 'zaehlung' && (matrix || tage.length === 1);
    const datumVon = importierbar.reduce((a, z) => (a === '' || z.datum < a ? z.datum : a), '');
    const datumBis = importierbar.reduce((a, z) => (z.datum > a ? z.datum : a), '');
    async function importieren() {
        setLaeuft(true);
        setFehler(null);
        setMeldung(null);
        try {
            // Zonen zuordnen (optional unbekannte neu anlegen)
            const zonenIds = new Map(zonen.map((z) => [normalisieren(z.name), z.id]));
            if (zonenAnlegen) {
                const neu = unbekannteZonen.filter((z) => !zonenWahl[z.roh] || zonenWahl[z.roh] === ZONE_UEBERSPRINGEN).map((z) => z.roh);
                for (const [i, name] of neu.entries()) {
                    if (zonenIds.has(normalisieren(name)))
                        continue;
                    const { data, error } = await supabase
                        .from('zonen')
                        .insert({ revier_id: k.revierId, name, sortierung: zonen.length + i, farbe: ZONENFARBEN[(zonen.length + i) % ZONENFARBEN.length] })
                        .select('id')
                        .single();
                    if (error)
                        throw error;
                    zonenIds.set(normalisieren(name), data.id);
                }
                await zonenLaden();
            }
            const zoneId = (roh) => {
                if (!roh)
                    return null;
                const gewaehlt = wahlFuer(roh);
                const vorhanden = zonenIds.get(normalisieren(roh));
                if (!vorhanden && gewaehlt && gewaehlt !== ZONE_UEBERSPRINGEN)
                    return gewaehlt;
                return vorhanden ?? null;
            };
            if (typ === 'zaehlung') {
                const marke = `CSV-Import ${dateiname}`;
                const nachDatum = new Map();
                for (const z of importierbar)
                    nachDatum.set(z.datum, [...(nachDatum.get(z.datum) ?? []), z]);
                const { data: vorhanden, error: e0 } = await supabase
                    .from('zaehlsitzungen')
                    .select('datum')
                    .eq('revier_id', k.revierId)
                    .like('bemerkung', `${marke.replace(/[%_\\]/g, '\\$&')}%`)
                    .is('geloescht_am', null)
                    .in('datum', [...nachDatum.keys()]);
                if (e0)
                    throw e0;
                const schonDa = new Set((vorhanden ?? []).map((x) => x.datum));
                const neueTage = [...nachDatum.keys()].filter((d) => !schonDa.has(d)).sort();
                let anzahlZaehlungen = 0;
                for (const tage of stuecke(neueTage, 100)) {
                    const { data: sitzungen, error } = await supabase
                        .from('zaehlsitzungen')
                        .insert(tage.map((datum) => {
                        // Flächenmodus gilt nur bei einer einzelnen Zählung; Strecke × 400 m = km × 40 ha (ohne Verschnitt an der Reviergrenze)
                        const km = flModus === 'strecke' ? Number(streckeKm.replace(',', '.')) : null;
                        const flaeche = km && km > 0 ? { flaechenmodus: 'strecke', streifenbreite_m: 400, strecke_km: km, flaeche_ha: Math.round(km * 40 * 100) / 100 } : {};
                        if (!einzeltag)
                            return { revier_id: k.revierId, datum, status: 'abgeschlossen', bemerkung: marke, erstellt_von: k.userId };
                        const z = alsSitzungsZeile({ ...sitz, datum });
                        return { revier_id: k.revierId, status: 'abgeschlossen', erstellt_von: k.userId, ...z, ...flaeche, bemerkung: z.bemerkung ? `${marke} – ${z.bemerkung}` : marke };
                    }))
                        .select('id, datum');
                    if (error)
                        throw error;
                    const zeilen = (sitzungen ?? []).flatMap((s) => (nachDatum.get(s.datum) ?? []).map((z) => ({
                        sitzung_id: s.id,
                        revier_id: k.revierId,
                        wildart_id: artFuer(z.wildartRoh),
                        anzahl: z.anzahl,
                        geschlecht: z.geschlecht,
                        altersklasse: z.altersklasse,
                        zone_id: zoneId(z.zoneRoh),
                        bemerkung: z.bemerkung,
                        erfasst_von: k.userId,
                    })));
                    for (const teil of stuecke(zeilen, 500)) {
                        const { error: e2 } = await supabase.from('zaehlungen').insert(teil);
                        if (e2)
                            throw e2;
                    }
                    anzahlZaehlungen += zeilen.length;
                    // Gezählte Fläche (Zonenfläche) festschreiben, damit Monitoring und Auswertung je 100 ha rechnen können
                    for (const gruppe of stuecke(sitzungen ?? [], 10)) {
                        await Promise.all(gruppe.map((x) => supabase.rpc('zaehlsitzung_flaeche_setzen', { p_sitzung_id: x.id })));
                    }
                }
                setMeldung(`${neueTage.length} Zählungen mit ${anzahlZaehlungen.toLocaleString('de-DE')} Einträgen importiert` +
                    (schonDa.size ? `; ${schonDa.size} Tage waren aus dieser Datei bereits importiert und wurden übersprungen` : '') +
                    '. Sie erscheinen im Monitoring und in der Historie.');
            }
            else {
                const { data: vorhanden, error: e0 } = await supabase
                    .from('abschuesse')
                    .select('wildart_id, erlegt_am, geschlecht')
                    .eq('revier_id', k.revierId)
                    .is('geloescht_am', null)
                    .gte('erlegt_am', `${datumVon}T00:00:00`)
                    .lte('erlegt_am', `${datumBis}T23:59:59`)
                    .limit(10000);
                if (e0)
                    throw e0;
                const schluessel = (w, t, g) => `${w}|${new Date(t).getTime()}|${g}`;
                const bekannt = new Set((vorhanden ?? []).map((x) => schluessel(x.wildart_id ?? '', x.erlegt_am, x.geschlecht)));
                const neu = importierbar
                    .map((z) => ({
                    revier_id: k.revierId,
                    wildart_id: artFuer(z.wildartRoh),
                    geschlecht: z.geschlecht,
                    altersklasse: z.altersklasse,
                    erlegt_am: lokalISO(z.datum, z.stunde, z.minute),
                    gewicht_kg: z.gewicht,
                    zone_id: zoneId(z.zoneRoh),
                    bemerkung: z.bemerkung,
                    erfasst_von: k.userId,
                }))
                    .filter((r) => {
                    const s = schluessel(r.wildart_id, r.erlegt_am, r.geschlecht);
                    if (bekannt.has(s))
                        return false;
                    bekannt.add(s); // identische Zeilen in der Datei selbst bleiben erhalten, wenn sie nicht schon in der Datenbank sind
                    return true;
                });
                for (const teil of stuecke(neu, 300)) {
                    const { error } = await supabase.from('abschuesse').insert(teil);
                    if (error)
                        throw error;
                }
                const uebersprungen = importierbar.length - neu.length;
                setMeldung(`${neu.length} Abschüsse importiert` +
                    (uebersprungen ? `; ${uebersprungen} bereits vorhanden bzw. doppelt und übersprungen` : '') +
                    '.');
            }
            setTabelle(null);
            setDateiname('');
        }
        catch (err) {
            setFehler(`Import abgebrochen: ${fehlertext(err)} Bereits übertragene Teile bleiben bestehen; ein erneuter Import überspringt sie.`);
        }
        finally {
            setLaeuft(false);
        }
    }
    if (!k.istInhaber) {
        return (_jsx(Seite, { titel: "Datenimport", children: _jsx(Hinweis, { children: "Historische Daten kann nur der Revierinhaber importieren." }) }));
    }
    const felder = FELDER[typ];
    const bereichWahl = (_jsx(Segmente, { label: "Bereich", wert: bereich, onAendern: setBereich, optionen: [
            { wert: 'csv', label: 'Erfassungen (CSV)' },
            { wert: 'geo', label: 'Geodaten (SHP/GPKG)' },
        ] }));
    if (bereich === 'geo') {
        return (_jsxs(Seite, { titel: "Datenimport", untertitel: "Reviergrenze, Zonen, Einrichtungen und Pirschwege aus Shapefile oder GeoPackage", children: [bereichWahl, meldung && _jsx(Hinweis, { art: "erfolg", children: meldung }), _jsx(Gruppe, { titel: "GPS-Datei (Smartwatch)", fuss: "GPX, KML, KMZ oder FIT als Pirschweg, Treiberroute oder WTE-Route \u2013 mit Pr\u00FCfbericht und Punktreduktion.", children: _jsx(Knopf, { variante: "sekundaer", onClick: () => setGpsOffen(true), children: "GPS-Datei importieren \u2026" }) }), gpsOffen && (_jsx(GpsImport, { k: k, onZu: () => setGpsOffen(false), onFertig: (t) => {
                        setGpsOffen(false);
                        setMeldung(t);
                    } })), _jsx(Geoimport, { k: k })] }));
    }
    return (_jsxs(Seite, { titel: "Datenimport", untertitel: "Historische Erfassungen aus CSV-Dateien \u00FCbernehmen", children: [bereichWahl, _jsx(Segmente, { label: "Art der Daten", wert: typ, onAendern: neuStart, optionen: [
                    { wert: 'zaehlung', label: 'Zählungen' },
                    { wert: 'abschuss', label: 'Abschüsse' },
                ] }), meldung && _jsx(Hinweis, { art: "erfolg", children: meldung }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), !tabelle && (_jsxs(_Fragment, { children: [_jsx(Gruppe, { titel: "CSV-Datei w\u00E4hlen", fuss: typ === 'zaehlung' ? 'Jede Zeile = eine Zählung (Datum, Wildart, Anzahl, optional Zone). Je Datum entsteht eine abgeschlossene Zählung.' : 'Jede Zeile = ein Abschuss (Datum, Wildart, optional Uhrzeit, Geschlecht, Altersklasse, Gewicht, Zone).', children: _jsx("div", { className: "zeile", children: _jsxs("label", { className: "knopf knopf-sekundaer datei-knopf", children: ["CSV-Datei ausw\u00E4hlen", _jsx("input", { type: "file", accept: ".csv,.txt,text/csv", onChange: (e) => {
                                            const datei = e.target.files?.[0];
                                            if (datei)
                                                void dateiLesen(datei);
                                            e.target.value = '';
                                        } })] }) }) }), _jsx(Leer, { children: "Trennzeichen (Semikolon, Komma, Tab) und Zeichensatz (UTF-8 oder Windows) werden automatisch erkannt. Datumsangaben wie 14.03.2021 oder 2021-03-14 werden verstanden. Erste Zeile = Spalten\u00FCberschriften." }), typ === 'zaehlung' && _jsx(VorlageGruppe, { revierId: k.revierId, zonen: zonen, wildarten: wildarten }), _jsx(Knopf, { variante: "ghost", onClick: () => {
                            const url = URL.createObjectURL(new Blob(['﻿' + VORLAGEN[typ]], { type: 'text/csv;charset=utf-8' }));
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `hegewerk-vorlage-${typ === 'zaehlung' ? 'zaehlungen' : 'abschuesse'}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }, children: typ === 'zaehlung' ? 'Listenformat-Vorlage herunterladen' : 'Vorlage herunterladen' })] })), tabelle && (_jsxs(_Fragment, { children: [matrix && (_jsx(Hinweis, { art: "info", children: `Matrixformat erkannt: ${(tabelle.length - 1).toLocaleString('de-DE')} Zeilen (Zonen) × ${kopf.length - 1} Spalten. Summenzeilen und -spalten werden ignoriert, das Geschlecht wird als „unbekannt“ gespeichert. Datei: ${dateiname}.` })), !matrix && (_jsx(Gruppe, { titel: `1. Spalten zuordnen · ${dateiname}`, fuss: `${(tabelle.length - 1).toLocaleString('de-DE')} Datenzeilen gefunden`, children: felder.map((f) => (_jsxs("label", { className: "zeile feld", children: [_jsxs("span", { className: "zeile-label", children: [f.label, f.pflicht ? ' *' : ''] }), _jsxs("select", { value: zuordnung[f.schluessel] ?? -1, onChange: (e) => setZuordnung({ ...zuordnung, [f.schluessel]: Number(e.target.value) }), children: [_jsx("option", { value: -1, children: f.pflicht ? '– wählen –' : '– nicht vorhanden –' }), kopf.map((h, i) => (_jsx("option", { value: i, children: h || `Spalte ${i + 1}` }, i)))] })] }, f.schluessel))) })), auswertung.fehlendePflicht.length > 0 ? (_jsxs(Hinweis, { art: "fehler", children: ["Bitte noch zuordnen: ", auswertung.fehlendePflicht.join(', ')] })) : (_jsxs(_Fragment, { children: [artWerte.length > 0 && (_jsx(Gruppe, { titel: "2. Wildarten pr\u00FCfen", fuss: offeneArten.length ? 'Nicht erkannte Wildarten bitte zuordnen – sonst werden diese Zeilen nicht importiert.' : undefined, children: artWerte.map((a) => (_jsxs("div", { className: "zeile", children: [_jsxs("span", { className: "zeile-label", children: ["\u201E", a.roh, "\u201C", _jsxs("small", { children: [a.anzahl.toLocaleString('de-DE'), " Zeilen"] })] }), a.auto ? (_jsx("span", { className: "badge badge-gruen", children: wildarten.find((w) => w.id === a.auto)?.name })) : (_jsxs("select", { className: "zeile-auswahl", "aria-label": `Wildart für ${a.roh}`, value: artZuordnung[a.roh] ?? '', onChange: (e) => setArtZuordnung({ ...artZuordnung, [a.roh]: e.target.value }), children: [_jsx("option", { value: "", children: "nicht importieren" }), _jsx(WildartOptionen, { wildarten: wildarten })] }))] }, a.roh))) })), zonenWerte.length > 0 && (_jsxs(Gruppe, { titel: "3. Zonen", children: [zonenWerte.map((z) => (_jsxs("div", { className: "zeile", children: [_jsxs("span", { className: "zeile-label", children: ["\u201E", z.roh, "\u201C", _jsxs("small", { children: [z.anzahl.toLocaleString('de-DE'), " Zeilen"] })] }), z.vorhanden ? (_jsx("span", { className: "badge badge-gruen", children: "vorhanden" })) : zonenAnlegen && !zonenWahl[z.roh] ? (_jsx("span", { className: "badge badge-orange", children: "wird angelegt" })) : (_jsxs("select", { className: "zeile-auswahl", "aria-label": `Zone für ${z.roh}`, value: wahlFuer(z.roh), onChange: (e) => setZonenWahl({ ...zonenWahl, [z.roh]: e.target.value }), children: [_jsx("option", { value: matrix ? ZONE_UEBERSPRINGEN : '', children: matrix ? 'überspringen' : 'ohne Zone' }), matrix && _jsx("option", { value: "", children: "ohne Zone importieren" }), zonen.map((x) => (_jsxs("option", { value: x.id, children: ["\u2192 ", x.name] }, x.id)))] }))] }, z.roh))), unbekannteZonen.length > 0 && (_jsxs("label", { className: "zeile", children: [_jsx("input", { type: "checkbox", checked: zonenAnlegen, onChange: (e) => setZonenAnlegen(e.target.checked) }), _jsxs("span", { className: "zeile-label", children: ["Unbekannte Zonen ohne Fl\u00E4che neu anlegen", _jsx("small", { children: "Die Fl\u00E4che kannst du sp\u00E4ter auf der Karte zeichnen." })] })] }))] })), auswertung.probleme.length > 0 && (_jsxs(Hinweis, { art: "fehler", children: [_jsxs("strong", { children: [auswertung.probleme.length, " Zeilen werden \u00FCbersprungen:"] }), _jsxs("ul", { className: "frist-liste", children: [auswertung.probleme.slice(0, 8).map((p) => (_jsx("li", { children: p }, p))), auswertung.probleme.length > 8 && _jsxs("li", { children: ["\u2026 und ", auswertung.probleme.length - 8, " weitere"] })] })] })), auswertung.nullzeilen > 0 && _jsxs(Leer, { children: [auswertung.nullzeilen, " Zeilen mit Anzahl 0 werden nicht \u00FCbernommen."] }), _jsx(Gruppe, { titel: "Vorschau (erste Zeilen)", children: _jsx("div", { className: "tabelle-rahmen", style: { border: 0 }, children: _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Datum" }), _jsx("th", { scope: "col", children: "Wildart" }), typ === 'zaehlung' && _jsx("th", { scope: "col", className: "zahl", children: "Anzahl" }), _jsx("th", { scope: "col", children: "Geschl." }), _jsx("th", { scope: "col", children: "Zone" })] }) }), _jsx("tbody", { children: auswertung.ok.slice(0, 6).map((z) => (_jsxs("tr", { children: [_jsx("td", { children: datumDE(z.datum) }), _jsx("td", { children: wildarten.find((w) => w.id === artFuer(z.wildartRoh))?.name ?? _jsxs("span", { className: "leise", children: ["? ", z.wildartRoh] }) }), typ === 'zaehlung' && _jsx("td", { className: "zahl", children: z.anzahl }), _jsx("td", { children: z.geschlecht === 'maennlich' ? '♂' : z.geschlecht === 'weiblich' ? '♀' : '–' }), _jsx("td", { children: z.zoneRoh || '–' })] }, z.nr))) })] }) }) }), typ === 'zaehlung' && (matrix || tage.length === 1) && (_jsx(SitzungsdatenFormular, { titel: "4. Sitzungsdaten", wert: matrix ? sitz : { ...sitz, datum: tage[0] }, onAendern: (w) => setSitz(matrix ? w : { ...w, datum: tage[0] }), mitte: mitte, datumAenderbar: matrix })), typ === 'zaehlung' && (matrix || tage.length === 1) && (_jsxs(Gruppe, { titel: "5. Gez\u00E4hlte Fl\u00E4che", fuss: flModus === 'strecke' ? 'Fläche = Strecke × 400 m (ohne Verschnitt an der Reviergrenze). Ohne Angabe bleibt die Zählung ohne festgeschriebene Fläche.' : 'Die Fläche ergibt sich aus den erfassten Zonen.', children: [_jsx("div", { style: { padding: '8px var(--abstand)' }, children: _jsx(Segmente, { label: "Fl\u00E4che berechnen nach", wert: flModus, onAendern: setFlModus, optionen: [{ wert: 'zonen', label: 'Zonenfläche' }, { wert: 'strecke', label: 'Strecke × 400 m' }] }) }), flModus === 'strecke' && _jsx(Feld, { label: "Gefahrene Strecke (km)", inputMode: "decimal", value: streckeKm, onChange: (e) => setStreckeKm(e.target.value) })] })), typ === 'zaehlung' && !matrix && tage.length > 1 && (_jsxs(Leer, { children: ["Die Datei enth\u00E4lt ", tage.length, " Z\u00E4hltage \u2013 je Tag entsteht eine Z\u00E4hlung. Wetter und Uhrzeiten lassen sich danach in jeder Z\u00E4hlung nachtragen."] })), _jsx(Knopf, { variante: "akzent", disabled: laeuft || importierbar.length === 0, onClick: () => void importieren(), children: laeuft ? 'Import läuft …' : `${importierbar.length.toLocaleString('de-DE')} ${typ === 'zaehlung' ? 'Zählwerte' : 'Abschüsse'} importieren` }), importierbar.length > 0 && (_jsxs(Leer, { children: ["Zeitraum ", datumDE(datumVon), " bis ", datumDE(datumBis), ". Ein erneuter Import derselben Datei erzeugt keine Dubletten."] }))] })), _jsx(Knopf, { variante: "ghost", onClick: () => neuStart(typ), disabled: laeuft, children: "Andere Datei w\u00E4hlen" })] }))] }));
}
