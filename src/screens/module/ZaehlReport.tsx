import { useEffect, useMemo, useState } from 'react';
import { Druckrahmen } from '../bewegungsjagd/BjDruck';
import { supabase } from '../../lib/supabase';
import { wildartName, type Wildart, type Zone } from '../../lib/stammdaten';
import { wetterText, type Wetter } from '../../lib/geo';
import { datumDE } from '../../lib/zeit';
import type { Enums, Json } from '../../lib/database.types';

type Zeile = { zone_id: string | null; wildart_id: string; geschlecht: Enums<'geschlecht'>; anzahl: number };
type Sitz = { datum: string; beginn: string | null; ende: string | null; wetter: Json | null; mondphase: string | null; bemerkung: string | null; ebene_id: string | null; flaechenmodus?: string; streifenbreite_m?: number; strecke_km?: number | null; flaeche_ha?: number | null };

const uhr = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null);
const zahl = (n: number, stellen = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });

// Zusammenfassung einer Wildzählung (A4 quer): Zonen × Wildarten, Summen und Kennzahlen je 100 ha.
// Geschlecht und Altersklasse werden zusammengefasst; Bezugsfläche ist die Summe der erfassten Zonen.
export function ZaehlReport({ revierId, revierName, sitzung, ebeneName, zeilen, zonen, wildarten, onZu }: { revierId: string; revierName: string; sitzung: Sitz; ebeneName: string | null; zeilen: Zeile[]; zonen: Zone[]; wildarten: Wildart[]; onZu: () => void }) {
  const [ha, setHa] = useState<Record<string, number>>({});
  useEffect(() => {
    void supabase.rpc('zonen_flaechen', { p_revier_id: revierId }).then(({ data }) => {
      const m: Record<string, number> = {};
      for (const r of data ?? []) m[r.zone_id] = Number(r.flaeche_ha);
      setHa(m);
    });
  }, [revierId]);

  const d = useMemo(() => {
    const mitWerten = zeilen.filter((z) => z.anzahl > 0);
    const arten = [...new Set(mitWerten.map((z) => z.wildart_id))].sort(
      (a, b) => (wildarten.find((w) => w.id === a)?.sortierung ?? 0) - (wildarten.find((w) => w.id === b)?.sortierung ?? 0),
    );
    // Erfassungszonen: bei Zonenebene alle Zonen der Ebene, sonst die Zonen mit Einträgen
    const imEinsatz = (z: Zone) => (sitzung.ebene_id ? z.ebeneId === sitzung.ebene_id : zeilen.some((x) => x.zone_id === z.id));
    const zeilenZonen: Array<{ id: string | null; name: string; ha: number | null }> = [
      ...zonen.filter(imEinsatz).map((z) => ({ id: z.id, name: z.name, ha: ha[z.id] ?? null })),
      ...(zeilen.some((x) => x.zone_id === null && x.anzahl > 0) ? [{ id: null, name: zonen.length ? 'ohne Zone' : 'Revier', ha: null }] : []),
    ];
    const wert = (art: string | null, zone: string | null | undefined) =>
      mitWerten.filter((z) => (art === null || z.wildart_id === art) && (zone === undefined || z.zone_id === zone)).reduce((a, z) => a + z.anzahl, 0);
    const flaeche = zeilenZonen.reduce((a, z) => a + (z.ha ?? 0), 0);
    return { arten, zeilenZonen, wert, flaeche };
  }, [zeilen, zonen, wildarten, ha, sitzung.ebene_id]);

  // Gezählte Fläche: beim Abschluss festgeschrieben (Strecke × Breite oder Zonenfläche), sonst Summe der erfassten Zonen
  const streckeModus = sitzung.flaechenmodus === 'strecke';
  const bezug = sitzung.flaeche_ha != null ? Number(sitzung.flaeche_ha) : streckeModus ? 0 : d.flaeche;
  const modusZeile = streckeModus
    ? `Strecke × ${sitzung.streifenbreite_m ?? 400} m${sitzung.strecke_km != null && bezug > 0 ? `: ${zahl(Number(sitzung.strecke_km), 1)} km × ${sitzung.streifenbreite_m ?? 400} m = ${zahl(bezug)} ha` : ''}`
    : 'Zonenfläche';

  const zeit = [uhr(sitzung.beginn), uhr(sitzung.ende)].filter(Boolean).join(' – ');
  const wetter = sitzung.wetter ? wetterText(sitzung.wetter as unknown as Wetter) : null;

  return (
    <Druckrahmen querformat onZu={onZu}>
      <section className="bj-druck-seite">
        <h1>Wildzählung {datumDE(sitzung.datum)}</h1>
        <p className="art">{revierName}{ebeneName ? ` · Zonenebene ${ebeneName}` : ''}</p>
        <table className="bj-druck-tabelle">
          <tbody>
            {zeit && <tr><th>Zeit</th><td>{zeit} Uhr</td></tr>}
            {wetter && <tr><th>Wetter</th><td>{wetter}</td></tr>}
            {sitzung.mondphase && <tr><th>Mond</th><td>{sitzung.mondphase}</td></tr>}
            {sitzung.bemerkung && <tr><th>Bemerkungen</th><td>{sitzung.bemerkung}</td></tr>}
          </tbody>
        </table>

        {d.arten.length === 0 ? (
          <p>In dieser Zählung wurde nichts erfasst.</p>
        ) : (
          <>
            <div className="zr-kennzahlen">
              {d.arten.map((a) => {
                const summe = d.wert(a, undefined);
                return (
                  <div key={a} className="zr-karte">
                    <h3>{wildartName(wildarten, a)}</h3>
                    <p className="gross">{summe}</p>
                    <p>gezählt gesamt</p>
                    <p className="mittel">{bezug > 0 ? zahl((summe / bezug) * 100, 2) : '–'}</p>
                    <p>je 100 ha</p>
                    <p className="klein">Gezählte Fläche: {bezug > 0 ? `${zahl(bezug)} ha` : '–'}</p>
                    <p className="klein">{modusZeile}</p>
                  </div>
                );
              })}
            </div>

            <h2 className="klein">Ergebnis je Erfassungszone</h2>
            <table className="bj-druck-liste zr-tabelle">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th className="zahl">Fläche (ha)</th>
                  {d.arten.map((a) => <th key={a} className="zahl">{wildartName(wildarten, a)}</th>)}
                  <th className="zahl">Summe</th>
                </tr>
              </thead>
              <tbody>
                {d.zeilenZonen.map((z) => (
                  <tr key={z.id ?? 'ohne'}>
                    <th scope="row">{z.name}</th>
                    <td className="zahl">{!streckeModus && z.ha != null ? zahl(z.ha) : '–'}</td>
                    {d.arten.map((a) => <td key={a} className="zahl">{d.wert(a, z.id) || '–'}</td>)}
                    <td className="zahl"><strong>{d.wert(null, z.id)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Summe</strong></td>
                  <td className="zahl"><strong>{bezug > 0 ? zahl(bezug) : '–'}</strong></td>
                  {d.arten.map((a) => <td key={a} className="zahl"><strong>{d.wert(a, undefined)}</strong></td>)}
                  <td className="zahl"><strong>{d.wert(null, undefined)}</strong></td>
                </tr>
              </tfoot>
            </table>
            <p className="art" style={{ marginTop: 8, fontSize: '.8rem' }}>
              {streckeModus ? `Bezugsfläche „je 100 ha“ = gezählte Fläche (${modusZeile}); die Zonenzeilen zeigen Zählwerte.` : 'Bezugsfläche „je 100 ha“ = Summe der erfassten Zonen.'} Erstellt am {new Date().toLocaleDateString('de-DE')} mit Hegewerk.
            </p>
          </>
        )}
      </section>
    </Druckrahmen>
  );
}
