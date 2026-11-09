import { useEffect, useMemo, useState } from 'react';
import type { Geometry, Position } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { koordinaten, type GeoFeature, type GeoSchicht } from '../../lib/geoimport';
import { FRUCHTGRUPPEN, SONSTIGE, fruchtErkennen, fruchtgruppe, normalisieren } from '../../lib/fruchtgruppen';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer } from '../../components/ui';
import type { RevierKontext } from './kontext';

type Ebene = { id: string; name: string; anbaujahr: number | null };
type Zeile = { roh: string; norm: string; anzahl: number; ha: number; erkannt: ReturnType<typeof fruchtErkennen> };

const stuecke = <T,>(liste: T[], n: number): T[][] => Array.from({ length: Math.ceil(liste.length / n) }, (_, i) => liste.slice(i * n, i * n + n));
const ha = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const RAND = 0.005; // Grad, Vorfilter um die Reviergrenze

// Fläche eines Rings in m² (flächentreu genug für die Anzeige im Prüfdialog)
function ringM2(r: Position[], kos: number): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i]![0]! * r[i + 1]![1]! - r[i + 1]![0]! * r[i]![1]!;
  return Math.abs(s / 2) * 111320 * 111320 * kos;
}
function flaecheHa(g: Geometry): number {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let sum = 0;
  for (const p of polys) {
    const lat = p[0]?.[0]?.[1] ?? 52;
    const kos = Math.cos((lat * Math.PI) / 180);
    sum += ringM2(p[0] ?? [], kos) - p.slice(1).reduce((a, r) => a + ringM2(r, kos), 0);
  }
  return sum / 10000;
}
function bbox(g: Geometry): [number, number, number, number] {
  const k = koordinaten(g);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of k) {
    x0 = Math.min(x0, p[0]!);
    x1 = Math.max(x1, p[0]!);
    y0 = Math.min(y0, p[1]!);
    y1 = Math.max(y1, p[1]!);
  }
  return [x0, y0, x1, y1];
}
const text = (f: GeoFeature, feld: string): string => {
  const v = (f.properties as Record<string, unknown> | null)?.[feld];
  return v === null || v === undefined ? '' : String(v).trim();
};

