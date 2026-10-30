import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { LngLatBounds, Map as KarteMap, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import kartenWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { linieEWKT } from '../../lib/geo';
import { nameVergeben } from '../../lib/stammdaten';
import { datumDE } from '../../lib/zeit';
import { Auswahl, Feld, Hinweis, Knopf } from '../../components/ui';
import { berichtErstellen, reduzieren } from '../../lib/gpsPruefung';
setWorkerUrl(kartenWorkerUrl);
const STIL = {
    version: 8,
    sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap-Mitwirkende' } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};
const ZIELNAMEN = { pirschweg: 'Pirschweg', treiberroute: 'Treiberroute', wte_route: 'WTE-Route' };
const km = (m) => `${(m / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
const uhr = (t) => new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
const zahl = (n) => n.toLocaleString('de-DE');
// GPS-Datei einer Smartwatch (GPX, KML, KMZ, FIT) übernehmen: 1. Datei und Ziel, 2. Prüfbericht und Punktreduktion, 3. Benennung
export function GpsImport({ k, onZu, onFertig, standardSitzungId }) {
    const [schritt, setSchritt] = useState(1);
    const [ziel, setZiel] = useState('pirschweg');
    const [laedt, setLaedt] = useState(false);
    const [fehler, setFehler] = useState(null);
    const [roh, setRoh] = useState(null);
    const [dateiname, setDateiname] = useState('');
    const [grenze, setGrenze] = useState(null);
    const [berichte, setBerichte] = useState([]);
    const [zeilen, setZeilen] = useState([]);
    const [toleranz, setToleranz] = useState(3);
    const [minAbstand, setMinAbstand] = useState(0);
    const [maxPunkte, setMaxPunkte] = useState(0);
    const [vorhandeneNamen, setVorhandeneNamen] = useState([]);
    const [jagden, setJagden] = useState([]);
    const [sitzungen, setSitzungen] = useState([]);
    const [jagdId, setJagdId] = useState('');
    const [sitzungId, setSitzungId] = useState(standardSitzungId ?? '');
    const [speichert, setSpeichert] = useState(false);
    useEffect(() => {
        void supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 1 }).then(({ data }) => {
            setGrenze(data?.grenze ?? null);
        });
        void supabase.from('pirschwege').select('name').eq('revier_id', k.revierId).is('geloescht_am', null).then(({ data }) => setVorhandeneNamen((data ?? []).map((x) => x.name)));
        void supabase.from('bewegungsjagden').select('id, titel, datum').eq('revier_id', k.revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(30).then(({ data }) => setJagden(data ?? []));
        void supabase.from('zaehlsitzungen').select('id, datum, status').eq('revier_id', k.revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(20).then(({ data }) => {
            setSitzungen(data ?? []);
            const offen = (data ?? []).find((s) => s.status === 'offen');
            if (offen)
                setSitzungId((alt) => alt || offen.id); // laufende Zählung: WTE-Route automatisch zuordnen
        });
    }, [k.revierId]);
    async function dateiLesen(datei) {
        setFehler(null);
        setLaedt(true);
        try {
            const { gpsParsen } = await import('../../lib/gpsParser'); // Parser erst bei Bedarf laden
            const r = await gpsParsen(datei);
            const b = berichtErstellen(r, grenze);
            if (b.length === 0)
                throw new Error('Die Datei enthält keine Tracks oder Routen (Wegpunkte werden nicht übernommen).');
            setRoh(r);
            setDateiname(datei.name);
            setBerichte(b);
            const basis = datei.name.replace(/\.[^.]+$/, '');
            setZeilen(b.map((t, i) => ({
                an: t.brauchbar,
                name: b.length === 1 ? (t.name === 'Aktivität' || /^Track \d+$/.test(t.name) ? basis : t.name) : t.name || `${basis} ${i + 1}`,
                ziel,
                bemerkung: '',
                mitDatum: false,
            })));
            setSchritt(2);
        }
        catch (err) {
            setFehler(fehlertext(err));
        }
        finally {
            setLaedt(false);
        }
    }
    const reduziert = useMemo(() => berichte.map((b) => (b.brauchbar ? reduzieren(b.punkte, toleranz, minAbstand, maxPunkte) : null)), [berichte, toleranz, minAbstand, maxPunkte]);
    const gewaehlt = berichte.filter((_, i) => zeilen[i]?.an);
    // ---------- Kartenvorschau ----------
    const el = useRef(null);
    const karte = useRef(null);
    const bereit = useRef(false);
    const gepasst = useRef(false);
    const daten = useRef({ orig: { type: 'FeatureCollection', features: [] }, red: { type: 'FeatureCollection', features: [] } });
    const zeichnen = () => {
        const m = karte.current;
        if (!m || !bereit.current)
            return;
        m.getSource('orig')?.setData(daten.current.orig);
        m.getSource('red')?.setData(daten.current.red);
        if (!gepasst.current && daten.current.orig.features.length) {
            const b = new LngLatBounds();
            for (const f of daten.current.orig.features)
                for (const c of f.geometry.coordinates)
                    b.extend(c);
            m.fitBounds(b, { padding: 40, duration: 0, maxZoom: 17 });
            gepasst.current = true;
        }
    };
    useEffect(() => {
        const linie = (p) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p.map((x) => [x.lng, x.lat]) } });
        daten.current = {
            orig: { type: 'FeatureCollection', features: berichte.flatMap((b, i) => (zeilen[i]?.an && b.brauchbar ? [linie(b.punkte)] : [])) },
            red: { type: 'FeatureCollection', features: reduziert.flatMap((r, i) => (zeilen[i]?.an && r ? [linie(r.punkte)] : [])) },
        };
        zeichnen();
    }, [berichte, reduziert, zeilen]);
    useEffect(() => {
        if (schritt !== 2 || !el.current)
            return;
        let m;
        try {
            m = new KarteMap({ container: el.current, style: STIL, center: [9.4, 52.2], zoom: 10, attributionControl: { compact: true } });
        }
        catch {
            return; // ohne WebGL entfällt nur die Vorschau
        }
        karte.current = m;
        gepasst.current = false;
        m.on('load', () => {
            m.addSource('orig', { type: 'geojson', data: daten.current.orig });
            m.addSource('red', { type: 'geojson', data: daten.current.red });
            m.addLayer({ id: 'orig', type: 'line', source: 'orig', paint: { 'line-color': '#e8863c', 'line-width': 5, 'line-opacity': 0.35 } });
            m.addLayer({ id: 'red', type: 'line', source: 'red', paint: { 'line-color': '#b3261e', 'line-width': 2.5 } });
            bereit.current = true;
            zeichnen();
        });
        return () => {
            bereit.current = false;
            karte.current = null;
            m.remove();
        };
    }, [schritt]);
    // ---------- Speichern ----------
    const alleNamen = zeilen.map((z) => (z.an ? z.name.trim() : null));
    const fehlerzeile = (z, i) => {
        if (!z.an)
            return null;
        if (!z.name.trim())
            return 'Bitte einen Namen eingeben.';
        if (nameVergeben(vorhandeneNamen, z.name))
            return 'Diesen Namen gibt es im Revier schon.';
        if (alleNamen.some((n, j) => j !== i && n && n.toLowerCase() === z.name.trim().toLowerCase()))
            return 'Doppelter Name in dieser Datei.';
        return null;
    };
    async function speichern() {
        setFehler(null);
        setSpeichert(true);
        try {
            let n = 0;
            for (const [i, z] of zeilen.entries()) {
                const r = reduziert[i];
                const b = berichte[i];
                if (!z.an || !r || !b)
                    continue;
                const datum = z.mitDatum && b.von ? `Aufgezeichnet am ${datumDE(new Date(b.von).toLocaleDateString('sv-SE'))}` : '';
                const bem = [z.bemerkung.trim(), datum].filter(Boolean).join(' · ');
                const { error } = await supabase.from('pirschwege').insert({
                    revier_id: k.revierId,
                    name: z.name.trim(),
                    bemerkung: bem || null,
                    typ: z.ziel,
                    bewegungsjagd_id: z.ziel === 'treiberroute' ? jagdId || null : null,
                    zaehlsitzung_id: z.ziel === 'wte_route' ? sitzungId || null : null,
                    geom: linieEWKT(r.punkte.map((p) => [p.lng, p.lat])),
                });
                if (error)
                    throw error;
                n++;
            }
            onFertig(`${n} ${n === 1 ? 'Linie' : 'Linien'} aus „${dateiname}“ übernommen (nur Geometrie, ohne Zeitstempel und Sensordaten).`);
        }
        catch (err) {
            setFehler(fehlertext(err));
        }
        finally {
            setSpeichert(false);
        }
    }
    const ziele = ['pirschweg', 'wte_route', ...(k.istInhaber ? ['treiberroute'] : [])].map((z) => ({ z, name: ZIELNAMEN[z] }));
    const summePunkte = berichte.reduce((s, b) => s + b.punkteGesamt, 0);
    return (_jsx("div", { className: "bj-dialog-hintergrund", role: "dialog", "aria-modal": "true", "aria-label": "GPS-Datei importieren", children: _jsxs("div", { className: "bj-dialog", style: { width: 'min(860px, 96vw)', maxHeight: '94dvh', overflow: 'auto' }, children: [_jsxs("strong", { children: ["GPS-Datei importieren \u00B7 Schritt ", schritt, " von 3"] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), schritt === 1 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "gruppe-fuss", style: { margin: 0 }, children: "GPX, KML, KMZ und FIT von Smartwatch oder GPS-Ger\u00E4t (bis 100 MB). Die Datei wird nur auf diesem Ger\u00E4t gelesen \u2013 gespeichert wird sp\u00E4ter ausschlie\u00DFlich die Linie." }), _jsx(Auswahl, { label: "\u00DCbernehmen als", value: ziel, onChange: (e) => setZiel(e.target.value), children: ziele.map((x) => (_jsx("option", { value: x.z, children: x.name }, x.z))) }), _jsxs("label", { className: "knopf knopf-akzent datei-knopf", children: [laedt ? 'Datei wird gelesen …' : 'GPS-Datei auswählen', _jsx("input", { type: "file", accept: ".gpx,.kml,.kmz,.fit,application/gpx+xml,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz", disabled: laedt, onChange: (e) => {
                                        const d = e.target.files?.[0];
                                        if (d)
                                            void dateiLesen(d);
                                        e.target.value = '';
                                    } })] })] })), schritt === 2 && roh && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "gruppe-fuss", style: { margin: 0 }, children: [_jsx("strong", { children: dateiname }), " \u00B7 ", roh.format, " \u00B7 ", berichte.length, " ", berichte.length === 1 ? 'Track' : 'Tracks', " \u00B7 ", berichte.reduce((s, b) => s + b.segmente, 0), " Segmente \u00B7 ", zahl(summePunkte), " Punkte"] }), (roh.wegpunkte > 0 || roh.sensordaten) && (_jsxs(Hinweis, { art: "info", children: [roh.wegpunkte > 0 && `${roh.wegpunkte} ${roh.wegpunkte === 1 ? 'Wegpunkt' : 'Wegpunkte'} `, roh.wegpunkte > 0 && roh.sensordaten && 'und ', roh.sensordaten && 'Sensordaten (Puls, Kadenz, Temperatur …) ', roh.wegpunkte === 1 && !roh.sensordaten ? 'wird' : 'werden', " ignoriert und nicht gespeichert."] })), berichte.map((b, i) => {
                            const z = zeilen[i];
                            const r = reduziert[i];
                            return (_jsxs("div", { className: "gruppe", style: { padding: 10 }, children: [_jsxs("label", { style: { display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }, children: [_jsx("input", { type: "checkbox", checked: z.an, disabled: !b.brauchbar, onChange: (e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, an: e.target.checked } : x))) }), b.name] }), _jsxs("div", { className: "gruppe-fuss", style: { margin: '4px 0 0' }, children: [zahl(b.punkteGesamt), " Punkte in ", b.segmente, " ", b.segmente === 1 ? 'Segment' : 'Segmenten', " \u00B7 ", km(b.laengeM), b.von !== null && b.bis !== null && ` · ${uhr(b.von)} – ${uhr(b.bis)}`, b.ausdehnungM && ` · Ausdehnung ${Math.round(b.ausdehnungM[0])} × ${Math.round(b.ausdehnungM[1])} m`] }), b.warnungen.map((w) => (_jsxs("div", { className: "hinweis hinweis-warnung", style: { marginTop: 6 }, children: ["! ", w] }, w))), z.an && r && (_jsxs("div", { className: "gruppe-fuss", style: { margin: '6px 0 0' }, children: ["Nach Reduktion: ", zahl(b.punkte.length), " \u2192 ", _jsx("strong", { children: zahl(r.punkte.length) }), " Punkte \u00B7 L\u00E4nge ", km(b.laengeM), " \u2192 ", _jsx("strong", { children: km(r.laengeM) })] }))] }, i));
                        }), _jsxs("div", { className: "gruppe", style: { padding: 10 }, children: [_jsxs("label", { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, children: ["Punktreduktion (Toleranz)", _jsx("input", { type: "range", min: 1, max: 20, step: 1, value: toleranz, onChange: (e) => setToleranz(Number(e.target.value)), "aria-label": "Toleranz der Punktreduktion in Metern" }), _jsxs("strong", { children: [toleranz, " m"] })] }), _jsxs("details", { children: [_jsx("summary", { children: "Weitere Optionen" }), _jsx(Feld, { label: "Mindestabstand zwischen Punkten (m, 0 = aus)", inputMode: "numeric", value: String(minAbstand), onChange: (e) => setMinAbstand(Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) }), _jsx(Feld, { label: "H\u00F6chstzahl Punkte je Linie (0 = unbegrenzt)", inputMode: "numeric", value: String(maxPunkte), onChange: (e) => setMaxPunkte(Math.max(0, Math.floor(Number(e.target.value) || 0))) })] })] }), _jsx("div", { ref: el, style: { height: 300, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border-input)' }, "aria-label": "Vorschau: Original hell, reduzierte Linie kr\u00E4ftig" }), _jsx("p", { className: "gruppe-fuss", style: { margin: 0 }, children: "Hell: Original \u00B7 kr\u00E4ftig rot: reduzierte Linie, die gespeichert wird." }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx(Knopf, { variante: "ghost", onClick: () => setSchritt(1), children: "Andere Datei" }), _jsxs(Knopf, { variante: "akzent", disabled: gewaehlt.length === 0, onClick: () => setSchritt(3), children: ["Weiter (", gewaehlt.length, ")"] })] })] })), schritt === 3 && (_jsxs(_Fragment, { children: [zeilen.map((z, i) => {
                            if (!z.an)
                                return null;
                            const f = fehlerzeile(z, i);
                            const b = berichte[i];
                            return (_jsxs("div", { className: "gruppe", style: { padding: 10 }, children: [_jsx(Feld, { label: "Name", value: z.name, onChange: (e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))) }), f && _jsx(Hinweis, { art: "fehler", children: f }), _jsx(Auswahl, { label: "Als", value: z.ziel, onChange: (e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, ziel: e.target.value } : x))), children: ziele.map((x) => (_jsx("option", { value: x.z, children: x.name }, x.z))) }), _jsx(Feld, { label: "Bemerkung (optional)", value: z.bemerkung, onChange: (e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, bemerkung: e.target.value } : x))) }), b.von !== null && (_jsxs("label", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: z.mitDatum, onChange: (e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, mitDatum: e.target.checked } : x))) }), "Aufzeichnungsdatum (", datumDE(new Date(b.von).toLocaleDateString('sv-SE')), ") in der Bemerkung vermerken"] }))] }, i));
                        }), zeilen.some((z) => z.an && z.ziel === 'treiberroute') && (_jsxs(Auswahl, { label: "Bewegungsjagd (optional)", value: jagdId, onChange: (e) => setJagdId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013 keine, revierweit \u2013" }), jagden.map((j) => (_jsxs("option", { value: j.id, children: [j.titel, j.datum ? ` (${datumDE(j.datum)})` : ''] }, j.id)))] })), zeilen.some((z) => z.an && z.ziel === 'wte_route') && (_jsxs(Auswahl, { label: "Z\u00E4hlung (optional)", value: sitzungId, onChange: (e) => setSitzungId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013 keine \u2013" }), sitzungen.map((s) => (_jsxs("option", { value: s.id, children: ["Z\u00E4hlung vom ", datumDE(s.datum)] }, s.id)))] })), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx(Knopf, { variante: "ghost", onClick: () => setSchritt(2), children: "Zur\u00FCck" }), _jsx(Knopf, { variante: "akzent", disabled: speichert || zeilen.some((z, i) => fehlerzeile(z, i)), onClick: () => void speichern(), children: speichert ? 'Speichern …' : 'Speichern' })] })] })), _jsx(Knopf, { variante: "ghost", onClick: onZu, disabled: speichert, children: "Abbrechen" })] }) }));
}
