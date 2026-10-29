import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GeolocateControl,
  LngLatBounds,
  Map as KarteMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import kartenWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, useZonen, wildartName, ZONENFARBEN } from '../../lib/stammdaten';
import { aktuellesWetter, himmelsrichtung, linieEWKT, punktEWKT, type Wetter } from '../../lib/geo';
import type { Enums, Json } from '../../lib/database.types';
import type { RevierKontext } from './kontext';

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
    luftbild: {
      type: 'raster',
      tiles: [LUFTBILD_URL],
      tileSize: 256,
      maxzoom: 20,
      attribution: 'Luftbild © LGLN',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm' },
    { id: 'luftbild', type: 'raster', source: 'luftbild', layout: { visibility: 'none' } },
  ],
};

const STANDARD_ZENTRUM: [number, number] = [9.47, 52.2]; // Raum Bad Münder

export const EINRICHTUNGSTYPEN: Array<{ wert: Enums<'einrichtung_typ'>; label: string; farbe: string }> = [
  { wert: 'hochsitz', label: 'Hochsitz', farbe: '#8b5a2b' },
  { wert: 'kanzel', label: 'Kanzel', farbe: '#5d3a1a' },
  { wert: 'ansitzleiter', label: 'Ansitzleiter', farbe: '#b07d4f' },
  { wert: 'bodensitz', label: 'Bodensitz', farbe: '#a0855b' },
  { wert: 'kirrung', label: 'Kirrung', farbe: '#d4a017' },
  { wert: 'salzlecke', label: 'Salzlecke', farbe: '#9aa5b1' },
  { wert: 'fuetterung', label: 'Fütterung', farbe: '#c97b2a' },
  { wert: 'wildacker', label: 'Wildacker', farbe: '#4caf50' },
  { wert: 'wildkamera', label: 'Wildkamera', farbe: '#1f6fb2' },
  { wert: 'falle', label: 'Falle', farbe: '#7f4f9e' },
  { wert: 'sonstiges', label: 'Sonstiges', farbe: '#5d6d7e' },
];

const LEER: FeatureCollection = { type: 'FeatureCollection', features: [] };

type KartenDaten = {
  grenze: MultiPolygon | null;
  zonen: Feature[];
  einrichtungen: Feature[];
  pirschwege: Feature[];
  beobachtungen: Feature[];
  abschuesse: Feature[];
};

type Ebenen = {
  luftbild: boolean;
  zonen: boolean;
  einrichtungen: boolean;
  pirschwege: boolean;
  heatmap: boolean;
  abschuesse: boolean;
};

type Modus =
  | { art: 'grenze' }
  | { art: 'zone'; zoneId: string | null; name: string }
  | { art: 'pirschweg' }
  | { art: 'aufzeichnung' }
  | { art: 'einrichtung' }
  | null;

// ---------- Komponente ----------

