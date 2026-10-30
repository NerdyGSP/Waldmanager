import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import { EinrichtungsIcon } from '../../lib/einrichtungsIcons';
import { EINRICHTUNGSTYPEN } from '../../lib/stammdaten';
import { Hinweis, Knopf, Leer } from '../../components/ui';
import { EinrichtungSheet, type EinrichtungInfo } from './EinrichtungSheet';
import type { RevierKontext } from './kontext';

type Zeile = EinrichtungInfo & { erstellt: string; zone: string; zusatz: string };
type Spalte = 'typ' | 'name' | 'zone' | 'koord' | 'bemerkung' | 'erstellt' | 'zusatz';

const typLabel = (t: string) => EINRICHTUNGSTYPEN.find((x) => x.wert === t)?.label ?? t;
const typIndex = (t: string) => {
  const i = EINRICHTUNGSTYPEN.findIndex((x) => x.wert === t);
  return i < 0 ? 999 : i;
};
const koordText = (e: { lat: number; lng: number }) => `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}`;

// Vollbild-Tabelle aller Einrichtungen des Reviers (Mitjäger nur lesend)
export function EinrichtungenVollbild({ k }: { k: RevierKontext }) {
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [typFilter, setTypFilter] = useState<string>('');
  const [sortSpalte, setSortSpalte] = useState<Spalte>('typ');
  const [sortRichtung, setSortRichtung] = useState<1 | -1>(1);
  const [dialog, setDialog] = useState<{ einr: EinrichtungInfo; start: 'bearbeiten' | 'loeschen' } | null>(null);

  const laden = useCallback(async () => {
    const { data, error } = await supabase.rpc('karte_daten', { p_revier_id: k.revierId, p_tage: 1 });
    if (error) return setFehler(fehlertext(error));
    const x = data as unknown as { einrichtungen?: Array<{ id?: string; geometry?: { coordinates?: number[] }; properties?: { id?: string; typ?: string; name?: string | null; bemerkung?: string | null } }> } | null;
    const basis = (x?.einrichtungen ?? []).map((e) => ({
      id: e.id ?? e.properties?.id ?? '',
      name: e.properties?.name ?? null,
      typ: (e.properties?.typ ?? 'sonstiges') as EinrichtungInfo['typ'],
      bemerkung: e.properties?.bemerkung ?? null,
      lng: e.geometry?.coordinates?.[0] ?? 0,
      lat: e.geometry?.coordinates?.[1] ?? 0,
    }));
    const [erst, ebenen, zonen, fang, jagd] = await Promise.all([
      supabase.from('einrichtungen').select('id, erstellt_am').eq('revier_id', k.revierId).is('geloescht_am', null),
      supabase.from('zonen_ebenen').select('id, name').eq('revier_id', k.revierId),
      supabase.from('zonen').select('id, name, ebene_id').eq('revier_id', k.revierId).is('geloescht_am', null),
      supabase.from('abschuesse').select('einrichtung_id, erlegt_am, art').eq('revier_id', k.revierId).not('einrichtung_id', 'is', null).is('geloescht_am', null).order('erlegt_am', { ascending: false }),
      supabase.from('bewegungsjagd_teilnehmer').select('zugeordnete_einrichtung_id, bewegungsjagden(titel, datum)').not('zugeordnete_einrichtung_id', 'is', null),
    ]);
    const erstMap = new Map((erst.data ?? []).map((e) => [e.id, e.erstellt_am]));
    const ebeneName = new Map((ebenen.data ?? []).map((e) => [e.id, e.name]));
    const zoneMap = new Map((zonen.data ?? []).map((z) => [z.id, z.ebene_id ? `${z.name} (${ebeneName.get(z.ebene_id) ?? 'Ebene'})` : z.name]));
    const letzterFang = new Map<string, string>();
    for (const f of fang.data ?? []) if (f.einrichtung_id && !letzterFang.has(f.einrichtung_id)) letzterFang.set(f.einrichtung_id, `${datumDE(f.erlegt_am.slice(0, 10))}${f.art ? ` · ${f.art}` : ''}`);
    const jagden = new Map<string, Set<string>>();
    for (const t of jagd.data ?? []) {
      const j = t.bewegungsjagden as unknown as { titel: string; datum: string | null } | null;
      if (!t.zugeordnete_einrichtung_id || !j) continue;
      const set = jagden.get(t.zugeordnete_einrichtung_id) ?? new Set<string>();
      set.add(`${j.titel}${j.datum ? ` (${datumDE(j.datum)})` : ''}`);
      jagden.set(t.zugeordnete_einrichtung_id, set);
    }
    const zonenIds = await Promise.all(
      basis.map(async (e) => {
        const r = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: e.lng, p_lat: e.lat });
        return r.data as string | null;
      }),
    );
    setZeilen(
      basis.map((e, i) => ({
        ...e,
        erstellt: erstMap.get(e.id) ?? '',
        zone: (zonenIds[i] && zoneMap.get(zonenIds[i]!)) || '',
        zusatz:
          e.typ === 'falle' ? (letzterFang.has(e.id) ? `Letzter Fang: ${letzterFang.get(e.id)}` : 'Noch kein Fang')
          : e.typ === 'drueckjagdbock' ? (jagden.has(e.id) ? `Zugewiesen bei: ${[...jagden.get(e.id)!].join(', ')}` : 'Keiner Jagd zugewiesen')
          : '',
      })),
    );
    setFehler(null);
  }, [k.revierId]);
  useEffect(() => {
    void laden();
  }, [laden]);

  const zaehler = useMemo(() => {
    const m = new Map<string, number>();
    for (const z of zeilen ?? []) m.set(z.typ, (m.get(z.typ) ?? 0) + 1);
    return m;
  }, [zeilen]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase('de');
    const wert = (z: Zeile): string | number => {
      switch (sortSpalte) {
        case 'typ': return typIndex(z.typ);
        case 'name': return (z.name ?? '').toLocaleLowerCase('de');
        case 'zone': return z.zone.toLocaleLowerCase('de');
        case 'koord': return z.lat;
        case 'bemerkung': return (z.bemerkung ?? '').toLocaleLowerCase('de');
        case 'erstellt': return z.erstellt;
        case 'zusatz': return z.zusatz.toLocaleLowerCase('de');
      }
    };
    return (zeilen ?? [])
      .filter((z) => (!typFilter || z.typ === typFilter) && (!q || [z.name ?? '', typLabel(z.typ), z.zone, z.bemerkung ?? '', z.zusatz].some((t) => t.toLocaleLowerCase('de').includes(q))))
      .sort((a, b) => {
        const x = wert(a);
        const y = wert(b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de');
        return (r || (a.name ?? '').localeCompare(b.name ?? '', 'de')) * sortRichtung;
      });
  }, [zeilen, suche, typFilter, sortSpalte, sortRichtung]);

  const sortieren = (s: Spalte) => {
    if (s === sortSpalte) setSortRichtung((r) => (r === 1 ? -1 : 1));
    else {
      setSortSpalte(s);
      setSortRichtung(1);
    }
  };
  const kopf = (s: Spalte, text: string) => (
    <th scope="col" aria-sort={sortSpalte === s ? (sortRichtung === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => sortieren(s)}>
        {text}
        {sortSpalte === s ? (sortRichtung === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  function csvExport() {
    const feld = (t: string) => `"${t.replace(/"/g, '""')}"`;
    const kopfzeile = ['Typ', 'Name', 'Zone', 'Breitengrad', 'Längengrad', 'Bemerkung', 'Angelegt am', 'Zusatzinfo'];
    const zeilenCsv = sichtbar.map((z) => [typLabel(z.typ), z.name ?? '', z.zone, z.lat.toFixed(6), z.lng.toFixed(6), z.bemerkung ?? '', z.erstellt ? datumDE(z.erstellt.slice(0, 10)) : '', z.zusatz]);
    const text = [kopfzeile, ...zeilenCsv].map((r) => r.map(feld).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'einrichtungen.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function aufKarte(z: Zeile) {
    try {
      sessionStorage.setItem('hegewerk:kartenfokus', JSON.stringify({ id: z.id, name: z.name, typ: z.typ, bemerkung: z.bemerkung, lng: z.lng, lat: z.lat }));
    } catch {
      /* ohne Fokus */
    }
    navigieren('/karte');
  }

  const namen = (zeilen ?? []).map((z) => z.name);

  return (
    <div className="bj-vollbild">
      <header className="bj-vollbild-kopf">
        <nav aria-label="Brotkrumen">
          <button onClick={() => navigieren('/reviermanagement')}>‹ Zurück zum Reviermanagement</button>
          <span>/</span>
          <span>Alle Einrichtungen</span>
        </nav>
      </header>
      <main className="bj-vollbild-inhalt einr-tabelle-rahmen" style={{ maxWidth: 1200 }}>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        {meldung && <Hinweis art="erfolg">{meldung}</Hinweis>}
        <div className="einr-zaehler" role="group" aria-label="Nach Typ filtern">
          <button type="button" aria-pressed={typFilter === ''} onClick={() => setTypFilter('')}>
            Alle <strong>{zeilen?.length ?? 0}</strong>
          </button>
          {EINRICHTUNGSTYPEN.filter((t) => zaehler.has(t.wert)).map((t) => (
            <button key={t.wert} type="button" aria-pressed={typFilter === t.wert} onClick={() => setTypFilter(typFilter === t.wert ? '' : t.wert)}>
              {t.label} <strong>{zaehler.get(t.wert)}</strong>
            </button>
          ))}
        </div>
        <div className="einr-filter">
          <input type="search" placeholder="Suchen (Name, Zone, Bemerkung)" aria-label="Einrichtungen suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
          <Knopf variante="sekundaer" onClick={csvExport} disabled={!sichtbar.length}>
            CSV exportieren
          </Knopf>
        </div>
        {zeilen === null && !fehler && <div className="laden">Lade …</div>}
        {zeilen !== null && sichtbar.length === 0 && <Leer>Keine Einrichtungen in dieser Ansicht.</Leer>}
        {sichtbar.length > 0 && (
          <div style={{ overflowX: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <table className="einr-tab">
              <thead>
                <tr>
                  {kopf('typ', 'Typ')}
                  {kopf('name', 'Name')}
                  {kopf('zone', 'Zone')}
                  {kopf('koord', 'Koordinaten')}
                  {kopf('bemerkung', 'Bemerkung')}
                  {kopf('erstellt', 'Angelegt am')}
                  {kopf('zusatz', 'Zusatzinfo')}
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((z) => (
                  <tr key={z.id}>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} title={typLabel(z.typ)}>
                        <EinrichtungsIcon typ={z.typ} farbe={EINRICHTUNGSTYPEN.find((t) => t.wert === z.typ)?.farbe ?? '#5d6d7e'} groesse={22} />
                        <small>{typLabel(z.typ)}</small>
                      </span>
                    </td>
                    <td>{z.name ?? '–'}</td>
                    <td>{z.zone || '–'}</td>
                    <td>{koordText(z)}</td>
                    <td>{z.bemerkung ?? ''}</td>
                    <td>{z.erstellt ? datumDE(z.erstellt.slice(0, 10)) : '–'}</td>
                    <td>{z.zusatz}</td>
                    <td className="aktion">
                      <Knopf variante="ghost" onClick={() => aufKarte(z)}>
                        Auf Karte zeigen
                      </Knopf>
                      {k.istInhaber && (
                        <>
                          <Knopf variante="ghost" onClick={() => setDialog({ einr: z, start: 'bearbeiten' })}>
                            Bearbeiten
                          </Knopf>
                          <Knopf variante="gefahr" onClick={() => setDialog({ einr: z, start: 'loeschen' })}>
                            Löschen
                          </Knopf>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      {dialog && (
        <div className="einr-dialog-rahmen">
          <EinrichtungSheet
            key={`${dialog.einr.id}-${dialog.start}`}
            k={k}
            einr={dialog.einr}
            vergebeneNamen={namen}
            startAnsicht={dialog.start}
            onSchliessen={() => setDialog(null)}
            onGeaendert={(text) => {
              setDialog(null);
              setMeldung(text);
              void laden();
            }}
            onVerschieben={() => undefined}
            onPosition={async () => 'gespeichert'}
          />
        </div>
      )}
    </div>
  );
}
