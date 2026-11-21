import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import { speichernOderMerken, useWarteschlange, wartendePolter, warteschlangeAbarbeiten } from '../../lib/offline';
import { BAUMARTEN } from '../../lib/stammdaten';
import { FRIST_TAGE, FRIST_VORSCHLAEGE, POLTER_FARBE, POLTER_FARBE_UEBERFAELLIG, fristText, fristVon, istUeberfaellig, liegtSeitText, passtZuFilter, polterText, sortieren, zaehlen, type PolterFilter } from '../../lib/polter';
import { punktInFlaeche } from '../../karte/kern/geometrie';
import { polterGeaendert, positionWahlBeenden, positionWahlStarten, usePositionWahl } from '../../karte/kern/positionWahl';
import { useBreit } from '../../lib/useBreit';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, Zeile } from '../../components/ui';
import type { BetriebKontext } from './kontext';

type PolterEintrag = {
  id: string;
  baumart: string | null;
  stueck: number | null;
  menge_fm: number | null;
  abgelegt_am: string;
  abgefahren_am: string | null;
  frist_tage: number | null;
  bestand_id: string | null;
  status: string;
  notiz: string | null;
  erfasst_von: string | null;
  wartet?: boolean;
};

type BestandFlaeche = { id: string; name: string; geom: MultiPolygon };

// Modul „Polter“: Holz, das am Weg liegt – Liste mit Liegedauer, Erfassung unter /polter/neu
export function Polter({ k, unterpfad = [] }: { k: BetriebKontext; unterpfad?: string[] }) {
  if (unterpfad[0] === 'neu') return <PolterErfassen k={k} />;
  return <PolterListe k={k} />;
}

