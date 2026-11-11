import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GeoImportFehler, geodatenLesen, type Einlesung, type GeoSchicht, type Pruefschritt } from '../../lib/geoimport';
import { flurstueckText, pakete, werteAus, zuordnungRaten, type FeldZuordnung } from '../../lib/flurstuecke';
import type { Json } from '../../lib/database.types';
import { Auswahl, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile } from '../../components/ui';
import type { BetriebKontext } from './kontext';

type Flurstueck = { id: string; gemarkung: string | null; flur: string | null; nummer: string | null; flaeche_ha: number; flaeche_amtlich_ha: number | null };

const ha = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const PAKET = 500;

// Modul „Flurstücke“: Bestand aus dem Kataster, Import aus Shapefile (ZIP) oder GeoPackage
export function Flurstuecke({ k }: { k: BetriebKontext }) {
  const [liste, setListe] = useState<Flurstueck[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [importOffen, setImportOffen] = useState(false);
  const [loeschenFrage, setLoeschenFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('flurstuecke')
      .select('id, gemarkung, flur, nummer, flaeche_ha, flaeche_amtlich_ha')
      .eq('betrieb_id', k.betriebId)
      .order('gemarkung')
      .order('flur')
      .order('nummer');
    if (error) setFehler(fehlertext(error));
    setListe(data ?? []);
  }, [k.betriebId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const summe = useMemo(() => (liste ?? []).reduce((a, f) => a + Number(f.flaeche_ha), 0), [liste]);
  const summeAmtlich = useMemo(() => (liste ?? []).reduce((a, f) => a + Number(f.flaeche_amtlich_ha ?? 0), 0), [liste]);

  async function grenzeAusFlurstuecken() {
    setFehler(null);
    setMeldung(null);
    setLaeuft(true);
    const { data, error } = await supabase.rpc('grenze_aus_flurstuecken', { p_betrieb_id: k.betriebId });
    setLaeuft(false);
    if (error) setFehler(fehlertext(error));
    else {
      setMeldung(`Betriebsgrenze aus den Flurstücken gesetzt · ${ha(Number(data))} ha`);
      await k.neuLaden();
    }
  }

  async function alleLoeschen() {
    setFehler(null);
    setLaeuft(true);
    const { data, error } = await supabase.rpc('flurstuecke_loeschen', { p_betrieb_id: k.betriebId });
    setLaeuft(false);
    setLoeschenFrage(false);
    if (error) setFehler(fehlertext(error));
    else setMeldung(`${data} Flurstücke entfernt`);
    await laden();
  }

  if (importOffen) {
    return (
      <FlurstueckImport
        k={k}
        vorhanden={liste?.length ?? 0}
        onFertig={async (text) => {
          setImportOffen(false);
          setMeldung(text);
          await laden();
        }}
        onAbbrechen={() => setImportOffen(false)}
      />
    );
  }

  return (
    <Seite titel="Flurstücke" untertitel="Eigentumsflächen aus dem Liegenschaftskataster">
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {meldung && <Hinweis art="erfolg">{meldung}</Hinweis>}

      {liste === null ? (
        <Leer>Flurstücke werden geladen …</Leer>
      ) : liste.length === 0 ? (
        <Leer>Noch keine Flurstücke. Importiere sie aus einem Shapefile oder GeoPackage, z. B. aus dem ALKIS-Auszug deines Katasteramts.</Leer>
      ) : (
        <Gruppe
          titel={`${liste.length} ${liste.length === 1 ? 'Flurstück' : 'Flurstücke'} · ${ha(summe)} ha`}
          fuss={summeAmtlich > 0 ? `Amtliche Fläche laut Kataster: ${ha(summeAmtlich)} ha. Die berechnete Fläche kann durch Vereinfachung der Geometrie leicht abweichen.` : undefined}
        >
          {liste.map((f) => (
            <Zeile key={f.id} label={flurstueckText(f) || 'ohne Bezeichnung'} wert={`${ha(Number(f.flaeche_amtlich_ha ?? f.flaeche_ha))} ha`} />
          ))}
        </Gruppe>
      )}

      {k.istInhaber && (
        <>
          <Knopf variante="sekundaer" onClick={() => setImportOffen(true)}>
            Flurstücke importieren
          </Knopf>
          {!!liste?.length && (
            <Knopf variante="ghost" disabled={laeuft} onClick={() => void grenzeAusFlurstuecken()}>
              Betriebsgrenze aus Flurstücken bilden
            </Knopf>
          )}
          {!!liste?.length &&
            (loeschenFrage ? (
              <>
                <Hinweis art="warnung">Alle {liste.length} Flurstücke entfernen? Bestände, Maßnahmen und die Betriebsgrenze bleiben erhalten.</Hinweis>
                <Knopf variante="gefahr" disabled={laeuft} onClick={() => void alleLoeschen()}>
                  Alle Flurstücke entfernen
                </Knopf>
                <Knopf variante="ghost" onClick={() => setLoeschenFrage(false)}>
                  Abbrechen
                </Knopf>
              </>
            ) : (
              <Knopf variante="gefahr" onClick={() => setLoeschenFrage(true)}>
                Alle Flurstücke entfernen
              </Knopf>
            ))}
        </>
      )}
    </Seite>
  );
}

function FlurstueckImport({
  k,
  vorhanden,
  onFertig,
  onAbbrechen,
}: {
  k: BetriebKontext;
  vorhanden: number;
  onFertig: (meldung: string) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [einlesung, setEinlesung] = useState<Einlesung | null>(null);
  const [pruefung, setPruefung] = useState<Pruefschritt[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [liest, setLiest] = useState(false);
  const [schichtName, setSchichtName] = useState('');
  const [zuordnung, setZuordnung] = useState<FeldZuordnung | null>(null);
  const [ersetzen, setErsetzen] = useState(vorhanden > 0);
  const [grenzeSetzen, setGrenzeSetzen] = useState(true);
  const [fortschritt, setFortschritt] = useState<string | null>(null);

  // Nur Schichten mit Flächen kommen in Frage
  const schichten = useMemo(
    () => (einlesung?.schichten ?? []).map((s) => ({ ...s, features: s.features.filter((f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') })).filter((s) => s.features.length > 0),
    [einlesung],
  );
  const schicht: GeoSchicht | undefined = schichten.find((s) => s.name === schichtName) ?? schichten[0];

  useEffect(() => {
    if (schicht) setZuordnung(zuordnungRaten(schicht.felder));
  }, [schicht?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  async function dateiWaehlen(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setEinlesung(null);
    setLiest(true);
    try {
      const e = await geodatenLesen(datei);
      setEinlesung(e);
      setPruefung(e.pruefung);
      setSchichtName('');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
      setPruefung(err instanceof GeoImportFehler ? err.pruefung : []);
    } finally {
      setLiest(false);
    }
  }

  const vorschau = useMemo(() => (schicht && zuordnung ? schicht.features.slice(0, 5).map((f) => werteAus(f.properties, zuordnung)) : []), [schicht, zuordnung]);

  async function importieren() {
    if (!schicht || !zuordnung) return;
    setFehler(null);
    try {
      if (ersetzen && vorhanden > 0) {
        setFortschritt('Vorhandene Flurstücke werden entfernt …');
        const { error } = await supabase.rpc('flurstuecke_loeschen', { p_betrieb_id: k.betriebId });
        if (error) throw error;
      }
      const objekte = schicht.features.map((f) => ({ geometry: f.geometry, ...werteAus(f.properties, zuordnung) }));
      const teile = pakete(objekte, PAKET);
      let ok = 0;
      let bad = 0;
      for (let i = 0; i < teile.length; i++) {
        setFortschritt(`Paket ${i + 1} von ${teile.length} wird übertragen …`);
        const { data, error } = await supabase.rpc('flurstuecke_importieren', { p_betrieb_id: k.betriebId, p_objekte: teile[i] as unknown as Json });
        if (error) throw error;
        const r = data as { importiert?: number; ungueltig?: number } | null;
        ok += r?.importiert ?? 0;
        bad += r?.ungueltig ?? 0;
      }
      let grenzText = '';
      if (grenzeSetzen && ok > 0) {
        setFortschritt('Betriebsgrenze wird gebildet …');
        const { data, error } = await supabase.rpc('grenze_aus_flurstuecken', { p_betrieb_id: k.betriebId });
        if (error) throw error;
        grenzText = ` · Betriebsgrenze ${ha(Number(data))} ha`;
        await k.neuLaden();
      }
      await onFertig(`${ok} Flurstücke importiert${bad ? `, ${bad} ohne gültige Fläche übersprungen` : ''}${grenzText}`);
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setFortschritt(null);
    }
  }

  const feldwahl = (label: string, schluessel: keyof Omit<FeldZuordnung, 'flaecheEinheit'>, hinweis = '– keins –') =>
    zuordnung && schicht ? (
      <Auswahl label={label} value={zuordnung[schluessel]} onChange={(e) => setZuordnung({ ...zuordnung, [schluessel]: e.target.value })}>
        <option value="">{hinweis}</option>
        {schicht.felder.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </Auswahl>
    ) : null;

  return (
    <Seite titel="Flurstücke importieren" zurueck={onAbbrechen}>
      <Gruppe titel="Datei" fuss="Shapefile als ZIP (mit .shp, .dbf, .prj) oder GeoPackage (.gpkg). Die Datei wird im Browser gelesen und erst nach „Importieren“ übertragen.">
        <label className="zeile feld">
          <span className="zeile-label">Datei wählen</span>
          <input type="file" accept=".zip,.gpkg,.geojson,.json" disabled={liest || !!fortschritt} onChange={(e) => void dateiWaehlen(e.target.files?.[0])} />
        </label>
      </Gruppe>
      {liest && <Leer>Datei wird gelesen …</Leer>}
      {pruefung.length > 0 && (
        <Gruppe titel="Prüfung">
          {pruefung.map((p, i) => (
            <Zeile key={i} label={p.text} wert={p.status === 'ok' ? '✓' : p.status === 'warnung' ? '!' : '✗'} />
          ))}
        </Gruppe>
      )}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {einlesung && schichten.length === 0 && <Hinweis art="fehler">Die Datei enthält keine Flächen. Flurstücke müssen als Polygone vorliegen.</Hinweis>}

      {schicht && zuordnung && (
        <>
          <Gruppe titel="Zuordnung" fuss="Vorbelegt anhand typischer ALKIS-Feldnamen. Steht die Nummer in Zähler und Nenner, wähle beide Felder.">
            {schichten.length > 1 && (
              <Auswahl label="Ebene" value={schicht.name} onChange={(e) => setSchichtName(e.target.value)}>
                {schichten.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.features.length})
                  </option>
                ))}
              </Auswahl>
            )}
            {feldwahl('Gemarkung', 'gemarkung')}
            {feldwahl('Flur', 'flur')}
            {feldwahl('Flurstück / Zähler', 'nummer')}
            {feldwahl('Nenner', 'nenner', '– nicht getrennt –')}
            {feldwahl('Amtliche Fläche', 'flaeche')}
            {zuordnung.flaeche && (
              <Auswahl label="Einheit der Fläche" value={zuordnung.flaecheEinheit} onChange={(e) => setZuordnung({ ...zuordnung, flaecheEinheit: e.target.value as 'm2' | 'ha' })}>
                <option value="m2">Quadratmeter (ALKIS)</option>
                <option value="ha">Hektar</option>
              </Auswahl>
            )}
          </Gruppe>

          <Gruppe titel={`Vorschau · ${schicht.features.length} Flurstücke`}>
            {vorschau.map((w, i) => (
              <Zeile key={i} label={w.bezeichnung || 'ohne Bezeichnung'} wert={w.flaeche_amtlich_ha != null ? `${ha(w.flaeche_amtlich_ha)} ha` : '–'} />
            ))}
          </Gruppe>

          <Gruppe titel="Optionen">
            {vorhanden > 0 && (
              <Zeile label={`Vorhandene ${vorhanden} Flurstücke ersetzen`}>
                <input type="checkbox" role="switch" aria-label="Vorhandene Flurstücke ersetzen" checked={ersetzen} onChange={(e) => setErsetzen(e.target.checked)} />
              </Zeile>
            )}
            <Zeile label="Betriebsgrenze aus den Flurstücken bilden">
              <input type="checkbox" role="switch" aria-label="Betriebsgrenze bilden" checked={grenzeSetzen} onChange={(e) => setGrenzeSetzen(e.target.checked)} />
            </Zeile>
          </Gruppe>

          {fortschritt && <Hinweis>{fortschritt}</Hinweis>}
          <Knopf variante="primaer" disabled={!!fortschritt} onClick={() => void importieren()}>
            {schicht.features.length} Flurstücke importieren
          </Knopf>
        </>
      )}
      <Knopf variante="ghost" disabled={!!fortschritt} onClick={onAbbrechen}>
        Abbrechen
      </Knopf>
    </Seite>
  );
}
