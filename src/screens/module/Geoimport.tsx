import { useEffect, useMemo, useState } from 'react';
import type { Geometry } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { linieEWKT, punktEWKT } from '../../lib/geo';
import {
  GeoImportFehler,
  geodatenLesen,
  einzelteile,
  koordinaten,
  passendeObjekte,
  type Einlesung,
  type GeoFeature,
  type Pruefschritt,
  type Ziel,
} from '../../lib/geoimport';
import { EinrichtungsOptionen } from '../../components/EinrichtungsOptionen';
import { nameVergeben, useZonen, useZonenEbenen, ZONENFARBEN } from '../../lib/stammdaten';
import type { Enums, Json } from '../../lib/database.types';
import { Auswahl, Gruppe, Hinweis, Knopf, Leer } from '../../components/ui';
import type { RevierKontext } from './kontext';

const ZIELE: Array<{ wert: Ziel; titel: string; text: string; geometrie: string }> = [
  { wert: 'grenze', titel: 'Reviergrenze', text: 'Ersetzt die vorhandene Grenze des Reviers.', geometrie: 'Flächen' },
  { wert: 'zonen', titel: 'Zonen', text: 'Legt je Fläche eine Zone an (ohne Zuschnitt auf die Reviergrenze).', geometrie: 'Flächen' },
  { wert: 'einrichtungen', titel: 'Einrichtungen', text: 'Hochsitze, Kirrungen u. a. als Punkte.', geometrie: 'Punkte' },
  { wert: 'pirschwege', titel: 'Pirschwege', text: 'Wege und Pfade als Linien.', geometrie: 'Linien' },
  { wert: 'treiberrouten', titel: 'Treiberrouten', text: 'Laufwege der Treiber bei Bewegungsjagden als Linien.', geometrie: 'Linien' },
  { wert: 'wte_routen', titel: 'WTE-Routen', text: 'Zählstrecken der Wildtiererfassung als Linien.', geometrie: 'Linien' },
];
const ARTEN: Record<string, string> = {
  Point: 'Punkt',
  MultiPoint: 'Mehrfachpunkt',
  LineString: 'Linie',
  MultiLineString: 'Mehrfachlinie',
  Polygon: 'Fläche',
  MultiPolygon: 'Mehrfachfläche',
};
const stuecke = <T,>(liste: T[], n: number): T[][] => Array.from({ length: Math.ceil(liste.length / n) }, (_, i) => liste.slice(i * n, i * n + n));
const SYMBOL = { ok: '✓', warnung: '!', fehler: '✕' } as const;

