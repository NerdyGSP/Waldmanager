import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { datumZeitDE } from '../../lib/zeit';
import { speichernOderMerken, useWarteschlange, wartendeFunde, warteschlangeAbarbeiten } from '../../lib/offline';
import { fotoLink, fotoMerken, fotosHochladen, verkleinern } from '../../lib/fotos';
import { FUND_TYPEN, MERKMALE, mengeText, merkmalLabel, typFarbe, typLabel, type FundTyp } from '../../lib/funde';
import { punktInFlaeche } from '../../karte/kern/geometrie';
import { fundeGeaendert, positionWahlBeenden, positionWahlStarten, usePositionWahl } from '../../karte/kern/positionWahl';
import { useBreit } from '../../lib/useBreit';
import { Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, Zeile } from '../../components/ui';
import type { BetriebKontext } from './kontext';

type Fund = {
  id: string;
  typ: string;
  merkmal: string | null;
  anzahl: number;
  menge_fm: number | null;
  beobachtet_am: string;
  bestand_id: string | null;
  status: string;
  foto_pfad: string | null;
  notiz: string | null;
  erfasst_von: string | null;
  wartet?: boolean;
};

type BestandFlaeche = { id: string; name: string; geom: MultiPolygon };

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

// Modul „Funde“: Liste der Fundmeldungen, Meldeformular unter /funde/neu
export function Funde({ k, unterpfad = [] }: { k: BetriebKontext; unterpfad?: string[] }) {
  if (unterpfad[0] === 'neu') return <FundMelden k={k} />;
  return <FundListe k={k} />;
}

