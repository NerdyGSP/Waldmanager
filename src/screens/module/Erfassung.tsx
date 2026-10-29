import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten, useZonen, wildartName } from '../../lib/stammdaten';
import { aktuellePosition, punktEWKT, type Position } from '../../lib/geo';
import { speichernOderMerken } from '../../lib/offline';
import { datumZeitDE } from '../../lib/zeit';
import type { Enums } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, Zaehler, Zeile } from '../../components/ui';
import type { RevierKontext } from './kontext';

const SCHNELLWAHL = ['rehwild', 'schwarzwild', 'rotwild', 'damwild', 'fuchs', 'feldhase'];

type Beobachtung = {
  id: string;
  zeitpunkt: string;
  wildart_id: string;
  anzahl: number;
  geschlecht: Enums<'geschlecht'>;
  altersklasse: string | null;
  zone_id: string | null;
  erfasst_von: string | null;
  bemerkung: string | null;
};

export function Erfassung({ k }: { k: RevierKontext }) {
  const wildarten = useWildarten();
  const { zonen } = useZonen(k.revierId);
  const [wildartId, setWildartId] = useState('rehwild');
  const [anzahl, setAnzahl] = useState(1);
  const [geschlecht, setGeschlecht] = useState<Enums<'geschlecht'>>('unbekannt');
  const [altersklasse, setAltersklasse] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const [ortStatus, setOrtStatus] = useState('Position wird bestimmt …');
  const [meldung, setMeldung] = useState<{ art: 'erfolg' | 'fehler' | 'info'; text: string } | null>(null);
  const [liste, setListe] = useState<Beobachtung[]>([]);

  const klassen = wildarten.find((w) => w.id === wildartId)?.altersklassen ?? [];

  const ortBestimmen = useCallback(async () => {
    setOrtStatus('Position wird bestimmt …');
    const p = await aktuellePosition();
    setPosition(p);
    if (!p) {
      setOrtStatus('Keine Position – Erfassung ohne Ort möglich');
      return;
    }
    setOrtStatus(`Position ± ${p.genauigkeit} m`);
    if (navigator.onLine) {
      const { data } = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: p.lon, p_lat: p.lat });
      if (data) setZoneId(data);
    }
  }, [k.revierId]);

  const laden = useCallback(async () => {
    const { data } = await supabase
      .from('beobachtungen')
      .select('id, zeitpunkt, wildart_id, anzahl, geschlecht, altersklasse, zone_id, erfasst_von, bemerkung')
      .eq('revier_id', k.revierId)
      .is('geloescht_am', null)
      .order('zeitpunkt', { ascending: false })
      .limit(25);
    if (data) setListe(data);
  }, [k.revierId]);

  useEffect(() => {
    void ortBestimmen();
    void laden();
  }, [ortBestimmen, laden]);

  async function speichern() {
    setMeldung(null);
    try {
      const ergebnis = await speichernOderMerken({
        tabelle: 'beobachtungen',
        daten: {
          id: crypto.randomUUID(),
          revier_id: k.revierId,
          zeitpunkt: new Date().toISOString(),
          wildart_id: wildartId,
          anzahl,
          geschlecht,
          altersklasse: altersklasse || null,
          zone_id: zoneId || null,
          bemerkung: bemerkung.trim() || null,
          erfasst_von: k.userId,
          geom: position ? punktEWKT(position.lon, position.lat) : null,
        },
      });
      setMeldung(
        ergebnis === 'gespeichert'
          ? { art: 'erfolg', text: `${anzahl} × ${wildartName(wildarten, wildartId)} gespeichert` }
          : { art: 'info', text: 'Kein Netz – gespeichert auf dem Gerät, wird automatisch übertragen' },
      );
      setAnzahl(1);
      setGeschlecht('unbekannt');
      setAltersklasse('');
      setBemerkung('');
      if (ergebnis === 'gespeichert') await laden();
    } catch (err) {
      setMeldung({ art: 'fehler', text: fehlertext(err) });
    }
  }

  async function loeschen(b: Beobachtung) {
    if (!window.confirm('Diese Beobachtung löschen?')) return;
    const { error } = await supabase.from('beobachtungen').delete().eq('id', b.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    await laden();
  }

  const weitere = wildarten.filter((w) => !SCHNELLWAHL.includes(w.id));

  return (
    <Seite titel="Einzelerfassung" untertitel={ortStatus}>
      <div className="schnellwahl" role="radiogroup" aria-label="Wildart">
        {SCHNELLWAHL.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={wildartId === id}
            onClick={() => {
              setWildartId(id);
              setAltersklasse('');
            }}
          >
            {wildartName(wildarten, id)}
          </button>
        ))}
      </div>

      <Gruppe>
        <Auswahl
          label="Andere Wildart"
          value={SCHNELLWAHL.includes(wildartId) ? '' : wildartId}
          onChange={(e) => {
            if (e.target.value) setWildartId(e.target.value);
            setAltersklasse('');
          }}
        >
          <option value="">–</option>
          {weitere.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Auswahl>
        <div className="zeile">
          <span className="zeile-label">Anzahl</span>
          <Zaehler label="Anzahl" wert={anzahl} min={1} onAendern={setAnzahl} />
        </div>
        <div className="zeile">
          <span className="zeile-label">Geschlecht</span>
          <Segmente
            label="Geschlecht"
            wert={geschlecht}
            onAendern={setGeschlecht}
            optionen={GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.kurz }))}
          />
        </div>
        {klassen.length > 0 && (
          <Auswahl label="Altersklasse" value={altersklasse} onChange={(e) => setAltersklasse(e.target.value)}>
            <option value="">–</option>
            {klassen.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Auswahl>
        )}
        <Auswahl label="Zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">–</option>
          {zonen.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </Auswahl>
        <Feld label="Bemerkung" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
      </Gruppe>

      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
      <Knopf onClick={speichern}>
        {anzahl} × {wildartName(wildarten, wildartId)} erfassen
      </Knopf>
      <Knopf variante="sekundaer" onClick={ortBestimmen}>
        📍 Position neu bestimmen
      </Knopf>

      <Gruppe titel="Zuletzt erfasst">
        {liste.length === 0 && <Zeile label="Noch keine Beobachtungen" />}
        {liste.map((b) => (
          <Zeile
            key={b.id}
            label={
              <>
                {b.anzahl} × {wildartName(wildarten, b.wildart_id)} {GESCHLECHTER.find((g) => g.wert === b.geschlecht)?.kurz}
                {b.altersklasse ? ` · ${b.altersklasse}` : ''}
                <small>
                  {datumZeitDE(b.zeitpunkt)}
                  {zonen.find((z) => z.id === b.zone_id) ? ` · ${zonen.find((z) => z.id === b.zone_id)?.name}` : ''}
                  {b.bemerkung ? ` · ${b.bemerkung}` : ''}
                </small>
              </>
            }
          >
            {(k.istInhaber || b.erfasst_von === k.userId) && (
              <button className="link gefahr" onClick={() => loeschen(b)}>
                Löschen
              </button>
            )}
          </Zeile>
        ))}
      </Gruppe>
      <Leer>Ohne Netz werden Erfassungen auf dem Gerät gespeichert und übertragen, sobald wieder Verbindung besteht.</Leer>
    </Seite>
  );
}
