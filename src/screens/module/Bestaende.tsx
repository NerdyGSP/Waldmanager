import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { BAUMARTEN, BESTANDSFARBEN, baumartenText, nameVergeben, useBestaende, type Baumartenanteil, type Bestand } from '../../lib/stammdaten';
import { anteilSumme, baumartenPruefen, bestandesalter, pflanzjahrAusAlter } from '../../lib/forst';
import { Farbwahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile } from '../../components/ui';
import type { BetriebKontext } from './kontext';
import { MassnahmenKurz } from './Massnahmen';

// Modul „Bestände“: Liste aller Bestände, Detail unter /bestaende/<id>
export function Bestaende({ k, unterpfad = [] }: { k: BetriebKontext; unterpfad?: string[] }) {
  const { bestaende, laedt, laden } = useBestaende(k.betriebId);
  const gewaehlt = unterpfad[0] ? bestaende.find((b) => b.id === unterpfad[0]) : undefined;

  if (unterpfad[0] && !laedt && !gewaehlt) {
    return (
      <Seite titel="Bestand" zurueck={() => navigieren('/bestaende')}>
        <Hinweis>Diesen Bestand gibt es nicht mehr.</Hinweis>
      </Seite>
    );
  }
  if (gewaehlt) return <BestandDetail key={gewaehlt.id} k={k} bestand={gewaehlt} alle={bestaende} onGeaendert={laden} />;

  return (
    <Seite titel="Bestände" untertitel="Bewirtschaftungseinheiten des Forstbetriebs · Flächen zeichnest du auf der Karte">
      {laedt ? (
        <Leer>Bestände werden geladen …</Leer>
      ) : bestaende.length === 0 ? (
        <Leer>Noch keine Bestände. Lege unten einen an und zeichne ihn danach auf der Karte.</Leer>
      ) : (
        <Gruppe titel={`${bestaende.length} ${bestaende.length === 1 ? 'Bestand' : 'Bestände'}`}>
          {bestaende.map((b) => {
            const alter = bestandesalter(b.pflanzjahr);
            return (
              <button key={b.id} type="button" className="zeile zeile-knopf" onClick={() => navigieren(`/bestaende/${b.id}`)}>
                <span className="zeile-label">
                  <i className="farbpunkt" style={{ background: b.farbe ?? 'var(--color-primary)' }} /> {b.name}
                  <small>
                    {[b.bestandestyp, b.baumarten.length ? baumartenText(b.baumarten) : null, alter != null ? `${alter} J.` : null, b.hatGeometrie ? null : 'noch ohne Fläche']
                      .filter(Boolean)
                      .join(' · ') || 'Noch keine Bestandsdaten'}
                  </small>
                </span>
                <span className="zeile-wert" aria-hidden="true">›</span>
              </button>
            );
          })}
        </Gruppe>
      )}
      {k.istInhaber && <BestandAnlegen k={k} bestaende={bestaende} onAngelegt={laden} />}
    </Seite>
  );
}

function BestandAnlegen({ k, bestaende, onAngelegt }: { k: BetriebKontext; bestaende: Bestand[]; onAngelegt: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const n = name.trim();
    if (nameVergeben(bestaende.map((b) => b.name), n)) {
      setFehler(`Einen Bestand „${n}“ gibt es bereits.`);
      return;
    }
    const { data, error } = await supabase
      .from('bestaende')
      .insert({ betrieb_id: k.betriebId, name: n, sortierung: bestaende.length, farbe: BESTANDSFARBEN[bestaende.length % BESTANDSFARBEN.length] })
      .select('id')
      .single();
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setName('');
    await onAngelegt();
    navigieren(`/bestaende/${data.id}`);
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe titel="Bestand anlegen" fuss="Übliche Bezeichnung: Abteilung und Buchstabe, z. B. „4a“. Die Fläche zeichnest du danach auf der Karte (+ NEU → Bestand zeichnen).">
        <Feld label="Name" required placeholder="z. B. 4a" value={name} onChange={(e) => setName(e.target.value)} />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" variante="sekundaer" disabled={!name.trim()}>
        Bestand anlegen
      </Knopf>
    </form>
  );
}

