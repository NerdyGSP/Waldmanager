import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten, useZonen, useZonenEbenen, wildartName, type Wildart, type Zone } from '../../lib/stammdaten';
import { aktuellePosition, aktuellesWetter, wetterText, type Wetter } from '../../lib/geo';
import { speichernOderMerken } from '../../lib/offline';
import { datumDE, heuteISO, mondphase } from '../../lib/zeit';
import { navigieren } from '../../lib/router';
import type { Enums, Json } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zaehler, Zeile, useRadHorizontal, WildartOptionen } from '../../components/ui';
import type { RevierKontext } from './kontext';
import { ZaehlReport } from './ZaehlReport';

type Sitzung = {
  id: string;
  datum: string;
  beginn: string | null;
  ende: string | null;
  status: Enums<'sitzung_status'>;
  wetter: Json | null;
  mondphase: string | null;
  bemerkung: string | null;
  erstellt_von: string | null;
  ebene_id: string | null;
};

type Zaehlzeile = {
  id: string;
  zone_id: string | null;
  wildart_id: string;
  geschlecht: Enums<'geschlecht'>;
  anzahl: number;
};

export function Zaehlung({ k, sitzungId }: { k: RevierKontext; sitzungId: string | null }) {
  return sitzungId ? <SitzungAnsicht k={k} sitzungId={sitzungId} /> : <SitzungsListe k={k} />;
}

// ---------- Übersicht und neue Sitzung ----------

function SitzungsListe({ k }: { k: RevierKontext }) {
  const [sitzungen, setSitzungen] = useState<Array<Sitzung & { summe: number }>>([]);
  const [neu, setNeu] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from('zaehlsitzungen')
      .select('id, datum, beginn, ende, status, wetter, mondphase, bemerkung, erstellt_von, ebene_id, zaehlungen(anzahl, geloescht_am)')
      .eq('revier_id', k.revierId)
      .is('geloescht_am', null)
      .order('datum', { ascending: false })
      .order('beginn', { ascending: false })
      .then(({ data, error }) => {
        if (error) setFehler(fehlertext(error));
        setSitzungen(
          (data ?? []).map(({ zaehlungen, ...s }) => ({
            ...s,
            summe: zaehlungen.filter((z) => !z.geloescht_am).reduce((a, z) => a + z.anzahl, 0),
          })),
        );
      });
  }, [k.revierId]);

  if (neu) return <NeueSitzung k={k} onAbbrechen={() => setNeu(false)} />;

  const offen = sitzungen.filter((s) => s.status === 'offen');
  const fertig = sitzungen.filter((s) => s.status === 'abgeschlossen');

  return (
    <Seite titel="Wildzählung" aktion={<Knopf onClick={() => setNeu(true)}>+ Neue Zählung</Knopf>}>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {offen.length > 0 && (
        <Gruppe titel="Laufende Zählungen">
          {offen.map((s) => (
            <SitzungsZeile key={s.id} s={s} />
          ))}
        </Gruppe>
      )}
      <Gruppe titel="Historie">
        {fertig.length === 0 && <Zeile label="Noch keine abgeschlossenen Zählungen" />}
        {fertig.map((s) => (
          <SitzungsZeile key={s.id} s={s} />
        ))}
      </Gruppe>
    </Seite>
  );
}

