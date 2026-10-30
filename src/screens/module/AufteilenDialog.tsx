import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as KarteMap, Popup, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import kartenWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { Feld, Hinweis, Knopf } from '../../components/ui';

setWorkerUrl(kartenWorkerUrl);

const STIL: StyleSpecification = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap-Mitwirkende' } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};
const FARBEN = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#1f78b4'];

type Teil = Feature<Polygon | MultiPolygon, { nr: number; flaeche_ha: number; farbe: string }>;

// Revier automatisch in N flächengleiche Zonen teilen: Vorschau auf der Karte, Anlegen als eigene Zonenebene
export function AufteilenDialog({ revierId, onZu, onAngelegt }: { revierId: string; onZu: () => void; onAngelegt: () => Promise<void> }) {
  const [anzahl, setAnzahl] = useState(6);
  const [name, setName] = useState('');
  const [teile, setTeile] = useState<Teil[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const karte = useRef<KarteMap | null>(null);
  const gepasst = useRef(false);
  const geladen = useRef(false);
  const daten = useRef<FeatureCollection>({ type: 'FeatureCollection', features: [] });

  const zeichnen = () => {
    const m = karte.current;
    if (!m || !geladen.current) return;
    const q = m.getSource('teile') as GeoJSONSource | undefined;
    if (q) q.setData(daten.current);
    else {
      m.addSource('teile', { type: 'geojson', data: daten.current });
      m.addLayer({ id: 'teile-flaeche', type: 'fill', source: 'teile', paint: { 'fill-color': ['get', 'farbe'], 'fill-opacity': 0.45 } });
      m.addLayer({ id: 'teile-linie', type: 'line', source: 'teile', paint: { 'line-color': '#111', 'line-width': 2 } });
    }
  };

  useEffect(() => {
    if (!el.current) return;
    const m = new KarteMap({ container: el.current, style: STIL, center: [9.47, 52.2], zoom: 11, attributionControl: { compact: true } });
    karte.current = m;
    m.on('load', () => {
      geladen.current = true;
      zeichnen();
    });
    const popup = new Popup({ closeButton: false });
    m.on('click', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['teile-flaeche'] })[0];
      if (f) popup.setLngLat(e.lngLat).setHTML(`<strong>Zone ${f.properties.nr}</strong><br>${Number(f.properties.flaeche_ha).toLocaleString('de-DE')} ha`).addTo(m);
    });
    return () => {
      m.remove();
      karte.current = null;
      geladen.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vorschau neu berechnen (verzögert, damit schnelles Ändern nicht jedes Mal rechnet)
  useEffect(() => {
    if (anzahl < 2 || anzahl > 30) return;
    setLaedt(true);
    const timer = window.setTimeout(() => {
      void supabase.rpc('revier_aufteilen_vorschau', { p_revier_id: revierId, p_anzahl: anzahl }).then(({ data, error }) => {
        setLaedt(false);
        if (error) {
          setFehler(fehlertext(error));
          setTeile([]);
          return;
        }
        setFehler(null);
        const fc = data as unknown as FeatureCollection<Polygon | MultiPolygon, { nr: number; flaeche_ha: number }>;
        const liste = fc.features.map((f) => ({ ...f, properties: { ...f.properties, farbe: FARBEN[(f.properties.nr - 1) % FARBEN.length]! } })) as Teil[];
        setTeile(liste);
        daten.current = { type: 'FeatureCollection', features: liste };
        zeichnen();
        const m = karte.current;
        if (m && !gepasst.current && liste.length) {
          const b = new LngLatBounds();
          const walk = (c: unknown): void => {
            if (Array.isArray(c) && typeof c[0] === 'number') b.extend([c[0] as number, c[1] as number]);
            else if (Array.isArray(c)) c.forEach(walk);
          };
          liste.forEach((f) => walk(f.geometry.coordinates));
          if (!b.isEmpty()) {
            gepasst.current = true;
            m.fitBounds(b, { padding: 30, animate: false });
          }
        }
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [anzahl, revierId]);

  async function anlegen() {
    setSpeichert(true);
    const { error } = await supabase.rpc('revier_aufteilen', { p_revier_id: revierId, p_anzahl: anzahl, p_name: name.trim() || undefined });
    setSpeichert(false);
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    await onAngelegt();
    onZu();
  }

  const flaechen = teile.map((t) => t.properties.flaeche_ha);
  const summe = flaechen.reduce((a, b) => a + b, 0);

  return (
    <div className="bj-dialog-hintergrund" role="dialog" aria-modal="true" aria-label="Revier in Zonen aufteilen">
      <div className="bj-dialog" style={{ width: 'min(820px, 96vw)', maxHeight: '94dvh', overflow: 'auto' }}>
        <strong>Revier in gleich große Zonen aufteilen</strong>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
          Die Zonen haben die gleiche Fläche (nicht gleichen Wildbestand oder Waldanteil) und folgen keinen Wegen oder Feldkanten. Sie landen in einer eigenen Zonenebene und lassen sich danach wie andere Zonen bearbeiten oder mit der Ebene löschen.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Anzahl Zonen
            <input type="range" min={2} max={30} value={anzahl} onChange={(e) => setAnzahl(Number(e.target.value))} aria-label="Anzahl der Zonen" />
            <input type="number" min={2} max={30} value={anzahl} style={{ width: 64 }} onChange={(e) => setAnzahl(Math.min(30, Math.max(2, Number(e.target.value) || 2)))} aria-label="Anzahl der Zonen (Zahl)" />
          </label>
          <span aria-live="polite">{laedt ? 'Berechne …' : teile.length ? `je ca. ${(summe / teile.length).toLocaleString('de-DE', { maximumFractionDigits: 1 })} ha · gesamt ${summe.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ha` : ''}</span>
        </div>
        <div ref={el} className="bj-karte bj-karte-hoch" role="application" aria-label="Vorschau der Aufteilung" />
        <Feld label="Name der Ebene (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Raster ${anzahl} Zonen`} />
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <div className="bj-dialog-knoepfe">
          <Knopf variante="ghost" onClick={onZu}>Abbrechen</Knopf>
          <Knopf variante="akzent" disabled={speichert || laedt || teile.length === 0} onClick={() => void anlegen()}>
            {speichert ? 'Lege an …' : `${anzahl} Zonen anlegen`}
          </Knopf>
        </div>
      </div>
    </div>
  );
}