function BestandDetail({ k, bestand, alle, onGeaendert }: { k: BetriebKontext; bestand: Bestand; alle: Bestand[]; onGeaendert: () => Promise<void> }) {
  const darf = k.istInhaber;
  const [name, setName] = useState(bestand.name);
  const [abteilung, setAbteilung] = useState(bestand.abteilung ?? '');
  const [typ, setTyp] = useState(bestand.bestandestyp ?? '');
  const [alter, setAlter] = useState(bestand.pflanzjahr != null ? String(bestandesalter(bestand.pflanzjahr) ?? '') : '');
  const [vorrat, setVorrat] = useState(bestand.vorratVfmHa != null ? String(bestand.vorratVfmHa).replace('.', ',') : '');
  const [bemerkung, setBemerkung] = useState('');
  const [mischung, setMischung] = useState<Baumartenanteil[]>(bestand.baumarten);
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg'; text: string } | null>(null);
  const [loeschenFrage, setLoeschenFrage] = useState(false);

  // Bemerkung ist nicht Teil der Listenabfrage – einmal nachladen
  useEffect(() => {
    void supabase
      .from('bestaende')
      .select('bemerkung')
      .eq('id', bestand.id)
      .maybeSingle()
      .then(({ data }) => setBemerkung(data?.bemerkung ?? ''));
  }, [bestand.id]);

  const mischFehler = baumartenPruefen(mischung);

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setMeldung(null);
    const n = name.trim();
    if (nameVergeben(alle.map((b) => b.name), n, bestand.name)) {
      setMeldung({ art: 'fehler', text: `Einen Bestand „${n}“ gibt es bereits.` });
      return;
    }
    const a = alter.trim() ? Number(alter) : null;
    if (a !== null && (!Number.isInteger(a) || a < 0 || a > 400)) {
      setMeldung({ art: 'fehler', text: 'Bitte das Alter als ganze Zahl in Jahren angeben.' });
      return;
    }
    const v = vorrat.trim() ? Number(vorrat.replace(',', '.')) : null;
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      setMeldung({ art: 'fehler', text: 'Bitte den Vorrat als Zahl in Vfm je Hektar angeben.' });
      return;
    }
    if (mischFehler) {
      setMeldung({ art: 'fehler', text: mischFehler });
      return;
    }
    const { error } = await supabase
      .from('bestaende')
      .update({
        name: n,
        abteilung: abteilung.trim() || null,
        bestandestyp: typ.trim() || null,
        pflanzjahr: a === null ? null : pflanzjahrAusAlter(a),
        vorrat_vfm_ha: v,
        bemerkung: bemerkung.trim() || null,
        baumarten: mischung,
      })
      .eq('id', bestand.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    else {
      setMeldung({ art: 'erfolg', text: 'Bestand gespeichert' });
      await onGeaendert();
    }
  }

  async function farbeSetzen(farbe: string) {
    const { error } = await supabase.from('bestaende').update({ farbe }).eq('id', bestand.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    await onGeaendert();
  }

  async function entfernen() {
    // Weiches Löschen, damit Maßnahmen und Funde ihren Bezug behalten
    const { error } = await supabase.from('bestaende').update({ geloescht_am: new Date().toISOString() }).eq('id', bestand.id);
    if (error) {
      setMeldung({ art: 'fehler', text: fehlertext(error) });
      return;
    }
    await onGeaendert();
    navigieren('/bestaende');
  }

  const freieArten = (aktuell: string) => BAUMARTEN.filter((b) => b.kuerzel === aktuell || !mischung.some((m) => m.art === b.kuerzel));

  return (
    <Seite titel={`Bestand ${bestand.name}`} untertitel={bestand.hatGeometrie ? undefined : 'Noch ohne Fläche – auf der Karte über + NEU → Bestand zeichnen'} zurueck={() => navigieren('/bestaende')}>
      <form onSubmit={speichern}>
        <Gruppe titel="Stammdaten">
          <Feld label="Name" required disabled={!darf} value={name} onChange={(e) => setName(e.target.value)} />
          <Feld label="Abteilung" disabled={!darf} placeholder="optional" value={abteilung} onChange={(e) => setAbteilung(e.target.value)} />
          <Feld label="Bestandestyp" disabled={!darf} placeholder="z. B. Fichten-Baumholz" value={typ} onChange={(e) => setTyp(e.target.value)} />
          <Feld label="Alter (Jahre)" disabled={!darf} inputMode="numeric" placeholder="optional" value={alter} onChange={(e) => setAlter(e.target.value.replace(/\D/g, ''))} />
          <Feld label="Vorrat (Vfm/ha)" disabled={!darf} inputMode="decimal" placeholder="optional" value={vorrat} onChange={(e) => setVorrat(e.target.value)} />
          <Feld label="Bemerkung" disabled={!darf} placeholder="optional" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
          {darf && (
            <Zeile label="Farbe auf der Karte">
              <Farbwahl label={`Farbe von Bestand ${bestand.name}`} wert={bestand.farbe ?? BESTANDSFARBEN[0]!} onAendern={(f) => void farbeSetzen(f)} />
            </Zeile>
          )}
        </Gruppe>

        <Gruppe titel="Baumarten" fuss={mischung.length ? `Summe ${anteilSumme(mischung)} %${mischFehler ? ` – ${mischFehler}` : ''}` : 'Noch keine Baumarten eingetragen.'}>
          {mischung.map((m, i) => (
            <div key={i} className="zeile baumart-zeile">
              <select
                aria-label={`Baumart ${i + 1}`}
                disabled={!darf}
                value={m.art}
                onChange={(e) => setMischung((alt) => alt.map((x, j) => (j === i ? { ...x, art: e.target.value } : x)))}
              >
                <option value="">Baumart wählen</option>
                {freieArten(m.art).map((b) => (
                  <option key={b.kuerzel} value={b.kuerzel}>
                    {b.name} ({b.kuerzel})
                  </option>
                ))}
              </select>
              <input
                aria-label={`Anteil ${i + 1} in Prozent`}
                inputMode="numeric"
                disabled={!darf}
                value={String(m.anteil)}
                onChange={(e) => setMischung((alt) => alt.map((x, j) => (j === i ? { ...x, anteil: Number(e.target.value.replace(/\D/g, '') || 0) } : x)))}
              />
              <span>%</span>
              {darf && (
                <button type="button" className="link gefahr" onClick={() => setMischung((alt) => alt.filter((_, j) => j !== i))}>
                  Entfernen
                </button>
              )}
            </div>
          ))}
          {darf && mischung.length < BAUMARTEN.length && (
            <div style={{ padding: '8px var(--abstand)' }}>
              <button
                type="button"
                className="link"
                onClick={() => setMischung((alt) => [...alt, { art: '', anteil: Math.max(0, 100 - anteilSumme(alt)) }])}
              >
                + Baumart hinzufügen
              </button>
            </div>
          )}
        </Gruppe>

        {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
        {darf && (
          <Knopf type="submit" variante="sekundaer">
            Bestand speichern
          </Knopf>
        )}
      </form>

      <MassnahmenKurz k={k} bestandId={bestand.id} />

      <Knopf variante="ghost" onClick={() => navigieren('/karte')}>
        Auf der Karte ansehen
      </Knopf>

      {darf &&
        (loeschenFrage ? (
          <>
            <Hinweis art="warnung">Bestand „{bestand.name}“ entfernen? Maßnahmen und Funde bleiben erhalten, verlieren aber den Bezug.</Hinweis>
            <Knopf variante="gefahr" onClick={() => void entfernen()}>
              Endgültig entfernen
            </Knopf>
            <Knopf variante="ghost" onClick={() => setLoeschenFrage(false)}>
              Abbrechen
            </Knopf>
          </>
        ) : (
          <Knopf variante="gefahr" onClick={() => setLoeschenFrage(true)}>
            Bestand entfernen
          </Knopf>
        ))}
    </Seite>
  );
}
