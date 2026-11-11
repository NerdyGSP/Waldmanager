import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Einklappbar } from '../../components/ui';
import { BestandInfo, type GewaehlterBestand } from './BestandInfo';
import { createPortal } from 'react-dom';
import {
  GeolocateControl,
  LngLatBounds,
  Map as KarteMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapTouchEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import kartenWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Position } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { BESTANDSFARBEN, baumartenLesen, nameVergeben, useBestaende } from '../../lib/stammdaten';
import type { Json } from '../../lib/database.types';
import type { BetriebKontext } from './kontext';
import { Symbol } from '../../components/symbole';
import { EBENEN_SCHICHTEN, standardSichtbarkeit, type EbenenId } from '../../karte/ebenen/registry';
import { EBENEN_SPEICHER, ebenenEinstellungenLesen } from '../../karte/ebenen/einstellungen';
import { koordinaten, mittelpunkt, naechsterRandpunkt, punktInFlaeche } from '../../karte/kern/geometrie';

// ---------- Kartengrundlagen ----------

// MapLibre 6 sucht seinen Web-Worker neben der Bibliothek; nach dem Bündeln liegt er als eigene Datei vor
setWorkerUrl(kartenWorkerUrl);

const LUFTBILD_URL =
  'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&FORMAT=image/jpeg&LAYERS=ni_dop20&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}';

const STIL: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap-Mitwirkende',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const STANDARD_ZENTRUM: [number, number] = [9.47, 52.2]; // Raum Bad Münder

// Handys laden das Luftbild nur für den Betriebsbereich, Tablets/PCs für den ganzen Kartenausschnitt
const ISTHANDY = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 600;

const LEER: FeatureCollection = { type: 'FeatureCollection', features: [] };

type KartenDaten = {
  grenze: MultiPolygon | null;
  bestaende: Feature[];
  mitte: [number, number] | null;
};

type Ebenen = Record<EbenenId, boolean>;

type Modus = { art: 'grenze' } | { art: 'bestand'; bestandId: string | null; name: string; bearbeiten?: boolean } | null;

// ---------- Komponente ----------

