import { useEffect, useRef, useState } from 'react';
import { Auswahl, Feld, Gruppe, Knopf } from '../../components/ui';
import { mondText, RICHTUNGEN, wetterFuerZeitpunkt, type Sitzungsdaten } from '../../lib/sitzungsdaten';

// Formular „Sitzungsdaten“: Wetter wird – solange nichts von Hand geändert wurde – aus dem Open-Meteo-Archiv vorbelegt (Reviermitte, Datum, Startzeit)
export function SitzungsdatenFormular({
  wert,
  onAendern,
  mitte,
  datumAenderbar = true,
  titel = 'Sitzungsdaten',
  autoVorbelegen = true,
}: {
  wert: Sitzungsdaten;
  onAendern: (w: Sitzungsdaten) => void;
  mitte: [number, number] | null; // [lon, lat]
  datumAenderbar?: boolean;
  titel?: string;
  autoVorbelegen?: boolean;
}) {
  const [status, setStatus] = useState('');
  const aktuell = useRef(wert);
  aktuell.current = wert;
  const handEingabe = useRef(false);
  const anfrage = useRef(0);

  async function wetterLaden(erzwingen: boolean) {
    const w = aktuell.current;
    if (!mitte || !w.datum) {
      setStatus(mitte ? '' : 'Ohne Reviergrenze kein automatisches Wetter – bitte von Hand eintragen.');
      return;
    }
    if (!erzwingen && handEingabe.current) return;
    const nr = ++anfrage.current;
    setStatus('Wetter wird abgerufen …');
    const v = await wetterFuerZeitpunkt(mitte[1], mitte[0], w.datum, w.start);
    if (nr !== anfrage.current) return;
    if (!v) {
      setStatus('Keine Wetterdaten verfügbar (offline oder noch nicht vorhanden) – bitte von Hand eintragen.');
      return;
    }
    handEingabe.current = false;
    onAendern({ ...aktuell.current, ...v });
    setStatus('Vorausgefüllt aus Open-Meteo (Reviermitte) – alle Werte kannst du ändern.');
  }

  // Bei neuem Datum oder neuer Startzeit erneut vorbelegen, solange nichts von Hand geändert wurde
  useEffect(() => {
    if (!autoVorbelegen) return;
    const t = setTimeout(() => void wetterLaden(false), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert.datum, wert.start, mitte?.[0], mitte?.[1], autoVorbelegen]);

  // Mond wird lokal berechnet
  useEffect(() => {
    const m = mondText(wert.datum, wert.start);
    if (m && m !== aktuell.current.mond) onAendern({ ...aktuell.current, mond: m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert.datum, wert.start]);

  const setze = (teil: Partial<Sitzungsdaten>, hand = true) => {
    if (hand) handEingabe.current = true;
    onAendern({ ...wert, ...teil });
  };

  return (
    <Gruppe titel={titel} fuss={status || undefined}>
      {datumAenderbar && <Feld label="Datum *" type="date" value={wert.datum} onChange={(e) => setze({ datum: e.target.value }, false)} />}
      <Feld label="Beginn" type="time" value={wert.start} onChange={(e) => setze({ start: e.target.value }, false)} />
      <Feld label="Ende" type="time" value={wert.ende} onChange={(e) => setze({ ende: e.target.value }, false)} />
      <Feld label="Wetter" value={wert.wetter} placeholder="z. B. bedeckt, klar" onChange={(e) => setze({ wetter: e.target.value })} />
      <Auswahl label="Wind aus" value={wert.windRichtung} onChange={(e) => setze({ windRichtung: e.target.value })}>
        <option value="">– keine Angabe –</option>
        {RICHTUNGEN.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Auswahl>
      <Feld label="Windstärke (km/h)" inputMode="decimal" value={wert.windKmh} onChange={(e) => setze({ windKmh: e.target.value })} />
      <Feld label="Temperatur (°C)" inputMode="decimal" value={wert.temperatur} onChange={(e) => setze({ temperatur: e.target.value })} />
      <Feld label="Niederschlag (mm)" inputMode="decimal" value={wert.niederschlag} onChange={(e) => setze({ niederschlag: e.target.value })} />
      <Feld label="Mond" value={wert.mond} onChange={(e) => setze({ mond: e.target.value })} />
      <Feld label="Bemerkung" value={wert.bemerkung} onChange={(e) => setze({ bemerkung: e.target.value })} />
      {mitte && (
        <Knopf variante="ghost" type="button" onClick={() => void wetterLaden(true)}>
          Wetter neu abrufen
        </Knopf>
      )}
    </Gruppe>
  );
}