function FundListe({ k }: { k: BetriebKontext }) {
  const [liste, setListe] = useState<Fund[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [typ, setTyp] = useState<'' | FundTyp>('');
  const [status, setStatus] = useState<'offen' | 'erledigt' | 'alle'>('offen');
  const [namen, setNamen] = useState<Map<string, string>>(new Map());
  const [foto, setFoto] = useState<{ id: string; url: string | null } | null>(null);
  const offen = useWarteschlange();

  const laden = useCallback(async () => {
    const [f, b] = await Promise.all([
      supabase
        .from('funde')
        .select('id, typ, merkmal, anzahl, menge_fm, beobachtet_am, bestand_id, status, foto_pfad, notiz, erfasst_von')
        .eq('betrieb_id', k.betriebId)
        .is('geloescht_am', null)
        .order('beobachtet_am', { ascending: false })
        .limit(300),
      supabase.from('bestaende').select('id, name').eq('betrieb_id', k.betriebId),
    ]);
    setFehler(f.error ? fehlertext(f.error) : null);
    setNamen(new Map((b.data ?? []).map((x) => [x.id, x.name])));
    const server = f.data ?? [];
    // Noch nicht übertragene Funde dieses Geräts oben anzeigen
    const lokal: Fund[] = wartendeFunde(k.betriebId)
      .filter((w) => !server.some((s) => s.id === w.id))
      .map((w) => ({
        id: w.id,
        typ: w.typ,
        merkmal: w.merkmal ?? null,
        anzahl: w.anzahl ?? 1,
        menge_fm: w.menge_fm ?? null,
        beobachtet_am: w.beobachtet_am ?? new Date().toISOString(),
        bestand_id: w.bestand_id ?? null,
        status: 'offen',
        foto_pfad: null,
        notiz: w.notiz ?? null,
        erfasst_von: k.userId,
        wartet: true,
      }));
    setListe([...lokal, ...server]);
  }, [k.betriebId, k.userId]);

  useEffect(() => {
    void laden();
  }, [laden, offen]);

  const sichtbar = useMemo(
    () => (liste ?? []).filter((f) => (!typ || f.typ === typ) && (status === 'alle' || f.status === status)),
    [liste, typ, status],
  );

  async function erledigen(f: Fund) {
    const { error } = await supabase.from('funde').update({ status: f.status === 'erledigt' ? 'offen' : 'erledigt' }).eq('id', f.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }

  async function fotoZeigen(f: Fund) {
    if (!f.foto_pfad) return;
    if (foto?.id === f.id) return setFoto(null);
    setFoto({ id: f.id, url: null });
    setFoto({ id: f.id, url: await fotoLink(f.foto_pfad) });
  }

  return (
    <Seite
      titel="Funde"
      untertitel="Käferbäume, Windwurf und Wildschäden aus der Begehung"
      aktion={
        <Knopf variante="primaer" onClick={() => navigieren('/funde/neu')}>
          + Fund melden
        </Knopf>
      }
    >
      <div className="filter-chips" role="group" aria-label="Fundtyp">
        <button type="button" className="filter-chip" aria-pressed={typ === ''} onClick={() => setTyp('')}>
          Alle Typen
        </button>
        {FUND_TYPEN.map((t) => (
          <button key={t.wert} type="button" className="filter-chip" aria-pressed={typ === t.wert} onClick={() => setTyp(t.wert)}>
            <i className="farbpunkt" style={{ background: t.farbe }} /> {t.label}
          </button>
        ))}
      </div>
      <Segmente<'offen' | 'erledigt' | 'alle'>
        label="Status"
        wert={status}
        onAendern={setStatus}
        optionen={[
          { wert: 'offen', label: 'Offen' },
          { wert: 'erledigt', label: 'Erledigt' },
          { wert: 'alle', label: 'Alle' },
        ]}
      />
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
        <Leer>Funde werden geladen …</Leer>
      ) : sichtbar.length === 0 ? (
        <Leer>{liste.length === 0 ? 'Noch keine Funde. Melde den ersten über „+ Fund melden“ – auch ohne Netz.' : 'Keine Funde in diesem Filter.'}</Leer>
      ) : (
        <Gruppe titel={`${sichtbar.length} ${sichtbar.length === 1 ? 'Fund' : 'Funde'}`}>
          {sichtbar.map((f) => (
            <div key={f.id}>
              <div className="zeile">
                <span className="zeile-label">
                  <i className="farbpunkt" style={{ background: typFarbe(f.typ) }} /> {typLabel(f.typ)}
                  {f.bestand_id && namen.get(f.bestand_id) ? ` · Bestand ${namen.get(f.bestand_id)}` : ''}
                  <small>
                    {[datumZeitDE(f.beobachtet_am), merkmalLabel(f.typ, f.merkmal), mengeText(f) || null, f.notiz, f.wartet ? 'wartet auf Netz' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <span className="fund-aktionen">
                  {f.foto_pfad && (
                    <button type="button" className="link" onClick={() => void fotoZeigen(f)} aria-expanded={foto?.id === f.id}>
                      Foto
                    </button>
                  )}
                  {!f.wartet && (k.istInhaber || f.erfasst_von === k.userId) && (
                    <button type="button" className={`status-pill status-${f.status === 'erledigt' ? 'erledigt' : 'geplant'}`} onClick={() => void erledigen(f)}>
                      {f.status === 'erledigt' ? 'Erledigt' : 'Offen'}
                    </button>
                  )}
                </span>
              </div>
              {foto?.id === f.id && (
                <div className="fund-foto">{foto.url ? <img src={foto.url} alt={`Foto zu ${typLabel(f.typ)}`} /> : <Leer>Foto wird geladen …</Leer>}</div>
              )}
            </div>
          ))}
        </Gruppe>
      )}
    </Seite>
  );
}

type Position = { lon: number; lat: number; genauigkeit: number | null };

function FundMelden({ k }: { k: BetriebKontext }) {
  const bestaende = useBestandFlaechen(k.betriebId);
  const [typ, setTyp] = useState<FundTyp>('kaeferbaum');
  const [merkmal, setMerkmal] = useState<string>(MERKMALE.kaeferbaum[0]!.wert);
  const [anzahl, setAnzahl] = useState(1);
  const [fm, setFm] = useState(5);
  const [notiz, setNotiz] = useState('');
  const [pos, setPos] = useState<Position | null>(null);
  const [gpsFehler, setGpsFehler] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [fotoFehler, setFotoFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const fotoEingabe = useRef<HTMLInputElement>(null);
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

  useEffect(() => () => {
    if (foto) URL.revokeObjectURL(foto.url);
  }, [foto]);

  const bestand = useMemo(() => (pos ? bestaende.find((b) => punktInFlaeche([pos.lon, pos.lat], b.geom)) ?? null : null), [pos, bestaende]);

  function typWaehlen(t: FundTyp) {
    setTyp(t);
    setMerkmal(MERKMALE[t][0]?.wert ?? '');
  }

  async function fotoGewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFotoFehler(null);
    try {
      const blob = await verkleinern(datei);
      setFoto({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setFotoFehler(err instanceof Error ? err.message : 'Foto konnte nicht gelesen werden.');
    }
  }

  async function speichern() {
    if (!pos) return;
    setFehler(null);
    setSpeichert(true);
    const id = crypto.randomUUID();
    try {
      // Foto zuerst lokal vormerken – geht auch ohne Netz verloren nicht
      if (foto) await fotoMerken(k.betriebId, id, foto.blob);
      const r = await speichernOderMerken({
        tabelle: 'funde',
        daten: {
          id,
          betrieb_id: k.betriebId,
          bestand_id: bestand?.id ?? null,
          typ,
          merkmal: merkmal || null,
          anzahl: typ === 'kaeferbaum' ? anzahl : 1,
          menge_fm: typ === 'windwurf' ? fm : null,
          geom: `SRID=4326;POINT(${pos.lon} ${pos.lat})`,
          genauigkeit_m: pos.genauigkeit != null ? Math.round(pos.genauigkeit) : null,
          beobachtet_am: new Date().toISOString(),
          notiz: notiz.trim() || null,
        },
      });
      if (r === 'gespeichert' && foto) void fotosHochladen();
      fundeGeaendert();
      // In der Karte direkt den nächsten Fund setzen können
      if (quelle === 'karte') {
        positionWahlBeenden();
        positionWahlStarten();
      }
      setErfolg(
        `${typLabel(typ)}${bestand ? ` in Bestand ${bestand.name}` : ''} ${r === 'gespeichert' ? 'gespeichert' : 'auf dem Gerät gespeichert – wird übertragen, sobald Netz da ist'}.`,
      );
      setFoto(null);
      setNotiz('');
      setAnzahl(1);
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <Seite
      titel="Fund melden"
      untertitel={quelle === 'karte' ? 'Position per Klick in die Karte setzen' : 'Position wird automatisch übernommen'}
      zurueck={() => navigieren('/funde')}
    >
      {erfolg && <Hinweis art="erfolg">{erfolg}</Hinweis>}
      <Segmente<FundTyp> label="Fundtyp" wert={typ} onAendern={typWaehlen} optionen={FUND_TYPEN.map((t) => ({ wert: t.wert, label: t.label }))} />

      <Gruppe>
        <button type="button" className={`foto-feld ${foto ? 'mit-foto' : ''}`} onClick={() => fotoEingabe.current?.click()}>
          {foto ? <img src={foto.url} alt="Gewähltes Foto" /> : <span>Foto aufnehmen (optional)</span>}
        </button>
        <input ref={fotoEingabe} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void fotoGewaehlt(e.target.files?.[0])} />
        {foto && (
          <div style={{ padding: '6px var(--abstand)' }}>
            <button type="button" className="link gefahr" onClick={() => setFoto(null)}>
              Foto entfernen
            </button>
          </div>
        )}
        {fotoFehler && <Hinweis art="fehler">{fotoFehler}</Hinweis>}
      </Gruppe>

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

      {MERKMALE[typ].length > 0 && (
        <Gruppe titel={typ === 'kaeferbaum' ? 'Befallsmerkmal' : typ === 'windwurf' ? 'Art' : 'Schadensart'}>
          <div className="merkmal-wahl" role="radiogroup" aria-label="Merkmal">
            {MERKMALE[typ].map((m) => (
              <button key={m.wert} type="button" role="radio" aria-checked={merkmal === m.wert} onClick={() => setMerkmal(m.wert)}>
                {m.label}
              </button>
            ))}
          </div>
        </Gruppe>
      )}

      {typ === 'kaeferbaum' && (
        <Gruppe>
          <Zeile label="Anzahl Bäume">
            <span className="stepper">
              <button type="button" aria-label="Weniger" onClick={() => setAnzahl((a) => Math.max(1, a - 1))}>
                −
              </button>
              <strong>{anzahl}</strong>
              <button type="button" aria-label="Mehr" onClick={() => setAnzahl((a) => a + 1)}>
                +
              </button>
            </span>
          </Zeile>
        </Gruppe>
      )}
      {typ === 'windwurf' && (
        <Gruppe>
          <Zeile label="Geschätzte Menge">
            <span className="stepper">
              <button type="button" aria-label="Weniger" onClick={() => setFm((a) => Math.max(1, a - 5))}>
                −
              </button>
              <strong>{fm} fm</strong>
              <button type="button" aria-label="Mehr" onClick={() => setFm((a) => a + 5)}>
                +
              </button>
            </span>
          </Zeile>
        </Gruppe>
      )}

      <Gruppe>
        <Feld label="Notiz" placeholder="z. B. Baum an Rückegasse 3 markiert" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
      </Gruppe>

      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf variante="primaer" disabled={!pos || speichert} onClick={() => void speichern()}>
        {pos ? 'Speichern' : quelle === 'karte' ? 'Erst Position in der Karte setzen' : 'Warte auf Position …'}
      </Knopf>
    </Seite>
  );
}
