import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { wildartName, type Wildart, type Zone, type ZonenEbene } from '../../lib/stammdaten';
import { useBreit } from '../../lib/useBreit';
import { Leer } from '../../components/ui';

export type MatrixZeile = { zone_id: string | null; wildart_id: string; anzahl: number };
export type MatrixSitzung = { ebene_id: string | null; flaechenmodus: string; streifenbreite_m: number; strecke_km: number | null; flaeche_ha: number | null };

const zahl = (n: number, nk = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: nk });

/** Gezählte Fläche und Modus-Text einer Sitzung (festgeschrieben, sonst Summe der erfassten Zonen) */
export function useBezug(revierId: string, sitzung: MatrixSitzung, zonenIds: Array<string | null>) {
  const [ha, setHa] = useState<Record<string, number>>({});
  useEffect(() => {
    void supabase.rpc('zonen_flaechen', { p_revier_id: revierId }).then(({ data }) => {
      const m: Record<string, number> = {};
      for (const r of data ?? []) m[r.zone_id] = Number(r.flaeche_ha);
      setHa(m);
    });
  }, [revierId]);
  const strecke = sitzung.flaechenmodus === 'strecke';
  const zonenSumme = [...new Set(zonenIds)].reduce((a, id) => a + (id ? (ha[id] ?? 0) : 0), 0);
  const bezug = sitzung.flaeche_ha != null ? Number(sitzung.flaeche_ha) : strecke ? 0 : zonenSumme;
  const breite = sitzung.streifenbreite_m || 400;
  const modus = strecke
    ? `Strecke × ${breite} m${sitzung.strecke_km != null && bezug > 0 ? `: ${zahl(Number(sitzung.strecke_km), 1)} km × ${breite} m = ${zahl(bezug)} ha` : ''}`
    : 'Zonenfläche';
  return { bezug, modus, strecke };
}

