import { useEffect, useRef } from 'react';
import { LngLatBounds, Map as KarteMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import kartenWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Geometry } from 'geojson';

setWorkerUrl(kartenWorkerUrl);

const STIL: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap-Mitwirkende' },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export type BjMarker = { id: string; lng: number; lat: number; art: 'treffpunkt' | 'bock' | 'eigener' | 'frei' | 'belegt' | 'rettung'; label?: string };

// Kleine Karte für die Bewegungsjagd: Treffpunkt wählen oder Treffpunkt/Böcke/eigenen Stand anzeigen
export default function BjKarte({
  marker,
  grenze,
  waehlbar = false,
  onWaehlen,
  onMarkerKlick,
  className = 'bj-karte',
}: {
  marker: BjMarker[];
  grenze?: Geometry | null;
  waehlbar?: boolean;
  onWaehlen?: (lng: number, lat: number) => void;
  onMarkerKlick?: (id: string) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const karte = useRef<KarteMap | null>(null);
  const aktive = useRef<Marker[]>([]);
  const gepasst = useRef(false);
  const waehlen = useRef(onWaehlen);
  waehlen.current = onWaehlen;
  const markerKlick = useRef(onMarkerKlick);
  markerKlick.current = onMarkerKlick;
  const wahl = useRef(waehlbar);
  wahl.current = waehlbar;

  useEffect(() => {
    if (!el.current) return;
    const m = new KarteMap({ container: el.current, style: STIL, center: [9.47, 52.2], zoom: 11, attributionControl: { compact: true } });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.on('click', (e) => {
      if (wahl.current) waehlen.current?.(e.lngLat.lng, e.lngLat.lat);
    });
    karte.current = m;
    return () => {
      m.remove();
      karte.current = null;
      aktive.current = [];
    };
  }, []);

  // Grenze
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    const zeichnen = () => {
      const daten = { type: 'FeatureCollection' as const, features: grenze ? [{ type: 'Feature' as const, geometry: grenze, properties: {} }] : [] };
      const q = m.getSource('bj-grenze') as GeoJSONSource | undefined;
      if (q) q.setData(daten);
      else {
        m.addSource('bj-grenze', { type: 'geojson', data: daten });
        m.addLayer({ id: 'bj-grenze', type: 'line', source: 'bj-grenze', paint: { 'line-color': '#1e5c3a', 'line-width': 2.5 } });
        // Ohne Marker auf die Reviergrenze zoomen (z. B. beim Positionswähler)
        if (grenze && !gepasst.current && aktive.current.length === 0) {
          const b = new LngLatBounds();
          const walk = (c: unknown): void => {
            if (Array.isArray(c) && typeof c[0] === 'number') b.extend([c[0] as number, c[1] as number]);
            else if (Array.isArray(c)) c.forEach(walk);
          };
          walk((grenze as { coordinates?: unknown }).coordinates);
          if (!b.isEmpty()) m.fitBounds(b, { padding: 30, maxZoom: 16, animate: false });
        }
      }
    };
    if (m.isStyleLoaded()) zeichnen();
    else m.once('load', zeichnen);
  }, [grenze]);

  // Marker
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    aktive.current.forEach((x) => x.remove());
    aktive.current = marker.map((p) => {
      const d = document.createElement('div');
      d.className = `bj-marker bj-marker-${p.art}`;
      d.textContent = p.art === 'treffpunkt' ? '⚑' : p.art === 'eigener' ? '★' : p.art === 'rettung' ? '+' : '';
      d.addEventListener('click', (ev) => {
        if (!markerKlick.current) return;
        ev.stopPropagation();
        markerKlick.current(p.id);
      });
      if (onMarkerKlick) d.style.cursor = 'pointer';
      if (p.label) {
        d.title = p.label;
        d.setAttribute('aria-label', p.label);
      }
      if (p.label && p.art !== 'bock' && p.art !== 'frei') {
        const s = document.createElement('span');
        s.className = 'bj-marker-text';
        s.textContent = p.label;
        d.appendChild(s);
      }
      return new Marker({ element: d }).setLngLat([p.lng, p.lat]).addTo(m);
    });
    if (!gepasst.current && marker.length) {
      gepasst.current = true;
      const b = new LngLatBounds();
      marker.forEach((p) => b.extend([p.lng, p.lat]));
      if (marker.length === 1) m.jumpTo({ center: [marker[0]!.lng, marker[0]!.lat], zoom: 15 });
      else m.fitBounds(b, { padding: 50, maxZoom: 16, animate: false });
    }
  }, [marker]);

  return <div ref={el} className={className} role="application" aria-label="Karte der Bewegungsjagd" />;
}
