import { useMemo } from 'react';
import { Druckrahmen } from '../bewegungsjagd/BjDruck';
import { GESCHLECHTER, wildartName, type Wildart, type Zone } from '../../lib/stammdaten';
import { wetterText, type Wetter } from '../../lib/geo';
import { datumDE } from '../../lib/zeit';
import type { Enums, Json } from '../../lib/database.types';

type Zeile = { zone_id: string | null; wildart_id: string; geschlecht: Enums<'geschlecht'>; anzahl: number };
type Sitz = { datum: string; beginn: string | null; ende: string | null; wetter: Json | null; mondphase: string | null; bemerkung: string | null };

const uhr = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null);

// Druckbarer Bericht einer Wildzählung (A4, bei vielen Zonen quer)
export function ZaehlReport({ revierName, sitzung, ebeneName, zeilen, zonen, wildarten, onZu }: { revierName: string; sitzung: Sitz; ebeneName: string | null; zeilen: Zeile[]; zonen: Zone[]; wildarten: Wildart[]; onZu: () => void }) {
  const d = useMemo(() => {
    const spalten: Array<{ id: string | null; name: string }> = [
      ...zonen.filter((z) => zeilen.some((x) => x.zone_id === z.id && x.anzahl > 0)).map((z) => ({ id: z.id, name: z.name })),
      ...(zeilen.some((x) => x.zone_id === null && x.anzahl > 0) ? [{ id: null, name: zonen.length ? 'ohne Zone' : 'Revier' }] : []),
      ...[...new Set(zeilen.map((x) => x.zone_id))].filter((id) => id && !zonen.some((z) => z.id === id)).map((id) => ({ id, name: 'entfernte Zone' })),
    ];
    const arten = [...new Set(zeilen.filter((z) => z.anzahl > 0).map((z) => z.wildart_id))].sort(
      (a, b) => (wildarten.find((w) => w.id === a)?.sortierung ?? 0) - (wildarten.find((w) => w.id === b)?.sortierung ?? 0),
    );
    const wert = (art: string | null, zone: string | null | undefined, g?: Enums<'geschlecht'>) =>
      zeilen.filter((z) => (art === null || z.wildart_id === art) && (zone === undefined || z.zone_id === zone) && (!g || z.geschlecht === g)).reduce((a, z) => a + z.anzahl, 0);
    return { spalten, arten, wert };
  }, [zeilen, zonen, wildarten]);

  const quer = d.spalten.length > 5;
  const zeit = [uhr(sitzung.beginn), uhr(sitzung.ende)].filter(Boolean).join(' – ');
  const erstellt = new Date().toLocaleDateString('de-DE');

  return (
    <Druckrahmen querformat={quer} onZu={onZu}>
      <section className="bj-druck-seite">
        <h1>Wildzählung {datumDE(sitzung.datum)}</h1>
        <p className="art">{revierName}</p>
        <table className="bj-druck-tabelle">
          <tbody>
            {zeit && <tr><th>Zeit</th><td>{zeit} Uhr</td></tr>}
            {ebeneName && <tr><th>Zonenebene</th><td>{ebeneName}</td></tr>}
            {sitzung.mondphase && <tr><th>Mond</th><td>{sitzung.mondphase}</td></tr>}
            {sitzung.wetter && <tr><th>Wetter</th><td>{wetterText(sitzung.wetter as unknown as Wetter)}</td></tr>}
            {sitzung.bemerkung && <tr><th>Bemerkung</th><td>{sitzung.bemerkung}</td></tr>}
            <tr><th>Gezählt gesamt</th><td><strong>{d.wert(null, undefined)} Stück</strong></td></tr>
          </tbody>
        </table>
        <h2>Ergebnis</h2>
        {d.arten.length === 0 ? (
          <p>In dieser Zählung wurde nichts erfasst.</p>
        ) : (
          <table className="bj-druck-liste">
            <thead>
              <tr>
                <th>Wildart</th>
                {d.spalten.map((s) => <th key={s.id ?? 'ohne'}>{s.name}</th>)}
                <th>Summe</th>
                {GESCHLECHTER.map((g) => <th key={g.wert} title={g.label}>{g.kurz}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.arten.map((a) => (
                <tr key={a}>
                  <th scope="row">{wildartName(wildarten, a)}</th>
                  {d.spalten.map((s) => <td key={s.id ?? 'ohne'}>{d.wert(a, s.id) || '–'}</td>)}
                  <td><strong>{d.wert(a, undefined)}</strong></td>
                  {GESCHLECHTER.map((g) => <td key={g.wert}>{d.wert(a, undefined, g.wert) || '–'}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Gesamt</td>
                {d.spalten.map((s) => <td key={s.id ?? 'ohne'}>{d.wert(null, s.id)}</td>)}
                <td><strong>{d.wert(null, undefined)}</strong></td>
                {GESCHLECHTER.map((g) => <td key={g.wert}>{d.wert(null, undefined, g.wert)}</td>)}
              </tr>
            </tfoot>
          </table>
        )}
        <p className="art" style={{ marginTop: 16, fontSize: '.8rem' }}>Erstellt am {erstellt} mit Hegewerk</p>
      </section>
    </Druckrahmen>
  );
}
