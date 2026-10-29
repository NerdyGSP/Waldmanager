import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, letzteJagdjahre, type Jagdjahr } from '../../lib/zeit';
import { navigieren } from '../../lib/router';
import type { Database } from '../../lib/database.types';
import { Gruppe, Hinweis, Knopf, Leer, Seite, Segmente } from '../../components/ui';
import { Balken, Verlauf } from '../../components/diagramme';
import type { RevierKontext } from './kontext';

type Vergleich = Database['public']['Functions']['quervergleich']['Returns'][number];
type Sitzungssumme = { id: string; datum: string; arten: Record<string, number> };

export function Monitoring({ k }: { k: RevierKontext }) {
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
          .select('id, datum, zaehlungen(wildart_id, anzahl, geloescht_am)')
          .eq('revier_id', k.revierId)
          .eq('status', 'abgeschlossen')
          .is('geloescht_am', null)
          .gte('datum', jahr.von)
          .lte('datum', jahr.bis)
          .order('datum'),
        supabase
          .from('abschuesse')
          .select('wildart_id')
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
          return { id: x.id, datum: x.datum, arten };
        }),
      );
      const st: Record<string, number> = {};
      for (const x of a.data ?? []) st[x.wildart_id] = (st[x.wildart_id] ?? 0) + 1;
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

  const streckeSumme = Object.values(strecke).reduce((a, n) => a + n, 0);

  return (
    <Seite titel="Monitoring" untertitel={`Jagdjahr ${jahr.label}`}>
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
        <>
          <div className="kennzahlen">
            <Kennzahl wert={sitzungen.length} label="Zählungen" />
            <Kennzahl wert={beobachtungen} label="Beobachtungen" />
            <Kennzahl wert={streckeSumme} label="Abschüsse" />
            <Kennzahl
              wert={k.flaecheHa ? (streckeSumme / k.flaecheHa) * 100 : null}
              nachkomma={1}
              label="Abschüsse je 100 ha"
            />
          </div>

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
            <Gruppe titel="Höchster Zählwert je Wildart" fuss={k.flaecheHa ? `Bezogen auf ${k.flaecheHa.toLocaleString('de-DE')} ha Revierfläche` : undefined}>
              <div className="diagramm-block">
                <Balken
                  zeilen={gezaehlteArten.map((w) => ({
                    label: w.name,
                    wert: maxJeArt[w.id] ?? 0,
                    zusatz: k.flaecheHa ? ` · ${(((maxJeArt[w.id] ?? 0) / k.flaecheHa) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} / 100 ha` : undefined,
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
        </>
      ) : (
        <Quervergleich daten={vergleich} hatFreigaben={hatFreigaben} />
      )}
    </Seite>
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