// WTE-Übersicht: Zonen in den Zeilen, Wildarten in den Spalten (leere Spalten ausgeblendet), Zonenebenen einklappbar
export function ZaehlMatrix({ revierId, sitzung, zeilen, zonen, ebenen, wildarten }: { revierId: string; sitzung: MatrixSitzung; zeilen: MatrixZeile[]; zonen: Zone[]; ebenen: ZonenEbene[]; wildarten: Wildart[] }) {
  const breit = useBreit();
  const [zu, setZu] = useState<Set<string>>(new Set());
  const mit = useMemo(() => zeilen.filter((z) => z.anzahl > 0), [zeilen]);
  const arten = useMemo(
    () => [...new Set(mit.map((z) => z.wildart_id))].sort((a, b) => (wildarten.find((w) => w.id === a)?.sortierung ?? 0) - (wildarten.find((w) => w.id === b)?.sortierung ?? 0)),
    [mit, wildarten],
  );
  const wert = (art: string | null, zone: string | null | undefined, ids?: Array<string | null>) =>
    mit.filter((z) => (art === null || z.wildart_id === art) && (zone === undefined || z.zone_id === zone) && (!ids || ids.includes(z.zone_id))).reduce((a, z) => a + z.anzahl, 0);

  const zonenZeilen = useMemo(() => {
    const bekannt = zonen.filter((z) => zeilen.some((x) => x.zone_id === z.id)).map((z) => ({ id: z.id as string | null, name: z.name, ebene: z.ebeneId }));
    const ohne = zeilen.some((x) => x.zone_id === null) ? [{ id: null as string | null, name: zonen.length ? 'ohne Zone' : 'Gesamtrevier', ebene: null as string | null }] : [];
    const entfernt = [...new Set(zeilen.map((x) => x.zone_id))].filter((id) => id && !zonen.some((z) => z.id === id)).map((id) => ({ id, name: 'entfernte Zone', ebene: null as string | null }));
    return [...bekannt, ...ohne, ...entfernt];
  }, [zeilen, zonen]);
  const gruppen = useMemo(() => {
    const ids = [...new Set(zonenZeilen.map((z) => z.ebene))];
    const sortiert = ids.sort((a, b) => (ebenen.find((e) => e.id === a)?.sortierung ?? 9999) - (ebenen.find((e) => e.id === b)?.sortierung ?? 9999));
    return sortiert.map((id) => ({ id, name: ebenen.find((e) => e.id === id)?.name ?? 'Ohne Ebene', zeilen: zonenZeilen.filter((z) => z.ebene === id) }));
  }, [zonenZeilen, ebenen]);
  const { bezug, modus } = useBezug(revierId, sitzung, zonenZeilen.map((z) => z.id));

  if (arten.length === 0) return <Leer>Noch keine Sichtungen erfasst.</Leer>;
  const mitKopf = gruppen.length > 1 || (gruppen[0]?.id ?? null) !== null;
  const umschalten = (id: string | null) => setZu((s) => { const n = new Set(s); const k = id ?? '_'; if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const zeileZelle = (ids: Array<string | null>, art: string) => wert(art, undefined, ids) || '–';

  return (
    <>
      {breit ? (
        <div className="tabelle-rahmen matrix">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Zone</th>
                {arten.map((a) => <th key={a} className="zahl">{wildartName(wildarten, a)}</th>)}
                <th className="zahl">Summe</th>
              </tr>
            </thead>
            <tbody>
              {gruppen.map((g) => {
                const geschlossen = zu.has(g.id ?? '_');
                const ids = g.zeilen.map((z) => z.id);
                return (
                  <FragmentZeilen key={g.id ?? '_'}>
                    {mitKopf && (
                      <tr className="matrix-gruppe">
                        <th scope="row">
                          <button type="button" className="link" aria-expanded={!geschlossen} onClick={() => umschalten(g.id)}>
                            {geschlossen ? '▸' : '▾'} {g.name}
                          </button>
                        </th>
                        {arten.map((a) => <td key={a} className="zahl leise">{zeileZelle(ids, a)}</td>)}
                        <td className="zahl stark">{wert(null, undefined, ids)}</td>
                      </tr>
                    )}
                    {!geschlossen && g.zeilen.map((z) => (
                      <tr key={z.id ?? 'ohne'}>
                        <th scope="row" style={mitKopf ? { paddingLeft: 24 } : undefined}>{z.name}</th>
                        {arten.map((a) => <td key={a} className="zahl">{wert(a, z.id) || '–'}</td>)}
                        <td className="zahl stark">{wert(null, z.id)}</td>
                      </tr>
                    ))}
                  </FragmentZeilen>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Gesamt</th>
                {arten.map((a) => <td key={a} className="zahl stark">{wert(a, undefined)}</td>)}
                <td className="zahl stark">{wert(null, undefined)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="matrix-karten">
          {zonenZeilen.map((z) => (
            <div key={z.id ?? 'ohne'} className="matrix-karte">
              <strong>{z.name}</strong>
              <ul>
                {arten.filter((a) => wert(a, z.id) > 0).map((a) => <li key={a}><span>{wildartName(wildarten, a)}</span><b>{wert(a, z.id)}</b></li>)}
              </ul>
              <small>Summe {wert(null, z.id)}</small>
            </div>
          ))}
          <div className="matrix-karte"><strong>Gesamt</strong><small>{wert(null, undefined)} Stück</small></div>
        </div>
      )}

      <div className="tabelle-rahmen" style={{ marginTop: 10 }}>
        <p className="gruppe-fuss" style={{ margin: 0, padding: '8px 12px 0' }}>Gezählte Fläche: <strong>{bezug > 0 ? `${zahl(bezug)} ha` : '–'}</strong> · {modus}</p>
        <table className="tabelle">
          <thead>
            <tr><th>Wildart</th><th className="zahl">Gesamt</th><th className="zahl">je 100 ha</th></tr>
          </thead>
          <tbody>
            {arten.map((a) => (
              <tr key={a}>
                <th scope="row">{wildartName(wildarten, a)}</th>
                <td className="zahl">{wert(a, undefined)}</td>
                <td className="zahl stark">{bezug > 0 ? zahl((wert(a, undefined) / bezug) * 100, 2) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FragmentZeilen({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