export function FeldImport({ k, schicht, dateiname, onFertig, onAndereDatei }: { k: RevierKontext; schicht: GeoSchicht; dateiname: string; onFertig: (meldung: string) => void; onAndereDatei: () => void }) {
  const felder = schicht.felder;
  const raten = (re: RegExp) => felder.find((f) => re.test(f)) ?? '';
  const [namensfeld, setNamensfeld] = useState(() => felder.find((f) => /^(name|bezeichn|bez|titel|label|flik|schlag)/i.test(f)) ?? '');
  const [nrFeld, setNrFeld] = useState(() => raten(/^(schlag_?nr|schlagnr|nr|nummer|flik|id)$/i));
  const [fruchtFeld, setFruchtFeld] = useState(() => raten(/kultur|frucht|nutzung|^nc|crop|^nutz/i));
  const [jahrFeld, setJahrFeld] = useState(() => raten(/^(jahr|anbaujahr|year|antragsjahr)$/i));
  const [jahr, setJahr] = useState(String(new Date().getFullYear()));
  const [gemerkt, setGemerkt] = useState<Map<string, string>>(new Map());
  const [ueberschrieben, setUeberschrieben] = useState<Map<string, string>>(new Map());
  const [geprueft, setGeprueft] = useState<Set<string>>(new Set());
  const [ebenen, setEbenen] = useState<Ebene[]>([]);
  const [grenze, setGrenze] = useState<Geometry | null | undefined>(undefined);
  const [modus, setModus] = useState<'neu' | 'ersetzen'>('neu');
  const [ersetzId, setErsetzId] = useState('');
  const [bestaetigt, setBestaetigt] = useState(false);
  const [ebenenName, setEbenenName] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from('frucht_zuordnungen').select('roh_normalisiert, fruchtgruppe').eq('revier_id', k.revierId).then(({ data }) => {
      setGemerkt(new Map((data ?? []).map((z) => [z.roh_normalisiert, z.fruchtgruppe])));
    });
    void supabase.from('flaechen_ebenen').select('id, name, anbaujahr').eq('revier_id', k.revierId).order('anbaujahr', { ascending: false }).then(({ data }) => {
      setEbenen((data ?? []) as Ebene[]);
    });
    void supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 1 }).then(({ data }) => {
      setGrenze((data as unknown as { grenze?: Geometry | null } | null)?.grenze ?? null);
    });
  }, [k.revierId]);

  const flaechen = useMemo(() => schicht.features.filter((f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'), [schicht]);
  const hatJahrWerte = !!jahrFeld;
  const anbaujahr = useMemo(() => {
    if (jahrFeld) {
      const z: Record<string, number> = {};
      for (const f of flaechen) {
        const j = Number(text(f, jahrFeld));
        if (j >= 1990 && j <= 2100) z[j] = (z[j] ?? 0) + 1;
      }
      const top = Object.entries(z).sort((a, b) => b[1] - a[1])[0];
      if (top) return Number(top[0]);
    }
    const j = Number(jahr);
    return j >= 1990 && j <= 2100 ? j : null;
  }, [flaechen, jahrFeld, jahr]);

  const zeilen: Zeile[] = useMemo(() => {
    const m = new Map<string, Zeile>();
    for (const f of flaechen) {
      const roh = fruchtFeld ? text(f, fruchtFeld) : '';
      const norm = normalisieren(roh);
      const z = m.get(norm) ?? { roh, norm, anzahl: 0, ha: 0, erkannt: fruchtErkennen(roh, gemerkt) };
      z.anzahl++;
      z.ha += flaecheHa(f.geometry);
      m.set(norm, z);
    }
    const liste = [...m.values()];
    const offen = (z: Zeile) => z.erkannt.quelle === 'unbekannt' && z.norm !== '' && !geprueft.has(z.norm) && !ueberschrieben.has(z.norm);
    return liste.sort((a, b) => Number(offen(b)) - Number(offen(a)) || b.ha - a.ha);
  }, [flaechen, fruchtFeld, gemerkt, ueberschrieben, geprueft]);

  const gruppeVon = (z: Zeile) => ueberschrieben.get(z.norm) ?? z.erkannt.gruppe;
  const status = (z: Zeile): 'gemerkt' | 'automatisch' | 'manuell' | 'pruefen' | 'keine' => {
    if (!fruchtFeld || z.norm === '') return 'keine';
    if (ueberschrieben.has(z.norm)) return 'manuell';
    if (z.erkannt.quelle === 'gemerkt') return 'gemerkt';
    if (z.erkannt.quelle === 'unbekannt') return geprueft.has(z.norm) ? 'manuell' : 'pruefen';
    return 'automatisch';
  };
  const offeneAnzahl = zeilen.filter((z) => status(z) === 'pruefen').length;
  const verteilung = useMemo(() => {
    const v = new Map<string, { n: number; ha: number }>();
    for (const z of zeilen) {
      const g = ueberschrieben.get(z.norm) ?? z.erkannt.gruppe;
      const e = v.get(g) ?? { n: 0, ha: 0 };
      e.n += z.anzahl;
      e.ha += z.ha;
      v.set(g, e);
    }
    return FRUCHTGRUPPEN.filter((g) => v.has(g.schluessel)).map((g) => ({ g, ...v.get(g.schluessel)! }));
  }, [zeilen, ueberschrieben]);
  const gesamtHa = zeilen.reduce((a, z) => a + z.ha, 0);

  const standardName = `Schläge ${anbaujahr ?? ''}`.trim();
  const ersetzEbene = ebenen.find((e) => e.id === ersetzId);
  const kannImportieren = !laeuft && grenze !== undefined && !!grenze && flaechen.length > 0 && (fruchtFeld ? offeneAnzahl === 0 : true) && (modus === 'neu' || (!!ersetzEbene && bestaetigt));

  async function importieren() {
    if (!grenze) return;
    setLaeuft(true);
    setFehler(null);
    let neueEbene: string | null = null;
    try {
      const [gx0, gy0, gx1, gy1] = bbox(grenze);
      const kandidaten = flaechen.filter((f) => {
        const [x0, y0, x1, y1] = bbox(f.geometry);
        return x1 >= gx0 - RAND && x0 <= gx1 + RAND && y1 >= gy0 - RAND && y0 <= gy1 + RAND;
      });
      if (!kandidaten.length) throw new Error('Kein Schlag liegt in der Nähe des Reviers.');
      const quelle = `${dateiname}`.slice(0, 200);
      let ebeneId: string;
      if (modus === 'ersetzen' && ersetzEbene) {
        const { error: eDel } = await supabase.from('flaechen').delete().eq('ebene_id', ersetzEbene.id);
        if (eDel) throw eDel;
        const { error: eUp } = await supabase.from('flaechen_ebenen').update({ anbaujahr, quelle }).eq('id', ersetzEbene.id);
        if (eUp) throw eUp;
        ebeneId = ersetzEbene.id;
      } else {
        const { data, error } = await supabase
          .from('flaechen_ebenen')
          .insert({ revier_id: k.revierId, name: (ebenenName.trim() || standardName).slice(0, 120), anbaujahr, quelle, art: 'schlaege', sortierung: ebenen.length })
          .select('id')
          .single();
        if (error) throw error;
        ebeneId = data.id;
        neueEbene = ebeneId;
      }
      let importiert = 0;
      let ausserhalb = 0;
      let ungueltig = 0;
      let nr = 0;
      const objekte = kandidaten.map((f) => {
        nr++;
        const roh = fruchtFeld ? text(f, fruchtFeld) : '';
        const norm = normalisieren(roh);
        return {
          name: (namensfeld ? text(f, namensfeld) : '') || `Schlag ${nr}`,
          schlag_nr: nrFeld ? text(f, nrFeld) : '',
          frucht_roh: roh,
          fruchtgruppe: ueberschrieben.get(norm) ?? fruchtErkennen(roh, gemerkt).gruppe,
          geometry: f.geometry,
        };
      });
      for (const paket of stuecke(objekte, 200)) {
        const { data, error } = await supabase.rpc('flaechen_importieren', { p_ebene: ebeneId, p_objekte: paket as never });
        if (error) throw error;
        const r = data as unknown as { importiert: number; ausserhalb: number; ungueltig: number };
        importiert += r.importiert;
        ausserhalb += r.ausserhalb;
        ungueltig += r.ungueltig;
      }
      // Korrekturen für spätere Importe merken (nur Abweichungen von der automatischen Erkennung)
      const merken = [...ueberschrieben.entries()]
        .filter(([norm, g]) => norm && g !== fruchtErkennen(norm, new Map()).gruppe)
        .map(([norm, g]) => ({ revier_id: k.revierId, roh_normalisiert: norm.slice(0, 200), fruchtgruppe: g }));
      const unbekanntGeprueft = [...geprueft].filter((n) => n && !ueberschrieben.has(n)).map((n) => ({ revier_id: k.revierId, roh_normalisiert: n.slice(0, 200), fruchtgruppe: SONSTIGE }));
      const alle = [...merken, ...unbekanntGeprueft];
      if (alle.length) await supabase.from('frucht_zuordnungen').upsert(alle, { onConflict: 'revier_id,roh_normalisiert' });
      const aussen = kandidaten.length < flaechen.length ? flaechen.length - kandidaten.length : 0;
      onFertig(
        `${importiert.toLocaleString('de-DE')} Schläge importiert` +
          (ausserhalb + aussen ? `, ${(ausserhalb + aussen).toLocaleString('de-DE')} außerhalb des Reviers ausgelassen` : '') +
          (ungueltig ? `, ${ungueltig} mit ungültiger Geometrie ausgelassen` : '') +
          '.',
      );
    } catch (err) {
      if (neueEbene) await supabase.from('flaechen_ebenen').delete().eq('id', neueEbene);
      setFehler(`Der Import ist fehlgeschlagen${neueEbene ? ' und wurde zurückgenommen' : ''}: ${fehlertext(err)}`);
    } finally {
      setLaeuft(false);
    }
  }

  const beispiel = (feld: string) => {
    const w = flaechen.map((f) => text(f, feld)).find(Boolean);
    return w ? ` – z. B. „${w.length > 30 ? `${w.slice(0, 30)}…` : w}“` : '';
  };

  return (
    <>
      <Gruppe titel={`3 · Felder zuordnen – „${dateiname}“`} fuss="Nur Geometrie, Name, Fruchtart und Schlagnummer werden übernommen. Betrieb, Bewirtschafter, Eigentümer und Förderdaten werden nicht gespeichert.">
        <Auswahl label="Name aus Feld" value={namensfeld} onChange={(e) => setNamensfeld(e.target.value)}>
          <option value="">automatisch nummerieren</option>
          {felder.map((f) => (
            <option key={f} value={f}>{f}{beispiel(f)}</option>
          ))}
        </Auswahl>
        <Auswahl label="Schlagnummer aus Feld (optional)" value={nrFeld} onChange={(e) => setNrFeld(e.target.value)}>
          <option value="">keine</option>
          {felder.map((f) => (
            <option key={f} value={f}>{f}{beispiel(f)}</option>
          ))}
        </Auswahl>
        <Auswahl label="Feldfrucht aus Feld" value={fruchtFeld} onChange={(e) => setFruchtFeld(e.target.value)}>
          <option value="">keine (alle Schläge „Sonstige“)</option>
          {felder.map((f) => (
            <option key={f} value={f}>{f}{beispiel(f)}</option>
          ))}
        </Auswahl>
        <Auswahl label="Anbaujahr aus Feld (optional)" value={jahrFeld} onChange={(e) => setJahrFeld(e.target.value)}>
          <option value="">einheitlich eingeben</option>
          {felder.map((f) => (
            <option key={f} value={f}>{f}{beispiel(f)}</option>
          ))}
        </Auswahl>
        {!hatJahrWerte && <Feld label="Anbaujahr" type="number" inputMode="numeric" min={1990} max={2100} value={jahr} onChange={(e) => setJahr(e.target.value)} />}
        {!fruchtFeld && <Leer>Ohne Frucht-Feld sind alle Schläge „Sonstige“ (grau) und lassen sich später einzeln umstellen.</Leer>}
      </Gruppe>

      {fruchtFeld && (
        <Gruppe titel={`4 · Fruchtarten zuordnen (${zeilen.length})`} fuss="Offene Werte stehen oben. Korrekturen werden für spätere Importe gemerkt.">
          {offeneAnzahl > 0 && (
            <div className="zeile">
              <Knopf
                variante="sekundaer"
                onClick={() => setGeprueft((s) => new Set([...s, ...zeilen.filter((z) => status(z) === 'pruefen').map((z) => z.norm)]))}
              >
                Offene auf Sonstige setzen ({offeneAnzahl})
              </Knopf>
            </div>
          )}
          {zeilen.map((z) => {
            const st = status(z);
            const g = fruchtgruppe(gruppeVon(z));
            return (
              <label key={z.norm || '(leer)'} className="zeile feld feld-zuordnung">
                <span className="zeile-label">
                  <span className="farbpunkt" style={{ background: g.farbe }} aria-hidden="true" /> {z.roh || '(leer)'}
                  <small>
                    {z.anzahl.toLocaleString('de-DE')} Schläge · {ha(z.ha)} ha ·{' '}
                    <span className={st === 'pruefen' ? 'status-offen' : undefined}>
                      {st === 'pruefen' ? 'bitte prüfen' : st === 'gemerkt' ? 'gemerkt' : st === 'manuell' ? 'manuell' : st === 'keine' ? 'ohne Angabe' : 'automatisch'}
                    </span>
                  </small>
                </span>
                <select
                  aria-label={`Fruchtgruppe für ${z.roh || 'leere Werte'}`}
                  value={gruppeVon(z)}
                  onChange={(e) => setUeberschrieben((m) => new Map(m).set(z.norm, e.target.value))}
                >
                  {FRUCHTGRUPPEN.map((fg) => (
                    <option key={fg.schluessel} value={fg.schluessel}>{fg.name}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </Gruppe>
      )}

      <Gruppe titel={`${fruchtFeld ? '5' : '4'} · Ebene`}>
        <Auswahl label="Ziel" value={modus} onChange={(e) => { setModus(e.target.value as 'neu' | 'ersetzen'); setBestaetigt(false); }}>
          <option value="neu">Neue Ebene anlegen</option>
          {ebenen.length > 0 && <option value="ersetzen">Vorhandene Ebene ersetzen</option>}
        </Auswahl>
        {modus === 'neu' ? (
          <Feld label="Name der Ebene" value={ebenenName} placeholder={standardName} onChange={(e) => setEbenenName(e.target.value)} maxLength={120} />
        ) : (
          <>
            <Auswahl label="Ebene" value={ersetzId} onChange={(e) => { setErsetzId(e.target.value); setBestaetigt(false); }}>
              <option value="">– wählen –</option>
              {ebenen.map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.anbaujahr ? ` (${e.anbaujahr})` : ''}</option>
              ))}
            </Auswahl>
            {ersetzEbene && (
              <Hinweis art="fehler">
                Alle Schläge der Ebene „{ersetzEbene.name}“ werden gelöscht und durch diese Datei ersetzt.
                <label className="zeile" style={{ border: 0, padding: '8px 0 0' }}>
                  <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} />
                  <span className="zeile-label">Ebene ersetzen</span>
                </label>
              </Hinweis>
            )}
          </>
        )}
      </Gruppe>

      <Gruppe titel="Vorschau" fuss="Nur Geometrie, Name, Fruchtart und Schlagnummer werden übernommen. Schläge außerhalb der Reviergrenze werden ausgelassen, Randschläge bleiben ganz erhalten (die Fläche im Revier wird getrennt ausgewiesen).">
        <div className="zeile">
          <span className="zeile-label">
            {flaechen.length.toLocaleString('de-DE')} Schläge in der Datei · {ha(gesamtHa)} ha
            <small>Anbaujahr {anbaujahr ?? 'unklar'}</small>
          </span>
        </div>
        {verteilung.map((v) => (
          <div key={v.g.schluessel} className="zeile">
            <span className="zeile-label">
              <span className="farbpunkt" style={{ background: v.g.farbe }} aria-hidden="true" /> {v.g.name}
              <small>{v.n.toLocaleString('de-DE')} Schläge · {ha(v.ha)} ha</small>
            </span>
          </div>
        ))}
      </Gruppe>

      {grenze === null && <Hinweis art="fehler">Für den Import ist zuerst eine Reviergrenze nötig (Importziel „Reviergrenze“).</Hinweis>}
      {fruchtFeld && offeneAnzahl > 0 && <Leer>Bitte zuerst alle offenen Fruchtarten zuordnen oder auf „Sonstige“ setzen.</Leer>}
      <Knopf variante="akzent" disabled={!kannImportieren || (!ebenenName.trim() && !standardName && modus === 'neu')} onClick={() => void importieren()}>
        {laeuft ? 'Import läuft …' : `${flaechen.length.toLocaleString('de-DE')} Schläge importieren`}
      </Knopf>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf variante="ghost" onClick={onAndereDatei} disabled={laeuft}>
        Andere Datei wählen
      </Knopf>
    </>
  );
}