export function Geoimport({ k }: { k: RevierKontext }) {
  const { zonen, laden: zonenLaden } = useZonen(k.revierId);
  const { ebenen } = useZonenEbenen(k.revierId);
  const [ziel, setZiel] = useState<Ziel | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [einlesung, setEinlesung] = useState<Einlesung | null>(null);
  const [pruefung, setPruefung] = useState<Pruefschritt[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [schichtNr, setSchichtNr] = useState(0);
  const [namensfeld, setNamensfeld] = useState('');
  const [ebeneId, setEbeneId] = useState('');
  const [typ, setTyp] = useState<Enums<'einrichtung_typ'>>('hochsitz');
  const [hatGrenze, setHatGrenze] = useState(false);
  const [ersetzen, setErsetzen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    void supabase
      .from('revier_grenzen')
      .select('revier_id', { count: 'exact', head: true })
      .eq('revier_id', k.revierId)
      .then(({ count }) => setHatGrenze((count ?? 0) > 0));
  }, [k.revierId, meldung]);

  const schicht = einlesung?.schichten[schichtNr];
  // Erste Beispielwerte (nicht leer, verschieden) eines Attributfelds
  const beispiele = (feld: string, n: number): string[] => {
    const werte: string[] = [];
    for (const f of schicht?.features ?? []) {
      const v = (f.properties as Record<string, unknown> | null)?.[feld];
      const t = v === null || v === undefined ? '' : String(v).trim();
      if (t && !werte.includes(t)) werte.push(t.length > 40 ? `${t.slice(0, 40)}…` : t);
      if (werte.length >= n) break;
    }
    return werte;
  };
  const passend = useMemo(() => (schicht && ziel ? passendeObjekte(schicht, ziel) : []), [schicht, ziel]);
  const anzahlTeile = useMemo(() => (ziel ? passend.reduce((a, f) => a + einzelteile(f, ziel).length, 0) : 0), [passend, ziel]);
  const hatFehler = !!pruefung?.some((p) => p.status === 'fehler');

  function zuruecksetzen(zielBehalten = false) {
    if (!zielBehalten) setZiel(null);
    setEinlesung(null);
    setPruefung(null);
    setFehler(null);
    setSchichtNr(0);
    setErsetzen(false);
  }

  async function dateiWaehlen(datei: File) {
    zuruecksetzen(true);
    setMeldung(null);
    setLaedt(true);
    try {
      const erg = await geodatenLesen(datei);
      setEinlesung(erg);
      setPruefung(erg.pruefung);
      // Erste Schicht wählen, die zum Ziel passt
      const passt = erg.schichten.findIndex((s) => ziel && passendeObjekte(s, ziel).length > 0);
      setSchichtNr(Math.max(0, passt));
      const felder = erg.schichten[Math.max(0, passt)]?.felder ?? [];
      setNamensfeld(felder.find((f) => /^(name|bezeichn|bez|titel|label)/i.test(f)) ?? felder.find((f) => /name|bez/i.test(f)) ?? '');
    } catch (err) {
      if (err instanceof GeoImportFehler) {
        setPruefung(err.pruefung);
        setFehler(err.message);
      } else {
        setFehler(`Die Datei konnte nicht geprüft werden: ${fehlertext(err)}`);
      }
    } finally {
      setLaedt(false);
    }
  }

  function schichtWechseln(nr: number) {
    setSchichtNr(nr);
    const felder = einlesung?.schichten[nr]?.felder ?? [];
    setNamensfeld(felder.find((f) => /name|bez/i.test(f)) ?? '');
  }

  const nameVon = (f: GeoFeature, fallback: string) => {
    const wert = namensfeld ? f.properties?.[namensfeld] : null;
    const text = wert === null || wert === undefined ? '' : String(wert).trim();
    return text || fallback;
  };

  async function importieren() {
    if (!ziel || !schicht || !passend.length) return;
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    try {
      if (ziel === 'grenze') {
        const geojson = {
          type: 'MultiPolygon',
          coordinates: passend.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [])),
        } as unknown as Json;
        const { data, error } = await supabase.rpc('grenze_setzen', { p_revier_id: k.revierId, p_geojson: geojson });
        if (error) throw error;
        await k.neuLaden();
        setMeldung(`Reviergrenze übernommen · ${Number(data).toLocaleString('de-DE')} ha`);
      } else if (ziel === 'zonen') {
        const ebene = ebenen.find((e) => e.id === ebeneId);
        const vergeben = zonen.map((z) => z.name);
        let anzahl = 0;
        const probleme: string[] = [];
        for (const [i, f] of passend.entries()) {
          // doppelte Namen (z. B. mehrere Flächen „Acker“) werden durchnummeriert statt übersprungen
          const basis = nameVon(f, `Zone ${zonen.length + i + 1}`);
          let name = basis;
          for (let n = 2; nameVergeben(vergeben, name); n++) name = `${basis} (${n})`;
          const { data, error } = await supabase
            .from('zonen')
            .insert({
              revier_id: k.revierId,
              name,
              ebene_id: ebene?.id ?? null,
              farbe: ebene?.farbe ?? ZONENFARBEN[(zonen.length + i) % ZONENFARBEN.length],
              sortierung: zonen.length + i,
            })
            .select('id')
            .single();
          if (error) {
            probleme.push(`„${name}“: ${fehlertext(error)}`);
            continue;
          }
          const geo = await supabase.rpc('zone_geometrie_setzen', { p_zone_id: data.id, p_geojson: f.geometry as unknown as Json, p_zuschneiden: false });
          if (geo.error) {
            await supabase.from('zonen').delete().eq('id', data.id);
            probleme.push(`„${name}“: ${fehlertext(geo.error)}`);
            continue;
          }
          vergeben.push(name);
          anzahl++;
        }
        await zonenLaden();
        setMeldung(`${anzahl} von ${passend.length} Zonen angelegt.`);
        if (probleme.length) setFehler(`Nicht übernommen: ${probleme.slice(0, 6).join('; ')}${probleme.length > 6 ? ` … und ${probleme.length - 6} weitere` : ''}`);
      } else if (ziel === 'einrichtungen') {
        const { data: vorhanden } = await supabase.from('einrichtungen').select('name').eq('revier_id', k.revierId).is('geloescht_am', null);
        const vergeben = (vorhanden ?? []).map((e) => e.name);
        const zeilen: Array<{ revier_id: string; typ: Enums<'einrichtung_typ'>; name: string | null; geom: string }> = [];
        let doppelt = 0;
        for (const f of passend) {
          for (const g of einzelteile(f, ziel)) {
            const name = namensfeld ? nameVon(f, '') : '';
            if (name && nameVergeben(vergeben, name)) {
              doppelt++;
              continue;
            }
            if (name) vergeben.push(name);
            const c = (g as unknown as { coordinates: number[] }).coordinates;
            zeilen.push({ revier_id: k.revierId, typ, name: name || null, geom: punktEWKT(c[0]!, c[1]!) });
          }
        }
        for (const teil of stuecke(zeilen, 200)) {
          const { error } = await supabase.from('einrichtungen').insert(teil);
          if (error) throw error;
        }
        setMeldung(`${zeilen.length} Einrichtungen importiert` + (doppelt ? `; ${doppelt} mit bereits vergebenem Namen übersprungen` : '') + '.');
      } else {
        const routeTyp = ziel === 'treiberrouten' ? 'treiberroute' : ziel === 'wte_routen' ? 'wte_route' : 'pirschweg';
        const routeName = ziel === 'treiberrouten' ? 'Treiberroute' : ziel === 'wte_routen' ? 'WTE-Route' : 'Pirschweg';
        const zeilen: Array<{ revier_id: string; name: string; typ: string; geom: string }> = [];
        for (const f of passend) {
          for (const g of einzelteile(f, ziel)) {
            const nr = zeilen.length + 1;
            const name = nameVon(f, `${routeName} ${nr}`);
            zeilen.push({ revier_id: k.revierId, name, typ: routeTyp, geom: linieEWKT((g as unknown as { coordinates: Array<[number, number]> }).coordinates) });
          }
        }
        for (const teil of stuecke(zeilen, 100)) {
          const { error } = await supabase.from('pirschwege').insert(teil);
          if (error) throw error;
        }
        setMeldung(`${zeilen.length} ${ziel === 'treiberrouten' ? 'Treiberrouten' : ziel === 'wte_routen' ? 'WTE-Routen' : 'Pirschwege'} importiert.`);
      }
      zuruecksetzen();
    } catch (err) {
      setFehler(`Import abgebrochen: ${fehlertext(err)}`);
    } finally {
      setLaeuft(false);
    }
  }

  const zielInfo = ZIELE.find((z) => z.wert === ziel);

  return (
    <>
      {meldung && <Hinweis art="erfolg">{meldung}</Hinweis>}
      {fehler && !pruefung && <Hinweis art="fehler">{fehler}</Hinweis>}

      <Gruppe titel="1 · Was möchtest du importieren?">
        <div role="radiogroup" aria-label="Importziel" className="import-ziele">
          {ZIELE.map((z) => (
            <button
              key={z.wert}
              type="button"
              role="radio"
              aria-checked={ziel === z.wert}
              disabled={laedt || laeuft}
              onClick={() => {
                setZiel(z.wert);
                zuruecksetzen(true);
                setMeldung(null);
              }}
            >
              <strong>{z.titel}</strong>
              <small>{z.text}</small>
              <span className="badge">{z.geometrie}</span>
            </button>
          ))}
        </div>
      </Gruppe>

      {ziel && !einlesung && (
        <Gruppe
          titel={`2 · Datei für ${zielInfo?.titel} wählen`}
          fuss="Shapefile als ZIP (mit .shp, .dbf, .prj) oder GeoPackage (.gpkg). Die Datei wird zuerst auf deinem Gerät geprüft und erst nach deiner Bestätigung importiert. Andere Koordinatensysteme werden nach WGS84 umgerechnet."
        >
          <label className={`knopf knopf-primaer datei-knopf${laedt ? ' deaktiviert' : ''}`} style={{ margin: 12 }}>
            {laedt ? 'Datei wird geprüft …' : 'Shapefile (.zip) oder GeoPackage (.gpkg) wählen'}
            <input
              type="file"
              accept=".zip,.gpkg,application/zip,application/geopackage+sqlite3"
              disabled={laedt}
              onChange={(e) => {
                const datei = e.target.files?.[0];
                if (datei) void dateiWaehlen(datei);
                e.target.value = '';
              }}
            />
          </label>
        </Gruppe>
      )}

      {pruefung && (
        <Gruppe titel={fehler || hatFehler ? 'Prüfbericht – Import nicht möglich' : 'Prüfbericht'}>
          <ul className="pruefbericht">
            {pruefung.map((p, i) => (
              <li key={i} className={`pruef-${p.status}`}>
                <span aria-hidden="true">{SYMBOL[p.status]}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </Gruppe>
      )}
      {fehler && pruefung && (
        <>
          <Hinweis art="fehler">{fehler} Bitte exportiere die Daten erneut aus dem GIS oder wähle eine andere Datei.</Hinweis>
          <Knopf variante="sekundaer" onClick={() => zuruecksetzen(true)}>
            Andere Datei wählen
          </Knopf>
        </>
      )}

      {einlesung && schicht && ziel && (
        <>
          <Gruppe titel={`3 · ${zielInfo?.titel} aus „${einlesung.dateiname}“`}>
            {einlesung.schichten.length > 1 && (
              <Auswahl label="Ebene in der Datei" value={schichtNr} onChange={(e) => schichtWechseln(Number(e.target.value))}>
                {einlesung.schichten.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name} ({s.features.length})
                  </option>
                ))}
              </Auswahl>
            )}
            <div className="zeile">
              <span className="zeile-label">
                Enthaltene Geometrien
                <small>
                  {Object.entries(schicht.geometrietypen)
                    .map(([t, n]) => `${n.toLocaleString('de-DE')} × ${ARTEN[t] ?? t}`)
                    .join(' · ')}
                </small>
              </span>
            </div>
            {(ziel === 'zonen' || ziel === 'einrichtungen' || ziel === 'pirschwege' || ziel === 'treiberrouten' || ziel === 'wte_routen') && schicht.felder.length > 0 && (
              <Auswahl
                label={ziel === 'zonen' ? 'Zonenname aus Feld' : ziel === 'einrichtungen' ? 'Name aus Feld' : 'Name der Linie aus Feld'}
                value={namensfeld}
                onChange={(e) => setNamensfeld(e.target.value)}
              >
                <option value="">{ziel === 'einrichtungen' ? 'ohne Namen' : 'automatisch nummerieren'}</option>
                {schicht.felder.map((f) => (
                  <option key={f} value={f}>
                    {f}
                    {beispiele(f, 1)[0] ? ` – z. B. „${beispiele(f, 1)[0]}“` : ''}
                  </option>
                ))}
              </Auswahl>
            )}
            {(ziel === 'zonen' || ziel === 'einrichtungen' || ziel === 'pirschwege' || ziel === 'treiberrouten' || ziel === 'wte_routen') && namensfeld && beispiele(namensfeld, 3).length > 0 && (
              <small style={{ color: "var(--text-leise)" }}>Beispielwerte: {beispiele(namensfeld, 3).map((b) => `„${b}“`).join(', ')}</small>
            )}
            {ziel === 'zonen' && ebenen.length > 0 && (
              <Auswahl label="Zonenebene" value={ebeneId} onChange={(e) => setEbeneId(e.target.value)}>
                <option value="">Ohne Ebene</option>
                {ebenen.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Auswahl>
            )}
            {ziel === 'einrichtungen' && (
              <Auswahl label="Art der Einrichtungen" value={typ} onChange={(e) => setTyp(e.target.value as Enums<'einrichtung_typ'>)}>
                <EinrichtungsOptionen />
              </Auswahl>
            )}
          </Gruppe>

          {passend.length === 0 ? (
            <Hinweis art="fehler">
              Diese Ebene enthält keine {zielInfo?.geometrie}, die zu „{zielInfo?.titel}“ passen. Wähle eine andere Ebene oder ein anderes Importziel.
            </Hinweis>
          ) : (
            <>
              <Vorschau objekte={passend} />
              {ziel === 'grenze' && hatGrenze && (
                <Hinweis art="fehler">
                  Das Revier hat bereits eine Grenze. Sie wird durch den Import ersetzt; vorhandene Zonen bleiben unverändert.
                  <label className="zeile" style={{ border: 0, padding: '8px 0 0' }}>
                    <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.target.checked)} />
                    <span className="zeile-label">Vorhandene Reviergrenze ersetzen</span>
                  </label>
                </Hinweis>
              )}
              {ziel === 'grenze' && passend.length > 1 && <Leer>{passend.length} Flächen werden zu einer Reviergrenze zusammengefasst.</Leer>}
              {passend.length < schicht.features.length && (
                <Leer>{schicht.features.length - passend.length} weitere Objekte anderer Geometrieart werden nicht importiert.</Leer>
              )}
              <Knopf
                variante="akzent"
                disabled={laeuft || (ziel === 'grenze' && hatGrenze && !ersetzen)}
                onClick={() => void importieren()}
              >
                {laeuft
                  ? 'Import läuft …'
                  : ziel === 'grenze'
                    ? 'Als Reviergrenze übernehmen'
                    : `${anzahlTeile.toLocaleString('de-DE')} ${zielInfo?.titel} importieren`}
              </Knopf>
              {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
            </>
          )}
          <Knopf variante="ghost" onClick={() => zuruecksetzen(true)} disabled={laeuft}>
            Andere Datei wählen
          </Knopf>
        </>
      )}
    </>
  );
}