function SitzungsZeile({ s }: { s: Sitzung & { summe: number } }) {
  return (
    <button className="zeile zeile-knopf" onClick={() => navigieren(`/zaehlung/${s.id}`)}>
      <span className="zeile-label">
        {datumDE(s.datum)}
        {s.beginn ? `, ${new Date(s.beginn).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : ''}
        <small>
          {s.summe} Stück gezählt
          {s.mondphase ? ` · ${s.mondphase}` : ''}
          {s.bemerkung ? ` · ${s.bemerkung}` : ''}
        </small>
      </span>
      <span className="zeile-pfeil" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

function NeueSitzung({ k, onAbbrechen }: { k: RevierKontext; onAbbrechen: () => void }) {
  const { ebenen } = useZonenEbenen(k.revierId);
  const [ebeneId, setEbeneId] = useState('');
  const [datum, setDatum] = useState(heuteISO());
  const [bemerkung, setBemerkung] = useState('');
  const [wetter, setWetter] = useState<Wetter | null>(null);
  const [wetterStatus, setWetterStatus] = useState('Wetter wird abgerufen …');
  const [fehler, setFehler] = useState<string | null>(null);
  const mond = mondphase(new Date(`${datum}T20:00:00`));

  useEffect(() => {
    void (async () => {
      const p = await aktuellePosition();
      if (!p) {
        setWetterStatus('Ohne Position kein automatisches Wetter');
        return;
      }
      const w = await aktuellesWetter(p.lat, p.lon);
      setWetter(w);
      setWetterStatus(w ? wetterText(w) : 'Wetter nicht verfügbar');
    })();
  }, []);

  async function starten(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const { data, error } = await supabase
      .from('zaehlsitzungen')
      .insert({
        revier_id: k.revierId,
        datum,
        beginn: new Date().toISOString(),
        mondphase: `${mond.name} (${mond.beleuchtung} %)`,
        wetter: wetter ? (wetter as unknown as Json) : null,
        bemerkung: bemerkung.trim() || null,
        ebene_id: ebeneId || null,
      })
      .select('id')
      .single();
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    navigieren(`/zaehlung/${data.id}`);
  }

  return (
    <Seite titel="Neue Zählung" zurueck={onAbbrechen}>
      <form onSubmit={starten}>
        <Gruppe>
          <Feld label="Datum" type="date" required value={datum} onChange={(e) => setDatum(e.target.value)} />
          {ebenen.length > 0 && (
            <Auswahl label="Zonenebene" value={ebeneId} onChange={(e) => setEbeneId(e.target.value)}>
              <option value="">Alle Zonen</option>
              {ebenen.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Auswahl>
          )}
          <Zeile label="Wetter" wert={wetterStatus} />
          <Zeile label="Mond" wert={`${mond.name}, ${mond.beleuchtung} % beleuchtet`} />
          <Feld label="Bemerkung" placeholder="z. B. Scheinwerferzählung" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </Gruppe>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf type="submit" variante="akzent">Zählung starten</Knopf>
      </form>
    </Seite>
  );
}

// ---------- Laufende oder abgeschlossene Sitzung ----------

function SitzungAnsicht({ k, sitzungId }: { k: RevierKontext; sitzungId: string }) {
  const wildarten = useWildarten();
  const tabsRef = useRadHorizontal<HTMLDivElement>();
  const { zonen: alleZonen } = useZonen(k.revierId);
  const { ebenen } = useZonenEbenen(k.revierId);
  const [report, setReport] = useState(false);
  const [sitzung, setSitzung] = useState<Sitzung | null>(null);
  // Ist die Zählung auf eine Zonenebene beschränkt, nur deren Zonen anbieten
  const zonen = useMemo(
    () => (sitzung?.ebene_id ? alleZonen.filter((z) => z.ebeneId === sitzung.ebene_id) : alleZonen),
    [alleZonen, sitzung?.ebene_id],
  );
  const [zeilen, setZeilen] = useState<Zaehlzeile[]>([]);
  const [zoneId, setZoneId] = useState<string>('');
  const [uebersicht, setUebersicht] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offlineHinweis, setOfflineHinweis] = useState(false);

  const laden = useCallback(async () => {
    const [s, z] = await Promise.all([
      supabase
        .from('zaehlsitzungen')
        .select('id, datum, beginn, ende, status, wetter, mondphase, bemerkung, erstellt_von, ebene_id')
        .eq('id', sitzungId)
        .maybeSingle(),
      supabase.from('zaehlungen').select('id, zone_id, wildart_id, geschlecht, anzahl').eq('sitzung_id', sitzungId).is('geloescht_am', null),
    ]);
    if (s.error || z.error) setFehler(fehlertext(s.error ?? z.error));
    setSitzung(s.data);
    setZeilen(z.data ?? []);
    if (s.data?.status === 'abgeschlossen') setUebersicht(true);
  }, [sitzungId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Erste Zone vorauswählen
  useEffect(() => {
    if (!zoneId && zonen[0]) setZoneId(zonen[0].id);
  }, [zonen, zoneId]);

  async function setzen(zeile: Zaehlzeile) {
    setZeilen((alt) => [...alt.filter((x) => x.id !== zeile.id), zeile]);
    try {
      const r = await speichernOderMerken({
        tabelle: 'zaehlungen',
        daten: { ...zeile, sitzung_id: sitzungId, revier_id: k.revierId },
      });
      if (r === 'gemerkt') setOfflineHinweis(true);
    } catch (err) {
      setFehler(fehlertext(err));
    }
  }

  function hinzufuegen(wildartId: string, geschlecht: Enums<'geschlecht'>) {
    const zid = zoneId || null;
    const vorhanden = zeilen.find((z) => z.zone_id === zid && z.wildart_id === wildartId && z.geschlecht === geschlecht);
    if (vorhanden) return;
    void setzen({ id: crypto.randomUUID(), zone_id: zid, wildart_id: wildartId, geschlecht, anzahl: 1 });
  }

  async function abschliessen() {
    const { error } = await supabase
      .from('zaehlsitzungen')
      .update({ status: 'abgeschlossen', ende: new Date().toISOString() })
      .eq('id', sitzungId);
    if (error) setFehler(fehlertext(error));
    await laden();
    setUebersicht(true);
  }

  async function wiederOeffnen() {
    const { error } = await supabase.from('zaehlsitzungen').update({ status: 'offen', ende: null }).eq('id', sitzungId);
    if (error) setFehler(fehlertext(error));
    setUebersicht(false);
    await laden();
  }

  async function loeschen() {
    if (!window.confirm('Diese Zählung mit allen Einträgen löschen?')) return;
    const { error } = await supabase.from('zaehlsitzungen').delete().eq('id', sitzungId);
    if (error) setFehler(fehlertext(error));
    else navigieren('/zaehlung', true);
  }

  if (!sitzung) {
    return (
      <Seite titel="Wildzählung" zurueck={() => navigieren('/zaehlung')}>
        {fehler ? <Hinweis art="fehler">{fehler}</Hinweis> : <Leer>Lade Zählung …</Leer>}
      </Seite>
    );
  }

  const titel = `Zählung ${datumDE(sitzung.datum)}`;
  const untertitel = [sitzung.mondphase, sitzung.wetter ? wetterText(sitzung.wetter as unknown as Wetter) : null]
    .filter(Boolean)
    .join(' · ');
  const darfLoeschen = k.istInhaber || sitzung.erstellt_von === k.userId;

  if (uebersicht) {
    return (
      <Seite titel={titel} untertitel={untertitel} zurueck={() => navigieren('/zaehlung')}>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Gesamtuebersicht zeilen={zeilen} zonen={alleZonen} wildarten={wildarten} />
        {sitzung.bemerkung && <Leer>Bemerkung: {sitzung.bemerkung}</Leer>}
        {sitzung.status === 'offen' ? (
          <>
            <Knopf onClick={abschliessen}>Zählung abschließen</Knopf>
            <Knopf variante="sekundaer" onClick={() => setUebersicht(false)}>
              Weiter zählen
            </Knopf>
          </>
        ) : (
          <>
            <Knopf variante="akzent" onClick={() => setReport(true)}>
              Report drucken
            </Knopf>
            <Knopf variante="sekundaer" onClick={wiederOeffnen}>
              Zählung wieder öffnen
            </Knopf>
          </>
        )}
        {report && (
          <ZaehlReport
            revierId={k.revierId}
            revierName={k.revierName}
            sitzung={sitzung}
            ebeneName={ebenen.find((x) => x.id === sitzung.ebene_id)?.name ?? null}
            zeilen={zeilen}
            zonen={alleZonen}
            wildarten={wildarten}
            onZu={() => setReport(false)}
          />
        )}
        {darfLoeschen && (
          <Knopf variante="gefahr" onClick={loeschen}>
            Zählung löschen
          </Knopf>
        )}
      </Seite>
    );
  }

  const zid = zoneId || null;
  const zoneZeilen = zeilen
    .filter((z) => z.zone_id === zid)
    .sort((a, b) => {
      const wa = wildarten.find((w) => w.id === a.wildart_id)?.sortierung ?? 0;
      const wb = wildarten.find((w) => w.id === b.wildart_id)?.sortierung ?? 0;
      return wa - wb || a.geschlecht.localeCompare(b.geschlecht);
    });
  const summeZone = (id: string | null) => zeilen.filter((z) => z.zone_id === id).reduce((a, z) => a + z.anzahl, 0);

  return (
    <Seite
      titel={titel}
      untertitel={untertitel}
      zurueck={() => navigieren('/zaehlung')}
      aktion={<Knopf variante="sekundaer" onClick={() => setUebersicht(true)}>Übersicht</Knopf>}
    >
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {offlineHinweis && <Hinweis>Kein Netz – Zählstände werden auf dem Gerät gehalten und automatisch übertragen.</Hinweis>}

      <div className="zonen-tabs" role="tablist" aria-label="Zone" ref={tabsRef}>
        {zonen.map((z) => (
          <button key={z.id} role="tab" aria-selected={zoneId === z.id} onClick={() => setZoneId(z.id)}>
            {z.name}
            <span>{summeZone(z.id)}</span>
          </button>
        ))}
        <button role="tab" aria-selected={zoneId === ''} onClick={() => setZoneId('')}>
          {zonen.length ? 'Ohne Zone' : 'Gesamtrevier'}
          <span>{summeZone(null)}</span>
        </button>
      </div>
      {zonen.length === 0 && <Leer>Noch keine Zonen angelegt – gezählt wird für das Gesamtrevier.</Leer>}

      <Gruppe>
        {zoneZeilen.length === 0 && <Zeile label="In dieser Zone noch nichts gezählt" />}
        {zoneZeilen.map((z) => (
          <div className="zeile" key={z.id}>
            <span className="zeile-label">
              {wildartName(wildarten, z.wildart_id)} {GESCHLECHTER.find((g) => g.wert === z.geschlecht)?.kurz}
            </span>
            <Zaehler
              label={wildartName(wildarten, z.wildart_id)}
              wert={z.anzahl}
              onAendern={(neu) => void setzen({ ...z, anzahl: neu })}
            />
          </div>
        ))}
      </Gruppe>

      <WildartHinzufuegen wildarten={wildarten} onHinzufuegen={hinzufuegen} />

      <Knopf onClick={() => setUebersicht(true)}>Gesamtübersicht und abschließen</Knopf>
    </Seite>
  );
}

function WildartHinzufuegen({
  wildarten,
  onHinzufuegen,
}: {
  wildarten: Wildart[];
  onHinzufuegen: (wildartId: string, geschlecht: Enums<'geschlecht'>) => void;
}) {
  const [wildartId, setWildartId] = useState('rehwild');
  return (
    <Gruppe titel="Wildart hinzufügen">
      <Auswahl label="Wildart" value={wildartId} onChange={(e) => setWildartId(e.target.value)}>
        <WildartOptionen wildarten={wildarten} />
      </Auswahl>
      <div className="zeile">
        <span className="zeile-label">Hinzufügen als</span>
        <span className="zeile-aktionen">
          {GESCHLECHTER.map((g) => (
            <button key={g.wert} type="button" className="knopf knopf-sekundaer klein" onClick={() => onHinzufuegen(wildartId, g.wert)}>
              {g.kurz} {g.label}
            </button>
          ))}
        </span>
      </div>
    </Gruppe>
  );
}

export function Gesamtuebersicht({ zeilen, zonen, wildarten }: { zeilen: Zaehlzeile[]; zonen: Zone[]; wildarten: Wildart[] }) {
  const daten = useMemo(() => {
    const spalten: Array<{ id: string | null; name: string }> = [
      ...zonen.filter((z) => zeilen.some((x) => x.zone_id === z.id)).map((z) => ({ id: z.id, name: z.name })),
      ...(zeilen.some((x) => x.zone_id === null) ? [{ id: null, name: zonen.length ? 'ohne Zone' : 'Revier' }] : []),
      // Zonen, die inzwischen entfernt wurden
      ...[...new Set(zeilen.map((x) => x.zone_id))]
        .filter((id) => id && !zonen.some((z) => z.id === id))
        .map((id) => ({ id, name: 'entfernte Zone' })),
    ];
    const arten = [...new Set(zeilen.filter((z) => z.anzahl > 0).map((z) => z.wildart_id))].sort(
      (a, b) => (wildarten.find((w) => w.id === a)?.sortierung ?? 0) - (wildarten.find((w) => w.id === b)?.sortierung ?? 0),
    );
    const wert = (art: string, zone: string | null | undefined, g?: Enums<'geschlecht'>) =>
      zeilen
        .filter((z) => z.wildart_id === art && (zone === undefined || z.zone_id === zone) && (!g || z.geschlecht === g))
        .reduce((a, z) => a + z.anzahl, 0);
    return { spalten, arten, wert };
  }, [zeilen, zonen, wildarten]);

  if (daten.arten.length === 0) return <Leer>In dieser Zählung wurde noch nichts erfasst.</Leer>;

  const gesamt = zeilen.reduce((a, z) => a + z.anzahl, 0);

  return (
    <div className="tabelle-rahmen">
      <table className="tabelle">
        <thead>
          <tr>
            <th>Wildart</th>
            {daten.spalten.map((s) => (
              <th key={s.id ?? 'ohne'} className="zahl">
                {s.name}
              </th>
            ))}
            <th className="zahl">Summe</th>
            <th className="zahl">♂ / ♀ / ?</th>
          </tr>
        </thead>
        <tbody>
          {daten.arten.map((art) => (
            <tr key={art}>
              <th scope="row">{wildartName(wildarten, art)}</th>
              {daten.spalten.map((s) => (
                <td key={s.id ?? 'ohne'} className="zahl">
                  {daten.wert(art, s.id) || '–'}
                </td>
              ))}
              <td className="zahl stark">{daten.wert(art, undefined)}</td>
              <td className="zahl leise">
                {daten.wert(art, undefined, 'maennlich')} / {daten.wert(art, undefined, 'weiblich')} /{' '}
                {daten.wert(art, undefined, 'unbekannt')}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Gesamt</th>
            {daten.spalten.map((s) => (
              <td key={s.id ?? 'ohne'} className="zahl">
                {zeilen.filter((z) => z.zone_id === s.id).reduce((a, z) => a + z.anzahl, 0)}
              </td>
            ))}
            <td className="zahl stark">{gesamt}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
