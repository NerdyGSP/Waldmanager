import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import { Verlauf } from '../../components/diagramme';

export type GewaehlteZone = { id: string; name: string; farbe: string | null; flaecheHa: number | null };

type Messung = { sitzungId: string; datum: string; wildartId: string; anzahl: number };

const ANZAHL_ZAEHLUNGEN = 12;
const ANZAHL_SPALTEN = 6;

/** Informationsfenster am unteren Kartenrand: letzte Zählungen einer Zone als Tabelle und als Verlauf je Wildart */
export function ZonenInfo({ zone, onSchliessen }: { zone: GewaehlteZone; onSchliessen: () => void }) {
  const wildarten = useWildarten();
  const [messungen, setMessungen] = useState<Messung[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [verlaufArt, setVerlaufArt] = useState('');

  useEffect(() => {
    let aktiv = true;
    setMessungen(null);
    setFehler(null);
    void supabase
      .from('zaehlungen')
      .select('wildart_id, anzahl, sitzung:zaehlsitzungen!inner(id, datum, status, geloescht_am)')
      .eq('zone_id', zone.id)
      .is('geloescht_am', null)
      .eq('sitzung.status', 'abgeschlossen')
      .is('sitzung.geloescht_am', null)
      .then(({ data, error }) => {
        if (!aktiv) return;
        if (error) {
          setFehler(fehlertext(error));
          return;
        }
        setMessungen(
          (data ?? []).flatMap((z) => {
            const s = Array.isArray(z.sitzung) ? z.sitzung[0] : z.sitzung;
            return s ? [{ sitzungId: s.id, datum: s.datum, wildartId: z.wildart_id, anzahl: z.anzahl }] : [];
          }),
        );
      });
    return () => {
      aktiv = false;
    };
  }, [zone.id]);

  // Letzte Zählungen (neueste zuerst), je Zählung die Summe je Wildart
  const auswertung = useMemo(() => {
    const sitzungen = new Map<string, { datum: string; arten: Map<string, number> }>();
    for (const m of messungen ?? []) {
      const s = sitzungen.get(m.sitzungId) ?? { datum: m.datum, arten: new Map<string, number>() };
      s.arten.set(m.wildartId, (s.arten.get(m.wildartId) ?? 0) + m.anzahl);
      sitzungen.set(m.sitzungId, s);
    }
    const liste = [...sitzungen.entries()]
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.datum.localeCompare(a.datum))
      .slice(0, ANZAHL_ZAEHLUNGEN);
    const artIds = new Set(liste.flatMap((s) => [...s.arten.keys()]));
    const arten = wildarten
      .filter((w) => artIds.has(w.id))
      .map((w) => {
        const werte = liste.map((s) => s.arten.get(w.id) ?? 0);
        return {
          id: w.id,
          name: w.name,
          werte,
          max: Math.max(...werte),
          schnitt: werte.reduce((a, n) => a + n, 0) / (werte.length || 1),
        };
      })
      .sort((a, b) => b.max - a.max);
    return { liste, arten };
  }, [messungen, wildarten]);

  useEffect(() => {
    if (auswertung.arten.length && !auswertung.arten.some((a) => a.id === verlaufArt)) setVerlaufArt(auswertung.arten[0]!.id);
  }, [auswertung.arten, verlaufArt]);

  const spalten = auswertung.liste.slice(0, ANZAHL_SPALTEN);
  const verlaufsart = auswertung.arten.find((a) => a.id === verlaufArt);
  const mehrereJahre = new Set(auswertung.liste.map((s) => s.datum.slice(0, 4))).size > 1;
  const kurz = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', mehrereJahre ? { day: '2-digit', month: '2-digit', year: '2-digit' } : { day: '2-digit', month: '2-digit' });

  return (
    <section className="zonen-info" role="dialog" aria-label={`Zone ${zone.name}`}>
      <header className="zonen-info-kopf">
        <i className="farbpunkt" style={{ background: zone.farbe ?? 'var(--color-primary)' }} />
        <div>
          <strong>{zone.name}</strong>
          <small>
            {zone.flaecheHa ? `${zone.flaecheHa.toLocaleString('de-DE')} ha · ` : ''}
            {messungen === null && !fehler
              ? 'Zählungen werden geladen …'
              : auswertung.liste.length
                ? `${auswertung.liste.length} ${auswertung.liste.length === 1 ? 'Zählung' : 'Zählungen'}, zuletzt am ${datumDE(auswertung.liste[0]!.datum)}`
                : 'Noch keine abgeschlossene Zählung'}
          </small>
        </div>
        <button className="knopf knopf-ghost klein" onClick={() => navigieren('/zaehlung')}>
          Zur Wildzählung
        </button>
        <button className="zonen-info-zu" onClick={onSchliessen} aria-label="Informationsfenster schließen">
          ✕
        </button>
      </header>

      {fehler && <p className="feld-fehler">{fehler}</p>}

      {auswertung.arten.length > 0 && (
        <div className="zonen-info-inhalt">
          <div className="zonen-info-tabelle tabelle-rahmen">
            <table className="tabelle">
              <thead>
                <tr>
                  <th scope="col">Wildart</th>
                  {spalten.map((s) => (
                    <th key={s.id} scope="col" className="zahl">
                      {kurz(s.datum)}
                    </th>
                  ))}
                  <th scope="col" className="zahl">
                    Ø
                  </th>
                  <th scope="col" className="zahl">
                    Max
                  </th>
                </tr>
              </thead>
              <tbody>
                {auswertung.arten.map((a) => (
                  <tr key={a.id} aria-selected={a.id === verlaufArt} onClick={() => setVerlaufArt(a.id)} className="klickbar">
                    <th scope="row">{a.name}</th>
                    {a.werte.slice(0, ANZAHL_SPALTEN).map((w, i) => (
                      <td key={spalten[i]!.id} className={`zahl ${w === 0 ? 'leise' : ''}`}>
                        {w}
                      </td>
                    ))}
                    <td className="zahl leise">{a.schnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</td>
                    <td className="zahl stark">{a.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="zonen-info-verlauf">
            <label className="filter">
              <span>Verlauf</span>
              <select value={verlaufArt} onChange={(e) => setVerlaufArt(e.target.value)} aria-label="Wildart im Verlauf">
                {auswertung.arten.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {verlaufsart && (
              <Verlauf
                titel={`${verlaufsart.name} in ${zone.name}`}
                punkte={[...auswertung.liste]
                  .reverse()
                  .map((s) => ({ label: kurz(s.datum), wert: s.arten.get(verlaufsart.id) ?? 0 }))}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
