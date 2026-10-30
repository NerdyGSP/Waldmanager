import { useRoutenEbenen, ebeneBereitstellen } from '../../lib/routen';
import { RoutenEbenenWahl, ebeneUngueltig } from '../../components/RoutenEbenenWahl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LngLatBounds, Map as KarteMap, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import kartenWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { linieEWKT } from '../../lib/geo';
import { nameVergeben } from '../../lib/stammdaten';
import { datumDE } from '../../lib/zeit';
import { Auswahl, Feld, Hinweis, Knopf } from '../../components/ui';
import type { GpsRoh } from '../../lib/gpsParser';
import { berichtErstellen, reduzieren, type TrackBericht } from '../../lib/gpsPruefung';
import type { RevierKontext } from './kontext';

setWorkerUrl(kartenWorkerUrl);

const STIL: StyleSpecification = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap-Mitwirkende' } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export type GpsZiel = 'pirschweg' | 'treiberroute' | 'wte_route';
const ZIELNAMEN: Record<GpsZiel, string> = { pirschweg: 'Pirschweg', treiberroute: 'Treiberroute', wte_route: 'WTE-Route' };

const km = (m: number) => `${(m / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
const uhr = (t: number) => new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
const zahl = (n: number) => n.toLocaleString('de-DE');

type Auswahlzeile = { an: boolean; name: string; ziel: GpsZiel; bemerkung: string; mitDatum: boolean; ebene: string; neueEbene: string };

// GPS-Datei einer Smartwatch (GPX, KML, KMZ, FIT) übernehmen: 1. Datei und Ziel, 2. Prüfbericht und Punktreduktion, 3. Benennung
export function GpsImport({ k, onZu, onFertig, standardSitzungId }: { k: RevierKontext; onZu: () => void; onFertig: (text: string) => void; standardSitzungId?: string | null }) {
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
  const [ziel, setZiel] = useState<GpsZiel>('pirschweg');
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [roh, setRoh] = useState<GpsRoh | null>(null);
  const [dateiname, setDateiname] = useState('');
  const [grenze, setGrenze] = useState<Geometry | null>(null);
  const [berichte, setBerichte] = useState<TrackBericht[]>([]);
  const [zeilen, setZeilen] = useState<Auswahlzeile[]>([]);
  const [toleranz, setToleranz] = useState(3);
  const [minAbstand, setMinAbstand] = useState(0);
  const [maxPunkte, setMaxPunkte] = useState(0);
  const [vorhandeneNamen, setVorhandeneNamen] = useState<string[]>([]);
  const [jagden, setJagden] = useState<Array<{ id: string; titel: string; datum: string | null }>>([]);
  const [sitzungen, setSitzungen] = useState<Array<{ id: string; datum: string }>>([]);
  const [jagdId, setJagdId] = useState('');
  const [sitzungId, setSitzungId] = useState(standardSitzungId ?? '');
  const [speichert, setSpeichert] = useState(false);
  const { ebenen: routenEbenen } = useRoutenEbenen(k.revierId);

  useEffect(() => {
    void supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 1 }).then(({ data }) => {
      setGrenze(((data as { grenze?: Geometry | null } | null)?.grenze as Geometry | null | undefined) ?? null);
    });
    void supabase.from('pirschwege').select('name').eq('revier_id', k.revierId).is('geloescht_am', null).then(({ data }) => setVorhandeneNamen((data ?? []).map((x) => x.name)));
    void supabase.from('bewegungsjagden').select('id, titel, datum').eq('revier_id', k.revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(30).then(({ data }) => setJagden(data ?? []));
    void supabase.from('zaehlsitzungen').select('id, datum, status').eq('revier_id', k.revierId).is('geloescht_am', null).order('datum', { ascending: false }).limit(20).then(({ data }) => {
      setSitzungen(data ?? []);
      const offen = (data ?? []).find((s) => s.status === 'offen');
      if (offen) setSitzungId((alt) => alt || offen.id); // laufende Zählung: WTE-Route automatisch zuordnen
    });
  }, [k.revierId]);

  async function dateiLesen(datei: File) {
    setFehler(null);
    setLaedt(true);
    try {
      const { gpsParsen } = await import('../../lib/gpsParser'); // Parser erst bei Bedarf laden
      const r = await gpsParsen(datei);
      const b = berichtErstellen(r, grenze);
      if (b.length === 0) throw new Error('Die Datei enthält keine Tracks oder Routen (Wegpunkte werden nicht übernommen).');
      setRoh(r);
      setDateiname(datei.name);
      setBerichte(b);
      const basis = datei.name.replace(/\.[^.]+$/, '');
      setZeilen(
        b.map((t, i) => ({
          an: t.brauchbar,
          name: b.length === 1 ? (t.name === 'Aktivität' || /^Track \d+$/.test(t.name) ? basis : t.name) : t.name || `${basis} ${i + 1}`,
          ziel,
          bemerkung: '',
          mitDatum: false,
          ebene: '',
          neueEbene: '',
        })),
      );
      setSchritt(2);
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setLaedt(false);
    }
  }

  const reduziert = useMemo(() => berichte.map((b) => (b.brauchbar ? reduzieren(b.punkte, toleranz, minAbstand, maxPunkte) : null)), [berichte, toleranz, minAbstand, maxPunkte]);
  const gewaehlt = berichte.filter((_, i) => zeilen[i]?.an);

  // ---------- Kartenvorschau ----------
  const el = useRef<HTMLDivElement>(null);
  const karte = useRef<KarteMap | null>(null);
  const bereit = useRef(false);
  const gepasst = useRef(false);
  const daten = useRef<{ orig: FeatureCollection; red: FeatureCollection }>({ orig: { type: 'FeatureCollection', features: [] }, red: { type: 'FeatureCollection', features: [] } });

  const zeichnen = () => {
    const m = karte.current;
    if (!m || !bereit.current) return;
    (m.getSource('orig') as GeoJSONSource | undefined)?.setData(daten.current.orig);
    (m.getSource('red') as GeoJSONSource | undefined)?.setData(daten.current.red);
    if (!gepasst.current && daten.current.orig.features.length) {
      const b = new LngLatBounds();
      for (const f of daten.current.orig.features) for (const c of (f.geometry as unknown as { coordinates: Array<[number, number]> }).coordinates) b.extend(c);
      m.fitBounds(b, { padding: 40, duration: 0, maxZoom: 17 });
      gepasst.current = true;
    }
  };

  useEffect(() => {
    const linie = (p: Array<{ lng: number; lat: number }>): Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p.map((x) => [x.lng, x.lat]) } });
    daten.current = {
      orig: { type: 'FeatureCollection', features: berichte.flatMap((b, i) => (zeilen[i]?.an && b.brauchbar ? [linie(b.punkte)] : [])) },
      red: { type: 'FeatureCollection', features: reduziert.flatMap((r, i) => (zeilen[i]?.an && r ? [linie(r.punkte)] : [])) },
    };
    zeichnen();
  }, [berichte, reduziert, zeilen]);

  useEffect(() => {
    if (schritt !== 2 || !el.current) return;
    let m: KarteMap;
    try {
      m = new KarteMap({ container: el.current, style: STIL, center: [9.4, 52.2], zoom: 10, attributionControl: { compact: true } });
    } catch {
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
  const fehlerzeile = (z: Auswahlzeile, i: number): string | null => {
    if (!z.an) return null;
    if (!z.name.trim()) return 'Bitte einen Namen eingeben.';
    if (nameVergeben(vorhandeneNamen, z.name)) return 'Diesen Namen gibt es im Revier schon.';
    if (alleNamen.some((n, j) => j !== i && n && n.toLowerCase() === z.name.trim().toLowerCase())) return 'Doppelter Name in dieser Datei.';
    return null;
  };

  async function speichern() {
    setFehler(null);
    setSpeichert(true);
    try {
      let n = 0;
      const ebenenCache = new Map<string, string>();
      for (const [i, z] of zeilen.entries()) {
        const r = reduziert[i];
        const b = berichte[i];
        if (!z.an || !r || !b) continue;
        const datum = z.mitDatum && b.von ? `Aufgezeichnet am ${datumDE(new Date(b.von).toLocaleDateString('sv-SE'))}` : '';
        const bem = [z.bemerkung.trim(), datum].filter(Boolean).join(' · ');
        const ebeneId = await ebeneBereitstellen(k.revierId, z.ziel, z.ebene, z.neueEbene, routenEbenen, ebenenCache);
        const { error } = await supabase.from('pirschwege').insert({
          revier_id: k.revierId,
          ebene_id: ebeneId,
          name: z.name.trim(),
          bemerkung: bem || null,
          typ: z.ziel,
          bewegungsjagd_id: z.ziel === 'treiberroute' ? jagdId || null : null,
          zaehlsitzung_id: z.ziel === 'wte_route' ? sitzungId || null : null,
          geom: linieEWKT(r.punkte.map((p) => [p.lng, p.lat] as [number, number])),
        });
        if (error) throw error;
        n++;
      }
      onFertig(`${n} ${n === 1 ? 'Linie' : 'Linien'} aus „${dateiname}“ übernommen (nur Geometrie, ohne Zeitstempel und Sensordaten).`);
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setSpeichert(false);
    }
  }

  const ziele = (['pirschweg', 'wte_route', ...(k.istInhaber ? ['treiberroute'] : [])] as GpsZiel[]).map((z) => ({ z, name: ZIELNAMEN[z] }));
  const summePunkte = berichte.reduce((s, b) => s + b.punkteGesamt, 0);

  return (
    <div className="bj-dialog-hintergrund" role="dialog" aria-modal="true" aria-label="GPS-Datei importieren">
      <div className="bj-dialog" style={{ width: 'min(860px, 96vw)', maxHeight: '94dvh', overflow: 'auto' }}>
        <strong>GPS-Datei importieren · Schritt {schritt} von 3</strong>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

        {schritt === 1 && (
          <>
            <p className="gruppe-fuss" style={{ margin: 0 }}>
              GPX, KML, KMZ und FIT von Smartwatch oder GPS-Gerät (bis 100 MB). Die Datei wird nur auf diesem Gerät gelesen – gespeichert wird später ausschließlich die Linie.
            </p>
            <Auswahl label="Übernehmen als" value={ziel} onChange={(e) => setZiel(e.target.value as GpsZiel)}>
              {ziele.map((x) => (
                <option key={x.z} value={x.z}>
                  {x.name}
                </option>
              ))}
            </Auswahl>
            <label className="knopf knopf-akzent datei-knopf">
              {laedt ? 'Datei wird gelesen …' : 'GPS-Datei auswählen'}
              <input
                type="file"
                accept=".gpx,.kml,.kmz,.fit,application/gpx+xml,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
                disabled={laedt}
                onChange={(e) => {
                  const d = e.target.files?.[0];
                  if (d) void dateiLesen(d);
                  e.target.value = '';
                }}
              />
            </label>
          </>
        )}

        {schritt === 2 && roh && (
          <>
            <div className="gruppe-fuss" style={{ margin: 0 }}>
              <strong>{dateiname}</strong> · {roh.format} · {berichte.length} {berichte.length === 1 ? 'Track' : 'Tracks'} · {berichte.reduce((s, b) => s + b.segmente, 0)} Segmente · {zahl(summePunkte)} Punkte
            </div>
            {(roh.wegpunkte > 0 || roh.sensordaten) && (
              <Hinweis art="info">
                {roh.wegpunkte > 0 && `${roh.wegpunkte} ${roh.wegpunkte === 1 ? 'Wegpunkt' : 'Wegpunkte'} `}
                {roh.wegpunkte > 0 && roh.sensordaten && 'und '}
                {roh.sensordaten && 'Sensordaten (Puls, Kadenz, Temperatur …) '}
                {roh.wegpunkte === 1 && !roh.sensordaten ? 'wird' : 'werden'} ignoriert und nicht gespeichert.
              </Hinweis>
            )}
            {berichte.map((b, i) => {
              const z = zeilen[i]!;
              const r = reduziert[i];
              return (
                <div key={i} className="gruppe" style={{ padding: 10 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                    <input type="checkbox" checked={z.an} disabled={!b.brauchbar} onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, an: e.target.checked } : x)))} />
                    {b.name}
                  </label>
                  <div className="gruppe-fuss" style={{ margin: '4px 0 0' }}>
                    {zahl(b.punkteGesamt)} Punkte in {b.segmente} {b.segmente === 1 ? 'Segment' : 'Segmenten'} · {km(b.laengeM)}
                    {b.von !== null && b.bis !== null && ` · ${uhr(b.von)} – ${uhr(b.bis)}`}
                    {b.ausdehnungM && ` · Ausdehnung ${Math.round(b.ausdehnungM[0])} × ${Math.round(b.ausdehnungM[1])} m`}
                  </div>
                  {b.warnungen.map((w) => (
                    <div key={w} className="hinweis hinweis-warnung" style={{ marginTop: 6 }}>
                      ! {w}
                    </div>
                  ))}
                  {z.an && r && (
                    <div className="gruppe-fuss" style={{ margin: '6px 0 0' }}>
                      Nach Reduktion: {zahl(b.punkte.length)} → <strong>{zahl(r.punkte.length)}</strong> Punkte · Länge {km(b.laengeM)} → <strong>{km(r.laengeM)}</strong>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="gruppe" style={{ padding: 10 }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                Punktreduktion (Toleranz)
                <input type="range" min={1} max={20} step={1} value={toleranz} onChange={(e) => setToleranz(Number(e.target.value))} aria-label="Toleranz der Punktreduktion in Metern" />
                <strong>{toleranz} m</strong>
              </label>
              <details>
                <summary>Weitere Optionen</summary>
                <Feld label="Mindestabstand zwischen Punkten (m, 0 = aus)" inputMode="numeric" value={String(minAbstand)} onChange={(e) => setMinAbstand(Math.max(0, Number(e.target.value.replace(',', '.')) || 0))} />
                <Feld label="Höchstzahl Punkte je Linie (0 = unbegrenzt)" inputMode="numeric" value={String(maxPunkte)} onChange={(e) => setMaxPunkte(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </details>
            </div>
            <div ref={el} style={{ height: 300, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border-input)' }} aria-label="Vorschau: Original hell, reduzierte Linie kräftig" />
            <p className="gruppe-fuss" style={{ margin: 0 }}>
              Hell: Original · kräftig rot: reduzierte Linie, die gespeichert wird.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf variante="ghost" onClick={() => setSchritt(1)}>
                Andere Datei
              </Knopf>
              <Knopf variante="akzent" disabled={gewaehlt.length === 0} onClick={() => setSchritt(3)}>
                Weiter ({gewaehlt.length})
              </Knopf>
            </div>
          </>
        )}

        {schritt === 3 && (
          <>
            {zeilen.map((z, i) => {
              if (!z.an) return null;
              const f = fehlerzeile(z, i);
              const b = berichte[i]!;
              return (
                <div key={i} className="gruppe" style={{ padding: 10 }}>
                  <Feld label="Name" value={z.name} onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  {f && <Hinweis art="fehler">{f}</Hinweis>}
                  <Auswahl label="Als" value={z.ziel} onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, ziel: e.target.value as GpsZiel, ebene: '', neueEbene: '' } : x)))}>
                    {ziele.map((x) => (
                      <option key={x.z} value={x.z}>
                        {x.name}
                      </option>
                    ))}
                  </Auswahl>
                  <RoutenEbenenWahl typ={z.ziel} ebenen={routenEbenen} ebeneId={z.ebene} neuerName={z.neueEbene} darfAnlegen={k.istInhaber} onAendern={(ebene, neueEbene) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, ebene, neueEbene } : x)))} />
                  <Feld label="Bemerkung (optional)" value={z.bemerkung} onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, bemerkung: e.target.value } : x)))} />
                  {b.von !== null && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={z.mitDatum} onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, mitDatum: e.target.checked } : x)))} />
                      Aufzeichnungsdatum ({datumDE(new Date(b.von).toLocaleDateString('sv-SE'))}) in der Bemerkung vermerken
                    </label>
                  )}
                </div>
              );
            })}
            {zeilen.some((z) => z.an && z.ziel === 'treiberroute') && (
              <Auswahl label="Bewegungsjagd (optional)" value={jagdId} onChange={(e) => setJagdId(e.target.value)}>
                <option value="">– keine, revierweit –</option>
                {jagden.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.titel}
                    {j.datum ? ` (${datumDE(j.datum)})` : ''}
                  </option>
                ))}
              </Auswahl>
            )}
            {zeilen.some((z) => z.an && z.ziel === 'wte_route') && (
              <Auswahl label="Zählung (optional)" value={sitzungId} onChange={(e) => setSitzungId(e.target.value)}>
                <option value="">– keine –</option>
                {sitzungen.map((s) => (
                  <option key={s.id} value={s.id}>
                    Zählung vom {datumDE(s.datum)}
                  </option>
                ))}
              </Auswahl>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf variante="ghost" onClick={() => setSchritt(2)}>
                Zurück
              </Knopf>
              <Knopf variante="akzent" disabled={speichert || zeilen.some((z, i) => fehlerzeile(z, i) || (z.an && ebeneUngueltig(z.ebene, z.neueEbene)))} onClick={() => void speichern()}>
                {speichert ? 'Speichern …' : 'Speichern'}
              </Knopf>
            </div>
          </>
        )}

        <Knopf variante="ghost" onClick={onZu} disabled={speichert}>
          Abbrechen
        </Knopf>
      </div>
    </div>
  );
}