// Schematische Vorschau der Geometrien (flächentreu genug für eine Plausibilitätsprüfung)
function Vorschau({ objekte }: { objekte: GeoFeature[] }) {
  const proben = objekte.length > 1500 ? objekte.filter((_, i) => i % Math.ceil(objekte.length / 1500) === 0) : objekte;
  const alle = proben.flatMap((f) => koordinaten(f.geometry));
  if (!alle.length) return null;
  const lon = alle.map((p) => p[0]!);
  const lat = alle.map((p) => p[1]!);
  const [x0, x1, y0, y1] = [Math.min(...lon), Math.max(...lon), Math.min(...lat), Math.max(...lat)];
  const kos = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const B = 320;
  const H = 200;
  const breite = Math.max((x1 - x0) * kos, 1e-9);
  const hoehe = Math.max(y1 - y0, 1e-9);
  const m = Math.min((B - 16) / breite, (H - 16) / hoehe);
  const px = (p: number[]) => `${(8 + (p[0]! - x0) * kos * m + (B - 16 - breite * m) / 2).toFixed(1)},${(H - 8 - (p[1]! - y0) * m - (H - 16 - hoehe * m) / 2).toFixed(1)}`;
  const pfad = (g: Geometry): string => {
    switch (g.type) {
      case 'Polygon':
        return g.coordinates.map((r) => `M${r.map(px).join('L')}Z`).join('');
      case 'MultiPolygon':
        return g.coordinates.map((p) => p.map((r) => `M${r.map(px).join('L')}Z`).join('')).join('');
      case 'LineString':
        return `M${g.coordinates.map(px).join('L')}`;
      case 'MultiLineString':
        return g.coordinates.map((l) => `M${l.map(px).join('L')}`).join('');
      default:
        return '';
    }
  };
  const punkte = proben.flatMap((f) => (f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPoint' ? f.geometry.coordinates : []));
  const breiteKm = (x1 - x0) * kos * 111.32;
  const hoeheKm = (y1 - y0) * 111.32;
  return (
    <Gruppe titel="Vorschau" fuss={`Ausdehnung ca. ${breiteKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} × ${hoeheKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km${proben.length < objekte.length ? ' · Stichprobe' : ''}`}>
      <svg viewBox={`0 0 ${B} ${H}`} className="geo-vorschau" role="img" aria-label="Vorschau der zu importierenden Geometrien">
        {proben.map((f, i) => (
          <path key={i} d={pfad(f.geometry)} className={f.geometry.type.endsWith('Polygon') ? 'vorschau-flaeche' : 'vorschau-linie'} />
        ))}
        {punkte.map((p, i) => {
          const [cx, cy] = px(p).split(',');
          return <circle key={i} cx={cx} cy={cy} r="2.5" className="vorschau-punkt" />;
        })}
      </svg>
    </Gruppe>
  );
}
