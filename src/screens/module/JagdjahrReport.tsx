import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, jagdjahr } from '../../lib/zeit';
import { Einklappbar, Gruppe, Hinweis, Knopf, Leer, Segmente } from '../../components/ui';
import { Verlauf } from '../../components/diagramme';
import { Druckrahmen } from '../bewegungsjagd/BjDruck';
import type { RevierKontext } from './kontext';

type StreckeZeile = { jj: number; wildart_id: string; art: string; herkunft: 'revier' | 'bewegungsjagd'; geschlecht: string; altersklasse: string | null; anzahl: number };
type ZaehlZeile = { jj: number; wildart_id: string; sitzungen: number; maximum: number; schnitt: number; flaeche_ha: number; je100: number | null; modi: string[] };
type Daten = { revier_ha: number | null; strecke: StreckeZeile[]; zaehlung: ZaehlZeile[] };

const MODUS: Record<string, string> = { strecke: 'Strecke × Breite', zonen: 'Zonenfläche', zone: 'Zonenfläche' };
const ARTEN: Array<{ art: string; titel: string }> = [
  { art: 'abschuss', titel: 'Abschüsse' },
  { art: 'fang', titel: 'Fänge (gefangene Tiere)' },
  { art: 'fallwild', titel: 'Fallwild' },
];
const GESCHLECHT: Record<string, string> = { maennlich: 'männlich', weiblich: 'weiblich', unbekannt: 'unbekannt' };
const zahl = (n: number | null | undefined, nk = 0) => (n == null ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk }));
const jjLabel = (j: number) => jagdjahr(j).label;

type Opt = { von: number; bis: number; wildart: string; gruppe: 'wildart' | 'jahr'; herkunft: 'alle' | 'revier' | 'bewegungsjagd'; kennzahlen: boolean };

