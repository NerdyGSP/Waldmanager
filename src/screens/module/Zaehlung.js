import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AuditZeile } from '../../components/AuditZeile';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten, useZonen, useZonenEbenen, wildartName } from '../../lib/stammdaten';
import { aktuellePosition, aktuellesWetter, wetterText } from '../../lib/geo';
import { speichernOderMerken, wartendeZaehlungen } from '../../lib/offline';
import { useZaehlungGeaendert } from '../../lib/zaehlEreignis';
import { datumDE, heuteISO, mondphase } from '../../lib/zeit';
import { navigieren } from '../../lib/router';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zaehler, Zeile, useRadHorizontal, WildartOptionen } from '../../components/ui';
import { ZaehlReport } from './ZaehlReport';
import { ZaehlMatrix } from './ZaehlMatrix';
import { FlaechenmodusWahl, modusText, STANDARD_BREITE_M } from './FlaechenmodusWahl';
import { WteRoutenWahl, useWteRouten } from '../../components/WteRoutenWahl';
import { SitzungsdatenFormular } from './SitzungsdatenFormular';
import { alsSitzungsZeile, vonSitzungsZeile } from '../../lib/sitzungsdaten';
export function Zaehlung({ k, sitzungId }) {
    return sitzungId ? _jsx(SitzungAnsicht, { k: k, sitzungId: sitzungId }) : _jsx(SitzungsListe, { k: k });
}
// ---------- Übersicht und neue Sitzung ----------
function SitzungsListe({ k }) {
    const [sitzungen, setSitzungen] = useState([]);
    const [neu, setNeu] = useState(false);
    const [fehler, setFehler] = useState(null);
    useEffect(() => {
        void supabase
            .from('zaehlsitzungen')
            .select('id, datum, beginn, ende, status, wetter, mondphase, bemerkung, erstellt_von, ebene_id, flaechenmodus, streifenbreite_m, strecke_km, flaeche_ha, zaehlungen(anzahl, geloescht_am)')
            .eq('revier_id', k.revierId)
            .is('geloescht_am', null)
            .order('datum', { ascending: false })
            .order('beginn', { ascending: false })
            .then(({ data, error }) => {
            if (error)
                setFehler(fehlertext(error));
            setSitzungen((data ?? []).map(({ zaehlungen, ...s }) => ({
                ...s,
                summe: zaehlungen.filter((z) => !z.geloescht_am).reduce((a, z) => a + z.anzahl, 0),
            })));
        });
    }, [k.revierId]);
    if (neu)
        return _jsx(NeueSitzung, { k: k, onAbbrechen: () => setNeu(false) });
    const offen = sitzungen.filter((s) => s.status === 'offen');
    const fertig = sitzungen.filter((s) => s.status === 'abgeschlossen');
    return (_jsxs(Seite, { titel: "Wildz\u00E4hlung", aktion: _jsx(Knopf, { onClick: () => setNeu(true), children: "+ Neue Z\u00E4hlung" }), children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), offen.length > 0 && (_jsx(Gruppe, { titel: "Laufende Z\u00E4hlungen", children: offen.map((s) => (_jsx(SitzungsZeile, { s: s }, s.id))) })), _jsxs(Gruppe, { titel: "Historie", children: [fertig.length === 0 && _jsx(Zeile, { label: "Noch keine abgeschlossenen Z\u00E4hlungen" }), fertig.map((s) => (_jsx(SitzungsZeile, { s: s }, s.id)))] })] }));
}
function SitzungsZeile({ s }) {
    return (_jsxs("button", { className: "zeile zeile-knopf", onClick: () => navigieren(`/zaehlung/${s.id}`), children: [_jsxs("span", { className: "zeile-label", children: [datumDE(s.datum), s.beginn ? `, ${new Date(s.beginn).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : '', _jsxs("small", { children: [s.summe, " St\u00FCck gez\u00E4hlt", s.mondphase ? ` · ${s.mondphase}` : '', s.flaeche_ha !== null ? ` · ${s.flaeche_ha.toLocaleString('de-DE')} ha (${modusText(s.flaechenmodus === 'strecke' ? 'strecke' : 'zonen', s.streifenbreite_m)})` : '', s.bemerkung ? ` · ${s.bemerkung}` : ''] })] }), _jsx("span", { className: "zeile-pfeil", "aria-hidden": "true", children: "\u203A" })] }));
}
function NeueSitzung({ k, onAbbrechen }) {
    const { ebenen } = useZonenEbenen(k.revierId);
    const [ebeneId, setEbeneId] = useState('');
    const [datum, setDatum] = useState(heuteISO());
    const [bemerkung, setBemerkung] = useState('');
    const [modus, setModus] = useState('zonen');
    const [breite, setBreite] = useState(STANDARD_BREITE_M);
    const [wetter, setWetter] = useState(null);
    const [wetterStatus, setWetterStatus] = useState('Wetter wird abgerufen …');
    const [fehler, setFehler] = useState(null);
    const wteRouten = useWteRouten(k.revierId, modus === 'strecke');
    const [routenIds, setRoutenIds] = useState([]);
    const [routenVorbelegt, setRoutenVorbelegt] = useState(false);
    // Vorbelegung: alle WTE-Routen, die Auswahl lässt sich ändern
    useEffect(() => {
        if (wteRouten && !routenVorbelegt) {
            setRoutenIds(wteRouten.map((r) => r.id));
            setRoutenVorbelegt(true);
        }
    }, [wteRouten, routenVorbelegt]);
    const mond = mondphase(new Date(`${datum}T20:00:00`));
    useEffect(() => {
        void (async () => {
            const p = await aktuellePosition();
            if (!p) {
                setWetterStatus('Ohne Position kein automatisches Wetter');
                return;
            }
            const w = await aktuellesWetter(p.lat, p.lon);
            setWetter(w);
            setWetterStatus(w ? wetterText(w) : 'Wetter nicht verfügbar');
        })();
    }, []);
    async function starten(e) {
        e.preventDefault();
        setFehler(null);
        const { data, error } = await supabase
            .from('zaehlsitzungen')
            .insert({
            revier_id: k.revierId,
            datum,
            beginn: new Date().toISOString(),
            mondphase: `${mond.name} (${mond.beleuchtung} %)`,
            wetter: wetter ? wetter : null,
            bemerkung: bemerkung.trim() || null,
            ebene_id: ebeneId || null,
            flaechenmodus: modus,
            streifenbreite_m: breite || STANDARD_BREITE_M,
        })
            .select('id')
            .single();
        if (error) {
            setFehler(fehlertext(error));
            return;
        }
        if (modus === 'strecke' && routenIds.length) {
            const { error: e2 } = await supabase.from('zaehlsitzung_routen').insert(routenIds.map((route_id) => ({ sitzung_id: data.id, route_id, revier_id: k.revierId })));
            if (e2) {
                setFehler(`Zählung gestartet, aber die Routen konnten nicht zugeordnet werden: ${fehlertext(e2)}`);
            }
        }
        navigieren(`/zaehlung/${data.id}`);
    }
    return (_jsx(Seite, { titel: "Neue Z\u00E4hlung", zurueck: onAbbrechen, children: _jsxs("form", { onSubmit: starten, children: [_jsxs(Gruppe, { children: [_jsx(Feld, { label: "Datum", type: "date", required: true, value: datum, onChange: (e) => setDatum(e.target.value) }), ebenen.length > 0 && (_jsxs(Auswahl, { label: "Zonenebene", value: ebeneId, onChange: (e) => setEbeneId(e.target.value), children: [_jsx("option", { value: "", children: "Alle Zonen" }), ebenen.map((x) => (_jsx("option", { value: x.id, children: x.name }, x.id)))] })), _jsx(FlaechenmodusWahl, { modus: modus, breite: breite, onModus: setModus, onBreite: setBreite }), modus === 'strecke' && _jsx(WteRoutenWahl, { routen: wteRouten, gewaehlt: routenIds, onAendern: setRoutenIds }), _jsx(Zeile, { label: "Wetter", wert: wetterStatus }), _jsx(Zeile, { label: "Mond", wert: `${mond.name}, ${mond.beleuchtung} % beleuchtet` }), _jsx(Feld, { label: "Bemerkung", placeholder: "z. B. Scheinwerferz\u00E4hlung", value: bemerkung, onChange: (e) => setBemerkung(e.target.value) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", variante: "akzent", children: "Z\u00E4hlung starten" })] }) }));
}
// ---------- Laufende oder abgeschlossene Sitzung ----------
function SitzungBearbeiten({ k, sitzung, onFertig }) {
    const [wert, setWert] = useState(() => vonSitzungsZeile(sitzung));
    const [mitte, setMitte] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [laeuft, setLaeuft] = useState(false);
    useEffect(() => {
        void supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 1 }).then(({ data }) => {
            const m = data?.mitte?.coordinates;
            if (m && m.length >= 2)
                setMitte([m[0], m[1]]);
        });
    }, [k.revierId]);
    async function speichern() {
        setLaeuft(true);
        setFehler(null);
        if (!wert.datum) {
            setLaeuft(false);
            setFehler('Bitte ein Datum angeben.');
            return;
        }
        const { error } = await supabase.from('zaehlsitzungen').update(alsSitzungsZeile(wert)).eq('id', sitzung.id);
        setLaeuft(false);
        if (error)
            setFehler(fehlertext(error));
        else
            onFertig(true);
    }
    return (_jsxs(Seite, { titel: `Zählung ${datumDE(sitzung.datum)}`, untertitel: "Sitzungsdaten bearbeiten", zurueck: () => onFertig(false), children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(SitzungsdatenFormular, { wert: wert, onAendern: setWert, mitte: mitte, datumAenderbar: true, autoVorbelegen: false }), _jsx(Knopf, { variante: "akzent", disabled: laeuft, onClick: () => void speichern(), children: laeuft ? 'Speichern …' : 'Speichern' })] }));
}
// Gezählte Fläche der Zählung: Modus, Strecke und Fläche – änderbar, auch nach dem Abschluss
function FlaechenGruppe({ sitzung, revierId, onGeaendert, onRouten }) {
    const [modus, setModus] = useState(sitzung.flaechenmodus === 'strecke' ? 'strecke' : 'zonen');
    const [breite, setBreite] = useState(sitzung.streifenbreite_m);
    const [vorschau, setVorschau] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [laeuft, setLaeuft] = useState(false);
    const [neuLadenZaehler, setNeuLadenZaehler] = useState(0);
    const routenListe = useWteRouten(revierId, modus === 'strecke');
    const [gewaehlt, setGewaehlt] = useState([]);
    const geaendert = modus !== sitzung.flaechenmodus || breite !== sitzung.streifenbreite_m;
    const abgeschlossen = sitzung.status === 'abgeschlossen';
    useEffect(() => {
        let aktiv = true;
        void supabase.rpc('sitzung_flaeche_berechnen', { p_sitzung_id: sitzung.id, p_modus: modus, p_breite_m: breite || STANDARD_BREITE_M }).then(({ data, error }) => {
            if (!aktiv)
                return;
            const z = data?.[0];
            if (error || !z)
                return;
            setVorschau({ strecke_km: z.strecke_km === null ? null : Number(z.strecke_km), flaeche_ha: z.flaeche_ha === null ? null : Number(z.flaeche_ha), routen: z.routen });
        });
        return () => {
            aktiv = false;
        };
    }, [sitzung.id, modus, breite, sitzung.status, neuLadenZaehler]);
    // Zugeordnete Routen dieser Zählung
    useEffect(() => {
        let aktiv = true;
        void supabase
            .from('zaehlsitzung_routen')
            .select('route_id')
            .eq('sitzung_id', sitzung.id)
            .then(({ data }) => {
            if (aktiv)
                setGewaehlt((data ?? []).map((r) => r.route_id));
        });
        return () => {
            aktiv = false;
        };
    }, [sitzung.id, neuLadenZaehler]);
    async function routenAendern(ids) {
        setFehler(null);
        const neu = ids.filter((i) => !gewaehlt.includes(i));
        const weg = gewaehlt.filter((i) => !ids.includes(i));
        setGewaehlt(ids);
        if (neu.length) {
            const { error } = await supabase.from('zaehlsitzung_routen').insert(neu.map((route_id) => ({ sitzung_id: sitzung.id, route_id, revier_id: revierId })));
            if (error)
                setFehler(fehlertext(error));
        }
        if (weg.length) {
            const { error } = await supabase.from('zaehlsitzung_routen').delete().eq('sitzung_id', sitzung.id).in('route_id', weg);
            if (error)
                setFehler(fehlertext(error));
        }
        setNeuLadenZaehler((n) => n + 1);
    }
    useEffect(() => {
        if (vorschau && modus === 'strecke')
            onRouten?.(vorschau.routen);
    }, [vorschau, modus, onRouten]);
    async function speichern() {
        setLaeuft(true);
        setFehler(null);
        const { error } = await supabase.from('zaehlsitzungen').update({ flaechenmodus: modus, streifenbreite_m: breite || STANDARD_BREITE_M }).eq('id', sitzung.id);
        setLaeuft(false);
        if (error)
            setFehler(fehlertext(error));
        else
            onGeaendert();
    }
    const fehltRoute = modus === 'strecke' && vorschau !== null && vorschau.routen === 0;
    const zahlDE = (n, nk = 1) => (n === null ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk }));
    const gespeichert = abgeschlossen && !geaendert && sitzung.flaeche_ha !== null;
    return (_jsxs(Gruppe, { titel: "Gez\u00E4hlte Fl\u00E4che", fuss: abgeschlossen ? 'Die Fläche wird beim Abschluss festgeschrieben. Ändern von Modus oder Breite berechnet sie neu.' : 'Wird beim Abschluss der Zählung festgeschrieben.', children: [_jsx(FlaechenmodusWahl, { modus: modus, breite: breite, onModus: setModus, onBreite: setBreite }), fehltRoute && (_jsx(Hinweis, { art: "warnung", children: "Dieser Z\u00E4hlung ist noch keine WTE-Route zugeordnet. Im Modus \u201EStrecke \u00D7 Breite\u201C l\u00E4sst sie sich so nicht abschlie\u00DFen. W\u00E4hle unten vorhandene WTE-Routen aus oder zeichne, zeichne per GPS auf oder importiere eine \u00FCber das Men\u00FC \u201E+ NEU\u201C auf der Karte." })), modus === 'strecke' && !abgeschlossen && _jsx(WteRoutenWahl, { routen: routenListe, gewaehlt: gewaehlt, onAendern: (ids) => void routenAendern(ids) }), _jsx(Zeile, { label: "Fl\u00E4che", wert: (gespeichert ? sitzung.flaeche_ha : vorschau?.flaeche_ha ?? null) === null
                    ? '–'
                    : `${zahlDE(gespeichert ? sitzung.flaeche_ha : vorschau?.flaeche_ha ?? null)} ha${modus === 'strecke' ? ` (${zahlDE(gespeichert ? sitzung.strecke_km : vorschau?.strecke_km ?? null, 2)} km × ${breite} m)` : ''}` }), !gespeichert && vorschau && _jsxs("p", { className: "gruppe-fuss", style: { margin: 0 }, children: ["Vorschau \u2013 ", modusText(modus, breite), "."] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), geaendert && (_jsx(Knopf, { variante: "sekundaer", disabled: laeuft || fehltRoute, onClick: () => void speichern(), children: laeuft ? 'Speichern …' : 'Flächenmodus speichern' }))] }));
}
function SitzungAnsicht({ k, sitzungId }) {
    const wildarten = useWildarten();
    const tabsRef = useRadHorizontal();
    const { zonen: alleZonen } = useZonen(k.revierId);
    const { ebenen } = useZonenEbenen(k.revierId);
    const [report, setReport] = useState(false);
    const [bearbeiten, setBearbeiten] = useState(false);
    const [routenAnzahl, setRoutenAnzahl] = useState(1);
    const [sitzung, setSitzung] = useState(null);
    // Ist die Zählung auf eine Zonenebene beschränkt, nur deren Zonen anbieten
    const zonen = useMemo(() => (sitzung?.ebene_id ? alleZonen.filter((z) => z.ebeneId === sitzung.ebene_id) : alleZonen), [alleZonen, sitzung?.ebene_id]);
    const [zeilen, setZeilen] = useState([]);
    const [zoneId, setZoneId] = useState('');
    const [uebersicht, setUebersicht] = useState(false);
    const [fehler, setFehler] = useState(null);
    const [offlineHinweis, setOfflineHinweis] = useState(false);
    const laden = useCallback(async () => {
        const [s, z] = await Promise.all([
            supabase
                .from('zaehlsitzungen')
                .select('id, datum, beginn, ende, status, wetter, mondphase, bemerkung, erstellt_von, ebene_id, flaechenmodus, streifenbreite_m, strecke_km, flaeche_ha')
                .eq('id', sitzungId)
                .maybeSingle(),
            supabase.from('zaehlungen').select('id, zone_id, wildart_id, geschlecht, anzahl').eq('sitzung_id', sitzungId).is('geloescht_am', null),
        ]);
        if (s.error || z.error)
            setFehler(fehlertext(s.error ?? z.error));
        setSitzung(s.data);
        // Noch nicht übertragene Einträge (Offline-Warteschlange) werden über ihre ID eingemischt – nichts wird doppelt gezählt
        const m = new Map((z.data ?? []).map((x) => [x.id, x]));
        for (const w of wartendeZaehlungen(sitzungId)) {
            const alt = m.get(w.id);
            if (alt)
                m.set(w.id, { ...alt, anzahl: w.anzahl });
            else if (w.wildart_id)
                m.set(w.id, { id: w.id, zone_id: w.zone_id, wildart_id: w.wildart_id, geschlecht: (w.geschlecht ?? 'unbekannt'), anzahl: w.anzahl });
        }
        setZeilen([...m.values()]);
        if (s.data?.status === 'abgeschlossen')
            setUebersicht(true);
    }, [sitzungId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    // Eingaben aus dem WTE-Modus der Karte (oder anderen Geräten nach der Synchronisation) auffrischen
    useZaehlungGeaendert((e) => {
        if (e.sitzungId === sitzungId && e.quelle === 'server')
            void laden();
    });
    // Erste Zone vorauswählen
    useEffect(() => {
        if (!zoneId && zonen[0])
            setZoneId(zonen[0].id);
    }, [zonen, zoneId]);
    async function setzen(zeile) {
        setZeilen((alt) => [...alt.filter((x) => x.id !== zeile.id), zeile]);
        try {
            const r = await speichernOderMerken({
                tabelle: 'zaehlungen',
                daten: { ...zeile, sitzung_id: sitzungId, revier_id: k.revierId },
            });
            if (r === 'gemerkt')
                setOfflineHinweis(true);
        }
        catch (err) {
            setFehler(fehlertext(err));
        }
    }
    function hinzufuegen(wildartId, geschlecht) {
        const zid = zoneId || null;
        const vorhanden = zeilen.find((z) => z.zone_id === zid && z.wildart_id === wildartId && z.geschlecht === geschlecht);
        if (vorhanden)
            return;
        void setzen({ id: crypto.randomUUID(), zone_id: zid, wildart_id: wildartId, geschlecht, anzahl: 1 });
    }
    async function abschliessen() {
        const { error } = await supabase
            .from('zaehlsitzungen')
            .update({ status: 'abgeschlossen', ende: new Date().toISOString() })
            .eq('id', sitzungId);
        if (error)
            setFehler(fehlertext(error));
        await laden();
        setUebersicht(true);
    }
    async function wiederOeffnen() {
        const { error } = await supabase.from('zaehlsitzungen').update({ status: 'offen', ende: null }).eq('id', sitzungId);
        if (error)
            setFehler(fehlertext(error));
        setUebersicht(false);
        await laden();
    }
    async function loeschen() {
        if (!window.confirm('Diese Zählung mit allen Einträgen löschen?'))
            return;
        const { error } = await supabase.from('zaehlsitzungen').delete().eq('id', sitzungId);
        if (error)
            setFehler(fehlertext(error));
        else
            navigieren('/zaehlung', true);
    }
    if (!sitzung) {
        return (_jsx(Seite, { titel: "Wildz\u00E4hlung", zurueck: () => navigieren('/zaehlung'), children: fehler ? _jsx(Hinweis, { art: "fehler", children: fehler }) : _jsx(Leer, { children: "Lade Z\u00E4hlung \u2026" }) }));
    }
    const titel = `Zählung ${datumDE(sitzung.datum)}`;
    const untertitel = [sitzung.mondphase, sitzung.wetter ? wetterText(sitzung.wetter) : null]
        .filter(Boolean)
        .join(' · ');
    const darfLoeschen = k.istInhaber || sitzung.erstellt_von === k.userId;
    if (bearbeiten) {
        return (_jsx(SitzungBearbeiten, { k: k, sitzung: sitzung, onFertig: (geaendert) => {
                setBearbeiten(false);
                if (geaendert)
                    void laden();
            } }));
    }
    // Dieselbe Matrix wie die Übersicht (Zonen × Wildarten), im Format der Import-Vorlage
    function csvExport() {
        const zelle = (t) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
        const arten = wildarten.filter((w) => zeilen.some((z) => z.wildart_id === w.id && z.anzahl > 0));
        const zeilenIds = [...new Set(zeilen.filter((z) => z.anzahl > 0).map((z) => z.zone_id))];
        const name = (id) => (id ? (alleZonen.find((z) => z.id === id)?.name ?? 'entfernte Zone') : 'Gesamtrevier');
        const summe = (zone, art) => zeilen.filter((z) => z.zone_id === zone && z.wildart_id === art).reduce((a, z) => a + z.anzahl, 0);
        const text = '\uFEFF' +
            [['Zone', ...arten.map((a) => a.name)], ...zeilenIds.map((id) => [name(id), ...arten.map((a) => String(summe(id, a.id) || ''))])]
                .map((r) => r.map(zelle).join(';'))
                .join('\r\n') +
            '\r\n';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        a.download = `wildzaehlung-${sitzung?.datum ?? 'export'}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
    if (uebersicht) {
        return (_jsxs(Seite, { titel: titel, untertitel: untertitel, zurueck: () => navigieren('/zaehlung'), children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(AuditZeile, { tabelle: "zaehlsitzungen", id: sitzung.id, aktualisierung: sitzung.status }), _jsx(ZaehlMatrix, { revierId: k.revierId, sitzung: sitzung, zeilen: zeilen, zonen: alleZonen, ebenen: ebenen, wildarten: wildarten }), _jsx(FlaechenGruppe, { sitzung: sitzung, revierId: k.revierId, onGeaendert: () => void laden(), onRouten: setRoutenAnzahl }), sitzung.bemerkung && _jsxs(Leer, { children: ["Bemerkung: ", sitzung.bemerkung] }), _jsx(Knopf, { variante: "sekundaer", onClick: () => csvExport(), children: "Als CSV exportieren (Matrix)" }), sitzung.status === 'offen' ? (_jsxs(_Fragment, { children: [_jsx(Knopf, { onClick: abschliessen, disabled: sitzung.flaechenmodus === 'strecke' && routenAnzahl === 0, children: "Z\u00E4hlung abschlie\u00DFen" }), _jsx(Knopf, { variante: "sekundaer", onClick: () => setUebersicht(false), children: "Weiter z\u00E4hlen" })] })) : (_jsxs(_Fragment, { children: [_jsx(Knopf, { variante: "akzent", onClick: () => setReport(true), children: "Report drucken" }), darfLoeschen && (_jsx(Knopf, { variante: "sekundaer", onClick: () => setBearbeiten(true), children: "Sitzungsdaten bearbeiten (Datum, Wetter, Zeiten)" })), _jsx(Knopf, { variante: "sekundaer", onClick: wiederOeffnen, children: "Z\u00E4hlung wieder \u00F6ffnen" })] })), report && (_jsx(ZaehlReport, { revierId: k.revierId, revierName: k.revierName, sitzung: sitzung, ebeneName: ebenen.find((x) => x.id === sitzung.ebene_id)?.name ?? null, zeilen: zeilen, zonen: alleZonen, wildarten: wildarten, onZu: () => setReport(false) })), darfLoeschen && (_jsx(Knopf, { variante: "gefahr", onClick: loeschen, children: "Z\u00E4hlung l\u00F6schen" }))] }));
    }
    const zid = zoneId || null;
    const zoneZeilen = zeilen
        .filter((z) => z.zone_id === zid)
        .sort((a, b) => {
        const wa = wildarten.find((w) => w.id === a.wildart_id)?.sortierung ?? 0;
        const wb = wildarten.find((w) => w.id === b.wildart_id)?.sortierung ?? 0;
        return wa - wb || a.geschlecht.localeCompare(b.geschlecht);
    });
    const summeZone = (id) => zeilen.filter((z) => z.zone_id === id).reduce((a, z) => a + z.anzahl, 0);
    return (_jsxs(Seite, { titel: titel, untertitel: untertitel, zurueck: () => navigieren('/zaehlung'), aktion: _jsx(Knopf, { variante: "sekundaer", onClick: () => setUebersicht(true), children: "\u00DCbersicht" }), children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), offlineHinweis && _jsx(Hinweis, { children: "Kein Netz \u2013 Z\u00E4hlst\u00E4nde werden auf dem Ger\u00E4t gehalten und automatisch \u00FCbertragen." }), _jsxs("div", { className: "zonen-tabs", role: "tablist", "aria-label": "Zone", ref: tabsRef, children: [zonen.map((z) => (_jsxs("button", { role: "tab", "aria-selected": zoneId === z.id, onClick: () => setZoneId(z.id), children: [z.name, _jsx("span", { children: summeZone(z.id) })] }, z.id))), _jsxs("button", { role: "tab", "aria-selected": zoneId === '', onClick: () => setZoneId(''), children: [zonen.length ? 'Ohne Zone' : 'Gesamtrevier', _jsx("span", { children: summeZone(null) })] })] }), zonen.length === 0 && _jsx(Leer, { children: "Noch keine Zonen angelegt \u2013 gez\u00E4hlt wird f\u00FCr das Gesamtrevier." }), _jsxs(Gruppe, { children: [zoneZeilen.length === 0 && _jsx(Zeile, { label: "In dieser Zone noch nichts gez\u00E4hlt" }), zoneZeilen.map((z) => (_jsxs("div", { className: "zeile", children: [_jsxs("span", { className: "zeile-label", children: [wildartName(wildarten, z.wildart_id), " ", GESCHLECHTER.find((g) => g.wert === z.geschlecht)?.kurz] }), _jsx(Zaehler, { label: wildartName(wildarten, z.wildart_id), wert: z.anzahl, onAendern: (neu) => void setzen({ ...z, anzahl: neu }) })] }, z.id)))] }), _jsx(WildartHinzufuegen, { wildarten: wildarten, onHinzufuegen: hinzufuegen }), _jsx(Knopf, { onClick: () => setUebersicht(true), children: "Gesamt\u00FCbersicht und abschlie\u00DFen" })] }));
}
function WildartHinzufuegen({ wildarten, onHinzufuegen, }) {
    const [wildartId, setWildartId] = useState('rehwild');
    return (_jsxs(Gruppe, { titel: "Wildart hinzuf\u00FCgen", children: [_jsx(Auswahl, { label: "Wildart", value: wildartId, onChange: (e) => setWildartId(e.target.value), children: _jsx(WildartOptionen, { wildarten: wildarten }) }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Hinzuf\u00FCgen als" }), _jsx("span", { className: "zeile-aktionen", children: GESCHLECHTER.map((g) => (_jsxs("button", { type: "button", className: "knopf knopf-sekundaer klein", onClick: () => onHinzufuegen(wildartId, g.wert), children: [g.kurz, " ", g.label] }, g.wert))) })] })] }));
}
export function Gesamtuebersicht({ zeilen, zonen, wildarten }) {
    const daten = useMemo(() => {
        const spalten = [
            ...zonen.filter((z) => zeilen.some((x) => x.zone_id === z.id)).map((z) => ({ id: z.id, name: z.name })),
            ...(zeilen.some((x) => x.zone_id === null) ? [{ id: null, name: zonen.length ? 'ohne Zone' : 'Revier' }] : []),
            // Zonen, die inzwischen entfernt wurden
            ...[...new Set(zeilen.map((x) => x.zone_id))]
                .filter((id) => id && !zonen.some((z) => z.id === id))
                .map((id) => ({ id, name: 'entfernte Zone' })),
        ];
        const arten = [...new Set(zeilen.filter((z) => z.anzahl > 0).map((z) => z.wildart_id))].sort((a, b) => (wildarten.find((w) => w.id === a)?.sortierung ?? 0) - (wildarten.find((w) => w.id === b)?.sortierung ?? 0));
        const wert = (art, zone, g) => zeilen
            .filter((z) => z.wildart_id === art && (zone === undefined || z.zone_id === zone) && (!g || z.geschlecht === g))
            .reduce((a, z) => a + z.anzahl, 0);
        return { spalten, arten, wert };
    }, [zeilen, zonen, wildarten]);
    if (daten.arten.length === 0)
        return _jsx(Leer, { children: "In dieser Z\u00E4hlung wurde noch nichts erfasst." });
    const gesamt = zeilen.reduce((a, z) => a + z.anzahl, 0);
    return (_jsx("div", { className: "tabelle-rahmen", children: _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Wildart" }), daten.spalten.map((s) => (_jsx("th", { className: "zahl", children: s.name }, s.id ?? 'ohne'))), _jsx("th", { className: "zahl", children: "Summe" }), _jsx("th", { className: "zahl", children: "\u2642 / \u2640 / ?" })] }) }), _jsx("tbody", { children: daten.arten.map((art) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: wildartName(wildarten, art) }), daten.spalten.map((s) => (_jsx("td", { className: "zahl", children: daten.wert(art, s.id) || '–' }, s.id ?? 'ohne'))), _jsx("td", { className: "zahl stark", children: daten.wert(art, undefined) }), _jsxs("td", { className: "zahl leise", children: [daten.wert(art, undefined, 'maennlich'), " / ", daten.wert(art, undefined, 'weiblich'), " /", ' ', daten.wert(art, undefined, 'unbekannt')] })] }, art))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("th", { scope: "row", children: "Gesamt" }), daten.spalten.map((s) => (_jsx("td", { className: "zahl", children: zeilen.filter((z) => z.zone_id === s.id).reduce((a, z) => a + z.anzahl, 0) }, s.id ?? 'ohne'))), _jsx("td", { className: "zahl stark", children: gesamt }), _jsx("td", {})] }) })] }) }));
}