export default function Karte({
  k,
  eingebettet = false,
  panelZiel = null,
  aktualisierung,
}: {
  k: BetriebKontext;
  /** Desktop: Karte dauerhaft rechts, Werkzeuge in der Seitenleiste */
  eingebettet?: boolean;
  /** Element in der Seitenleiste, in das die Werkzeuge gerendert werden (nur wenn das Kartenmodul aktiv ist) */
  panelZiel?: HTMLElement | null;
  /** Ändert sich der Wert, werden die Kartendaten neu geladen */
  aktualisierung?: unknown;
}) {
  const { bestaende, laden: bestaendeLaden } = useBestaende(k.betriebId);
  const container = useRef<HTMLDivElement>(null);
  const karte = useRef<KarteMap | null>(null);
  const beschriftungen = useRef<Marker[]>([]);
  const [bereit, setBereit] = useState(false);
  const [daten, setDaten] = useState<KartenDaten | null>(null);
  const [ebenen, setEbenen] = useState<Ebenen>(standardSichtbarkeit);
  const [modus, setModusState] = useState<Modus>(null);
  const modusRef = useRef<Modus>(null);
  const [punkte, setPunkte] = useState<Position[]>([]);
  const punkteRef = useRef<Position[]>([]);
  punkteRef.current = punkte;
  // Bearbeiten: markierter Eckpunkt sowie unveränderte Teilflächen/Löcher des Bestands
  const [gewaehlterPunkt, setGewaehlterPunkt] = useState<number | null>(null);
  const flaechenRest = useRef<{ teile: Position[][][]; loecher: Position[][] }>({ teile: [], loecher: [] });
  const [zuordnen, setZuordnen] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [menueOffen, setMenueOffen] = useState(false);
  const [panelOffen, setPanelOffen] = useState(false);
  const [kartenFehler, setKartenFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg' | 'info'; text: string } | null>(null);
  const [reglerOffen, setReglerOffen] = useState<string[]>([]);
  const grenzeRef = useRef<MultiPolygon | null>(null);
  const luftbildSchluessel = useRef('');
  const [einst, setEinst] = useState(ebenenEinstellungenLesen);
  useEffect(() => {
    try {
      localStorage.setItem(EBENEN_SPEICHER, JSON.stringify(einst));
    } catch {
      /* ohne Speicher gilt die Einstellung nur für diese Sitzung */
    }
  }, [einst]);
  const [gewaehlt, setGewaehlt] = useState<GewaehlterBestand | null>(null);

  const setModus = (m: Modus) => {
    modusRef.current = m;
    setModusState(m);
    setPunkte([]);
    setGewaehlterPunkt(null);
    setZuordnen(false);
  };

  // Daten laden
  const laden = useCallback(async () => {
    const { data, error } = await supabase.rpc('karte_daten', { p_betrieb_id: k.betriebId });
    if (error) {
      setMeldung({ art: 'fehler', text: fehlertext(error) });
      return;
    }
    const d = (data ?? {}) as { grenze?: MultiPolygon | null; bestaende?: Feature[]; mitte?: { coordinates?: number[] } | null };
    setDaten({
      grenze: d.grenze ?? null,
      bestaende: d.bestaende ?? [],
      mitte: (d.mitte?.coordinates as [number, number] | undefined) ?? null,
    });
  }, [k.betriebId]);

  // Karte initialisieren
  useEffect(() => {
    if (!container.current) return;
    let m: KarteMap;
    try {
      m = new KarteMap({ container: container.current, style: STIL, center: STANDARD_ZENTRUM, zoom: 12, attributionControl: { compact: true } });
    } catch (err) {
      // Typisch: WebGL im Browser deaktiviert oder vom Grafiktreiber gesperrt
      setKartenFehler(String((err as Error)?.message ?? err));
      return;
    }
    karte.current = m;
    let geladen = false;
    let letzterFehler = '';
    m.on('error', (e) => {
      letzterFehler = String((e as unknown as { error?: { message?: string } }).error?.message ?? '');
      if (!geladen && /webgl|context|worker/i.test(letzterFehler)) setKartenFehler(letzterFehler);
    });
    const zeitlimit = window.setTimeout(() => {
      if (!geladen) setKartenFehler(letzterFehler || 'Die Karte wurde nach 20 Sekunden nicht fertig geladen.');
    }, 20000);
    // Größenänderungen des Containers (Seitenleiste, Drehen des Geräts) an die Karte weitergeben
    const beobachter = new ResizeObserver(() => m.resize());
    beobachter.observe(container.current);
    m.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
    m.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    m.on('load', () => {
      for (const id of ['grenze', 'bestaende', 'zeichnung']) m.addSource(id, { type: 'geojson', data: LEER });
      m.addLayer({
        id: 'bestaende-flaeche',
        type: 'fill',
        source: 'bestaende',
        paint: { 'fill-color': ['coalesce', ['get', 'farbe'], '#2f6b4a'], 'fill-opacity': 0.22 },
      });
      m.addLayer({
        id: 'bestaende-linie',
        type: 'line',
        source: 'bestaende',
        paint: { 'line-color': ['coalesce', ['get', 'farbe'], '#2f6b4a'], 'line-width': 1.5 },
      });
      m.addLayer({
        id: 'bestaende-auswahl',
        type: 'line',
        source: 'bestaende',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'line-color': '#f26a1b', 'line-width': 4 },
      });
      m.addLayer({ id: 'grenze-linie', type: 'line', source: 'grenze', paint: { 'line-color': '#e4572e', 'line-width': 3 } });
      m.addLayer({
        id: 'zeichnung-flaeche',
        type: 'fill',
        source: 'zeichnung',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#1f6fb2', 'fill-opacity': 0.2 },
      });
      m.addLayer({
        id: 'zeichnung-linie',
        type: 'line',
        source: 'zeichnung',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': '#1f6fb2', 'line-width': 2.5 },
      });
      m.addLayer({
        id: 'zeichnung-punkte',
        type: 'circle',
        source: 'zeichnung',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['==', ['get', 'sel'], 1], 9, 6],
          'circle-color': ['case', ['==', ['get', 'sel'], 1], '#1f6fb2', '#fff'],
          'circle-stroke-color': '#1f6fb2',
          'circle-stroke-width': 2,
        },
      });
      m.on('mouseenter', 'bestaende-flaeche', () => {
        if (!modusRef.current) m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'bestaende-flaeche', () => {
        m.getCanvas().style.cursor = '';
      });
      geladen = true;
      window.clearTimeout(zeitlimit);
      setKartenFehler(null);
      setBereit(true);
    });

    return () => {
      window.clearTimeout(zeitlimit);
      beobachter.disconnect();
      m.remove();
      karte.current = null;
    };
  }, []);

  useEffect(() => {
    if (bereit) void laden();
  }, [bereit, laden, aktualisierung]);

  // Daten in die Karte schreiben
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit || !daten) return;
    const setzen = (id: string, fc: FeatureCollection) => (m.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
    setzen('grenze', { type: 'FeatureCollection', features: daten.grenze ? [{ type: 'Feature', geometry: daten.grenze, properties: {} }] : [] });
    setzen('bestaende', { type: 'FeatureCollection', features: daten.bestaende });
    grenzeRef.current = daten.grenze;

    // Handy: Luftbild nur für die Betriebsgrenze (+ ca. 150 m Rand); Tablet/PC: für den gesamten Kartenausschnitt
    // Nur neu aufbauen, wenn sich die Ausdehnung wirklich geändert hat – sonst lädt der Browser alle Kacheln erneut
    const bb = daten.grenze ? grenzen([daten.grenze]) : null;
    const schluessel = ISTHANDY ? (bb ? 'handy:' + [bb.getWest(), bb.getSouth(), bb.getEast(), bb.getNorth()].map((v) => v.toFixed(5)).join(',') : '') : 'voll';
    if (schluessel !== luftbildSchluessel.current || ((bb || !ISTHANDY) && !m.getLayer('luftbild'))) {
      luftbildSchluessel.current = schluessel;
      if (m.getLayer('luftbild')) m.removeLayer('luftbild');
      if (m.getSource('luftbild')) m.removeSource('luftbild');
      if (bb || !ISTHANDY) {
        const rand = 0.002;
        m.addSource('luftbild', {
          type: 'raster',
          tiles: [LUFTBILD_URL],
          tileSize: 256,
          // Handy: gröbere Auflösung spart Daten (Zoom 18 ≈ 0,4 m/Pixel); Tablet/PC bis zur Originalauflösung des Orthofotos
          maxzoom: ISTHANDY ? 18 : 19,
          ...(ISTHANDY && bb ? { bounds: [bb.getWest() - rand, bb.getSouth() - rand, bb.getEast() + rand, bb.getNorth() + rand] as [number, number, number, number] } : {}),
          attribution: `Luftbild © GeoBasis-DE/LGLN ${new Date().getFullYear()}, Daten geändert`,
        });
        m.addLayer({ id: 'luftbild', type: 'raster', source: 'luftbild', layout: { visibility: ebenen.luftbild ? 'visible' : 'none' } }, 'bestaende-flaeche');
      }
    }

    // Bestandsnamen als HTML-Beschriftung (kommt ohne Schrift-Server aus)
    for (const mk of beschriftungen.current) mk.remove();
    beschriftungen.current = daten.bestaende.map((f) => {
      const el = document.createElement('div');
      el.className = 'zonen-beschriftung';
      el.textContent = String(f.properties?.name ?? '');
      el.style.display = ebenen.bestaende ? '' : 'none';
      return new Marker({ element: el }).setLngLat(mittelpunkt(f.geometry)).addTo(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten, bereit]);

  // Beim ersten Laden auf den Betrieb zoomen, sonst auf den eigenen Standort
  const gezoomt = useRef(false);
  useEffect(() => {
    const m = karte.current;
    if (!m || !daten || gezoomt.current) return;
    gezoomt.current = true;
    const b = grenzen([...(daten.grenze ? [daten.grenze] : []), ...daten.bestaende.map((f) => f.geometry)]);
    if (b) m.fitBounds(b, { padding: { top: 40, bottom: 60, left: 40, right: 60 }, maxZoom: 16, duration: 0 });
    else
      navigator.geolocation?.getCurrentPosition(
        (p) => m.jumpTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 14 }),
        () => undefined,
        { timeout: 8000 },
      );
  }, [daten]);

  // Ebenen ein-/ausblenden
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const sichtbar = (ebene: string, an: boolean) => m.getLayer(ebene) && m.setLayoutProperty(ebene, 'visibility', an ? 'visible' : 'none');
    sichtbar('luftbild', ebenen.luftbild);
    sichtbar('grenze-linie', ebenen.grenze);
    for (const s of EBENEN_SCHICHTEN.bestaende) sichtbar(s, ebenen.bestaende);
    for (const mk of beschriftungen.current) mk.getElement().style.display = ebenen.bestaende ? '' : 'none';
  }, [ebenen, bereit, daten]);

  // Reihenfolge und Transparenz der Ebenen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const d = einst.deckkraft;
    const setze = (schicht: string, eigenschaft: string, wert: number) => {
      if (m.getLayer(schicht)) (m.setPaintProperty as (s: string, e: string, w: number) => void)(schicht, eigenschaft, wert);
    };
    setze('luftbild', 'raster-opacity', d.luftbild);
    setze('bestaende-flaeche', 'fill-opacity', d.bestaende * 0.4);
    setze('bestaende-linie', 'line-opacity', Math.min(1, d.bestaende * 1.8));
    setze('grenze-linie', 'line-opacity', d.grenze);
    for (const mk of beschriftungen.current) mk.getElement().style.opacity = String(Math.min(1, d.bestaende * 1.8));
    // von unten nach oben jeweils an die Spitze stellen; Zeichnung bleibt immer ganz oben
    for (const id of [...einst.reihenfolge].reverse()) {
      for (const schicht of EBENEN_SCHICHTEN[id]) if (m.getLayer(schicht)) m.moveLayer(schicht);
    }
    for (const schicht of ['zeichnung-flaeche', 'zeichnung-linie', 'zeichnung-punkte']) if (m.getLayer(schicht)) m.moveLayer(schicht);
  }, [einst, bereit, daten]);

  // Ausgewählten Bestand hervorheben
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit || !m.getLayer('bestaende-auswahl')) return;
    m.setFilter('bestaende-auswahl', ['==', ['get', 'id'], gewaehlt?.id ?? '']);
  }, [gewaehlt, bereit]);
  useEffect(() => {
    if (modus) setGewaehlt(null);
  }, [modus]);

  // Zeichnung anzeigen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const features: Feature[] = punkte.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { sel: i === gewaehlterPunkt ? 1 : 0 } }));
    if (punkte.length >= 3) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...punkte, punkte[0]!]] }, properties: {} });
    else if (punkte.length === 2) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: punkte }, properties: {} });
    (m.getSource('zeichnung') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [punkte, bereit, gewaehlterPunkt]);

  // Klicks: im Zeichenmodus Punkte setzen, sonst Bestand anzeigen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const klick = (e: MapMouseEvent) => {
      const aktiv = modusRef.current;
      const pos: Position = [e.lngLat.lng, e.lngLat.lat];
      if (aktiv?.art === 'bestand' && aktiv.bearbeiten) return; // eigener Handler (Punkte ziehen/einfügen)
      if (aktiv && !zuordnen) {
        const grenze = grenzeRef.current;
        if (aktiv.art === 'bestand' && grenze && !punktInFlaeche(pos, grenze)) {
          // Bestände dürfen nicht über die Betriebsgrenze hinausgehen
          setPunkte((alt) => [...alt, naechsterRandpunkt(pos, grenze)]);
          setMeldung({ art: 'info', text: 'Punkt lag außerhalb und wurde auf die Betriebsgrenze gesetzt.' });
          return;
        }
        setPunkte((alt) => [...alt, pos]);
        return;
      }
      if (aktiv) return;
      const f = m.queryRenderedFeatures(e.point, { layers: ['bestaende-flaeche'] })[0];
      if (!f) {
        setGewaehlt(null);
        return;
      }
      const p = f.properties ?? {};
      // MapLibre liefert verschachtelte Eigenschaften als JSON-Text
      const roh = typeof p.baumarten === 'string' ? (() => { try { return JSON.parse(p.baumarten as string) as unknown; } catch { return []; } })() : p.baumarten;
      setGewaehlt({
        id: String(p.id),
        name: String(p.name ?? ''),
        farbe: (p.farbe as string | null) ?? null,
        flaecheHa: p.flaeche_ha != null ? Number(p.flaeche_ha) : null,
        bestandestyp: (p.bestandestyp as string | null) ?? null,
        baumarten: baumartenLesen(roh),
        pflanzjahr: p.pflanzjahr != null ? Number(p.pflanzjahr) : null,
        vorratVfmHa: p.vorrat_vfm_ha != null ? Number(p.vorrat_vfm_ha) : null,
      });
    };
    m.on('click', klick);
    if (modus) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
    return () => {
      m.off('click', klick);
    };
  }, [bereit, modus, zuordnen]);

  // Bestand bearbeiten: Eckpunkte ziehen, Linie antippen = Punkt einfügen, Punkt antippen = markieren
  const bearbeitet = modus?.art === 'bestand' && !!modus.bearbeiten;
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit || !bearbeitet) return;
    const TREFFER = 18;
    let ziehen: number | null = null;
    let bewegt = false;
    let zuletztGezogen = 0;
    const naechster = (pt: { x: number; y: number }): number | null => {
      let best: number | null = null;
      let bestD = TREFFER;
      punkteRef.current.forEach((p, i) => {
        const s = m.project(p as [number, number]);
        const d = Math.hypot(s.x - pt.x, s.y - pt.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    };
    const runter = (e: MapMouseEvent | MapTouchEvent) => {
      const i = naechster(e.point);
      if (i === null) return;
      e.preventDefault();
      ziehen = i;
      bewegt = false;
      m.dragPan.disable();
      setGewaehlterPunkt(i);
    };
    const bewegen = (e: MapMouseEvent | MapTouchEvent) => {
      if (ziehen === null) return;
      bewegt = true;
      const pos: Position = [e.lngLat.lng, e.lngLat.lat];
      const i = ziehen;
      setPunkte((alt) => alt.map((p, j) => (j === i ? pos : p)));
    };
    const hoch = () => {
      if (ziehen === null) return;
      ziehen = null;
      if (bewegt) zuletztGezogen = Date.now();
      bewegt = false;
      m.dragPan.enable();
    };
    const klick = (e: MapMouseEvent) => {
      // das Click-Ereignis direkt nach dem Ziehen ignorieren
      if (Date.now() - zuletztGezogen < 300) return;
      if (naechster(e.point) !== null) return;
      // nächstgelegene Kante suchen und dort einen Punkt einfügen
      const pts = punkteRef.current.map((p) => m.project(p as [number, number]));
      let bestI = -1;
      let bestD = TREFFER;
      let bestP = { x: 0, y: 0 };
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((e.point.x - a.x) * dx + (e.point.y - a.y) * dy) / l2));
        const px = a.x + t * dx;
        const py = a.y + t * dy;
        const d = Math.hypot(e.point.x - px, e.point.y - py);
        if (d < bestD) {
          bestD = d;
          bestI = i;
          bestP = { x: px, y: py };
        }
      }
      if (bestI < 0) {
        setGewaehlterPunkt(null);
        return;
      }
      const ll = m.unproject([bestP.x, bestP.y]);
      setPunkte((alt) => [...alt.slice(0, bestI + 1), [ll.lng, ll.lat] as Position, ...alt.slice(bestI + 1)]);
      setGewaehlterPunkt(bestI + 1);
    };
    m.on('mousedown', runter);
    m.on('touchstart', runter);
    m.on('mousemove', bewegen);
    m.on('touchmove', bewegen);
    m.on('mouseup', hoch);
    m.on('touchend', hoch);
    m.on('click', klick);
    return () => {
      m.off('mousedown', runter);
      m.off('touchstart', runter);
      m.off('mousemove', bewegen);
      m.off('touchmove', bewegen);
      m.off('mouseup', hoch);
      m.off('touchend', hoch);
      m.off('click', klick);
      m.dragPan.enable();
    };
  }, [bereit, bearbeitet]);

  // Vorhandenen Bestand zur Bearbeitung der Eckpunkte laden (größte Teilfläche; weitere Teile und Löcher bleiben erhalten)
  function bestandBearbeiten(bestandId: string, name: string) {
    const f = daten?.bestaende.find((b) => String((b.properties as { id?: string } | null)?.id ?? b.id) === bestandId);
    const g = f?.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
      setMeldung({ art: 'fehler', text: 'Dieser Bestand hat noch keine Fläche.' });
      return;
    }
    const teile: Position[][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const flaeche = (ring: Position[]) => {
      const xs = ring.map((p) => p[0]!);
      const ys = ring.map((p) => p[1]!);
      return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    };
    let wahl = 0;
    teile.forEach((t, i) => {
      if (flaeche(t[0]!) > flaeche(teile[wahl]![0]!)) wahl = i;
    });
    const ring = teile[wahl]![0]!.slice(0, -1);
    setModus({ art: 'bestand', bestandId, name, bearbeiten: true });
    flaechenRest.current = { teile: teile.filter((_, i) => i !== wahl), loecher: teile[wahl]!.slice(1) };
    setPunkte(ring);
    setMeldung({ art: 'info', text: 'Punkte ziehen · auf eine Linie tippen fügt einen Punkt ein · Punkt antippen und „Punkt löschen“.' });
  }

  // ---------- Aktionen ----------

  function zeichnungAbschliessen() {
    if (!modus) return;
    setMeldung(null);
    if (punkte.length < 3) {
      setMeldung({ art: 'fehler', text: 'Bitte mindestens drei Punkte setzen.' });
      return;
    }
    // Neuer Bestand: erst fragen, zu welchem Bestand die Fläche gehört
    if (modus.art === 'bestand' && !modus.bestandId) {
      setZuordnen(true);
      return;
    }
    void zeichnungSpeichern(modus.art === 'bestand' ? { bestandId: modus.bestandId, name: modus.name } : undefined);
  }

  async function zeichnungSpeichern(ziel?: { bestandId: string | null; name: string }) {
    if (!modus) return;
    setMeldung(null);
    setSpeichert(true);
    try {
      const aussen = [...punkte, punkte[0]!];
      const geojson = (
        modus.art === 'bestand' && modus.bearbeiten
          ? flaechenRest.current.teile.length
            ? { type: 'MultiPolygon', coordinates: [[aussen, ...flaechenRest.current.loecher], ...flaechenRest.current.teile] }
            : { type: 'Polygon', coordinates: [aussen, ...flaechenRest.current.loecher] }
          : { type: 'Polygon', coordinates: [aussen] }
      ) as unknown as Json;
      if (modus.art === 'grenze') {
        const { data, error } = await supabase.rpc('grenze_setzen', { p_betrieb_id: k.betriebId, p_geojson: geojson });
        if (error) throw error;
        setMeldung({ art: 'erfolg', text: `Betriebsgrenze gespeichert · ${Number(data).toLocaleString('de-DE')} ha` });
        await k.neuLaden();
      } else if (ziel) {
        let bestandId = ziel.bestandId;
        const neu = !bestandId;
        if (!bestandId) {
          const { data: angelegt, error: anlegeFehler } = await supabase
            .from('bestaende')
            .insert({ betrieb_id: k.betriebId, name: ziel.name, sortierung: bestaende.length, farbe: BESTANDSFARBEN[bestaende.length % BESTANDSFARBEN.length] })
            .select('id')
            .single();
          if (anlegeFehler) throw anlegeFehler;
          bestandId = angelegt.id;
        }
        const { data: ha, error } = await supabase.rpc('bestand_geometrie_setzen', { p_bestand_id: bestandId, p_geojson: geojson });
        if (error) {
          // Neu angelegter Bestand ohne gültige Fläche wieder entfernen
          if (neu) await supabase.from('bestaende').delete().eq('id', bestandId);
          throw error;
        }
        setMeldung({ art: 'erfolg', text: `Bestand „${ziel.name}“ gespeichert · ${Number(ha).toLocaleString('de-DE')} ha${grenzeRef.current ? ' (auf Betriebsgrenze zugeschnitten)' : ''}` });
        await bestaendeLaden();
      }
      setModus(null);
      await laden();
    } catch (err) {
      setMeldung({ art: 'fehler', text: fehlertext(err) });
    } finally {
      setSpeichert(false);
    }
  }

  // ---------- Darstellung ----------

  const zeichnet = !!modus;
  const reglerUmschalten = (id: string) => setReglerOffen((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const verschieben = (i: number, richtung: -1 | 1) =>
    setEinst((alt) => {
      const liste = [...alt.reihenfolge];
      const j = i + richtung;
      if (j < 0 || j >= liste.length) return alt;
      [liste[i], liste[j]] = [liste[j]!, liste[i]!];
      return { ...alt, reihenfolge: liste };
    });
  const ebenenInfo: Record<EbenenId, { name: string; label: string; an: boolean; gesperrt?: boolean }> = {
    luftbild: {
      name: 'Luftbild',
      label: ISTHANDY ? (daten?.grenze ? 'Luftbild (LGLN, nur Betriebsbereich)' : 'Luftbild – erst Betriebsgrenze zeichnen') : 'Luftbild (LGLN)',
      an: ebenen.luftbild && (!ISTHANDY || !!daten?.grenze),
      gesperrt: ISTHANDY && !daten?.grenze,
    },
    bestaende: { name: 'Bestände', label: `Bestände (${daten?.bestaende.length ?? 0})`, an: ebenen.bestaende },
    grenze: { name: 'Betriebsgrenze', label: 'Betriebsgrenze', an: ebenen.grenze },
  };
  const ohneFlaeche = bestaende.filter((b) => !b.hatGeometrie);

  const werkzeuge = (
    <>
      {meldung && <div className={`hinweis hinweis-${meldung.art}`}>{meldung.text}</div>}
      <Abschnitt titel="Ebenen" offen>
        <p className="leer" style={{ margin: 0 }}>
          Oberste Ebene liegt über den anderen. Mit den Pfeilen verschieben, mit dem Regler die Transparenz einstellen.
        </p>
        <ul className="ebenen-liste">
          {einst.reihenfolge.map((id, i) => {
            const info = ebenenInfo[id];
            return (
              <li key={id}>
                <div className="ebenen-kopf">
                  <EbenenSchalter label={info.label} an={info.an} gesperrt={info.gesperrt} onAendern={(an) => setEbenen({ ...ebenen, [id]: an })} />
                  <span className="ebenen-schieber">
                    <button
                      type="button"
                      className="regler-knopf"
                      aria-label={`Transparenz-Einstellung ${info.name}`}
                      aria-expanded={reglerOffen.includes(id)}
                      title="Transparenz einstellen"
                      onClick={() => reglerUmschalten(id)}
                    >
                      <Symbol name="einstellungen" className="symbol klein" />
                    </button>
                    <button type="button" aria-label={`${info.name} nach oben`} disabled={i === 0} onClick={() => verschieben(i, -1)}>
                      <Symbol name="nachOben" className="symbol klein" />
                    </button>
                    <button type="button" aria-label={`${info.name} nach unten`} disabled={i === einst.reihenfolge.length - 1} onClick={() => verschieben(i, 1)}>
                      <Symbol name="nachUnten" className="symbol klein" />
                    </button>
                  </span>
                </div>
                {reglerOffen.includes(id) && (
                  <label className="transparenz">
                    <span>Transparenz</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round((1 - einst.deckkraft[id]) * 100)}
                      aria-label={`Transparenz ${info.name}`}
                      onChange={(e) => setEinst((alt) => ({ ...alt, deckkraft: { ...alt.deckkraft, [id]: 1 - Number(e.target.value) / 100 } }))}
                    />
                    <output>{Math.round((1 - einst.deckkraft[id]) * 100)} %</output>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
        <p className="leer" style={{ margin: 0 }}>
          {ISTHANDY
            ? 'Mobil wird das Luftbild nur für den Betriebsbereich geladen und auf dem Gerät zwischengespeichert, um Daten zu sparen.'
            : 'Das Luftbild wird für den gesamten Kartenausschnitt geladen und auf dem Gerät zwischengespeichert.'}
        </p>
      </Abschnitt>
      {ohneFlaeche.length > 0 && (
        <p className="leer">
          Noch ohne Fläche: {ohneFlaeche.map((b) => b.name).join(', ')}. Über „+ NEU“ → „Bestand zeichnen“ zuordnen.
        </p>
      )}
      <p className="leer">Zeichnen findest du im Menü „+ NEU“ auf der Karte.</p>
    </>
  );

  return (
    <div className="karte-seite">
      <div ref={container} className="karte" />

      {!zeichnet && k.istInhaber && (
        <div className="karte-chips">
          <div className="karte-chip-reihe">
            <button type="button" className="karte-chip chip-knopf" aria-haspopup="menu" aria-expanded={menueOffen} onClick={() => setMenueOffen((o) => !o)}>
              <Symbol name="neu" className="symbol klein" /> NEU
            </button>
          </div>
        </div>
      )}

      {menueOffen && !zeichnet && (
        <div className="wte-menue" role="menu" aria-label="Neu">
          <p className="menue-gruppe">Zeichnen</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenueOffen(false);
              setModus({ art: 'grenze' });
            }}
          >
            {daten?.grenze ? 'Betriebsgrenze neu zeichnen' : 'Betriebsgrenze zeichnen'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenueOffen(false);
              setModus({ art: 'bestand', bestandId: null, name: '' });
            }}
          >
            Bestand zeichnen
          </button>
        </div>
      )}

      {zeichnet && !zuordnen && (
        <div className="zeichen-leiste">
          <span>
            {modus.art === 'grenze' && 'Betriebsgrenze: Eckpunkte antippen'}
            {modus.art === 'bestand' && modus.bearbeiten && `Bestand „${modus.name}“ bearbeiten: Punkte ziehen, Linie antippen = Punkt einfügen`}
            {modus.art === 'bestand' && !modus.bearbeiten && 'Neuer Bestand: Eckpunkte antippen'}
          </span>
          {modus.art === 'bestand' && modus.bearbeiten ? (
            <button
              className="knopf knopf-sekundaer klein"
              onClick={() => {
                setPunkte((p) => p.filter((_, i) => i !== gewaehlterPunkt));
                setGewaehlterPunkt(null);
              }}
              disabled={gewaehlterPunkt === null || punkte.length <= 3}
            >
              Punkt löschen
            </button>
          ) : (
            <button className="knopf knopf-sekundaer klein" onClick={() => setPunkte((p) => p.slice(0, -1))} disabled={!punkte.length}>
              ↶ Zurück
            </button>
          )}
          <button className="knopf knopf-primaer klein" disabled={speichert} onClick={zeichnungAbschliessen}>
            Fertig
          </button>
          <button className="knopf knopf-gefahr klein" onClick={() => setModus(null)}>
            Abbrechen
          </button>
        </div>
      )}

      {zuordnen && (
        <BestandZuordnen
          ohneFlaeche={ohneFlaeche.map((b) => ({ id: b.id, name: b.name }))}
          vergeben={bestaende.map((b) => b.name)}
          info={`${punkte.length} Punkte`}
          speichert={speichert}
          onSpeichern={(z) => void zeichnungSpeichern(z)}
          onAbbrechen={() => setZuordnen(false)}
        />
      )}

      {gewaehlt && !modus && (
        <BestandInfo
          bestand={gewaehlt}
          onSchliessen={() => setGewaehlt(null)}
          onBearbeiten={k.istInhaber ? () => bestandBearbeiten(gewaehlt.id, gewaehlt.name) : undefined}
        />
      )}

      {kartenFehler && (
        <div className="karte-fehler" role="alert">
          <strong>Die Karte kann in diesem Browser nicht angezeigt werden.</strong>
          <p>
            Meist ist WebGL deaktiviert oder vom Grafiktreiber gesperrt. In Firefox: Einstellungen → Allgemein → Leistung →
            „Hardwarebeschleunigung verwenden“ aktivieren und den Browser neu starten – oder Edge bzw. Chrome verwenden.
          </p>
          <code>{kartenFehler}</code>
        </div>
      )}

      {!eingebettet && (
        <button className="panel-schalter" onClick={() => setPanelOffen((o) => !o)} aria-expanded={panelOffen}>
          {panelOffen ? 'Schließen' : 'Ebenen & Werkzeuge'}
        </button>
      )}

      {!eingebettet && panelOffen && <aside className="karte-panel">{werkzeuge}</aside>}
      {eingebettet && panelZiel && createPortal(<div className="karte-werkzeuge">{werkzeuge}</div>, panelZiel)}
    </div>
  );
}

// ---------- Teilkomponenten ----------

function Abschnitt({ titel, offen = false, children }: { titel: string; offen?: boolean; children: ReactNode }) {
  return (
    <Einklappbar variante="abschnitt" titel={titel} offen={offen} speicher={`karte.abschnitt.${titel}`}>
      {children}
    </Einklappbar>
  );
}

function EbenenSchalter({ label, an, gesperrt = false, onAendern }: { label: string; an: boolean; gesperrt?: boolean; onAendern: (an: boolean) => void }) {
  return (
    <label className={`ebene ${gesperrt ? 'gesperrt' : ''}`}>
      <input type="checkbox" checked={an} disabled={gesperrt} onChange={(e) => onAendern(e.target.checked)} />
      {label}
    </label>
  );
}

/** Nach dem Zeichnen: Fläche einem vorhandenen Bestand ohne Fläche zuordnen oder einen neuen anlegen */
function BestandZuordnen({
  ohneFlaeche,
  vergeben,
  info,
  speichert,
  onSpeichern,
  onAbbrechen,
}: {
  ohneFlaeche: Array<{ id: string; name: string }>;
  vergeben: string[];
  info: string;
  speichert: boolean;
  onSpeichern: (ziel: { bestandId: string | null; name: string }) => void;
  onAbbrechen: () => void;
}) {
  const [wahl, setWahl] = useState(ohneFlaeche[0]?.id ?? '');
  const [name, setName] = useState('');
  const neu = wahl === '';
  const doppelt = neu && !!name.trim() && nameVergeben(vergeben, name);
  const ok = neu ? !!name.trim() && !doppelt : true;
  return (
    <div className="karte-dialog" role="dialog" aria-label="Fläche einem Bestand zuordnen">
      <strong>Fläche zuordnen</strong>
      <small>{info}</small>
      <select value={wahl} onChange={(e) => setWahl(e.target.value)} aria-label="Bestand">
        {ohneFlaeche.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} (noch ohne Fläche)
          </option>
        ))}
        <option value="">Neuer Bestand …</option>
      </select>
      {neu && <input placeholder="Name, z. B. 4a" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name des neuen Bestands" />}
      {doppelt && <span className="feld-fehler">Einen Bestand „{name.trim()}“ gibt es bereits.</span>}
      <div className="karte-dialog-knoepfe">
        <button className="knopf knopf-sekundaer klein" onClick={onAbbrechen}>
          Zurück
        </button>
        <button
          className="knopf knopf-primaer klein"
          disabled={!ok || speichert}
          onClick={() => onSpeichern(neu ? { bestandId: null, name: name.trim() } : { bestandId: wahl, name: ohneFlaeche.find((b) => b.id === wahl)?.name ?? '' })}
        >
          Speichern
        </button>
      </div>
    </div>
  );
}

// ---------- Geometrie-Helfer (weitere in src/karte/kern/geometrie.ts) ----------

function grenzen(geometrien: Geometry[]): LngLatBounds | null {
  const alle = geometrien.flatMap(koordinaten);
  if (!alle.length) return null;
  const b = new LngLatBounds();
  for (const p of alle) b.extend([p[0]!, p[1]!]);
  return b;
}
