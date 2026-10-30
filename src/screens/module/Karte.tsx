import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ZonenInfo, type GewaehlteZone } from './ZonenInfo';
import { WetterPanel } from './WetterPanel';
import { WteSichtung, type WteSitzung, type WteZone } from './WteSichtung';
import { createPortal } from 'react-dom';
import {
  GeolocateControl,
  LngLatBounds,
  Map as KarteMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type FilterSpecification,
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
import { EINRICHTUNGSTYPEN, GESCHLECHTER, nameVergeben, useWildarten, useZonen, wildartName, ZONENFARBEN } from '../../lib/stammdaten';
import { datumDE, datumZeitDE } from '../../lib/zeit';
import { aktuellesWetter, himmelsrichtung, linieEWKT, punktEWKT, type Wetter } from '../../lib/geo';
import { navigieren } from '../../lib/router';
import { EinrichtungsIcon, einrichtungsBild } from '../../lib/einrichtungsIcons';
import type { Enums, Json } from '../../lib/database.types';
import type { RevierKontext } from './kontext';
import { Symbol } from '../../components/symbole';
import { EinrichtungsOptionen } from '../../components/EinrichtungsOptionen';
import { EinrichtungSheet, VerschiebeLeiste, type EinrichtungInfo } from './EinrichtungSheet';
import { speichernOderMerken, wartendeZaehlungen } from '../../lib/offline';
import { useZaehlungGeaendert, useZonenSummen } from '../../lib/zaehlEreignis';
import { GpsImport } from './GpsImport';
import { useRoutenEbenen, ROUTENFOKUS, routenTypFarbe } from '../../lib/routen';
import { ZeichnenSheet, type SheetArt, type SheetWerte } from './ZeichnenSheet';

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


// Logische Kartenebenen: jede besteht aus einer oder mehreren MapLibre-Schichten
type EbenenId = 'einrichtungen' | 'abschuesse' | 'pirschwege' | 'treiberrouten' | 'wteRouten' | 'heatmap' | 'grenze' | 'zonen' | 'luftbild';
const EBENEN_SCHICHTEN: Record<EbenenId, string[]> = {
  luftbild: ['luftbild'],
  zonen: ['zonen-flaeche', 'zonen-linie', 'zonen-auswahl'],
  grenze: ['grenze-linie'],
  heatmap: ['heatmap'],
  pirschwege: ['pirschwege-linie'],
  treiberrouten: ['treiberrouten-linie', 'treiberrouten-pfeile'],
  wteRouten: ['wte-routen-linie', 'wte-routen-pfeile'],
  abschuesse: ['abschuesse-punkt'],
  einrichtungen: ['einrichtungen-punkt'],
};
// oben → unten
const STANDARD_REIHENFOLGE: EbenenId[] = ['einrichtungen', 'abschuesse', 'pirschwege', 'treiberrouten', 'wteRouten', 'heatmap', 'grenze', 'zonen', 'luftbild'];
const STANDARD_DECKKRAFT: Record<EbenenId, number> = {
  einrichtungen: 1,
  abschuesse: 1,
  pirschwege: 1,
  treiberrouten: 1,
  wteRouten: 1,
  heatmap: 0.75,
  grenze: 1,
  zonen: 0.55,
  luftbild: 1,
};
const EBENEN_SPEICHER = 'hegewerk.karte.ebenen';

function ebenenEinstellungenLesen(): { reihenfolge: EbenenId[]; deckkraft: Record<EbenenId, number> } {
  try {
    const roh = JSON.parse(localStorage.getItem(EBENEN_SPEICHER) ?? 'null') as { reihenfolge?: string[]; deckkraft?: Record<string, number> } | null;
    const reihenfolge = roh?.reihenfolge;
    const gueltig = Array.isArray(reihenfolge) && reihenfolge.length === STANDARD_REIHENFOLGE.length && STANDARD_REIHENFOLGE.every((id) => reihenfolge.includes(id));
    const deckkraft = { ...STANDARD_DECKKRAFT };
    for (const id of STANDARD_REIHENFOLGE) {
      const w = roh?.deckkraft?.[id];
      if (typeof w === 'number' && w >= 0 && w <= 1) deckkraft[id] = w;
    }
    return { reihenfolge: gueltig ? (reihenfolge as EbenenId[]) : STANDARD_REIHENFOLGE, deckkraft };
  } catch {
    return { reihenfolge: STANDARD_REIHENFOLGE, deckkraft: { ...STANDARD_DECKKRAFT } };
  }
}

// Richtungspfeil (zeigt nach rechts = Linienrichtung) für Treiber- und WTE-Routen
function pfeilBild(): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.strokeStyle = '#111';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(4, 5);
  g.lineTo(20, 12);
  g.lineTo(4, 19);
  g.lineTo(8, 12);
  g.closePath();
  g.fill();
  g.stroke();
  return g.getImageData(0, 0, 24, 24);
}

// Handys laden das Luftbild nur für den Revierbereich, Tablets/PCs für den ganzen Kartenausschnitt
const ISTHANDY = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 600;

const LEER: FeatureCollection = { type: 'FeatureCollection', features: [] };

type KartenEbene = { id: string; name: string; farbe: string | null; wte_aktiv?: boolean };

type KartenDaten = {
  grenze: MultiPolygon | null;
  ebenen: KartenEbene[];
  zonen: Feature[];
  einrichtungen: Feature[];
  pirschwege: Feature[];
  beobachtungen: Feature[];
  abschuesse: Feature[];
  zaehlungen: Feature[];
  mitte: [number, number] | null;
};

const HEATNAMEN = { zaehlungen: 'Zählungen', beobachtungen: 'Beobachtungen', abschuesse: 'Abschüsse' } as const;
type HeatQuelle = 'zaehlungen' | 'beobachtungen' | 'abschuesse';
const WILDARTFARBEN = ['#c0392b', '#1f6fb2', '#1e8449', '#b9770e', '#8e44ad', '#16a085', '#d35400', '#5d6d7e', '#cb4335', '#2e4053'];

type Ebenen = {
  luftbild: boolean;
  grenze: boolean;
  zonen: boolean;
  einrichtungen: boolean;
  pirschwege: boolean;
  treiberrouten: boolean;
  wteRouten: boolean;
  heatmap: boolean;
  abschuesse: boolean;
};

type RouteTyp = 'pirschweg' | 'treiberroute' | 'wte_route';
const ROUTENNAME: Record<RouteTyp, string> = { pirschweg: 'Pirschweg', treiberroute: 'Treiberroute', wte_route: 'WTE-Route' };

type Modus =
  | { art: 'grenze' }
  | { art: 'zone'; zoneId: string | null; name: string; bearbeiten?: boolean }
  | { art: 'route'; typ: RouteTyp }
  | { art: 'aufzeichnung'; typ: RouteTyp }
  | { art: 'einrichtung' }
  | null;

// ---------- Komponente ----------