function PolterListe({ k }: { k: BetriebKontext }) {
  const [liste, setListe] = useState<PolterEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<PolterFilter>('liegt');
  const [namen, setNamen] = useState<Map<string, string>>(new Map());
  const offen = useWarteschlange();

  const laden = useCallback(async () => {
    const [p, b] = await Promise.all([
      supabase.rpc('polter_laden', { p_betrieb_id: k.betriebId }),
      supabase.from('bestaende').select('id, name').eq('betrieb_id', k.betriebId),
    ]);
    setFehler(p.error ? fehlertext(p.error) : null);
    setNamen(new Map((b.data ?? []).map((x) => [x.id, x.name])));
    const server = (((p.data as { features?: Feature[] } | null)?.features ?? []) as Feature[]).map((f) => f.properties as PolterEintrag);
    // Noch nicht übertragene Polter dieses Geräts mit anzeigen
    const lokal: PolterEintrag[] = wartendePolter(k.betriebId)
      .filter((w) => !server.some((s) => s.id === w.id))
      .map((w) => ({
        id: w.id,
        baumart: w.baumart ?? null,
        stueck: w.stueck ?? null,
        menge_fm: w.menge_fm ?? null,
        abgelegt_am: w.abgelegt_am ?? new Date().toISOString(),
        abgefahren_am: null,
        frist_tage: w.frist_tage ?? null,
        bestand_id: w.bestand_id ?? null,
        status: 'liegt',
        notiz: w.notiz ?? null,
        erfasst_von: k.userId,
        wartet: true,
      }));
    setListe(sortieren([...lokal, ...server]));
  }, [k.betriebId, k.userId]);

  useEffect(() => {
    void laden();
  }, [laden, offen]);

  const zahl = useMemo(() => zaehlen(liste ?? []), [liste]);
  const sichtbar = useMemo(() => (liste ?? []).filter((p) => passtZuFilter(p, filter)), [liste, filter]);

  async function fristSetzen(p: PolterEintrag, tage: number) {
    const { error } = await supabase.from('polter').update({ frist_tage: tage }).eq('id', p.id);
    setFehler(error ? fehlertext(error) : null);
    polterGeaendert();
    await laden();
  }

  async function umschalten(p: PolterEintrag) {
    const { error } = await supabase.from('polter').update({ status: p.status === 'abgefahren' ? 'liegt' : 'abgefahren' }).eq('id', p.id);
    setFehler(error ? fehlertext(error) : null);
    polterGeaendert();
    await laden();
  }

  return (
    <Seite
      titel="Polter"
      untertitel="Holz, das am Weg liegt und noch abgefahren werden muss"
      aktion={
        <Knopf variante="primaer" onClick={() => navigieren('/polter/neu')}>
          + Holz liegt hier
        </Knopf>
      }
    >
      <Segmente<PolterFilter>
        label="Status"
        wert={filter}
        onAendern={setFilter}
        optionen={[
          { wert: 'liegt', label: `Liegt (${zahl.liegt})` },
          { wert: 'ueberfaellig', label: `Überfällig (${zahl.ueberfaellig})` },
          { wert: 'abgefahren', label: 'Abgefahren' },
          { wert: 'alle', label: 'Alle' },
        ]}
      />
      {zahl.ueberfaellig > 0 && filter !== 'ueberfaellig' && (
        <Hinweis art="warnung">
          {zahl.ueberfaellig} {zahl.ueberfaellig === 1 ? 'Polter liegt' : 'Polter liegen'} länger als die jeweilige Frist.
        </Hinweis>
      )}
      {offen > 0 && (
        <Hinweis>
          {offen} {offen === 1 ? 'Meldung wartet' : 'Meldungen warten'} auf Netz und werden automatisch übertragen.{' '}
          <button type="button" className="link" onClick={() => void warteschlangeAbarbeiten().then(laden)}>
            Jetzt senden
          </button>
        </Hinweis>
      )}
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {liste === null ? (
        <Leer>Polter werden geladen …</Leer>
      ) : sichtbar.length === 0 ? (
        <Leer>{liste.length === 0 ? 'Noch kein Polter erfasst. Über „+ Holz liegt hier“ merkst du dir abgelegtes Holz – auch ohne Netz.' : 'Keine Polter in diesem Filter.'}</Leer>
      ) : (
        <Gruppe titel={`${sichtbar.length} Polter`}>
          {sichtbar.map((p) => {
            const ueberfaellig = istUeberfaellig(p);
            const darfAendern = !p.wartet && (k.istInhaber || p.erfasst_von === k.userId);
            return (
              <div className="zeile" key={p.id}>
                <span className="zeile-label">
                  <i className="farbpunkt" style={{ background: ueberfaellig ? POLTER_FARBE_UEBERFAELLIG : POLTER_FARBE }} /> {polterText(p) || 'Holz'}
                  {p.bestand_id && namen.get(p.bestand_id) ? ` · Bestand ${namen.get(p.bestand_id)}` : ''}
                  <small>
                    {[
                      p.status === 'abgefahren' ? `abgefahren${p.abgefahren_am ? ` am ${datumDE(p.abgefahren_am)}` : ''}` : liegtSeitText(p.abgelegt_am),
                      fristText(p) || null,
                      `abgelegt am ${datumDE(p.abgelegt_am)}`,
                      p.notiz,
                      p.wartet ? 'wartet auf Netz' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                {darfAendern && p.status === 'liegt' && (
                  <select className="frist-wahl" aria-label="Frist in Tagen" value={fristVon(p)} onChange={(e) => void fristSetzen(p, Number(e.target.value))}>
                    {[...new Set([...FRIST_VORSCHLAEGE, fristVon(p)])]
                      .sort((a, b) => a - b)
                      .map((t) => (
                        <option key={t} value={t}>
                          Frist {t} T.
                        </option>
                      ))}
                  </select>
                )}
                {darfAendern && (
                  <button
                    type="button"
                    className={`status-pill status-${p.status === 'abgefahren' ? 'erledigt' : ueberfaellig ? 'ueberfaellig' : 'geplant'}`}
                    onClick={() => void umschalten(p)}
                  >
                    {p.status === 'abgefahren' ? 'Abgefahren' : 'Liegt'}
                  </button>
                )}
              </div>
            );
          })}
        </Gruppe>
      )}
    </Seite>
  );
}

type Position = { lon: number; lat: number; genauigkeit: number | null };

/** Bestände mit Fläche aus den (offline zwischengespeicherten) Kartendaten */
function useBestandFlaechen(betriebId: string): BestandFlaeche[] {
  const [liste, setListe] = useState<BestandFlaeche[]>([]);
  useEffect(() => {
    void supabase.rpc('karte_daten', { p_betrieb_id: betriebId }).then(({ data }) => {
      const fs = ((data as { bestaende?: Feature[] } | null)?.bestaende ?? []) as Feature[];
      setListe(
        fs.flatMap((f) => {
          const g = f.geometry as Polygon | MultiPolygon | null;
          if (!g) return [];
          const multi: MultiPolygon = g.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [g.coordinates] } : g;
          return [{ id: String(f.properties?.id ?? f.id), name: String(f.properties?.name ?? ''), geom: multi }];
        }),
      );
    });
  }, [betriebId]);
  return liste;
}

function PolterErfassen({ k }: { k: BetriebKontext }) {
  const bestaende = useBestandFlaechen(k.betriebId);
  const [baumart, setBaumart] = useState('');
  const [einheit, setEinheit] = useState<'stueck' | 'fm'>('stueck');
  const [stueck, setStueck] = useState(2);
  const [fm, setFm] = useState(1);
  const [notiz, setNotiz] = useState('');
  const [frist, setFrist] = useState<number>(FRIST_TAGE);
  const [pos, setPos] = useState<Position | null>(null);
  const [gpsFehler, setGpsFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [erfolg, setErfolg] = useState<string | null>(null);
  // Browseransicht mit dauerhafter Karte: Position per Klick in die Karte; iPhone: GPS
  const breit = useBreit();
  const [quelle, setQuelle] = useState<'gps' | 'karte'>(breit ? 'karte' : 'gps');
  const wahl = usePositionWahl();

  useEffect(() => {
    if (quelle !== 'karte') return;
    setPos(null);
    positionWahlStarten();
    return () => positionWahlBeenden();
  }, [quelle]);
  useEffect(() => {
    if (quelle === 'karte') setPos(wahl.punkt ? { lon: wahl.punkt.lon, lat: wahl.punkt.lat, genauigkeit: null } : null);
  }, [quelle, wahl.punkt]);

  // GPS-Position laufend verbessern, solange das Formular offen ist
  useEffect(() => {
    if (quelle !== 'gps') return;
    setPos(null);
    if (!navigator.geolocation) {
      setGpsFehler('Dieses Gerät liefert keine Position.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGpsFehler(null);
        setPos((alt) => (!alt || p.coords.accuracy <= (alt.genauigkeit ?? Infinity) + 5 ? { lon: p.coords.longitude, lat: p.coords.latitude, genauigkeit: p.coords.accuracy } : alt));
      },
      () => setGpsFehler('Keine Position – bitte die Ortungsfreigabe für den Browser prüfen.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [quelle]);

  const bestand = useMemo(() => (pos ? bestaende.find((b) => punktInFlaeche([pos.lon, pos.lat], b.geom)) ?? null : null), [pos, bestaende]);

  async function speichern() {
    if (!pos) return;
    setFehler(null);
    setSpeichert(true);
    try {
      const r = await speichernOderMerken({
        tabelle: 'polter',
        daten: {
          id: crypto.randomUUID(),
          betrieb_id: k.betriebId,
          bestand_id: bestand?.id ?? null,
          baumart: baumart || null,
          stueck: einheit === 'stueck' ? stueck : null,
          menge_fm: einheit === 'fm' ? fm : null,
          geom: `SRID=4326;POINT(${pos.lon} ${pos.lat})`,
          genauigkeit_m: pos.genauigkeit != null ? Math.round(pos.genauigkeit) : null,
          abgelegt_am: new Date().toISOString(),
          frist_tage: frist,
          notiz: notiz.trim() || null,
        },
      });
      polterGeaendert();
      // In der Karte direkt das nächste Polter setzen können
      if (quelle === 'karte') {
        positionWahlBeenden();
        positionWahlStarten();
      }
      setErfolg(`Polter${bestand ? ` in Bestand ${bestand.name}` : ''} ${r === 'gespeichert' ? 'gespeichert' : 'auf dem Gerät gespeichert – wird übertragen, sobald Netz da ist'}.`);
      setNotiz('');
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <Seite
      titel="Holz liegt hier"
      untertitel={quelle === 'karte' ? 'Position per Klick in die Karte setzen' : 'Position wird automatisch übernommen'}
      zurueck={() => navigieren('/polter')}
    >
      {erfolg && <Hinweis art="erfolg">{erfolg}</Hinweis>}

      <Gruppe titel="Ort">
        <Zeile label="Bestand" wert={!pos ? '–' : bestand ? `${bestand.name} (automatisch)` : 'außerhalb der Bestände'} />
        {quelle === 'karte' ? (
          <Zeile label="Position" wert={pos ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : 'In die Karte klicken'} />
        ) : (
          <Zeile label="GPS" wert={pos?.genauigkeit != null ? `±${Math.round(pos.genauigkeit)} m` : gpsFehler ?? 'Position wird ermittelt …'} />
        )}
        {quelle === 'karte' && !wahl.aktiv && (
          <div style={{ padding: '8px var(--abstand) 0' }}>
            <button type="button" className="link" onClick={() => positionWahlStarten()}>
              Position in der Karte setzen
            </button>
          </div>
        )}
        {breit && (
          <div style={{ padding: '8px var(--abstand)' }}>
            <button type="button" className="link" onClick={() => setQuelle(quelle === 'karte' ? 'gps' : 'karte')}>
              {quelle === 'karte' ? 'Stattdessen meine GPS-Position verwenden' : 'Position auf der Karte wählen'}
            </button>
          </div>
        )}
      </Gruppe>

      <Gruppe titel="Holz">
        <Auswahl label="Baumart (optional)" value={baumart} onChange={(e) => setBaumart(e.target.value)}>
          <option value="">– keine Angabe –</option>
          {BAUMARTEN.map((b) => (
            <option key={b.kuerzel} value={b.kuerzel}>
              {b.name}
            </option>
          ))}
        </Auswahl>
      </Gruppe>
      <Segmente<'stueck' | 'fm'>
        label="Mengenangabe"
        wert={einheit}
        onAendern={setEinheit}
        optionen={[
          { wert: 'stueck', label: 'Stück' },
          { wert: 'fm', label: 'Festmeter' },
        ]}
      />
      <Gruppe>
        <Zeile label={einheit === 'stueck' ? 'Anzahl Stämme' : 'Geschätzte Menge'}>
          <span className="stepper">
            <button type="button" aria-label="Weniger" onClick={() => (einheit === 'stueck' ? setStueck((a) => Math.max(1, a - 1)) : setFm((a) => Math.max(1, a - 1)))}>
              −
            </button>
            <strong>{einheit === 'stueck' ? stueck : `${fm} fm`}</strong>
            <button type="button" aria-label="Mehr" onClick={() => (einheit === 'stueck' ? setStueck((a) => a + 1) : setFm((a) => a + 1))}>
              +
            </button>
          </span>
        </Zeile>
      </Gruppe>

      <Segmente<string>
        label="Abfahren innerhalb von"
        wert={String(frist)}
        onAendern={(w) => setFrist(Number(w))}
        optionen={FRIST_VORSCHLAEGE.map((t) => ({ wert: String(t), label: t % 7 === 0 && t < 90 ? `${t / 7} Wo.` : `${t} T.` }))}
      />

      <Gruppe>
        <Feld label="Notiz" placeholder="z. B. liegt links am Hauptweg, Brennholz" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
      </Gruppe>

      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf variante="primaer" disabled={!pos || speichert} onClick={() => void speichern()}>
        {pos ? 'Speichern' : quelle === 'karte' ? 'Erst Position in der Karte setzen' : 'Warte auf Position …'}
      </Knopf>
    </Seite>
  );
}