export default function Karte({ k }: { k: RevierKontext }) {
  const wildarten = useWildarten();
  const { zonen, laden: zonenLaden } = useZonen(k.revierId);
  const container = useRef<HTMLDivElement>(null);
  const karte = useRef<KarteMap | null>(null);
  const zonenMarker = useRef<Marker[]>([]);
  const [bereit, setBereit] = useState(false);
  const [daten, setDaten] = useState<KartenDaten | null>(null);
  const [ebenen, setEbenen] = useState<Ebenen>({
    luftbild: false,
    zonen: true,
    einrichtungen: true,
    pirschwege: true,
    heatmap: false,
    abschuesse: false,
  });
  const [modus, setModusState] = useState<Modus>(null);
  const modusRef = useRef<Modus>(null);
  const [punkte, setPunkte] = useState<Position[]>([]);
  const [neueEinrichtung, setNeueEinrichtung] = useState<Position | null>(null);
  const [wind, setWind] = useState<Wetter | null>(null);
  const [panelOffen, setPanelOffen] = useState(window.innerWidth > 700);
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg' | 'info'; text: string } | null>(null);
  const [shpImport, setShpImport] = useState<Feature<Polygon | MultiPolygon>[] | null>(null);
  const aufzeichnung = useRef<number | null>(null);

  const setModus = (m: Modus) => {
    modusRef.current = m;
    setModusState(m);
    setPunkte([]);
    setNeueEinrichtung(null);
  };

  // Daten laden
  const laden = useCallback(async () => {
    const { data, error } = await supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 365 });
    if (error) {
      setMeldung({ art: 'fehler', text: fehlertext(error) });
      return;
    }
    const d = (data ?? {}) as unknown as Partial<KartenDaten>;
    setDaten({
      grenze: d.grenze ?? null,
      zonen: d.zonen ?? [],
      einrichtungen: d.einrichtungen ?? [],
      pirschwege: d.pirschwege ?? [],
      beobachtungen: d.beobachtungen ?? [],
      abschuesse: d.abschuesse ?? [],
    });
  }, [k.revierId]);

  // Karte initialisieren
  useEffect(() => {
    if (!container.current) return;
    const m = new KarteMap({
      container: container.current,
      style: STIL,
      center: STANDARD_ZENTRUM,
      zoom: 12,
      attributionControl: { compact: true },
    });
    karte.current = m;
    m.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
    m.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'top-right',
    );
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    m.on('load', () => {
      for (const id of ['grenze', 'zonen', 'einrichtungen', 'pirschwege', 'beobachtungen', 'abschuesse', 'zeichnung']) {
        m.addSource(id, { type: 'geojson', data: LEER });
      }
      m.addLayer({
        id: 'zonen-flaeche',
        type: 'fill',
        source: 'zonen',
        paint: { 'fill-color': ['coalesce', ['get', 'farbe'], '#2f5d3a'], 'fill-opacity': 0.22 },
      });
      m.addLayer({
        id: 'zonen-linie',
        type: 'line',
        source: 'zonen',
        paint: { 'line-color': ['coalesce', ['get', 'farbe'], '#2f5d3a'], 'line-width': 1.5 },
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
        source: 'beobachtungen',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'anzahl'], 1, 0.4, 10, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 16, 40],
          'heatmap-opacity': 0.75,
        },
      });
      m.addLayer({
        id: 'pirschwege-linie',
        type: 'line',
        source: 'pirschwege',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7b4a12', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      });
      m.addLayer({
        id: 'abschuesse-punkt',
        type: 'circle',
        source: 'abschuesse',
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 6, 'circle-color': '#c0392b', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
      });
      m.addLayer({
        id: 'einrichtungen-punkt',
        type: 'circle',
        source: 'einrichtungen',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9],
          'circle-color': [
            'match',
            ['get', 'typ'],
            ...EINRICHTUNGSTYPEN.flatMap((t) => [t.wert, t.farbe]),
            '#5d6d7e',
          ] as unknown as string,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
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
        paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#1f6fb2', 'circle-stroke-width': 2 },
      });

      for (const ebene of ['einrichtungen-punkt', 'pirschwege-linie', 'zonen-flaeche']) {
        m.on('mouseenter', ebene, () => {
          if (!modusRef.current) m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', ebene, () => {
          m.getCanvas().style.cursor = '';
        });
      }
      setBereit(true);
    });

    return () => {
      m.remove();
      karte.current = null;
    };
  }, []);

  useEffect(() => {
    if (bereit) void laden();
  }, [bereit, laden]);

  // Daten in die Karte schreiben
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit || !daten) return;
    const setzen = (id: string, fc: FeatureCollection) => (m.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
    setzen('grenze', { type: 'FeatureCollection', features: daten.grenze ? [{ type: 'Feature', geometry: daten.grenze, properties: {} }] : [] });
    setzen('zonen', { type: 'FeatureCollection', features: daten.zonen });
    setzen('einrichtungen', { type: 'FeatureCollection', features: daten.einrichtungen });
    setzen('pirschwege', { type: 'FeatureCollection', features: daten.pirschwege });
    setzen('beobachtungen', { type: 'FeatureCollection', features: daten.beobachtungen });
    setzen('abschuesse', { type: 'FeatureCollection', features: daten.abschuesse });

    // Zonennamen als HTML-Beschriftung (kommt ohne Schrift-Server aus)
    for (const mk of zonenMarker.current) mk.remove();
    zonenMarker.current = daten.zonen.map((f) => {
      const el = document.createElement('div');
      el.className = 'zonen-beschriftung';
      el.textContent = String(f.properties?.name ?? '');
      return new Marker({ element: el }).setLngLat(mittelpunkt(f.geometry)).addTo(m);
    });
    for (const mk of zonenMarker.current) mk.getElement().style.display = ebenen.zonen ? '' : 'none';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten, bereit]);

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
    const links = window.innerWidth > 700 ? 360 : 30;
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
    sichtbar('luftbild', ebenen.luftbild);
    sichtbar('osm', !ebenen.luftbild);
    sichtbar('zonen-flaeche', ebenen.zonen);
    sichtbar('zonen-linie', ebenen.zonen);
    sichtbar('einrichtungen-punkt', ebenen.einrichtungen);
    sichtbar('pirschwege-linie', ebenen.pirschwege);
    sichtbar('heatmap', ebenen.heatmap);
    sichtbar('abschuesse-punkt', ebenen.abschuesse);
    for (const mk of zonenMarker.current) mk.getElement().style.display = ebenen.zonen ? '' : 'none';
  }, [ebenen, bereit]);

  // Zeichnung anzeigen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const features: Feature[] = punkte.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
    const istFlaeche = modus?.art === 'grenze' || modus?.art === 'zone';
    if (punkte.length >= 3 && istFlaeche) {
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...punkte, punkte[0]!]] }, properties: {} });
    } else if (punkte.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: punkte }, properties: {} });
    }
    if (shpImport) features.push(...(shpImport as Feature[]));
    (m.getSource('zeichnung') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [punkte, modus, bereit, shpImport]);

  // Klicks: im Zeichenmodus Punkte setzen, sonst Details anzeigen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const klick = (e: MapMouseEvent) => {
      const aktiv = modusRef.current;
      const pos: Position = [e.lngLat.lng, e.lngLat.lat];
      if (aktiv?.art === 'einrichtung') {
        setNeueEinrichtung(pos);
        return;
      }
      if (aktiv && aktiv.art !== 'aufzeichnung') {
        setPunkte((alt) => [...alt, pos]);
        return;
      }
      if (aktiv) return;
      const treffer = m.queryRenderedFeatures(e.point, { layers: ['einrichtungen-punkt', 'pirschwege-linie', 'zonen-flaeche'] });
      const f = treffer[0];
      if (!f) return;
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
  }, [bereit, modus, k.istInhaber, wildarten]);

  // Wind am Kartenmittelpunkt
  const windLaden = useCallback(async () => {
    const m = karte.current;
    if (!m) return;
    const c = m.getCenter();
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
    } else if (ebene === 'pirschwege-linie') {
      titel.textContent = `Pirschweg: ${String(p.name ?? '')}`;
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

  async function zeichnungSpeichern() {
    if (!modus) return;
    setMeldung(null);
    try {
      if (modus.art === 'grenze' || modus.art === 'zone') {
        if (punkte.length < 3) throw new Error('Bitte mindestens drei Punkte setzen.');
        const geojson = { type: 'Polygon', coordinates: [[...punkte, punkte[0]!]] } as unknown as Json;
        if (modus.art === 'grenze') {
          const { data, error } = await supabase.rpc('grenze_setzen', { p_revier_id: k.revierId, p_geojson: geojson });
          if (error) throw error;
          setMeldung({ art: 'erfolg', text: `Reviergrenze gespeichert · ${Number(data).toLocaleString('de-DE')} ha` });
          await k.neuLaden();
        } else {
          let zoneId = modus.zoneId;
          let name = modus.name;
          if (!zoneId) {
            // Neue Zone: erst benennen und anlegen, dann Fläche speichern
            const eingabe = window.prompt('Name der neuen Zone:', `Zone ${zonen.length + 1}`)?.trim();
            if (!eingabe) return;
            name = eingabe;
            const { data: neu, error: anlegeFehler } = await supabase
              .from('zonen')
              .insert({
                revier_id: k.revierId,
                name,
                sortierung: zonen.length,
                farbe: ZONENFARBEN[zonen.length % ZONENFARBEN.length],
              })
              .select('id')
              .single();
            if (anlegeFehler) throw anlegeFehler;
            zoneId = neu.id;
          }
          const { error } = await supabase.rpc('zone_geometrie_setzen', { p_zone_id: zoneId, p_geojson: geojson });
          if (error) throw error;
          setMeldung({ art: 'erfolg', text: `Zone „${name}“ gespeichert` });
          await zonenLaden();
        }
      } else if (modus.art === 'pirschweg' || modus.art === 'aufzeichnung') {
        if (punkte.length < 2) throw new Error('Ein Pirschweg braucht mindestens zwei Punkte.');
        const name = window.prompt('Name des Pirschwegs:', 'Pirschweg')?.trim();
        if (!name) return;
        const { error } = await supabase.from('pirschwege').insert({
          revier_id: k.revierId,
          name,
          geom: linieEWKT(punkte as Array<[number, number]>),
        });
        if (error) throw error;
        setMeldung({ art: 'erfolg', text: `Pirschweg „${name}“ gespeichert` });
      }
      aufzeichnungStoppen();
      setModus(null);
      await laden();
    } catch (err) {
      setMeldung({ art: 'fehler', text: fehlertext(err) });
    }
  }

  function aufzeichnungStarten() {
    setModus({ art: 'aufzeichnung' });
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

  async function einrichtungSpeichern(typ: Enums<'einrichtung_typ'>, name: string, bemerkung: string) {
    if (!neueEinrichtung) return;
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

  async function shpLesen(datei: File) {
    setMeldung({ art: 'info', text: 'Shapefile wird gelesen …' });
    try {
      const { default: shp } = await import('shpjs');
      const ergebnis = await shp(await datei.arrayBuffer());
      const sammlungen = Array.isArray(ergebnis) ? ergebnis : [ergebnis];
      const flaechen = sammlungen
        .flatMap((s) => s.features)
        .filter((f): f is Feature<Polygon | MultiPolygon> => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');
      if (!flaechen.length) throw new Error('Keine Flächen im Shapefile gefunden.');
      setShpImport(flaechen);
      setMeldung(null);
      const b = grenzen(flaechen.map((f) => f.geometry));
      if (b) karte.current?.fitBounds(b, { padding: 40 });
    } catch (err) {
      setMeldung({ art: 'fehler', text: `Shapefile konnte nicht gelesen werden: ${fehlertext(err)}` });
    }
  }

  async function shpAlsGrenze() {
    if (!shpImport) return;
    const geojson = {
      type: 'MultiPolygon',
      coordinates: shpImport.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)),
    } as unknown as Json;
    const { data, error } = await supabase.rpc('grenze_setzen', { p_revier_id: k.revierId, p_geojson: geojson });
    if (error) {
      setMeldung({ art: 'fehler', text: fehlertext(error) });
      return;
    }
    setShpImport(null);
    setMeldung({ art: 'erfolg', text: `Reviergrenze aus Shapefile übernommen · ${Number(data).toLocaleString('de-DE')} ha` });
    await k.neuLaden();
    await laden();
  }

  async function shpAlsZonen(namensfeld: string) {
    if (!shpImport) return;
    let anzahl = 0;
    for (const [i, f] of shpImport.entries()) {
      const name = String(f.properties?.[namensfeld] ?? `Zone ${zonen.length + i + 1}`).trim() || `Zone ${zonen.length + i + 1}`;
      const { data, error } = await supabase
        .from('zonen')
        .insert({ revier_id: k.revierId, name, sortierung: zonen.length + i })
        .select('id')
        .single();
      if (error) {
        setMeldung({ art: 'fehler', text: fehlertext(error) });
        break;
      }
      const geo = await supabase.rpc('zone_geometrie_setzen', { p_zone_id: data.id, p_geojson: f.geometry as unknown as Json });
      if (geo.error) {
        setMeldung({ art: 'fehler', text: `${name}: ${fehlertext(geo.error)}` });
        continue;
      }
      anzahl++;
    }
    setShpImport(null);
    if (anzahl) setMeldung({ art: 'erfolg', text: `${anzahl} Zonen aus Shapefile angelegt` });
    await zonenLaden();
    await laden();
  }

  // ---------- Darstellung ----------

  const zeichnet = modus && modus.art !== 'einrichtung';
  const anzahlBeob = daten?.beobachtungen.length ?? 0;

  return (
    <div className="karte-seite">
      <div ref={container} className="karte" />

      {wind && (
        <div className="wind" title="Aktueller Wind am Kartenmittelpunkt (Open-Meteo)">
          <span className="wind-pfeil" style={{ transform: `rotate(${wind.windRichtung + 180}deg)` }} aria-hidden="true">
            ↑
          </span>
          <span>
            <strong>{Math.round(wind.windKmh)} km/h</strong> aus {himmelsrichtung(wind.windRichtung)}
            <small>{Math.round(wind.temperatur)} °C</small>
          </span>
          <button className="link" onClick={windLaden} aria-label="Wind aktualisieren">
            ↻
          </button>
        </div>
      )}

      {zeichnet && (
        <div className="zeichen-leiste">
          <span>
            {modus.art === 'grenze' && 'Reviergrenze: Eckpunkte antippen'}
            {modus.art === 'zone' && (modus.zoneId ? `Zone „${modus.name}“: Eckpunkte antippen` : 'Neue Zone: Eckpunkte antippen')}
            {modus.art === 'pirschweg' && 'Pirschweg: Wegpunkte antippen'}
            {modus.art === 'aufzeichnung' && `GPS-Aufzeichnung: ${punkte.length} Punkte`}
          </span>
          <button className="knopf knopf-sekundaer klein" onClick={() => setPunkte((p) => p.slice(0, -1))} disabled={!punkte.length}>
            ↶ Zurück
          </button>
          <button className="knopf knopf-primaer klein" onClick={zeichnungSpeichern}>
            Speichern
          </button>
          <button
            className="knopf knopf-gefahr klein"
            onClick={() => {
              aufzeichnungStoppen();
              setModus(null);
            }}
          >
            Abbrechen
          </button>
        </div>
      )}

      {neueEinrichtung && (
        <EinrichtungFormular onSpeichern={einrichtungSpeichern} onAbbrechen={() => setNeueEinrichtung(null)} />
      )}

      <button className="panel-schalter" onClick={() => setPanelOffen((o) => !o)} aria-expanded={panelOffen}>
        {panelOffen ? '✕' : '☰ Ebenen & Werkzeuge'}
      </button>

      {panelOffen && (
        <aside className="karte-panel">
          {meldung && <div className={`hinweis hinweis-${meldung.art}`}>{meldung.text}</div>}

          <h3>Ebenen</h3>
          <EbenenSchalter label="Luftbild (LGLN)" an={ebenen.luftbild} onAendern={(an) => setEbenen({ ...ebenen, luftbild: an })} />
          <EbenenSchalter label="Zonen" an={ebenen.zonen} onAendern={(an) => setEbenen({ ...ebenen, zonen: an })} />
          <EbenenSchalter label="Einrichtungen" an={ebenen.einrichtungen} onAendern={(an) => setEbenen({ ...ebenen, einrichtungen: an })} />
          <EbenenSchalter label="Pirschwege" an={ebenen.pirschwege} onAendern={(an) => setEbenen({ ...ebenen, pirschwege: an })} />
          <EbenenSchalter
            label={`Heatmap Beobachtungen (${anzahlBeob}, 12 Monate)`}
            an={ebenen.heatmap}
            onAendern={(an) => setEbenen({ ...ebenen, heatmap: an })}
          />
          <EbenenSchalter
            label={`Abschüsse (${daten?.abschuesse.length ?? 0}, 12 Monate)`}
            an={ebenen.abschuesse}
            onAendern={(an) => setEbenen({ ...ebenen, abschuesse: an })}
          />

          {ebenen.einrichtungen && (
            <div className="legende">
              {EINRICHTUNGSTYPEN.filter((t) => daten?.einrichtungen.some((e) => e.properties?.typ === t.wert)).map((t) => (
                <span key={t.wert}>
                  <i style={{ background: t.farbe }} /> {t.label}
                </span>
              ))}
            </div>
          )}

          {k.istInhaber ? (
            <>
              <h3>Zeichnen</h3>
              <button className="knopf knopf-sekundaer" onClick={() => setModus({ art: 'grenze' })} disabled={!!modus}>
                {daten?.grenze ? 'Reviergrenze neu zeichnen' : 'Reviergrenze zeichnen'}
              </button>
              <button className="knopf knopf-sekundaer" onClick={() => setModus({ art: 'zone', zoneId: null, name: '' })} disabled={!!modus}>
                Neue Zone zeichnen
              </button>
              {zonen.length > 0 && (
                <select
                  className="karte-auswahl"
                  value=""
                  disabled={!!modus}
                  aria-label="Fläche einer bestehenden Zone zeichnen"
                  onChange={(e) => {
                    const z = zonen.find((x) => x.id === e.target.value);
                    if (z) setModus({ art: 'zone', zoneId: z.id, name: z.name });
                  }}
                >
                  <option value="">Fläche für bestehende Zone …</option>
                  {zonen.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                      {z.hatGeometrie ? ' (neu zeichnen)' : ' (noch ohne Fläche)'}
                    </option>
                  ))}
                </select>
              )}
              <button className="knopf knopf-sekundaer" onClick={() => setModus({ art: 'einrichtung' })} disabled={!!modus}>
                Einrichtung setzen
              </button>
              {modus?.art === 'einrichtung' && (
                <button className="knopf knopf-gefahr" onClick={() => setModus(null)}>
                  Einrichtungen setzen beenden
                </button>
              )}
              <button className="knopf knopf-sekundaer" onClick={() => setModus({ art: 'pirschweg' })} disabled={!!modus}>
                Pirschweg zeichnen
              </button>
              <button className="knopf knopf-sekundaer" onClick={aufzeichnungStarten} disabled={!!modus}>
                Pirschweg per GPS aufzeichnen
              </button>

              <h3>Import</h3>
              <label className="knopf knopf-sekundaer datei-knopf">
                Shapefile (.zip) laden
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const datei = e.target.files?.[0];
                    if (datei) void shpLesen(datei);
                    e.target.value = '';
                  }}
                />
              </label>
              {shpImport && <ShpAuswahl flaechen={shpImport} onGrenze={shpAlsGrenze} onZonen={shpAlsZonen} onAbbrechen={() => setShpImport(null)} />}
            </>
          ) : (
            <p className="leer">Zeichnen und Importieren kann nur der Revierinhaber.</p>
          )}
          <p className="leer">Heatmap und Abschüsse zeigen nur Erfassungen mit Position. Wind: Open-Meteo.</p>
          {wildarten.length > 0 && anzahlBeob > 0 && (
            <p className="leer">
              Häufigste Wildart: {wildartName(wildarten, haeufigste(daten?.beobachtungen ?? []))}
            </p>
          )}
        </aside>
      )}
    </div>
  );
}

