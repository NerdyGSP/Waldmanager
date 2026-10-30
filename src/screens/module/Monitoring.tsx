import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, datumDE, letzteJagdjahre, type Jagdjahr } from '../../lib/zeit';
import { navigieren } from '../../lib/router';
import type { Database } from '../../lib/database.types';
import { Gruppe, Hinweis, Knopf, Leer, Seite, Segmente } from '../../components/ui';
import { Balken, Verlauf, VerlaufMehrere, type Serie } from '../../components/diagramme';
import { Symbol } from '../../components/symbole';
import type { RevierKontext } from './kontext';

type Vergleich = Database['public']['Functions']['quervergleich']['Returns'][number];
type Sitzungssumme = { id: string; datum: string; arten: Record<string, number>; modus: string; breite: number; strecke: number | null; flaeche: number | null };

export function Monitoring({ k, breit = false, abgedockt = false }: { k: RevierKontext; breit?: boolean; abgedockt?: boolean }) {
  const voll = window.location.pathname.startsWith('/monitoring/voll');
  const wildarten = useWildarten();
  const [jahr, setJahr] = useState<Jagdjahr>(aktuellesJagdjahr());
  const [ansicht, setAnsicht] = useState<'revier' | 'vergleich'>('revier');
  const [sitzungen, setSitzungen] = useState<Sitzungssumme[]>([]);
  const [strecke, setStrecke] = useState<Record<string, number>>({});
  const [beobachtungen, setBeobachtungen] = useState(0);
  const [vergleich, setVergleich] = useState<Vergleich[]>([]);
  const [hatFreigaben, setHatFreigaben] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [verlaufArt, setVerlaufArt] = useState('rehwild');

  useEffect(() => {
    void (async () => {
      setFehler(null);
      const [s, a, b, v, f] = await Promise.all([
        supabase
          .from('zaehlsitzungen')
          .select('id, datum, flaechenmodus, streifenbreite_m, strecke_km, flaeche_ha, zaehlungen(wildart_id, anzahl, geloescht_am)')
          .eq('revier_id', k.revierId)
          .eq('status', 'abgeschlossen')
          .is('geloescht_am', null)
          .gte('datum', jahr.von)
          .lte('datum', jahr.bis)
          .order('datum'),
        supabase
          .from('abschuesse')
          .select('wildart_id')
          .or('art.eq.abschuss,and(art.eq.fang,fang_ergebnis.eq.gefangen)')
          .eq('revier_id', k.revierId)
          .is('geloescht_am', null)
          .gte('erlegt_am', `${jahr.von}T00:00:00`)
          .lte('erlegt_am', `${jahr.bis}T23:59:59`),
        supabase
          .from('beobachtungen')
          .select('id', { count: 'exact', head: true })
          .eq('revier_id', k.revierId)
          .is('geloescht_am', null)
          .gte('zeitpunkt', `${jahr.von}T00:00:00`)
          .lte('zeitpunkt', `${jahr.bis}T23:59:59`),
        supabase.rpc('quervergleich', { p_revier_id: k.revierId, p_von: jahr.von, p_bis: jahr.bis }),
        supabase.from('freigaben').select('wildart_id', { count: 'exact', head: true }).eq('revier_id', k.revierId),
      ]);
      const err = s.error ?? a.error ?? b.error ?? v.error ?? f.error;
      if (err) setFehler(fehlertext(err));

      setSitzungen(
        (s.data ?? []).map((x) => {
          const arten: Record<string, number> = {};
          for (const z of x.zaehlungen) if (!z.geloescht_am) arten[z.wildart_id] = (arten[z.wildart_id] ?? 0) + z.anzahl;
          return { id: x.id, datum: x.datum, arten, modus: x.flaechenmodus, breite: x.streifenbreite_m, strecke: x.strecke_km === null ? null : Number(x.strecke_km), flaeche: x.flaeche_ha === null ? null : Number(x.flaeche_ha) };
        }),
      );
      const st: Record<string, number> = {};
      for (const x of a.data ?? []) if (x.wildart_id) st[x.wildart_id] = (st[x.wildart_id] ?? 0) + 1;
      setStrecke(st);
      setBeobachtungen(b.count ?? 0);
      setVergleich(v.data ?? []);
      setHatFreigaben((f.count ?? 0) > 0);
    })();
  }, [k.revierId, jahr]);

  const gezaehlteArten = useMemo(() => {
    const ids = new Set(sitzungen.flatMap((s) => Object.keys(s.arten)));
    return wildarten.filter((w) => ids.has(w.id));
  }, [sitzungen, wildarten]);

  useEffect(() => {
    if (gezaehlteArten.length && !gezaehlteArten.some((w) => w.id === verlaufArt)) setVerlaufArt(gezaehlteArten[0]!.id);
  }, [gezaehlteArten, verlaufArt]);

  const maxJeArt = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sitzungen) for (const [art, n] of Object.entries(s.arten)) m[art] = Math.max(m[art] ?? 0, n);
    return m;
  }, [sitzungen]);

  // Höchstwerte je 100 ha: Bezug ist die gezählte Fläche der jeweiligen Zählung (Revierfläche nur als Ersatz, wenn keine festgeschrieben ist)
  const maxJe100 = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sitzungen) {
      const fl = s.flaeche ?? k.flaecheHa;
      if (!fl) continue;
      for (const [art, n] of Object.entries(s.arten)) m[art] = Math.max(m[art] ?? 0, (n / fl) * 100);
    }
    return m;
  }, [sitzungen, k.flaecheHa]);
  const gemischt = new Set(sitzungen.map((x) => x.modus)).size > 1;

  const streckeSumme = Object.values(strecke).reduce((a, n) => a + n, 0);

  return (
    <Seite titel="Monitoring" untertitel={`Jagdjahr ${jahr.label}`} aktion={breit && !abgedockt ? <Anordnung voll={voll} /> : undefined}>
      <div className="filter-leiste">
        <label className="filter">
          <span>Jagdjahr</span>
          <select value={jahr.start} onChange={(e) => setJahr(letzteJagdjahre().find((j) => j.start === Number(e.target.value)) ?? jahr)}>
            {letzteJagdjahre().map((j) => (
              <option key={j.start} value={j.start}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <Segmente
          label="Ansicht"
          wert={ansicht}
          onAendern={setAnsicht}
          optionen={[
            { wert: 'revier', label: 'Mein Revier' },
            { wert: 'vergleich', label: 'Quervergleich' },
          ]}
        />
      </div>

      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {ansicht === 'revier' ? (
        <div className="monitoring-box">
          <div className="monitoring-raster">
          <div className="kennzahlen breit">
            <Kennzahl wert={sitzungen.length} label="Zählungen" />
            <Kennzahl wert={beobachtungen} label="Beobachtungen" />
            <Kennzahl wert={streckeSumme} label="Abschüsse" />
            <Kennzahl
              wert={k.flaecheHa ? (streckeSumme / k.flaecheHa) * 100 : null}
              nachkomma={1}
              label="Abschüsse je 100 ha"
            />
            <Kennzahl wert={gezaehlteArten.length} label="Gezählte Wildarten" />
            <Kennzahl wert={Object.values(maxJeArt).reduce((a, n) => a + n, 0)} label="Summe der Höchstwerte" />
            <Kennzahl
              wert={Object.keys(maxJe100).length ? Object.values(maxJe100).reduce((a, n) => a + n, 0) : null}
              nachkomma={1}
              label="Höchstwerte je 100 ha"
            />
          </div>

          {breit && (
            <div className="breit">
              <Jahresvergleich k={k} wildarten={wildarten} />
            </div>
          )}

          {sitzungen.length > 0 && (
            <Gruppe titel="Gezählte Fläche je Zählung" fuss={gemischt ? 'Achtung: Zählungen mit Strecke × Breite und mit Zonenfläche sind nicht streng vergleichbar.' : undefined}>
              <div className="tabelle-rahmen" style={{ border: 0 }}>
                <table className="tabelle">
                  <thead>
                    <tr>
                      <th scope="col">Datum</th>
                      <th scope="col">Modus</th>
                      <th scope="col" className="zahl">Strecke</th>
                      <th scope="col" className="zahl">Fläche</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sitzungen.map((x) => (
                      <tr key={x.id}>
                        <th scope="row">{datumDE(x.datum)}</th>
                        <td>
                          <span className={`badge ${x.modus === 'strecke' ? 'badge-orange' : 'badge-gruen'}`}>{x.modus === 'strecke' ? `Strecke × ${x.breite} m` : 'Zonenfläche'}</span>
                        </td>
                        <td className="zahl">{x.strecke !== null ? `${x.strecke.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km` : '–'}</td>
                        <td className="zahl">{x.flaeche !== null ? `${x.flaeche.toLocaleString('de-DE')} ha` : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Gruppe>
          )}

          <Gruppe titel="Zählverlauf">
            {gezaehlteArten.length === 0 ? (
              <Leer>Noch keine abgeschlossenen Zählungen in diesem Jagdjahr.</Leer>
            ) : (
              <div className="diagramm-block">
                <select className="diagramm-wahl" value={verlaufArt} onChange={(e) => setVerlaufArt(e.target.value)} aria-label="Wildart im Verlauf">
                  {gezaehlteArten.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <Verlauf
                  titel={`Gezählte ${wildartName(wildarten, verlaufArt)} je Zählung`}
                  punkte={sitzungen.map((s) => ({
                    label: new Date(`${s.datum}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                    wert: s.arten[verlaufArt] ?? 0,
                  }))}
                />
              </div>
            )}
          </Gruppe>

          {gezaehlteArten.length > 0 && (
            <Gruppe titel="Höchster Zählwert je Wildart" fuss="Je 100 ha bezogen auf die gezählte Fläche der jeweiligen Zählung.">
              <div className="diagramm-block">
                <Balken
                  zeilen={gezaehlteArten.map((w) => ({
                    label: w.name,
                    wert: maxJeArt[w.id] ?? 0,
                    zusatz: maxJe100[w.id] !== undefined ? ` · ${maxJe100[w.id]!.toLocaleString('de-DE', { maximumFractionDigits: 1 })} / 100 ha` : undefined,
                  }))}
                />
              </div>
            </Gruppe>
          )}

          <Gruppe titel="Strecke je Wildart">
            {streckeSumme === 0 ? (
              <Leer>Keine Abschüsse in diesem Jagdjahr.</Leer>
            ) : (
              <div className="diagramm-block">
                <Balken
                  zeilen={Object.entries(strecke)
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, n]) => ({ label: wildartName(wildarten, id), wert: n }))}
                />
              </div>
            )}
          </Gruppe>
          </div>
        </div>
      ) : (
        <div className="monitoring-box">
          <Quervergleich daten={vergleich} hatFreigaben={hatFreigaben} />
        </div>
      )}
    </Seite>
  );
}

function Anordnung({ voll }: { voll: boolean }) {
  return (
    <div className="monitoring-werkzeuge">
      <button
        className="knopf knopf-sekundaer klein"
        onClick={() => navigieren(voll ? '/monitoring' : '/monitoring/voll')}
        title={voll ? 'Zurück zur Seitenleiste mit Karte' : 'Monitoring über die ganze Breite anzeigen'}
      >
        {voll ? 'Mit Karte' : 'Vollbreite'}
      </button>
      <button
        className="knopf knopf-sekundaer klein"
        onClick={() => window.open('/monitoring/fenster', 'hegewerk-monitoring', 'popup=yes,width=1500,height=950')}
        title="Monitoring in einem eigenen Fenster öffnen, z. B. auf dem zweiten Bildschirm"
      >
        <Symbol name="abdocken" /> Abdocken
      </button>
    </div>
  );
}

type Sitzung = { id: string; datum: string; arten: Record<string, number>; modus: string; flaeche: number | null };

function tagImJagdjahr(datum: string, start: number): number {
  const t = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.max(0, Math.min(365, Math.round((t(datum) - Date.UTC(start, 3, 1)) / 86400000)));
}

/** Mehrjahresvergleich: Zählverläufe und kumulierte Strecke mehrerer Jagdjahre übereinander */
function Jahresvergleich({ k, wildarten }: { k: RevierKontext; wildarten: ReturnType<typeof useWildarten> }) {
  const jahre = useMemo(() => letzteJagdjahre(6), []);
  const [gewaehlt, setGewaehlt] = useState<number[]>(() => jahre.slice(0, 3).map((j) => j.start));
  const [kennzahl, setKennzahl] = useState<'zaehlung' | 'strecke'>('zaehlung');
  const [bezug, setBezug] = useState<'stueck' | 'je100'>('stueck');
  const [art, setArt] = useState('');
  const [sitzungen, setSitzungen] = useState<Sitzung[]>([]);
  const [abschuesse, setAbschuesse] = useState<Array<{ wildart_id: string; erlegt_am: string }>>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let aktiv = true;
    const von = jahre[jahre.length - 1]!.von;
    setLaedt(true);
    void (async () => {
      const [s, a] = await Promise.all([
        supabase
          .from('zaehlsitzungen')
          .select('id, datum, flaechenmodus, streifenbreite_m, strecke_km, flaeche_ha, zaehlungen(wildart_id, anzahl, geloescht_am)')
          .eq('revier_id', k.revierId)
          .eq('status', 'abgeschlossen')
          .is('geloescht_am', null)
          .gte('datum', von)
          .order('datum'),
        supabase
          .from('abschuesse')
          .select('wildart_id, erlegt_am')
          .or('art.eq.abschuss,and(art.eq.fang,fang_ergebnis.eq.gefangen)')
          .eq('revier_id', k.revierId)
          .is('geloescht_am', null)
          .gte('erlegt_am', `${von}T00:00:00`)
          .order('erlegt_am')
          .limit(5000),
      ]);
      if (!aktiv) return;
      const err = s.error ?? a.error;
      setFehler(err ? fehlertext(err) : null);
      setSitzungen(
        (s.data ?? []).map((x) => {
          const arten: Record<string, number> = {};
          for (const z of x.zaehlungen) if (!z.geloescht_am) arten[z.wildart_id] = (arten[z.wildart_id] ?? 0) + z.anzahl;
          return { id: x.id, datum: x.datum, arten, modus: x.flaechenmodus, flaeche: x.flaeche_ha === null ? null : Number(x.flaeche_ha) };
        }),
      );
      setAbschuesse((a.data ?? []).filter((x): x is { wildart_id: string; erlegt_am: string } => !!x.wildart_id));
      setLaedt(false);
    })();
    return () => {
      aktiv = false;
    };
  }, [k.revierId, jahre]);

  const verfuegbar = useMemo(() => {
    const ids = new Set([...sitzungen.flatMap((s) => Object.keys(s.arten)), ...abschuesse.map((x) => x.wildart_id)]);
    return wildarten.filter((w) => ids.has(w.id));
  }, [sitzungen, abschuesse, wildarten]);

  useEffect(() => {
    if (verfuegbar.length && !verfuegbar.some((w) => w.id === art)) setArt(verfuegbar.find((w) => w.id === 'rehwild')?.id ?? verfuegbar[0]!.id);
  }, [verfuegbar, art]);

  // Je 100 ha: Bezug ist die gezählte Fläche der Zählung (Ersatz: Revierfläche)
  const faktorFuer = (s: Sitzung) => {
    const fl = s.flaeche ?? k.flaecheHa;
    return bezug === 'je100' && fl ? 100 / fl : 1;
  };
  const faktor = bezug === 'je100' && k.flaecheHa ? 100 / k.flaecheHa : 1;
  const imJahr = (datum: string, start: number) => datum >= `${start}-04-01` && datum <= `${start + 1}-03-31`;

  const gewaehlteJahre = jahre.filter((j) => gewaehlt.includes(j.start)).sort((a, b) => b.start - a.start);

  const serien: Serie[] = gewaehlteJahre.map((j) => {
    if (kennzahl === 'zaehlung') {
      return {
        id: String(j.start),
        label: `Jagdjahr ${j.label}`,
        punkte: sitzungen
          .filter((s) => imJahr(s.datum, j.start) && s.arten[art] !== undefined)
          .map((s) => ({ x: tagImJagdjahr(s.datum, j.start), wert: (s.arten[art] ?? 0) * faktorFuer(s), titel: datumDE(s.datum) })),
      };
    }
    let summe = 0;
    const punkte = [{ x: 0, wert: 0, titel: '1. April' }];
    for (const a of abschuesse) {
      const tag = a.erlegt_am.slice(0, 10);
      if (a.wildart_id !== art || !imJahr(tag, j.start)) continue;
      summe++;
      punkte.push({ x: tagImJagdjahr(tag, j.start), wert: summe * faktor, titel: datumDE(tag) });
    }
    return { id: String(j.start), label: `Jagdjahr ${j.label}`, punkte };
  });

  // Kennzahlen je Jagdjahr
  const tabelle = gewaehlteJahre.map((j) => {
    const s = sitzungen.filter((x) => imJahr(x.datum, j.start));
    const werte = s.filter((x) => x.arten[art] !== undefined).map((x) => (x.arten[art] as number) * faktorFuer(x));
    const strecke = abschuesse.filter((x) => imJahr(x.erlegt_am.slice(0, 10), j.start));
    return {
      jahr: j,
      zaehlungen: werte.length,
      max: werte.length ? Math.max(...werte) : null,
      schnitt: werte.length ? werte.reduce((a, n) => a + n, 0) / werte.length : null,
      streckeArt: strecke.filter((x) => x.wildart_id === art).length,
      streckeAlle: strecke.length,
    };
  });

  const einheit = bezug === 'je100' ? ' je 100 ha' : ' Stück';
  const zahl = (n: number | null, nk = 1) => (n === null ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: nk }));
  const gemischtJahre = new Set(sitzungen.filter((x) => gewaehlteJahre.some((j) => imJahr(x.datum, j.start))).map((x) => x.modus)).size > 1;

  return (
    <Gruppe titel="Jahresvergleich" fuss="Zählungen: Summe aller Zonen je abgeschlossener Zählung. Strecke: Abschüsse der Wildart, kumuliert ab 1. April.">
      <div className="diagramm-block">
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <div className="filter-leiste">
          <label className="filter">
            <span>Wildart</span>
            <select value={art} onChange={(e) => setArt(e.target.value)} aria-label="Wildart im Jahresvergleich">
              {verfuegbar.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <Segmente
            label="Kennzahl"
            wert={kennzahl}
            onAendern={setKennzahl}
            optionen={[
              { wert: 'zaehlung', label: 'Zählverlauf' },
              { wert: 'strecke', label: 'Strecke' },
            ]}
          />
          {k.flaecheHa && (
            <Segmente
              label="Bezug"
              wert={bezug}
              onAendern={setBezug}
              optionen={[
                { wert: 'stueck', label: 'Stück' },
                { wert: 'je100', label: 'je 100 ha' },
              ]}
            />
          )}
        </div>
        <fieldset className="jahreswahl" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="visuell-versteckt">Jagdjahre im Vergleich</legend>
          {jahre.map((j) => (
            <label key={j.start}>
              <input
                type="checkbox"
                checked={gewaehlt.includes(j.start)}
                onChange={(e) => setGewaehlt((alt) => (e.target.checked ? [...alt, j.start] : alt.filter((x) => x !== j.start)))}
              />
              {j.label}
            </label>
          ))}
        </fieldset>
        {bezug === 'je100' && gemischtJahre && (
          <Hinweis art="warnung">Die gewählten Jagdjahre enthalten Zählungen mit Strecke × Breite und mit Zonenfläche. Die Werte je 100 ha sind nicht streng vergleichbar.</Hinweis>
        )}
        {laedt ? (
          <Leer>Daten werden geladen …</Leer>
        ) : serien.every((s) => s.punkte.length <= 1) ? (
          <Leer>Für diese Auswahl liegen keine Werte vor.</Leer>
        ) : (
          <VerlaufMehrere
            serien={serien}
            titel={`${wildartName(wildarten, art)}: ${kennzahl === 'zaehlung' ? 'Zählverlauf' : 'kumulierte Strecke'} je Jagdjahr`}
            hervorgehoben={String(gewaehlteJahre[0]?.start)}
          />
        )}
        {tabelle.length > 0 && (
          <div className="tabelle-rahmen">
            <table className="tabelle">
              <thead>
                <tr>
                  <th scope="col">Jagdjahr</th>
                  <th scope="col" className="zahl">Zählungen</th>
                  <th scope="col" className="zahl">Höchstwert{einheit}</th>
                  <th scope="col" className="zahl">Ø{einheit}</th>
                  <th scope="col" className="zahl">Strecke {wildartName(wildarten, art)}</th>
                  <th scope="col" className="zahl">Strecke gesamt</th>
                </tr>
              </thead>
              <tbody>
                {tabelle.map((z) => (
                  <tr key={z.jahr.start}>
                    <th scope="row">{z.jahr.label}</th>
                    <td className="zahl">{z.zaehlungen}</td>
                    <td className="zahl stark">{zahl(z.max, 1)}</td>
                    <td className="zahl">{zahl(z.schnitt, 1)}</td>
                    <td className="zahl">{z.streckeArt}</td>
                    <td className="zahl">{z.streckeAlle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Gruppe>
  );
}

function Kennzahl({ wert, label, nachkomma = 0 }: { wert: number | null; label: string; nachkomma?: number }) {
  return (
    <div className="kennzahl">
      <strong>
        {wert === null ? '–' : wert.toLocaleString('de-DE', { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma })}
      </strong>
      <span>{label}</span>
    </div>
  );
}

function Quervergleich({ daten, hatFreigaben }: { daten: Vergleich[]; hatFreigaben: boolean }) {
  const [kennzahl, setKennzahl] = useState<'zaehlung' | 'abschuss'>('zaehlung');

  const nachArt = useMemo(() => {
    const m = new Map<string, { name: string; zeilen: Vergleich[] }>();
    for (const z of daten) {
      const e = m.get(z.wildart_id) ?? { name: z.wildart_name, zeilen: [] };
      e.zeilen.push(z);
      m.set(z.wildart_id, e);
    }
    return [...m.entries()];
  }, [daten]);

  if (!hatFreigaben) {
    return (
      <>
        <Hinweis>
          Der Quervergleich zeigt nur Wildarten, die dein Revier selbst freigibt. Noch ist nichts freigegeben.
        </Hinweis>
        <Knopf variante="sekundaer" onClick={() => navigieren('/freigaben')}>
          Zu den Freigaben
        </Knopf>
      </>
    );
  }

  const anzahlReviere = new Set(daten.filter((d) => !d.ist_durchschnitt).map((d) => d.revier_id)).size;

  return (
    <>
      <Segmente
        label="Kennzahl"
        wert={kennzahl}
        onAendern={setKennzahl}
        optionen={[
          { wert: 'zaehlung', label: 'Gezählt je 100 ha' },
          { wert: 'abschuss', label: 'Abschüsse je 100 ha' },
        ]}
      />
      <Leer>
        {anzahlReviere} {anzahlReviere === 1 ? 'Revier' : 'Reviere'} im Vergleich. Gezählt = höchster Wert einer
        abgeschlossenen Zählung im Jagdjahr. Der Hegering-Durchschnitt ist flächengewichtet.
      </Leer>
      {nachArt.length === 0 && <Leer>Für diesen Zeitraum liegen keine freigegebenen Daten vor.</Leer>}
      {nachArt.map(([id, { name, zeilen }]) => {
        const ohneFlaeche = zeilen.some((z) => !z.ist_durchschnitt && !z.flaeche_ha);
        return (
          <Gruppe
            key={id}
            titel={name}
            fuss={ohneFlaeche ? 'Reviere ohne hinterlegte Fläche fehlen im Wert je 100 ha.' : undefined}
          >
            <div className="diagramm-block">
              <Balken
                einheit=""
                hervorheben={(s) => {
                  const z = zeilen.find((x) => (x.revier_id ?? 'schnitt') === s);
                  return z?.ist_durchschnitt ? 'schnitt' : z?.ist_eigenes ? 'eigen' : null;
                }}
                zeilen={zeilen.map((z) => ({
                  schluessel: z.revier_id ?? 'schnitt',
                  label: z.revier_name,
                  wert: Number(kennzahl === 'zaehlung' ? z.gezaehlt_max_je_100ha : z.abschuesse_je_100ha) || 0,
                  zusatz:
                    kennzahl === 'zaehlung'
                      ? ` · max. ${Number(z.gezaehlt_max).toLocaleString('de-DE')} Stück`
                      : ` · ${Number(z.abschuesse).toLocaleString('de-DE')} Stück (♂ ${Number(z.abschuesse_maennlich).toLocaleString('de-DE')} / ♀ ${Number(z.abschuesse_weiblich).toLocaleString('de-DE')})`,
                }))}
              />
            </div>
          </Gruppe>
        );
      })}
    </>
  );
}