export default function Karte({
  k,
  eingebettet = false,
  panelZiel = null,
  aktualisierung,
}: {
  k: RevierKontext;
  /** Desktop: Karte dauerhaft rechts, Werkzeuge in der Seitenleiste */
  eingebettet?: boolean;
  /** Element in der Seitenleiste, in das die Werkzeuge gerendert werden (nur wenn das Kartenmodul aktiv ist) */
  panelZiel?: HTMLElement | null;
  /** Ändert sich der Wert, werden die Kartendaten neu geladen */
  aktualisierung?: unknown;
}) {
  const wildarten = useWildarten();
  const { zonen, laden: zonenLaden } = useZonen(k.revierId);
  const container = useRef<HTMLDivElement>(null);
  const karte = useRef<KarteMap | null>(null);
  const zonenMarker = useRef<Marker[]>([]);
  const [bereit, setBereit] = useState(false);
  const [daten, setDaten] = useState<KartenDaten | null>(null);
  const [ebenen, setEbenen] = useState<Ebenen>({
    luftbild: false,
    grenze: true,
    zonen: true,
    einrichtungen: true,
    pirschwege: true,
    treiberrouten: true,
    wteRouten: true,
    heatmap: false,
    abschuesse: false,
  });
  const [modus, setModusState] = useState<Modus>(null);
  const [gpsImport, setGpsImport] = useState(false);
  const [einrSheet, setEinrSheet] = useState<EinrichtungInfo | null>(null);
  // Deep Link aus der Glocke, während die Karte schon offen ist
  useEffect(() => {
    const fokus = (ev: Event) => {
      const x = (ev as CustomEvent<EinrichtungInfo>).detail;
      karte.current?.jumpTo({ center: [x.lng, x.lat], zoom: 18 });
      setEinrSheet(x);
    };
    window.addEventListener('hegewerk:kartenfokus', fokus);
    return () => window.removeEventListener('hegewerk:kartenfokus', fokus);
  }, []);
  const [verschiebe, setVerschiebe] = useState<{ einr: EinrichtungInfo; lng: number; lat: number } | null>(null);
  const [verschiebeLaeuft, setVerschiebeLaeuft] = useState(false);
  const verschiebeAktiv = useRef(false);
  const [sheetArt, setSheetArt] = useState<SheetArt | null>(null);
  const [sheetFehler, setSheetFehler] = useState<string | null>(null);
  const [sheetSpeichert, setSheetSpeichert] = useState(false);
  const modusRef = useRef<Modus>(null);
  const [punkte, setPunkte] = useState<Position[]>([]);
  const punkteRef = useRef<Position[]>([]);
  punkteRef.current = punkte;
  // Zonenbearbeitung: markierter Eckpunkt sowie unveränderte Teilflächen/Löcher der Zone
  const [gewaehlterPunkt, setGewaehlterPunkt] = useState<number | null>(null);
  const zonenRest = useRef<{ teile: Position[][][]; loecher: Position[][] }>({ teile: [], loecher: [] });
  const [neueEinrichtung, setNeueEinrichtung] = useState<Position | null>(null);
  const [wind, setWind] = useState<Wetter | null>(null);
  const [wetterOffen, setWetterOffen] = useState(false);
  // Animierte Windpfeile vom eigenen Standort (je Gerät gemerkt)
  const [windpfeile, setWindpfeileState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hegewerk.karte.windpfeile') === '1';
    } catch {
      return false;
    }
  });
  const setWindpfeile = (an: boolean) => {
    setWindpfeileState(an);
    try {
      localStorage.setItem('hegewerk.karte.windpfeile', an ? '1' : '0');
    } catch {
      /* nur für diese Sitzung */
    }
  };
  const [eigenePos, setEigenePos] = useState<[number, number] | null>(null);
  const windMarker = useRef<Marker | null>(null);
  const [wetterOrt, setWetterOrt] = useState<[number, number]>([0, 0]);
  const [panelOffen, setPanelOffen] = useState(false);
  const [kartenFehler, setKartenFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg' | 'info'; text: string } | null>(null);
  const aufzeichnung = useRef<number | null>(null);
  const [ausgeblendet, setAusgeblendet] = useState<Set<string>>(new Set());
  // Routenebenen: einzeln ausblenden und mit eigener Transparenz (je Gerät gemerkt)
  const { ebenen: routenEbenen, laden: routenEbenenLaden } = useRoutenEbenen(k.revierId);
  const [routenEinst, setRoutenEinst] = useState<{ aus: string[]; transparenz: Record<string, number> }>(() => {
    try {
      const r = JSON.parse(localStorage.getItem('hegewerk.karte.routen') ?? 'null') as { aus?: string[]; transparenz?: Record<string, number> } | null;
      return { aus: r?.aus ?? [], transparenz: r?.transparenz ?? {} };
    } catch {
      return { aus: [], transparenz: {} };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('hegewerk.karte.routen', JSON.stringify(routenEinst));
    } catch {
      /* nur für diese Sitzung */
    }
  }, [routenEinst]);
  // Einrichtungsarten einzeln ausblenden (je Gerät gemerkt)
  const [typenAus, setTypenAus] = useState<string[]>(() => {
    try {
      const r = JSON.parse(localStorage.getItem('hegewerk.karte.einrichtungsTypenAus') ?? '[]') as unknown;
      return Array.isArray(r) ? r.map(String) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('hegewerk.karte.einrichtungsTypenAus', JSON.stringify(typenAus));
    } catch {
      /* nur für diese Sitzung */
    }
  }, [typenAus]);
  const einrFilter = (verschiebeId?: string): FilterSpecification | null => {
    const teile: unknown[] = [];
    if (typenAus.length) teile.push(['!', ['in', ['get', 'typ'], ['literal', typenAus]]]);
    if (verschiebeId) teile.push(['!=', ['get', 'id'], verschiebeId]);
    return teile.length === 0 ? null : (teile.length === 1 ? teile[0] : ['all', ...teile]) as FilterSpecification;
  };
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
  const [gewaehlteZone, setGewaehlteZone] = useState<GewaehlteZone | null>(null);

  const setModus = (m: Modus) => {
    modusRef.current = m;
    setModusState(m);
    setPunkte([]);
    setGewaehlterPunkt(null);
    setNeueEinrichtung(null);
  };

  // WTE-Modus (Wildtiererfassung): je Gerät gemerkt
  const [wte, setWteState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hegewerk.karte.wte') === '1';
    } catch {
      return false;
    }
  });
  const setWte = (an: boolean) => {
    setWteState(an);
    try {
      localStorage.setItem('hegewerk.karte.wte', an ? '1' : '0');
    } catch {
      /* ohne Speicher gilt der Modus nur für diese Sitzung */
    }
    setWteMenue(false);
    setWteZone(null);
  };
  const [wteMenue, setWteMenue] = useState(false);
  const [wteZone, setWteZone] = useState<WteZone | null>(null);
  const [wteSitzung, setWteSitzung] = useState<WteSitzung | null>(null);
  // Summe der Sichtungen je Zone in der laufenden Zählung (sofort sichtbar, auch offline)
  const wteSummen = useZonenSummen(wte ? (wteSitzung?.id ?? null) : null, wartendeZaehlungen);
  const sitzungLaden = useCallback(async (): Promise<WteSitzung | null> => {
    const { data } = await supabase.from('zaehlsitzungen').select('id, datum, ebene_id').eq('revier_id', k.revierId).eq('status', 'offen').is('geloescht_am', null).maybeSingle();
    setWteSitzung(data ?? null);
    return data ?? null;
  }, [k.revierId]);
  useEffect(() => {
    if (wte && navigator.onLine) void sitzungLaden();
  }, [wte, sitzungLaden]);
  const wteRoutenEbenenIds = useMemo(() => routenEbenen.filter((e) => e.typ === 'wte_route' && e.wte_aktiv).map((e) => e.id), [routenEbenen]);
  const wteEbenenIds = useMemo(() => (daten?.ebenen ?? []).filter((e) => e.wte_aktiv).map((e) => e.id), [daten]);

  // Filter für Heatmap und Abschüsse (gelten für alle drei Quellen)
  const [wildartFilter, setWildartFilter] = useState('');
  const [tageFilter, setTageFilter] = useState<30 | 90 | 365>(365);
  const [heatQuelle, setHeatQuelle] = useState<HeatQuelle>('beobachtungen');
  const gefiltert = useMemo(() => {
    const grenzeZeit = Date.now() - tageFilter * 86400000;
    const filtern = (l: Feature[] | undefined, farben = false): Feature[] =>
      (l ?? [])
        .filter((f) => (!wildartFilter || f.properties?.wildart_id === wildartFilter) && new Date(String(f.properties?.zeitpunkt ?? 0)).getTime() >= grenzeZeit)
        .map((f) => {
          if (!farben) return f;
          const i = wildarten.findIndex((w) => w.id === f.properties?.wildart_id);
          return { ...f, properties: { ...f.properties, farbe: WILDARTFARBEN[(i < 0 ? 0 : i) % WILDARTFARBEN.length] } };
        });
    return {
      beobachtungen: filtern(daten?.beobachtungen),
      abschuesse: filtern(daten?.abschuesse, true),
      zaehlungen: filtern(daten?.zaehlungen),
    };
  }, [daten, wildartFilter, tageFilter, wildarten]);

  // Daten laden
  const laden = useCallback(async () => {
    const { data, error } = await supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 365 });
    if (error) {
      setMeldung({ art: 'fehler', text: fehlertext(error) });
      return;
    }
    void routenEbenenLaden();
    const d = (data ?? {}) as unknown as Partial<KartenDaten>;
    setDaten({
      grenze: d.grenze ?? null,
      ebenen: d.ebenen ?? [],
      zonen: d.zonen ?? [],
      einrichtungen: d.einrichtungen ?? [],
      pirschwege: d.pirschwege ?? [],
      beobachtungen: d.beobachtungen ?? [],
      abschuesse: d.abschuesse ?? [],
      zaehlungen: d.zaehlungen ?? [],
      mitte: ((d as { mitte?: { coordinates?: number[] } | null }).mitte?.coordinates as [number, number] | undefined) ?? null,
    });
  }, [k.revierId, routenEbenenLaden]);

  // Heatmap/Zählwerte nach einer übertragenen Sichtung auffrischen (gebündelt)
  const heatTimer = useRef<number | null>(null);
  useZaehlungGeaendert((e) => {
    if (e.quelle !== 'server') return;
    if (heatTimer.current) window.clearTimeout(heatTimer.current);
    heatTimer.current = window.setTimeout(() => void laden(), 1500);
  });

  // Karte initialisieren
  useEffect(() => {
    if (!container.current) return;
    let m: KarteMap;
    try {
      m = new KarteMap({
        container: container.current,
        style: STIL,
        center: STANDARD_ZENTRUM,
        zoom: 12,
        attributionControl: { compact: true },
      });
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
    m.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'top-right',
    );
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    m.on('styleimagemissing', (e) => {
      // Unbekannte Einrichtungsart: neutrales Symbol
      if (!m.hasImage(e.id)) m.addImage(e.id, einrichtungsBild('sonstiges', '#5d6d7e'), { pixelRatio: 2 });
    });
    m.on('load', () => {
      // „Auf Karte zeigen“ für eine Route (aus „Zonen & Routen“)
      try {
        const r = sessionStorage.getItem(ROUTENFOKUS);
        if (r) {
          sessionStorage.removeItem(ROUTENFOKUS);
          const x = JSON.parse(r) as { geometry: { coordinates: number[][] } };
          const pts = x.geometry.coordinates;
          if (pts.length) {
            const b = new LngLatBounds(pts[0] as [number, number], pts[0] as [number, number]);
            for (const c of pts) b.extend(c as [number, number]);
            m.fitBounds(b, { padding: 60, duration: 0, maxZoom: 18 });
          }
        }
      } catch {
        /* ohne Fokus weiter */
      }
      // „Auf Karte zeigen“ aus der Einrichtungstabelle
      try {
        const f = sessionStorage.getItem('hegewerk:kartenfokus');
        if (f) {
          sessionStorage.removeItem('hegewerk:kartenfokus');
          const x = JSON.parse(f) as EinrichtungInfo;
          m.jumpTo({ center: [x.lng, x.lat], zoom: 18 });
          setEinrSheet(x);
        }
      } catch {
        /* ohne Fokus weiter */
      }
      for (const id of ['grenze', 'zonen', 'einrichtungen', 'pirschwege', 'beobachtungen', 'abschuesse', 'heatquelle', 'zeichnung']) {
        m.addSource(id, { type: 'geojson', data: LEER });
      }
      m.addLayer({
        id: 'zonen-flaeche',
        type: 'fill',
        source: 'zonen',
        paint: { 'fill-color': ['coalesce', ['get', 'farbe'], '#1e5c3a'], 'fill-opacity': 0.22 },
      });
      m.addLayer({
        id: 'zonen-linie',
        type: 'line',
        source: 'zonen',
        paint: { 'line-color': ['coalesce', ['get', 'farbe'], '#1e5c3a'], 'line-width': 1.5 },
      });
      m.addLayer({
        id: 'zonen-auswahl',
        type: 'line',
        source: 'zonen',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'line-color': '#f26a1b', 'line-width': 4 },
      });
      m.addLayer({
        id: 'grenze-linie',
        type: 'line',
        source: 'grenze',
        paint: { 'line-color': '#e4572e', 'line-width': 3 },
      });
      m.addLayer({
        id: 'heatmap',
        type: 'heatmap',
        source: 'heatquelle',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': 1,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 16, 40],
          'heatmap-opacity': 0.75,
        },
      });
      m.addLayer({
        id: 'pirschwege-linie',
        type: 'line',
        source: 'pirschwege',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        filter: ['==', ['get', 'typ'], 'pirschweg'],
        paint: { 'line-color': ['coalesce', ['get', 'farbe'], '#7b4a12'], 'line-width': 3, 'line-dasharray': [2, 1.5] },
      });
      // Treiberrouten und WTE-Routen: eigene Farben, Richtungspfeile entlang der Linie
      m.addImage('route-pfeil', pfeilBild(), { pixelRatio: 2 });
      for (const [id, typ, farbe] of [['treiberrouten', 'treiberroute', '#c2185b'], ['wte-routen', 'wte_route', '#00796b']] as const) {
        m.addLayer({
          id: `${id}-linie`,
          type: 'line',
          source: 'pirschwege',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          filter: ['==', ['get', 'typ'], typ],
          paint: { 'line-color': ['coalesce', ['get', 'farbe'], farbe], 'line-width': 3.5 },
        });
        m.addLayer({
          id: `${id}-pfeile`,
          type: 'symbol',
          source: 'pirschwege',
          filter: ['==', ['get', 'typ'], typ],
          layout: { 'symbol-placement': 'line', 'symbol-spacing': 70, 'icon-image': 'route-pfeil', 'icon-size': 0.8, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' },
        });
      }
      m.addLayer({
        id: 'abschuesse-punkt',
        type: 'circle',
        source: 'abschuesse',
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 7, 'circle-color': ['coalesce', ['get', 'farbe'], '#c0392b'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
      });
      for (const t of EINRICHTUNGSTYPEN) m.addImage(`einr-${t.wert}`, einrichtungsBild(t.wert, t.farbe), { pixelRatio: 2 });
      m.addLayer({
        id: 'einrichtungen-punkt',
        type: 'symbol',
        source: 'einrichtungen',
        layout: {
          'icon-image': ['concat', 'einr-', ['get', 'typ']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 1.3],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
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
        paint: { 'circle-radius': ['case', ['==', ['get', 'sel'], 1], 9, 6], 'circle-color': ['case', ['==', ['get', 'sel'], 1], '#1f6fb2', '#fff'], 'circle-stroke-color': '#1f6fb2', 'circle-stroke-width': 2 },
      });

      for (const ebene of ['einrichtungen-punkt', 'pirschwege-linie', 'treiberrouten-linie', 'wte-routen-linie', 'zonen-flaeche']) {
        m.on('mouseenter', ebene, () => {
          if (!modusRef.current) m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', ebene, () => {
          m.getCanvas().style.cursor = '';
        });
      }
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
    setzen('zonen', { type: 'FeatureCollection', features: daten.zonen });
    setzen('einrichtungen', { type: 'FeatureCollection', features: daten.einrichtungen });
    setzen('pirschwege', { type: 'FeatureCollection', features: daten.pirschwege });
    setzen('beobachtungen', { type: 'FeatureCollection', features: gefiltert.beobachtungen });
    setzen('abschuesse', { type: 'FeatureCollection', features: gefiltert.abschuesse });
    setzen('heatquelle', { type: 'FeatureCollection', features: gefiltert[heatQuelle] });
    grenzeRef.current = daten.grenze;

    // Handy: Luftbild nur für die Reviergrenze (+ ca. 150 m Rand); Tablet/PC: für den gesamten Kartenausschnitt
    // Nur neu aufbauen, wenn sich die Ausdehnung wirklich geändert hat – sonst lädt der Browser alle Kacheln erneut
    const bb = daten.grenze ? grenzen([daten.grenze]) : null;
    const schluessel = ISTHANDY
      ? bb
        ? 'handy:' + [bb.getWest(), bb.getSouth(), bb.getEast(), bb.getNorth()].map((v) => v.toFixed(5)).join(',')
        : ''
      : 'voll';
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
          attribution: 'Luftbild © LGLN',
        });
        m.addLayer(
          { id: 'luftbild', type: 'raster', source: 'luftbild', layout: { visibility: ebenen.luftbild ? 'visible' : 'none' } },
          'zonen-flaeche',
        );
      }
    }

    // Zonennamen als HTML-Beschriftung (kommt ohne Schrift-Server aus)
    for (const mk of zonenMarker.current) mk.remove();
    zonenMarker.current = daten.zonen.map((f) => {
      const el = document.createElement('div');
      el.className = 'zonen-beschriftung';
      el.dataset.ebene = String(f.properties?.ebene_id ?? 'ohne');
      el.dataset.zone = String(f.properties?.id ?? '');
      el.dataset.name = String(f.properties?.name ?? '');
      el.textContent = String(f.properties?.name ?? '');
      return new Marker({ element: el }).setLngLat(mittelpunkt(f.geometry)).addTo(m);
    });
    zonenBeschriftungenAnzeigen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten, bereit, gefiltert, heatQuelle]);

  // WTE-Modus: kleiner Zähler an der Zone
  useEffect(() => {
    for (const mk of zonenMarker.current) {
      const el = mk.getElement();
      const n = wte ? wteSummen[el.dataset.zone ?? ''] : undefined;
      el.replaceChildren(el.dataset.name ?? '');
      if (n) {
        const b = document.createElement('span');
        b.className = 'zonen-summe';
        b.textContent = String(n);
        b.title = 'Sichtungen in der laufenden Zählung';
        el.appendChild(b);
      }
    }
  }, [wteSummen, wte, daten, bereit, gefiltert, heatQuelle]);

  function zonenBeschriftungenAnzeigen() {
    for (const mk of zonenMarker.current) {
      const el = mk.getElement();
      const ebene = el.dataset.ebene ?? 'ohne';
      el.style.display = wte ? (wteEbenenIds.includes(ebene) ? '' : 'none') : ebenen.zonen && !ausgeblendet.has(ebene) ? '' : 'none';
    }
  }

  // Beim ersten Laden auf das Revier zoomen, sonst auf den eigenen Standort
  const gezoomt = useRef(false);
  useEffect(() => {
    const m = karte.current;
    if (!m || !daten || gezoomt.current) return;
    gezoomt.current = true;
    const geometrien: Geometry[] = [
      ...(daten.grenze ? [daten.grenze] : []),
      ...daten.zonen.map((f) => f.geometry),
      ...daten.einrichtungen.map((f) => f.geometry),
      ...daten.pirschwege.map((f) => f.geometry),
    ];
    const b = grenzen(geometrien);
    // Auf breiten Bildschirmen liegt das Werkzeug-Panel links über der Karte
    const links = 40;
    if (b) m.fitBounds(b, { padding: { top: 40, bottom: 60, left: links, right: 60 }, maxZoom: 16, duration: 0 });
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
    const sichtbar = (ebene: string, an: boolean) => m.setLayoutProperty(ebene, 'visibility', an ? 'visible' : 'none');
    // OSM bleibt als Hintergrund außerhalb des Reviers sichtbar
    // Im WTE-Modus nur Grenze, Hintergrund und Zonen der WTE-Ebenen
    if (m.getLayer('luftbild')) sichtbar('luftbild', ebenen.luftbild);
    sichtbar('grenze-linie', wte ? true : ebenen.grenze);
    sichtbar('zonen-flaeche', wte ? true : ebenen.zonen);
    sichtbar('zonen-linie', wte ? true : ebenen.zonen);
    sichtbar('einrichtungen-punkt', !wte && ebenen.einrichtungen);
    sichtbar('pirschwege-linie', !wte && ebenen.pirschwege);
    sichtbar('treiberrouten-linie', !wte && ebenen.treiberrouten);
    sichtbar('treiberrouten-pfeile', !wte && ebenen.treiberrouten);
    // WTE-Routen sind im WTE-Modus immer sichtbar
    sichtbar('wte-routen-linie', wte || ebenen.wteRouten);
    sichtbar('wte-routen-pfeile', wte || ebenen.wteRouten);
    // Routenebenen einzeln ausblenden; im WTE-Modus nur WTE-Routen aus WTE-aktiven Ebenen, Treiberrouten nur offener Jagden
    const ebeneAus = ['!', ['in', ['coalesce', ['get', 'ebene_id'], 'ohne'], ['literal', routenEinst.aus]]];
    const routenFilter = (typ: string, extra?: unknown) =>
      ['all', ['==', ['get', 'typ'], typ], ebeneAus, ...(extra ? [extra] : [])] as unknown as Parameters<typeof m.setFilter>[1];
    m.setFilter('pirschwege-linie', routenFilter('pirschweg'));
    const treiberOffen = ['!=', ['get', 'jagd_offen'], false];
    m.setFilter('treiberrouten-linie', routenFilter('treiberroute', treiberOffen));
    m.setFilter('treiberrouten-pfeile', routenFilter('treiberroute', treiberOffen));
    const wteRoute = wte ? ['in', ['coalesce', ['get', 'ebene_id'], 'ohne'], ['literal', wteRoutenEbenenIds]] : undefined;
    m.setFilter('wte-routen-linie', routenFilter('wte_route', wteRoute));
    m.setFilter('wte-routen-pfeile', routenFilter('wte_route', wteRoute));
    sichtbar('heatmap', !wte && ebenen.heatmap);
    sichtbar('abschuesse-punkt', !wte && ebenen.abschuesse);
    // Einzelne Zonenebenen ein-/ausblenden
    const filter = (wte
      ? ['in', ['get', 'ebene_id'], ['literal', wteEbenenIds]]
      : ['!', ['in', ['get', 'ebene_id'], ['literal', [...ausgeblendet]]]]) as unknown as Parameters<typeof m.setFilter>[1];
    m.setFilter('zonen-flaeche', filter);
    m.setFilter('zonen-linie', filter);
    zonenBeschriftungenAnzeigen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ebenen, bereit, ausgeblendet, wte, wteEbenenIds, routenEinst.aus, wteRoutenEbenenIds]);

  // Reihenfolge und Transparenz der Ebenen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const d = einst.deckkraft;
    const setze = (schicht: string, eigenschaft: string, wert: number) => {
      if (m.getLayer(schicht)) (m.setPaintProperty as (s: string, e: string, w: number) => void)(schicht, eigenschaft, wert);
    };
    setze('luftbild', 'raster-opacity', d.luftbild);
    setze('zonen-flaeche', 'fill-opacity', d.zonen * 0.4);
    setze('zonen-linie', 'line-opacity', Math.min(1, d.zonen * 1.8));
    setze('grenze-linie', 'line-opacity', d.grenze);
    setze('heatmap', 'heatmap-opacity', d.heatmap);
    // Routen: Gruppen-Deckkraft mal Deckkraft der jeweiligen Ebene
    const routenDeckkraft = (gruppe: number) => {
      const paare = Object.entries(routenEinst.transparenz).flatMap(([id, t]) => [id, 1 - t / 100]);
      return (paare.length ? ['*', gruppe, ['match', ['coalesce', ['get', 'ebene_id'], 'ohne'], ...paare, 1]] : gruppe) as unknown as number;
    };
    setze('pirschwege-linie', 'line-opacity', routenDeckkraft(d.pirschwege));
    setze('treiberrouten-linie', 'line-opacity', routenDeckkraft(d.treiberrouten));
    setze('treiberrouten-pfeile', 'icon-opacity', routenDeckkraft(d.treiberrouten));
    setze('wte-routen-linie', 'line-opacity', routenDeckkraft(d.wteRouten));
    setze('wte-routen-pfeile', 'icon-opacity', routenDeckkraft(d.wteRouten));
    setze('abschuesse-punkt', 'circle-opacity', d.abschuesse);
    setze('abschuesse-punkt', 'circle-stroke-opacity', d.abschuesse);
    setze('einrichtungen-punkt', 'icon-opacity', d.einrichtungen);
    for (const mk of zonenMarker.current) mk.getElement().style.opacity = String(Math.min(1, d.zonen * 1.8));
    // von unten nach oben jeweils an die Spitze stellen; Zeichnung bleibt immer ganz oben
    for (const id of [...einst.reihenfolge].reverse()) {
      for (const schicht of EBENEN_SCHICHTEN[id]) if (m.getLayer(schicht)) m.moveLayer(schicht);
    }
    for (const schicht of ['zeichnung-flaeche', 'zeichnung-linie', 'zeichnung-punkte']) if (m.getLayer(schicht)) m.moveLayer(schicht);
  }, [einst, bereit, daten, routenEinst.transparenz]);

  // Ausgewählte Zone hervorheben
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit || !m.getLayer('zonen-auswahl')) return;
    m.setFilter('zonen-auswahl', ['==', ['get', 'id'], gewaehlteZone?.id ?? '']);
  }, [gewaehlteZone, bereit]);
  useEffect(() => {
    if (modus) setGewaehlteZone(null);
  }, [modus]);

  // Zeichnung anzeigen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const features: Feature[] = punkte.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { sel: i === gewaehlterPunkt ? 1 : 0 } }));
    const istFlaeche = modus?.art === 'grenze' || modus?.art === 'zone';
    if (punkte.length >= 3 && istFlaeche) {
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...punkte, punkte[0]!]] }, properties: {} });
    } else if (punkte.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: punkte }, properties: {} });
    }
    (m.getSource('zeichnung') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [punkte, modus, bereit, gewaehlterPunkt]);

  // Klicks: im Zeichenmodus Punkte setzen, sonst Details anzeigen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const klick = (e: MapMouseEvent) => {
      const aktiv = modusRef.current;
      const pos: Position = [e.lngLat.lng, e.lngLat.lat];
      if (wte && !aktiv) {
        // WTE-Modus: Tippen auf eine WTE-Zone öffnet die Sichtungserfassung
        const z = m.queryRenderedFeatures(e.point, { layers: ['zonen-flaeche'] })[0];
        if (z) {
          const p = z.properties ?? {};
          setWteMenue(false);
          setWteZone({ id: String(p.id), name: String(p.name ?? ''), ebeneId: p.ebene_id && p.ebene_id !== 'ohne' ? String(p.ebene_id) : null });
          void sitzungLaden();
        }
        return;
      }
      if (verschiebeAktiv.current) return; // beim Verschieben nur der Marker
      if (aktiv?.art === 'einrichtung') {
        setNeueEinrichtung(pos);
        return;
      }
      if (aktiv?.art === 'zone' && aktiv.bearbeiten) return; // eigener Handler (Punkte ziehen/einfügen)
      if (aktiv && aktiv.art !== 'aufzeichnung' && !sheetArt) {
        const grenze = grenzeRef.current;
        if (aktiv.art === 'zone' && grenze && !punktInFlaeche(pos, grenze)) {
          // Zonen dürfen nicht über die Reviergrenze hinausgehen
          setPunkte((alt) => [...alt, naechsterRandpunkt(pos, grenze)]);
          setMeldung({ art: 'info', text: 'Punkt lag außerhalb und wurde auf die Reviergrenze gesetzt.' });
          return;
        }
        setPunkte((alt) => [...alt, pos]);
        return;
      }
      if (aktiv) return;
      const treffer = m.queryRenderedFeatures(e.point, { layers: ['einrichtungen-punkt', 'abschuesse-punkt', 'pirschwege-linie', 'treiberrouten-linie', 'wte-routen-linie', 'zonen-flaeche'] });
      // Einrichtungen haben Vorrang vor allem, was darunter liegt (z. B. Zonen)
      const f = treffer.find((x) => x.layer.id === 'einrichtungen-punkt') ?? treffer[0];
      if (!f) {
        setGewaehlteZone(null);
        setEinrSheet(null);
        return;
      }
      if (f.layer.id === 'einrichtungen-punkt' && f.geometry.type === 'Point') {
        const p = f.properties ?? {};
        const [lng, lat] = f.geometry.coordinates as [number, number];
        setGewaehlteZone(null);
        setEinrSheet({ id: String(p.id), name: (p.name as string | null) || null, typ: p.typ as Enums<'einrichtung_typ'>, bemerkung: (p.bemerkung as string | null) || null, lng, lat });
        return;
      }
      if (f.layer.id === 'zonen-flaeche') {
        setEinrSheet(null);
        const p = f.properties ?? {};
        setGewaehlteZone({
          id: String(p.id),
          name: String(p.name ?? ''),
          farbe: (p.farbe as string | null) ?? null,
          flaecheHa: p.flaeche_ha != null ? Number(p.flaeche_ha) : null,
        });
        return;
      }
      new Popup({ closeButton: true, maxWidth: '260px' })
        .setLngLat(e.lngLat)
        .setDOMContent(popupInhalt(f.layer.id, f.properties ?? {}))
        .addTo(m);
    };
    m.on('click', klick);
    if (modus) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
    return () => {
      m.off('click', klick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bereit, modus, k.istInhaber, wildarten, wte, sheetArt]);

  // Zone bearbeiten: Eckpunkte ziehen, Linie antippen = Punkt einfügen, Punkt antippen = markieren
  const bearbeitet = modus?.art === 'zone' && !!modus.bearbeiten;
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

  // Vorhandene Zone zur Bearbeitung der Eckpunkte laden (größte Teilfläche; weitere Teile und Löcher bleiben erhalten)
  function zoneBearbeiten(zoneId: string, name: string) {
    const f = daten?.zonen.find((z) => String(z.id ?? (z.properties as { id?: string } | null)?.id) === zoneId);
    const g = f?.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
      setMeldung({ art: 'fehler', text: 'Diese Zone hat noch keine Fläche.' });
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
    setModus({ art: 'zone', zoneId, name, bearbeiten: true });
    zonenRest.current = { teile: teile.filter((_, i) => i !== wahl), loecher: teile[wahl]!.slice(1) };
    setPunkte(ring);
    setGewaehlteZone(null);
    setMeldung({ art: 'info', text: 'Punkte ziehen · auf eine Linie tippen fügt einen Punkt ein · Punkt antippen und „Punkt löschen“.' });
  }

  // Eigenen Standort verfolgen, solange die Windpfeile an sind
  useEffect(() => {
    if (!windpfeile || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setEigenePos([p.coords.longitude, p.coords.latitude]),
      () => setEigenePos(null),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [windpfeile]);

  // Windpfeile: 1–4 animierte Pfeile ab dem eigenen Punkt in Windrichtung (wohin der Wind weht)
  useEffect(() => {
    const m = karte.current;
    windMarker.current?.remove();
    windMarker.current = null;
    if (!m || !bereit || !windpfeile || !wind) return;
    const punkt = eigenePos ?? (() => { const c = m.getCenter(); return [c.lng, c.lat] as [number, number]; })();
    const anzahl = wind.windKmh < 6 ? 1 : wind.windKmh < 16 ? 2 : wind.windKmh < 30 ? 3 : 4;
    const dauer = 2.4;
    const el = document.createElement('div');
    el.className = 'windpfeile';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<span class="windpfeile-punkt"></span>' +
      Array.from({ length: anzahl }, (_, i) => `<svg class="windpfeil-n" style="animation-duration:${dauer}s;animation-delay:${((i * dauer) / anzahl).toFixed(2)}s" viewBox="0 0 24 24"><path d="M12 2 L21 20 L12 15 L3 20 Z" /></svg>`).join('');
    windMarker.current = new Marker({ element: el, rotation: (wind.windRichtung + 180) % 360, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(punkt).addTo(m);
    return () => {
      windMarker.current?.remove();
      windMarker.current = null;
    };
  }, [bereit, windpfeile, wind, eigenePos]);

  // Wind am Kartenmittelpunkt
  const windLaden = useCallback(async () => {
    const m = karte.current;
    if (!m) return;
    const c = m.getCenter();
    setWetterOrt([c.lat, c.lng]);
    setWind(await aktuellesWetter(c.lat, c.lng));
  }, []);
  useEffect(() => {
    if (daten) void windLaden();
  }, [daten, windLaden]);

  // Aufräumen der GPS-Aufzeichnung
  useEffect(
    () => () => {
      if (aufzeichnung.current !== null) navigator.geolocation.clearWatch(aufzeichnung.current);
    },
    [],
  );

  // ---------- Aktionen ----------

  function popupInhalt(ebene: string, p: Record<string, unknown>): HTMLElement {
    const el = document.createElement('div');
    el.className = 'popup';
    const titel = document.createElement('strong');
    const text = document.createElement('p');
    let loeschen: (() => Promise<void>) | null = null;

    if (ebene === 'einrichtungen-punkt') {
      const typ = EINRICHTUNGSTYPEN.find((t) => t.wert === p.typ)?.label ?? 'Einrichtung';
      titel.textContent = p.name ? `${String(p.name)} (${typ})` : typ;
      text.textContent = [p.zustand, p.bemerkung].filter(Boolean).join(' · ');
      loeschen = async () => {
        await supabase.from('einrichtungen').update({ geloescht_am: new Date().toISOString() }).eq('id', String(p.id));
      };
    } else if (ebene === 'abschuesse-punkt') {
      titel.textContent = `Abschuss: ${wildartName(wildarten, String(p.wildart_id ?? ''))}`;
      const g = GESCHLECHTER.find((x) => x.wert === p.geschlecht)?.label ?? 'unbekannt';
      text.textContent = `${datumZeitDE(String(p.erlegt_am ?? p.zeitpunkt ?? ''))} · ${g}`;
    } else if (ebene === 'pirschwege-linie' || ebene === 'treiberrouten-linie' || ebene === 'wte-routen-linie') {
      titel.textContent = `${ebene === 'treiberrouten-linie' ? 'Treiberroute' : ebene === 'wte-routen-linie' ? 'WTE-Route' : 'Pirschweg'}: ${String(p.name ?? '')}`;
      text.textContent = `${Number(p.laenge_m ?? 0).toLocaleString('de-DE')} m${p.bemerkung ? ` · ${String(p.bemerkung)}` : ''}`;
      loeschen = async () => {
        await supabase.from('pirschwege').update({ geloescht_am: new Date().toISOString() }).eq('id', String(p.id));
      };
    } else {
      titel.textContent = `Zone: ${String(p.name ?? '')}`;
    }
    el.append(titel, text);

    if (k.istInhaber && loeschen) {
      const knopf = document.createElement('button');
      knopf.className = 'link gefahr';
      knopf.textContent = 'Entfernen';
      const aktion = loeschen;
      knopf.onclick = async () => {
        if (!window.confirm('Wirklich entfernen?')) return;
        await aktion();
        document.querySelectorAll('.maplibregl-popup').forEach((x) => x.remove());
        await laden();
      };
      el.append(knopf);
    }
    return el;
  }

  // „Speichern“ in der Zeichenleiste: prüfen und – außer bei einer bestehenden Zone – Details im Bottom-Sheet abfragen
  function zeichnungAbschliessen() {
    if (!modus || modus.art === 'einrichtung') return;
    setMeldung(null);
    if (modus.art === 'grenze' || modus.art === 'zone') {
      if (punkte.length < 3) {
        setMeldung({ art: 'fehler', text: 'Bitte mindestens drei Punkte setzen.' });
        return;
      }
      if (modus.art === 'zone' && modus.zoneId) {
        void zeichnungSpeichern();
        return;
      }
      setSheetFehler(null);
      setSheetArt(modus.art);
    } else {
      if (punkte.length < 2) {
        setMeldung({ art: 'fehler', text: `Eine ${ROUTENNAME[modus.typ]} braucht mindestens zwei Punkte.` });
        return;
      }
      setSheetFehler(null);
      setSheetArt(modus.typ);
    }
  }

  async function zeichnungSpeichern(w?: SheetWerte) {
    if (!modus || modus.art === 'einrichtung') return;
    setMeldung(null);
    setSheetSpeichert(true);
    try {
      if (modus.art === 'grenze' || modus.art === 'zone') {
        const aussen = [...punkte, punkte[0]!];
        const geojson = (
          modus.art === 'zone' && modus.bearbeiten
            ? zonenRest.current.teile.length
              ? { type: 'MultiPolygon', coordinates: [[aussen, ...zonenRest.current.loecher], ...zonenRest.current.teile] }
              : { type: 'Polygon', coordinates: [aussen, ...zonenRest.current.loecher] }
            : { type: 'Polygon', coordinates: [aussen] }
        ) as unknown as Json;
        if (modus.art === 'grenze') {
          const { data, error } = await supabase.rpc('grenze_setzen', { p_revier_id: k.revierId, p_geojson: geojson });
          if (error) throw error;
          setMeldung({ art: 'erfolg', text: `Reviergrenze gespeichert · ${Number(data).toLocaleString('de-DE')} ha` });
          await k.neuLaden();
        } else {
          let zoneId = modus.zoneId ?? w?.zoneId ?? null;
          let name = modus.name;
          const neu = !zoneId;
          if (!zoneId) {
            if (!w) return;
            name = w.name;
            const ziel = daten?.ebenen.find((e) => e.id === w.ebeneId);
            const { data: angelegt, error: anlegeFehler } = await supabase
              .from('zonen')
              .insert({
                revier_id: k.revierId,
                name,
                ebene_id: ziel?.id ?? null,
                sortierung: zonen.length,
                farbe: w.farbe || ziel?.farbe || ZONENFARBEN[zonen.length % ZONENFARBEN.length],
              })
              .select('id')
              .single();
            if (anlegeFehler) throw anlegeFehler;
            zoneId = angelegt.id;
            if (ziel && w.wteAktiv !== !!ziel.wte_aktiv) await supabase.from('zonen_ebenen').update({ wte_aktiv: w.wteAktiv }).eq('id', ziel.id);
          } else if (w?.zoneId) {
            name = zonen.find((z) => z.id === w.zoneId)?.name ?? name;
          }
          const { data: ha, error } = await supabase.rpc('zone_geometrie_setzen', { p_zone_id: zoneId, p_geojson: geojson });
          if (error) {
            // Neu angelegte Zone ohne gültige Fläche wieder entfernen
            if (neu) await supabase.from('zonen').delete().eq('id', zoneId);
            throw error;
          }
          setMeldung({ art: 'erfolg', text: `Zone „${name}“ gespeichert · ${Number(ha).toLocaleString('de-DE')} ha (auf Reviergrenze zugeschnitten)` });
          await zonenLaden();
        }
      } else {
        if (!w) return;
        let ebeneId = w.routenEbeneId || null;
        if (w.neueEbeneName) {
          const { data: neueEbene, error: ebeneFehler } = await supabase
            .from('routen_ebenen')
            .insert({ revier_id: k.revierId, name: w.neueEbeneName, typ: modus.typ, reihenfolge: routenEbenen.length, wte_aktiv: modus.typ === 'wte_route', farbe: ZONENFARBEN[(routenEbenen.length + 3) % ZONENFARBEN.length] })
            .select('id')
            .single();
          if (ebeneFehler) throw ebeneFehler;
          ebeneId = neueEbene.id;
        }
        const { error } = await supabase.from('pirschwege').insert({
          revier_id: k.revierId,
          ebene_id: ebeneId,
          name: w.name,
          bemerkung: w.bemerkung || null,
          typ: modus.typ,
          bewegungsjagd_id: modus.typ === 'treiberroute' ? w.bewegungsjagdId || null : null,
          zaehlsitzung_id: modus.typ === 'wte_route' ? w.sitzungId || null : null,
          geom: linieEWKT(punkte as Array<[number, number]>),
        });
        if (error) throw error;
        setMeldung({ art: 'erfolg', text: `${ROUTENNAME[modus.typ]} „${w.name}“ gespeichert` });
      }
      aufzeichnungStoppen();
      setSheetArt(null);
      setModus(null);
      await laden();
    } catch (err) {
      if (sheetArt) setSheetFehler(fehlertext(err));
      else setMeldung({ art: 'fehler', text: fehlertext(err) });
    } finally {
      setSheetSpeichert(false);
    }
  }

  function aufzeichnungStarten(typ: RouteTyp) {
    setModus({ art: 'aufzeichnung', typ });
    setMeldung({ art: 'info', text: 'Aufzeichnung läuft – Bildschirm eingeschaltet lassen.' });
    aufzeichnung.current = navigator.geolocation.watchPosition(
      (p) => {
        if (p.coords.accuracy > 30) return;
        const neu: Position = [p.coords.longitude, p.coords.latitude];
        setPunkte((alt) => {
          const letzter = alt[alt.length - 1];
          return letzter && abstandM(letzter, neu) < 5 ? alt : [...alt, neu];
        });
      },
      () => setMeldung({ art: 'fehler', text: 'GPS nicht verfügbar – bitte Ortungsfreigabe prüfen.' }),
      { enableHighAccuracy: true, maximumAge: 0 },
    );
  }

  function aufzeichnungStoppen() {
    if (aufzeichnung.current !== null) navigator.geolocation.clearWatch(aufzeichnung.current);
    aufzeichnung.current = null;
  }

  // Position einer Einrichtung speichern (einmessen oder verschieben); offline über die Warteschlange
  async function einrichtungPosition(id: string, lng: number, lat: number): Promise<'gespeichert' | 'gemerkt'> {
    const r = await speichernOderMerken({ tabelle: 'einrichtungen', daten: { id, geom: punktEWKT(lng, lat) } });
    setDaten((d) =>
      d && {
        ...d,
        einrichtungen: d.einrichtungen.map((f) => (f.properties?.id === id ? { ...f, geometry: { type: 'Point', coordinates: [lng, lat] } } : f)),
      },
    );
    if (r === 'gespeichert') await laden();
    return r;
  }

  async function verschiebenBestaetigen() {
    if (!verschiebe) return;
    setVerschiebeLaeuft(true);
    try {
      const r = await einrichtungPosition(verschiebe.einr.id, verschiebe.lng, verschiebe.lat);
      setMeldung({ art: 'erfolg', text: r === 'gemerkt' ? 'Neue Position auf dem Gerät gespeichert – wird übertragen, sobald du online bist' : 'Einrichtung verschoben' });
      setVerschiebe(null);
    } catch (err) {
      setMeldung({ art: 'fehler', text: fehlertext(err) });
    } finally {
      setVerschiebeLaeuft(false);
    }
  }

  // Marker zum Verschieben: Original ausblenden, Ersatzmarker ziehbar
  useEffect(() => {
    const m = karte.current;
    verschiebeAktiv.current = !!verschiebe;
    if (!m || !bereit || !verschiebe) return;
    const id = verschiebe.einr.id;
    const el = document.createElement('div');
    el.className = 'verschiebe-marker';
    el.setAttribute('aria-label', 'Einrichtung verschieben');
    const marker = new Marker({ element: el, draggable: true }).setLngLat([verschiebe.einr.lng, verschiebe.einr.lat]).addTo(m);
    marker.on('dragend', () => {
      const p = marker.getLngLat();
      setVerschiebe((v) => v && { ...v, lng: p.lng, lat: p.lat });
    });
    if (m.getLayer('einrichtungen-punkt')) m.setFilter('einrichtungen-punkt', einrFilter(id));
    return () => {
      marker.remove();
      if (m.getLayer('einrichtungen-punkt')) m.setFilter('einrichtungen-punkt', einrFilter());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verschiebe?.einr.id, bereit]);

  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit || !m.getLayer('einrichtungen-punkt')) return;
    m.setFilter('einrichtungen-punkt', einrFilter(verschiebe?.einr.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typenAus, bereit]);

  async function einrichtungSpeichern(typ: Enums<'einrichtung_typ'>, name: string, bemerkung: string) {
    if (!neueEinrichtung) return;
    if (name.trim() && nameVergeben(einrichtungsNamen, name)) {
      setMeldung({ art: 'fehler', text: `Eine Einrichtung „${name.trim()}“ gibt es in diesem Revier bereits.` });
      return;
    }
    const { error } = await supabase.from('einrichtungen').insert({
      revier_id: k.revierId,
      typ,
      name: name.trim() || null,
      bemerkung: bemerkung.trim() || null,
      geom: punktEWKT(neueEinrichtung[0]!, neueEinrichtung[1]!),
    });
    if (error) {
      setMeldung({ art: 'fehler', text: fehlertext(error) });
      return;
    }
    setNeueEinrichtung(null);
    setMeldung({ art: 'erfolg', text: 'Einrichtung gespeichert – weitere per Tippen auf die Karte setzen' });
    await laden();
  }

  // ---------- Darstellung ----------

  // Offenes Sheet oder Dialog am unteren Rand: die Statusleiste schrumpft zum kleinen Chip oben und bleibt so immer sichtbar
  const sheetOffen = !!sheetArt || !!neueEinrichtung || !!einrSheet || !!gewaehlteZone || (wte && !!wteZone) || gpsImport;
  const zeichnet = modus && modus.art !== 'einrichtung';
  const einrichtungsNamen = (daten?.einrichtungen ?? []).map((e) => (e.properties?.name as string | null) ?? null);
  const kartenEbenen = daten?.ebenen ?? [];
  const hatOhneEbene = (daten?.zonen ?? []).some((z) => z.properties?.ebene_id === 'ohne');
  const anzahlBeob = daten?.beobachtungen.length ?? 0;

  const imBlock = (id: EbenenId) => id === 'heatmap' || id === 'abschuesse';
  const verschieben = (i: number, richtung: -1 | 1) =>
    setEinst((alt) => {
      const liste = [...alt.reihenfolge];
      let j = i + richtung;
      // Ebenen im Block „Heatmap & Abschüsse“ stehen nicht in der Liste und werden übersprungen
      while (j >= 0 && j < liste.length && imBlock(liste[j]!)) j += richtung;
      if (j < 0 || j >= liste.length) return alt;
      [liste[i], liste[j]] = [liste[j]!, liste[i]!];
      return { ...alt, reihenfolge: liste };
    });
  const ebenenInfo: Record<EbenenId, { name: string; label: string; an: boolean; gesperrt?: boolean; setAn: (an: boolean) => void }> = {
    luftbild: {
      name: 'Luftbild',
      label: ISTHANDY ? (daten?.grenze ? 'Luftbild (LGLN, nur Revierbereich)' : 'Luftbild – erst Reviergrenze zeichnen') : 'Luftbild (LGLN)',
      an: ebenen.luftbild && (!ISTHANDY || !!daten?.grenze),
      gesperrt: ISTHANDY && !daten?.grenze,
      setAn: (an) => setEbenen({ ...ebenen, luftbild: an }),
    },
    zonen: { name: 'Zonen', label: 'Zonen', an: ebenen.zonen, setAn: (an) => setEbenen({ ...ebenen, zonen: an }) },
    grenze: { name: 'Reviergrenze', label: 'Reviergrenze', an: ebenen.grenze, setAn: (an) => setEbenen({ ...ebenen, grenze: an }) },
    heatmap: { name: 'Heatmap', label: `Heatmap ${HEATNAMEN[heatQuelle]} (${gefiltert[heatQuelle].length})`, an: ebenen.heatmap, setAn: (an) => setEbenen({ ...ebenen, heatmap: an }) },
    pirschwege: { name: 'Pirschwege', label: 'Pirschwege', an: ebenen.pirschwege, setAn: (an) => setEbenen({ ...ebenen, pirschwege: an }) },
    treiberrouten: { name: 'Treiberrouten', label: 'Treiberrouten', an: ebenen.treiberrouten, setAn: (an) => setEbenen({ ...ebenen, treiberrouten: an }) },
    wteRouten: { name: 'WTE-Routen', label: 'WTE-Routen', an: ebenen.wteRouten, setAn: (an) => setEbenen({ ...ebenen, wteRouten: an }) },
    abschuesse: {
      name: 'Abschüsse',
      label: `Abschüsse (${gefiltert.abschuesse.length})`,
      an: ebenen.abschuesse,
      setAn: (an) => setEbenen({ ...ebenen, abschuesse: an }),
    },
    einrichtungen: { name: 'Einrichtungen', label: 'Einrichtungen', an: ebenen.einrichtungen, setAn: (an) => setEbenen({ ...ebenen, einrichtungen: an }) },
  };

  const werkzeuge = (
    <>
          {meldung && <div className={`hinweis hinweis-${meldung.art}`}>{meldung.text}</div>}

          <Abschnitt titel="Heatmap & Abschüsse">
            {(['heatmap', 'abschuesse'] as const).map((id) => (
              <div key={id} className="ebenen-block">
                <EbenenSchalter label={ebenenInfo[id].label} an={ebenenInfo[id].an} onAendern={ebenenInfo[id].setAn} />
                {id === 'heatmap' && (
                  <div className="segmente" role="radiogroup" aria-label="Quelle der Heatmap">
                    {(Object.keys(HEATNAMEN) as HeatQuelle[]).map((q) => (
                      <button key={q} type="button" role="radio" aria-checked={heatQuelle === q} onClick={() => setHeatQuelle(q)}>
                        {HEATNAMEN[q]}
                      </button>
                    ))}
                  </div>
                )}
                <label className="transparenz">
                  <span>Transparenz</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round((1 - einst.deckkraft[id]) * 100)}
                    aria-label={`Transparenz ${ebenenInfo[id].name}`}
                    onChange={(e) => setEinst((alt) => ({ ...alt, deckkraft: { ...alt.deckkraft, [id]: 1 - Number(e.target.value) / 100 } }))}
                  />
                  <output>{Math.round((1 - einst.deckkraft[id]) * 100)} %</output>
                </label>
              </div>
            ))}
            <label className="transparenz">
              <span>Wildart</span>
              <select value={wildartFilter} onChange={(e) => setWildartFilter(e.target.value)} aria-label="Wildart filtern">
                <option value="">Alle Wildarten</option>
                {wildarten.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="transparenz">
              <span>Zeitraum</span>
              <select value={tageFilter} onChange={(e) => setTageFilter(Number(e.target.value) as 30 | 90 | 365)} aria-label="Zeitraum filtern">
                <option value={30}>Letzte 30 Tage</option>
                <option value={90}>Letzte 90 Tage</option>
                <option value={365}>Letzte 12 Monate</option>
              </select>
            </label>
            <p className="leer" style={{ margin: 0 }}>Der Filter gilt für Heatmap und Abschüsse. Jeder Eintrag zählt einfach; Zählungen liegen in ihrer Zone.</p>
          </Abschnitt>

          <Abschnitt titel="Ebenen" offen>
          <p className="leer" style={{ margin: 0 }}>Oberste Ebene liegt über den anderen. Mit den Pfeilen verschieben, mit dem Regler die Transparenz einstellen.</p>
          <ul className="ebenen-liste">
            {einst.reihenfolge.map((id, i) => {
              if (imBlock(id)) return null;
              const info = ebenenInfo[id];
              const sichtbareIds = einst.reihenfolge.filter((x) => !imBlock(x));
              return (
                <li key={id}>
                  <div className="ebenen-kopf">
                    <EbenenSchalter label={info.label} an={info.an} gesperrt={info.gesperrt} onAendern={info.setAn} />
                    <span className="ebenen-schieber">
                      <button type="button" aria-label={`${info.name} nach oben`} disabled={id === sichtbareIds[0]} onClick={() => verschieben(i, -1)}>
                        <Symbol name="nachOben" className="symbol klein" />
                      </button>
                      <button type="button" aria-label={`${info.name} nach unten`} disabled={id === sichtbareIds[sichtbareIds.length - 1]} onClick={() => verschieben(i, 1)}>
                        <Symbol name="nachUnten" className="symbol klein" />
                      </button>
                    </span>
                  </div>
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
                  {id === 'zonen' && ebenen.zonen && kartenEbenen.length > 0 && (
                    <div className="unterebenen">
                      {[...kartenEbenen, ...(hatOhneEbene ? [{ id: 'ohne', name: 'Ohne Ebene', farbe: null }] : [])].map((e) => (
                        <label key={e.id} className="ebene">
                          <input
                            type="checkbox"
                            checked={!ausgeblendet.has(e.id)}
                            onChange={(ev) =>
                              setAusgeblendet((alt) => {
                                const neu = new Set(alt);
                                if (ev.target.checked) neu.delete(e.id);
                                else neu.add(e.id);
                                return neu;
                              })
                            }
                          />
                          <i className="farbpunkt" style={{ background: e.farbe ?? 'var(--text-leise)' }} />
                          {e.name}
                        </label>
                      ))}
                    </div>
                  )}
                  {(id === 'pirschwege' || id === 'treiberrouten' || id === 'wteRouten') && ebenen[id] && (() => {
                    const typ = id === 'pirschwege' ? 'pirschweg' : id === 'treiberrouten' ? 'treiberroute' : 'wte_route';
                    const liste: Array<{ id: string; name: string; farbe: string | null }> = routenEbenen.filter((e) => e.typ === typ);
                    if ((daten?.pirschwege ?? []).some((f) => f.properties?.typ === typ && !f.properties?.ebene_id)) liste.push({ id: 'ohne', name: 'Ohne Ebene', farbe: null });
                    if (!liste.length) return null;
                    return (
                      <div className="unterebenen">
                        {liste.map((e) => (
                          <div key={e.id} className="routen-unterebene">
                            <label className="ebene">
                              <input
                                type="checkbox"
                                checked={!routenEinst.aus.includes(e.id)}
                                onChange={(ev) => setRoutenEinst((alt) => ({ ...alt, aus: ev.target.checked ? alt.aus.filter((x) => x !== e.id) : [...alt.aus, e.id] }))}
                              />
                              <i className="farbpunkt" style={{ background: e.farbe ?? routenTypFarbe(typ) }} />
                              {e.name}
                            </label>
                            <label className="transparenz">
                              <span>Transparenz</span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={routenEinst.transparenz[e.id] ?? 0}
                                aria-label={`Transparenz ${e.name}`}
                                onChange={(ev) => setRoutenEinst((alt) => ({ ...alt, transparenz: { ...alt.transparenz, [e.id]: Number(ev.target.value) } }))}
                              />
                              <output>{routenEinst.transparenz[e.id] ?? 0} %</output>
                            </label>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {id === 'einrichtungen' && ebenen.einrichtungen && (
                    <div className="legende legende-schalter">
                      {EINRICHTUNGSTYPEN.filter((t) => daten?.einrichtungen.some((e) => e.properties?.typ === t.wert)).map((t) => (
                        <button
                          key={t.wert}
                          type="button"
                          className={`legende-typ ${typenAus.includes(t.wert) ? 'aus' : ''}`}
                          aria-pressed={!typenAus.includes(t.wert)}
                          title={typenAus.includes(t.wert) ? `${t.label} einblenden` : `${t.label} ausblenden`}
                          onClick={() => setTypenAus((a) => (a.includes(t.wert) ? a.filter((x) => x !== t.wert) : [...a, t.wert]))}
                        >
                          <EinrichtungsIcon typ={t.wert} farbe={t.farbe} groesse={18} /> {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {!ISTHANDY && <p className="leer" style={{ margin: 0 }}>Das Luftbild wird für den gesamten Kartenausschnitt geladen und auf dem Gerät zwischengespeichert.</p>}
          {ISTHANDY && <p className="leer" style={{ margin: 0 }}>Mobil wird das Luftbild nur für den Revierbereich geladen und auf dem Gerät zwischengespeichert, um Daten zu sparen.</p>}

          </Abschnitt>

          {k.istInhaber && (
            <Abschnitt titel="Import">
              <button className="knopf knopf-sekundaer" onClick={() => navigieren('/import')}>
                Geodaten importieren (SHP, GeoPackage)
              </button>
            </Abschnitt>
          )}
          <p className="leer">Zeichnen, Aufzeichnen und GPS-Import findest du im Menü „+ NEU“ auf der Karte.</p>
          <p className="leer">Heatmap und Abschüsse zeigen nur Erfassungen mit Position (Zählungen: Zone). Wind: Open-Meteo.</p>
          {wildarten.length > 0 && anzahlBeob > 0 && (
            <p className="leer">
              Häufigste Wildart: {wildartName(wildarten, haeufigste(daten?.beobachtungen ?? []))}
            </p>
          )}
    </>
  );

  return (
    <div className="karte-seite">
      <div ref={container} className="karte" />

      {!zeichnet && (
        <div className="karte-chips">
          <div className="karte-chip-reihe">
            {wind && (
              <div className="karte-chip wind" title="Wetter, Sonne, Mond und Büchsenlicht">
                <button type="button" className="wind-haupt" aria-expanded={wetterOffen} aria-haspopup="dialog" onClick={() => setWetterOffen((o) => !o)}>
                  <span className="wind-pfeil" style={{ transform: `rotate(${wind.windRichtung + 180}deg)` }} aria-hidden="true">
                    ↑
                  </span>
                  <span>
                    <strong>{Math.round(wind.windKmh)} km/h</strong> aus {himmelsrichtung(wind.windRichtung)}
                    <small>{Math.round(wind.temperatur)} °C · Wetter</small>
                  </span>
                </button>
                <button className="link" onClick={windLaden} aria-label="Wind aktualisieren">
                  <Symbol name="aktualisieren" className="symbol klein" />
                </button>
              </div>
            )}
            <button
              type="button"
              className={`karte-chip chip-knopf ${windpfeile ? 'an' : ''}`}
              aria-pressed={windpfeile}
              aria-label="Windpfeile auf der Karte ein- oder ausblenden"
              title="Windpfeile von deinem Standort"
              onClick={() => setWindpfeile(!windpfeile)}
            >
              <Symbol name="wind" className="symbol klein" /> Windpfeile
            </button>
            <button type="button" className={`karte-chip chip-knopf ${wte ? 'an' : ''}`} aria-pressed={wte} aria-label="Neu: Einrichtung, Fang, Wildtiererfassung" aria-haspopup="menu" aria-expanded={wteMenue} onClick={() => setWteMenue((o) => !o)}>
              <Symbol name="neu" className="symbol klein" /> NEU
            </button>
          </div>
          {wind && wetterOffen && <WetterPanel lat={wetterOrt[0]} lon={wetterOrt[1]} mitte={daten?.mitte ?? null} onSchliessen={() => setWetterOffen(false)} />}
        </div>
      )}

      {zeichnet && (
        <div className="zeichen-leiste">
          <span>
            {modus.art === 'grenze' && 'Reviergrenze: Eckpunkte antippen'}
            {modus.art === 'zone' && modus.bearbeiten && `Zone „${modus.name}“ bearbeiten: Punkte ziehen, Linie antippen = Punkt einfügen`}
            {modus.art === 'zone' && !modus.bearbeiten && (modus.zoneId ? `Zone „${modus.name}“: Eckpunkte antippen` : 'Neue Zone: Eckpunkte antippen')}
            {modus.art === 'route' && `${ROUTENNAME[modus.typ]}: Wegpunkte antippen`}
            {modus.art === 'aufzeichnung' && `${ROUTENNAME[modus.typ]} per GPS: ${punkte.length} Punkte`}
          </span>
          {modus.art === 'zone' && modus.bearbeiten ? (
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
          <button className="knopf knopf-primaer klein" onClick={zeichnungAbschliessen}>
            Fertig
          </button>
          <button
            className="knopf knopf-gefahr klein"
            onClick={() => {
              aufzeichnungStoppen();
              setSheetArt(null);
              setModus(null);
            }}
          >
            Abbrechen
          </button>
        </div>
      )}

      {neueEinrichtung && (
        <EinrichtungFormular
          vergeben={einrichtungsNamen}
          onSpeichern={einrichtungSpeichern}
          onAbbrechen={() => setNeueEinrichtung(null)}
        />
      )}

      {wteMenue && (
        <div className="wte-menue" role="menu" aria-label="Neu">
          {(() => {
            const frei = !modus && !sheetArt;
            const los = (f: () => void) => () => {
              setWteMenue(false);
              f();
            };
            const eintrag = (text: string, f: () => void, an = true) =>
              an && (
                <button type="button" role="menuitem" disabled={!frei && !text.includes('beenden')} onClick={los(f)}>
                  {text}
                </button>
              );
            const route = (typ: RouteTyp) => () => {
              setWte(false);
              setPunkte([]);
              setModus({ art: 'route', typ });
            };
            return (
              <>
                <p className="menue-gruppe">Erfassen</p>
                {wte
                  ? eintrag('Wildtiererfassung beenden', () => setWte(false))
                  : eintrag('Wildtiererfassung starten', () => setWte(true))}
                {eintrag('Fang melden', () => navigieren('/abschuesse/fang'))}
                {eintrag('Einrichtung anlegen', () => {
                  setWte(false);
                  setModus({ art: 'einrichtung' });
                }, k.istInhaber)}
                <p className="menue-gruppe">Zeichnen</p>
                {eintrag(daten?.grenze ? 'Reviergrenze neu zeichnen' : 'Reviergrenze zeichnen', () => setModus({ art: 'grenze' }), k.istInhaber)}
                {eintrag('Zone zeichnen', () => setModus({ art: 'zone', zoneId: null, name: '' }), k.istInhaber)}
                {eintrag('Pirschweg zeichnen', route('pirschweg'))}
                {eintrag('Treiberroute zeichnen', route('treiberroute'), k.istInhaber)}
                {eintrag('WTE-Route zeichnen', route('wte_route'))}
                <p className="menue-gruppe">Aufzeichnen</p>
                {eintrag('Pirschweg per GPS aufzeichnen', () => aufzeichnungStarten('pirschweg'))}
                {eintrag('WTE-Route per GPS aufzeichnen', () => aufzeichnungStarten('wte_route'))}
                <p className="menue-gruppe">Import</p>
                {eintrag('GPS-Datei (Smartwatch)', () => setGpsImport(true))}
              </>
            );
          })()}
        </div>
      )}
      {gpsImport && (
        <GpsImport
          k={k}
          standardSitzungId={wteSitzung?.id ?? null}
          onZu={() => setGpsImport(false)}
          onFertig={(text) => {
            setGpsImport(false);
            setMeldung({ art: 'erfolg', text });
            void laden();
          }}
        />
      )}
      {sheetArt && (
        <ZeichnenSheet
          art={sheetArt}
          standardSitzungId={wteSitzung?.id ?? null}
          routenEbenen={routenEbenen}
          routenNamen={(daten?.pirschwege ?? []).map((f) => String(f.properties?.name ?? ''))}
          darfEbenenAnlegen={k.istInhaber}
          revierId={k.revierId}
          zonen={zonen}
          ebenen={kartenEbenen}
          hatGrenze={!!daten?.grenze}
          info={`${punkte.length} Punkte`}
          speichert={sheetSpeichert}
          fehler={sheetFehler}
          onSpeichern={(w) => void zeichnungSpeichern(w)}
          onAbbrechen={() => setSheetArt(null)}
        />
      )}
      {modus?.art === 'einrichtung' && (
        <div className={`wte-leiste${sheetOffen ? ' kompakt' : ''}${wteMenue ? ' kompakt-mobil' : ''}`} role="status">
          <strong>Einrichtung</strong>
          <span>Karte antippen, um die Position zu setzen</span>
          <button type="button" className="link" onClick={() => setModus(null)}>
            Beenden
          </button>
        </div>
      )}
      {wte && (
        <div className={`wte-leiste${sheetOffen ? ' kompakt' : ''}${wteMenue ? ' kompakt-mobil' : ''}`} role="status">
          <strong>WTE</strong>
          <span>
            {wteEbenenIds.length === 0
              ? 'Keine Zonenebene als WTE markiert (Zonen → Ebenen)'
              : wteSitzung
                ? `Zählung vom ${datumDE(wteSitzung.datum)} läuft – Zone antippen`
                : 'Keine laufende Zählung – Zone antippen startet eine'}
          </span>
          <button type="button" className="link" onClick={() => setWte(false)}>
            Beenden
          </button>
        </div>
      )}
      {wte && meldung && !panelOffen && (
        <div className={`wte-toast hinweis hinweis-${meldung.art}`} role="status" onAnimationEnd={() => setMeldung(null)}>
          {meldung.text}
        </div>
      )}
      {wte && wteZone && (
        <WteSichtung
          key={wteZone.id}
          k={k}
          zone={wteZone}
          sitzung={wteSitzung}
          ebenen={(daten?.ebenen ?? []).map((e) => ({ id: e.id, name: e.name }))}
          onSchliessen={() => setWteZone(null)}
          onSitzung={sitzungLaden}
          onGespeichert={(text) => {
            setWteZone(null);
            setMeldung({ art: 'info', text });
          }}
        />
      )}

      {einrSheet && !modus && !verschiebe && !wte && (
        <EinrichtungSheet
          key={einrSheet.id}
          k={k}
          einr={einrSheet}
          vergebeneNamen={einrichtungsNamen}
          onSchliessen={() => setEinrSheet(null)}
          onGeaendert={(text) => {
            setEinrSheet(null);
            setMeldung({ art: 'erfolg', text });
            void laden();
          }}
          onVerschieben={() => {
            setVerschiebe({ einr: einrSheet, lng: einrSheet.lng, lat: einrSheet.lat });
            setEinrSheet(null);
          }}
          onPosition={(lng, lat) => einrichtungPosition(einrSheet.id, lng, lat)}
        />
      )}
      {verschiebe && (
        <VerschiebeLeiste
          name={verschiebe.einr.name || 'Einrichtung'}
          laeuft={verschiebeLaeuft}
          geaendert={verschiebe.lng !== verschiebe.einr.lng || verschiebe.lat !== verschiebe.einr.lat}
          onOk={() => void verschiebenBestaetigen()}
          onAbbrechen={() => setVerschiebe(null)}
        />
      )}
      {gewaehlteZone && !modus && !einrSheet && <ZonenInfo zone={gewaehlteZone} onSchliessen={() => setGewaehlteZone(null)} onBearbeiten={k.istInhaber ? () => zoneBearbeiten(gewaehlteZone.id, gewaehlteZone.name) : undefined} />}

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
    <details className="werkzeug-abschnitt" open={offen}>
      <summary>{titel}</summary>
      <div className="werkzeug-inhalt">{children}</div>
    </details>
  );
}

function EbenenSchalter({
  label,
  an,
  gesperrt = false,
  onAendern,
}: {
  label: string;
  an: boolean;
  gesperrt?: boolean;
  onAendern: (an: boolean) => void;
}) {
  return (
    <label className={`ebene ${gesperrt ? 'gesperrt' : ''}`}>
      <input type="checkbox" checked={an} disabled={gesperrt} onChange={(e) => onAendern(e.target.checked)} />
      {label}
    </label>
  );
}

function EinrichtungFormular({
  vergeben,
  onSpeichern,
  onAbbrechen,
}: {
  vergeben: Array<string | null>;
  onSpeichern: (typ: Enums<'einrichtung_typ'>, name: string, bemerkung: string) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [typ, setTyp] = useState<Enums<'einrichtung_typ'>>('hochsitz');
  const [name, setName] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  return (
    <div className="karte-dialog" role="dialog" aria-label="Neue Einrichtung">
      <strong>Neue Einrichtung</strong>
      <select value={typ} onChange={(e) => setTyp(e.target.value as Enums<'einrichtung_typ'>)}>
        <EinrichtungsOptionen />
      </select>
      <input placeholder="Name, z. B. Eichenkanzel" value={name} onChange={(e) => setName(e.target.value)} />
      {name.trim() && nameVergeben(vergeben, name) && (
        <span className="feld-fehler">Eine Einrichtung „{name.trim()}“ gibt es bereits.</span>
      )}
      <input placeholder="Bemerkung (optional)" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
      <div className="karte-dialog-knoepfe">
        <button className="knopf knopf-sekundaer klein" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <button
          className="knopf knopf-primaer klein"
          disabled={!!name.trim() && nameVergeben(vergeben, name)}
          onClick={() => void onSpeichern(typ, name, bemerkung)}
        >
          Speichern
        </button>
      </div>
    </div>
  );
}

// ---------- Geometrie-Helfer ----------

function koordinaten(g: Geometry | null | undefined): Position[] {
  if (!g) return [];
  switch (g.type) {
    case 'Point':
      return [g.coordinates];
    case 'LineString':
    case 'MultiPoint':
      return g.coordinates;
    case 'Polygon':
    case 'MultiLineString':
      return g.coordinates.flat();
    case 'MultiPolygon':
      return g.coordinates.flat(2);
    case 'GeometryCollection':
      return g.geometries.flatMap(koordinaten);
  }
}

function grenzen(geometrien: Geometry[]): LngLatBounds | null {
  const alle = geometrien.flatMap(koordinaten);
  if (!alle.length) return null;
  const b = new LngLatBounds();
  for (const p of alle) b.extend([p[0]!, p[1]!]);
  return b;
}

function mittelpunkt(g: Geometry): [number, number] {
  const k = koordinaten(g);
  const x = k.reduce((a, p) => a + p[0]!, 0) / (k.length || 1);
  const y = k.reduce((a, p) => a + p[1]!, 0) / (k.length || 1);
  return [x, y];
}

function inRing(p: Position, ring: Position[]): boolean {
  let innen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [ring[i]![0]!, ring[i]![1]!];
    const [xj, yj] = [ring[j]![0]!, ring[j]![1]!];
    if (yi > p[1]! !== yj > p[1]! && p[0]! < ((xj - xi) * (p[1]! - yi)) / (yj - yi) + xi) innen = !innen;
  }
  return innen;
}

function punktInFlaeche(p: Position, g: MultiPolygon): boolean {
  return g.coordinates.some((poly) => inRing(p, poly[0] ?? []) && !poly.slice(1).some((loch) => inRing(p, loch)));
}

/** Nächster Punkt auf dem Rand (lokal metrisch genähert), minimal nach innen versetzt */
function naechsterRandpunkt(p: Position, g: MultiPolygon): Position {
  const kx = Math.cos((p[1]! * Math.PI) / 180);
  let bester: Position = p;
  let bestD = Infinity;
  for (const poly of g.coordinates)
    for (const ring of poly)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i]!;
        const b = ring[i + 1]!;
        const ax = a[0]! * kx, ay = a[1]!, bx = b[0]! * kx, by = b[1]!, px = p[0]! * kx, py = p[1]!;
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
        const qx = ax + t * dx, qy = ay + t * dy;
        const d = (qx - px) ** 2 + (qy - py) ** 2;
        if (d < bestD) {
          bestD = d;
          bester = [qx / kx, qy];
        }
      }
  return bester;
}

function abstandM(a: Position, b: Position): number {
  const r = 6371000;
  const dLat = ((b[1]! - a[1]!) * Math.PI) / 180;
  const dLon = ((b[0]! - a[0]!) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1]! * Math.PI) / 180) * Math.cos((b[1]! * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function haeufigste(features: Feature[]): string {
  const z = new Map<string, number>();
  for (const f of features) {
    const id = String(f.properties?.wildart_id ?? '');
    z.set(id, (z.get(id) ?? 0) + Number(f.properties?.anzahl ?? 1));
  }
  return [...z.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}