export function JagdjahrReport({ k }: { k: RevierKontext }) {
  const wildarten = useWildarten();
  const aktuell = aktuellesJagdjahr().start;
  const [o, setO] = useState<Opt>({ von: aktuell - 4, bis: aktuell, wildart: '', gruppe: 'wildart', herkunft: 'alle', kennzahlen: false });
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [druck, setDruck] = useState(false);

  useEffect(() => {
    let aktiv = true;
    setFehler(null);
    void supabase.rpc('jagdjahr_report', { p_revier_id: k.revierId, p_von_jahr: Math.min(o.von, o.bis), p_bis_jahr: Math.max(o.von, o.bis) }).then(({ data, error }) => {
      if (!aktiv) return;
      if (error) setFehler(fehlertext(error));
      else setDaten(data as unknown as Daten);
    });
    return () => {
      aktiv = false;
    };
  }, [k.revierId, o.von, o.bis]);

  const jahre = useMemo(() => {
    const v = Math.min(o.von, o.bis);
    const b = Math.max(o.von, o.bis);
    return Array.from({ length: b - v + 1 }, (_, i) => v + i);
  }, [o.von, o.bis]);
  const name = (id: string) => wildartName(wildarten, id);
  const strecke = useMemo(
    () => (daten?.strecke ?? []).filter((r) => (!o.wildart || r.wildart_id === o.wildart) && (o.herkunft === 'alle' || r.herkunft === o.herkunft)),
    [daten, o.wildart, o.herkunft],
  );
  const zaehl = useMemo(() => (daten?.zaehlung ?? []).filter((r) => !o.wildart || r.wildart_id === o.wildart), [daten, o.wildart]);
  const zaehlArten = useMemo(() => [...new Set(zaehl.map((r) => r.wildart_id))].sort((a, b) => name(a).localeCompare(name(b), 'de')), [zaehl, wildarten]); // eslint-disable-line react-hooks/exhaustive-deps
  const gewaehlteArt = zaehlArten[0] ?? '';

  function csv() {
    const z = (v: string | number | null) => (v == null ? '' : String(v).replace('.', ',').replace(/;/g, ','));
    const zeilen = [
      ['Teil', 'Jagdjahr', 'Wildart', 'Art', 'Herkunft', 'Geschlecht', 'Altersklasse', 'Anzahl', 'Zählungen', 'Maximum', 'Durchschnitt', 'Fläche ha', 'Wert je 100 ha', 'Flächenmodus'],
      ...strecke.map((r) => ['Strecke', jjLabel(r.jj), name(r.wildart_id), r.art, r.herkunft === 'revier' ? 'Ansitz/Pirsch' : 'Bewegungsjagd', GESCHLECHT[r.geschlecht] ?? r.geschlecht, r.altersklasse ?? '', r.anzahl, '', '', '', '', '', ''].map((x) => z(x as string | number))),
      ...zaehl.map((r) => ['Zählung', jjLabel(r.jj), name(r.wildart_id), '', '', '', '', '', r.sitzungen, r.maximum, r.schnitt, r.flaeche_ha, r.je100, r.modi.map((m) => MODUS[m] ?? m).join(' + ')].map((x) => z(x as string | number | null))),
    ];
    const text = '﻿' + zeilen.map((r) => r.join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `jagdjahre-${jjLabel(jahre[0]!).replace('/', '-')}_${jjLabel(jahre[jahre.length - 1]!).replace('/', '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const inhalt = (d: Daten, ausdruck: boolean) => (
    <Inhalt d={d} o={o} jahre={jahre} strecke={strecke} zaehl={zaehl} zaehlArten={zaehlArten} diagrammArt={gewaehlteArt} name={name} ausdruck={ausdruck} />
  );

  return (
    <div className="monitoring-box">
      <div className="filter-leiste">
        <label className="filter">
          <span>Von</span>
          <select value={o.von} onChange={(e) => setO({ ...o, von: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => aktuell - i).map((j) => <option key={j} value={j}>{jjLabel(j)}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Bis</span>
          <select value={o.bis} onChange={(e) => setO({ ...o, bis: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => aktuell - i).map((j) => <option key={j} value={j}>{jjLabel(j)}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Wildart</span>
          <select value={o.wildart} onChange={(e) => setO({ ...o, wildart: e.target.value })}>
            <option value="">Alle</option>
            {wildarten.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <Segmente label="Gruppierung" wert={o.gruppe} onAendern={(g) => setO({ ...o, gruppe: g })} optionen={[{ wert: 'wildart', label: 'Nach Wildart' }, { wert: 'jahr', label: 'Nach Jagdjahr' }]} />
        <Segmente label="Herkunft" wert={o.herkunft} onAendern={(h) => setO({ ...o, herkunft: h })} optionen={[{ wert: 'alle', label: 'Alle' }, { wert: 'revier', label: 'Ansitz/Pirsch' }, { wert: 'bewegungsjagd', label: 'Bewegungsjagd' }]} />
        <label className="filter" style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={o.kennzahlen} onChange={(e) => setO({ ...o, kennzahlen: e.target.checked })} /> <span>Kennzahlen</span>
        </label>
        <span style={{ display: 'flex', gap: 6 }}>
          <Knopf variante="ghost" disabled={!daten} onClick={() => setDruck(true)}>Drucken</Knopf>
          <Knopf variante="ghost" disabled={!daten} onClick={csv}>CSV</Knopf>
        </span>
      </div>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {!daten && !fehler && <div className="laden">Lade …</div>}
      {daten && inhalt(daten, false)}
      {druck && daten && (
        <Druckrahmen querformat onZu={() => setDruck(false)}>
          <section className="bj-druck-seite quer" style={{ color: '#000', background: '#fff' }}>
            <h1 style={{ color: '#000' }}>Jagdjahr-Report · {k.revierName}</h1>
            <p className="art">
              Jagdjahre {jjLabel(jahre[0]!)} bis {jjLabel(jahre[jahre.length - 1]!)}
              {o.wildart ? ` · ${name(o.wildart)}` : ''} · Erstellt am {new Date().toLocaleDateString('de-DE')}
            </p>
            {inhalt(daten, true)}
          </section>
        </Druckrahmen>
      )}
    </div>
  );
}

function Leer2({ a, children }: { a: boolean; children: React.ReactNode }) {
  return a ? <p style={{ color: '#000' }}>{children}</p> : <Leer>{children}</Leer>;
}

// Im Druck: schlichter Block auf weißem Blatt (die Bildschirm-Gruppe ist im Dunkelmodus dunkel)
function Block({ titel, fuss, ausdruck, children }: { titel: string; fuss?: React.ReactNode; ausdruck: boolean; children: React.ReactNode }) {
  if (!ausdruck) return <Gruppe titel={titel} fuss={fuss}>{children}</Gruppe>;
  return (
    <section style={{ color: '#000', background: '#fff', marginTop: 10 }}>
      <h2 className="klein" style={{ color: '#000' }}>{titel}</h2>
      {children}
      {fuss && <small className="art" style={{ color: '#333' }}>{fuss}</small>}
    </section>
  );
}

function Inhalt({ d, o, jahre, strecke, zaehl, zaehlArten, diagrammArt, name, ausdruck }: {
  d: Daten; o: Opt; jahre: number[]; strecke: StreckeZeile[]; zaehl: ZaehlZeile[]; zaehlArten: string[]; diagrammArt: string; name: (id: string) => string; ausdruck: boolean;
}) {
  const [art, setArt] = useState(diagrammArt);
  const aktArt = zaehlArten.includes(art) ? art : diagrammArt;
  const tab = ausdruck ? 'bj-druck-liste' : 'tabelle';
  const rahmen = (c: React.ReactNode) => (ausdruck ? c : <div className="tabelle-rahmen">{c}</div>);
  const modiAlle = new Set(zaehl.flatMap((r) => r.modi));
  const verlauf = jahre.map((j) => ({ label: jjLabel(j).slice(2), wert: zaehl.find((r) => r.jj === j && r.wildart_id === aktArt)?.je100 ?? 0 }));

  // Strecke: Zeilen/Spalten je Gruppierung
  const streckeTabelle = (a: string) => {
    const zs = strecke.filter((r) => r.art === a);
    if (!zs.length) return null;
    const arten = [...new Set(zs.map((r) => r.wildart_id))].sort((x, y) => name(x).localeCompare(name(y), 'de'));
    const n = (w?: string, j?: number) => zs.filter((r) => (w == null || r.wildart_id === w) && (j == null || r.jj === j)).reduce((s, r) => s + r.anzahl, 0);
    const zeilen = o.gruppe === 'wildart' ? arten.map((w) => ({ k: w, l: name(w) })) : jahre.map((j) => ({ k: String(j), l: jjLabel(j) }));
    const spalten = o.gruppe === 'wildart' ? jahre.map((j) => ({ k: String(j), l: jjLabel(j) })) : arten.map((w) => ({ k: w, l: name(w) }));
    const wert = (z: string, s: string) => (o.gruppe === 'wildart' ? n(z, Number(s)) : n(s, Number(z)));
    const zSumme = (z: string) => (o.gruppe === 'wildart' ? n(z) : n(undefined, Number(z)));
    const sSumme = (s: string) => (o.gruppe === 'wildart' ? n(undefined, Number(s)) : n(s));
    // Detail: Wildart × Geschlecht/Altersklasse je Jagdjahr
    const detail = new Map<string, Map<number, number>>();
    for (const r of zs) {
      const key = `${r.wildart_id}|${GESCHLECHT[r.geschlecht] ?? r.geschlecht}${r.altersklasse ? ` · ${r.altersklasse}` : ''}`;
      const m = detail.get(key) ?? new Map<number, number>();
      m.set(r.jj, (m.get(r.jj) ?? 0) + r.anzahl);
      detail.set(key, m);
    }
    const detailTab = (
      <table className={tab}>
        <thead>
          <tr>
            <th scope="col">Wildart · Geschlecht · Alter</th>
            {jahre.map((j) => <th key={j} scope="col" className="zahl">{jjLabel(j)}</th>)}
            <th scope="col" className="zahl">Summe</th>
          </tr>
        </thead>
        <tbody>
          {[...detail.entries()].sort((x, y) => name(x[0].split('|')[0]!).localeCompare(name(y[0].split('|')[0]!), 'de') || x[0].localeCompare(y[0], 'de')).map(([key, m]) => (
            <tr key={key}>
              <th scope="row">{name(key.split('|')[0]!)} · {key.split('|')[1]}</th>
              {jahre.map((j) => <td key={j} className="zahl">{m.get(j) ?? '–'}</td>)}
              <td className="zahl"><strong>{[...m.values()].reduce((s, v) => s + v, 0)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    return (
      <Fragment key={a}>
        <h3 style={{ margin: '10px 0 4px', fontSize: 'var(--fs-base)', color: ausdruck ? '#000' : undefined }}>{ARTEN.find((x) => x.art === a)!.titel}</h3>
        {rahmen(
          <table className={tab}>
            <thead>
              <tr>
                <th scope="col">{o.gruppe === 'wildart' ? 'Wildart' : 'Jagdjahr'}</th>
                {spalten.map((s) => <th key={s.k} scope="col" className="zahl">{s.l}</th>)}
                <th scope="col" className="zahl">Summe</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <tr key={z.k}>
                  <th scope="row">{z.l}</th>
                  {spalten.map((s) => <td key={s.k} className={`zahl ${wert(z.k, s.k) ? '' : 'leise'}`}>{wert(z.k, s.k) || '–'}</td>)}
                  <td className="zahl"><strong>{zSumme(z.k)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Summe</th>
                {spalten.map((s) => <td key={s.k} className="zahl"><strong>{sSumme(s.k)}</strong></td>)}
                <td className="zahl"><strong>{n()}</strong></td>
              </tr>
            </tfoot>
          </table>,
        )}
        {ausdruck ? <div style={{ marginTop: 6 }}>{rahmen(detailTab)}</div> : <Einklappbar variante="inline" titel="Aufschlüsselung nach Geschlecht und Altersklasse">{rahmen(detailTab)}</Einklappbar>}
      </Fragment>
    );
  };

  const hatStrecke = ARTEN.some((a) => strecke.some((r) => r.art === a.art));
  const zeilenB = [...zaehl].sort((x, y) => (o.gruppe === 'wildart' ? name(x.wildart_id).localeCompare(name(y.wildart_id), 'de') || x.jj - y.jj : x.jj - y.jj || name(x.wildart_id).localeCompare(name(y.wildart_id), 'de')));

  // Teil C: Kennzahlen je Wildart (Abschüsse + gefangene Tiere über den Zeitraum)
  const kennz = useMemo(() => {
    const arten = [...new Set([...strecke.map((r) => r.wildart_id), ...zaehl.map((r) => r.wildart_id)])];
    return arten
      .map((w) => {
        const s = strecke.filter((r) => r.wildart_id === w && r.art !== 'fallwild').reduce((a, r) => a + r.anzahl, 0);
        const zz = zaehl.filter((r) => r.wildart_id === w);
        const jahreMitZaehlung = zz.length;
        const schnittSumme = zz.reduce((a, r) => a + r.schnitt, 0);
        const sMitZaehl = strecke.filter((r) => r.wildart_id === w && r.art !== 'fallwild' && zz.some((z) => z.jj === r.jj)).reduce((a, r) => a + r.anzahl, 0);
        return { w, s, je100: d.revier_ha ? (s / d.revier_ha) * 100 / Math.max(1, jahre.length) : null, verhaeltnis: jahreMitZaehlung && schnittSumme > 0 ? sMitZaehl / schnittSumme : null };
      })
      .sort((a, b) => name(a.w).localeCompare(name(b.w), 'de'));
  }, [strecke, zaehl, d.revier_ha, jahre.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Block ausdruck={ausdruck} titel="A · Strecke">
        <div style={{ padding: '4px var(--abstand) 8px' }}>
          {hatStrecke ? ARTEN.map((a) => streckeTabelle(a.art)) : <Leer2 a={ausdruck}>Keine Strecke im gewählten Zeitraum.</Leer2>}
        </div>
      </Block>

      <Block ausdruck={ausdruck} titel="B · Wildtiererfassung" fuss="Nur abgeschlossene Zählungen. Zählwert = Summe je Zählung über alle Zonen; Wert je 100 ha = gezählte Stücke ÷ gezählte Fläche.">
        <div style={{ padding: '4px var(--abstand) 8px' }}>
          {modiAlle.size > 1 && (ausdruck ? <p style={{ margin: '4px 0', color: '#000' }}><strong>Hinweis:</strong> Gemischte Flächenmodi, die Werte je 100 ha sind nicht streng vergleichbar.</p> : <Hinweis art="warnung">Gemischte Flächenmodi: Die Werte je 100 ha sind nicht streng vergleichbar.</Hinweis>)}
          {zeilenB.length === 0 ? (
            <Leer2 a={ausdruck}>Keine abgeschlossenen Zählungen im gewählten Zeitraum.</Leer2>
          ) : (
            rahmen(
              <table className={tab}>
                <thead>
                  <tr>
                    <th scope="col">{o.gruppe === 'wildart' ? 'Wildart' : 'Jagdjahr'}</th>
                    <th scope="col">{o.gruppe === 'wildart' ? 'Jagdjahr' : 'Wildart'}</th>
                    <th scope="col" className="zahl">Zählungen</th>
                    <th scope="col" className="zahl">Max</th>
                    <th scope="col" className="zahl">Ø</th>
                    <th scope="col" className="zahl">Fläche (ha)</th>
                    <th scope="col" className="zahl">je 100 ha</th>
                    <th scope="col">Flächenmodus</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilenB.map((r) => (
                    <tr key={`${r.jj}${r.wildart_id}`}>
                      <th scope="row">{o.gruppe === 'wildart' ? name(r.wildart_id) : jjLabel(r.jj)}</th>
                      <td>{o.gruppe === 'wildart' ? jjLabel(r.jj) : name(r.wildart_id)}</td>
                      <td className="zahl">{r.sitzungen}</td>
                      <td className="zahl">{r.maximum}</td>
                      <td className="zahl">{zahl(r.schnitt, 1)}</td>
                      <td className="zahl">{zahl(r.flaeche_ha, 0)}</td>
                      <td className="zahl"><strong>{zahl(r.je100, 2)}</strong></td>
                      <td>{ausdruck ? r.modi.map((m) => MODUS[m] ?? m).join(' + ') : r.modi.map((m) => <span key={m} className="badge">{MODUS[m] ?? m}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>,
            )
          )}
          {aktArt && (
            <div className="diagramm-block" style={{ breakInside: 'avoid' }}>
              {!ausdruck && (
                <label className="filter">
                  <span>Diagramm</span>
                  <select value={aktArt} onChange={(e) => setArt(e.target.value)}>
                    {zaehlArten.map((w) => <option key={w} value={w}>{name(w)}</option>)}
                  </select>
                </label>
              )}
              <strong style={{ fontSize: 'var(--fs-md)' }}>Zählwert je 100 ha über die Jagdjahre · {name(aktArt)}</strong>
              <Verlauf titel={`${name(aktArt)}: Zählwert je 100 ha`} punkte={verlauf} />
            </div>
          )}
        </div>
      </Block>

      {o.kennzahlen && (
        <Block ausdruck={ausdruck} titel="C · Kennzahlen" fuss={`Strecke = Abschüsse und gefangene Tiere ohne Fallwild. Revierfläche ${zahl(d.revier_ha, 0)} ha. „je 100 ha“ ist der Jahresdurchschnitt im Zeitraum; Verhältnis = Strecke ÷ Summe der Ø-Zählwerte (nur Jagdjahre mit Zählung).`}>
          <div style={{ padding: '4px var(--abstand) 8px' }}>
            {rahmen(
              <table className={tab}>
                <thead>
                  <tr>
                    <th scope="col">Wildart</th>
                    <th scope="col" className="zahl">Strecke gesamt</th>
                    <th scope="col" className="zahl">Strecke je 100 ha Revier / Jahr</th>
                    <th scope="col" className="zahl">Strecke ÷ Zählwert</th>
                  </tr>
                </thead>
                <tbody>
                  {kennz.map((r) => (
                    <tr key={r.w}>
                      <th scope="row">{name(r.w)}</th>
                      <td className="zahl">{r.s}</td>
                      <td className="zahl">{zahl(r.je100, 2)}</td>
                      <td className="zahl">{zahl(r.verhaeltnis, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>,
            )}
          </div>
        </Block>
      )}
    </>
  );
}