// ---------- Teilkomponenten ----------

function EbenenSchalter({ label, an, onAendern }: { label: string; an: boolean; onAendern: (an: boolean) => void }) {
  return (
    <label className="ebene">
      <input type="checkbox" checked={an} onChange={(e) => onAendern(e.target.checked)} />
      {label}
    </label>
  );
}

function EinrichtungFormular({
  onSpeichern,
  onAbbrechen,
}: {
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
        {EINRICHTUNGSTYPEN.map((t) => (
          <option key={t.wert} value={t.wert}>
            {t.label}
          </option>
        ))}
      </select>
      <input placeholder="Name, z. B. Eichenkanzel" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Bemerkung (optional)" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
      <div className="karte-dialog-knoepfe">
        <button className="knopf knopf-sekundaer klein" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <button className="knopf knopf-primaer klein" onClick={() => void onSpeichern(typ, name, bemerkung)}>
          Speichern
        </button>
      </div>
    </div>
  );
}

function ShpAuswahl({
  flaechen,
  onGrenze,
  onZonen,
  onAbbrechen,
}: {
  flaechen: Feature<Polygon | MultiPolygon>[];
  onGrenze: () => Promise<void>;
  onZonen: (namensfeld: string) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const felder = Object.keys(flaechen[0]?.properties ?? {});
  const [feld, setFeld] = useState(felder.find((f) => /name|bez/i.test(f)) ?? felder[0] ?? '');
  return (
    <div className="shp-auswahl">
      <p>
        <strong>{flaechen.length} Flächen</strong> gefunden (blau in der Karte).
      </p>
      <button className="knopf knopf-primaer" onClick={() => void onGrenze()}>
        Als Reviergrenze übernehmen
      </button>
      {felder.length > 0 && (
        <label className="ebene">
          Zonenname aus Feld
          <select value={feld} onChange={(e) => setFeld(e.target.value)}>
            {felder.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="knopf knopf-sekundaer" onClick={() => void onZonen(feld)}>
        Als {flaechen.length} Zonen anlegen
      </button>
      <button className="link" onClick={onAbbrechen}>
        Verwerfen
      </button>
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
