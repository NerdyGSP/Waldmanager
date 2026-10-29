import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, useZonen } from '../../lib/stammdaten';
import { datumDE, heuteISO } from '../../lib/zeit';
import type { Tables } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile } from '../../components/ui';
import type { RevierKontext } from './kontext';

type Schein = Omit<Tables<'begehungsscheine'>, 'revier_id' | 'geloescht_am' | 'erstellt_am' | 'aktualisiert_am' | 'ausgestellt_von'>;

const SPALTEN = 'id, gast_name, gast_kontakt, jagdschein_nr, art, entgelt_eur, gueltig_von, gueltig_bis, bereich, wildarten, bedingungen, widerrufen_am';

function stand(s: Pick<Schein, 'gueltig_von' | 'gueltig_bis' | 'widerrufen_am'>): { text: string; klasse: string; aktiv: boolean } {
  const heute = heuteISO();
  if (s.widerrufen_am) return { text: 'widerrufen', klasse: 'badge-rot', aktiv: false };
  if (s.gueltig_bis < heute) return { text: 'abgelaufen', klasse: '', aktiv: false };
  if (s.gueltig_von > heute) return { text: `ab ${datumDE(s.gueltig_von)}`, klasse: '', aktiv: false };
  const rest = Math.round((new Date(`${s.gueltig_bis}T12:00:00`).getTime() - new Date(`${heute}T12:00:00`).getTime()) / 86400000);
  if (rest <= 7) return { text: rest === 0 ? 'läuft heute ab' : `noch ${rest} ${rest === 1 ? 'Tag' : 'Tage'}`, klasse: 'badge-orange', aktiv: true };
  return { text: 'gültig', klasse: 'badge-gruen', aktiv: true };
}

export function Begehungsscheine({ k }: { k: RevierKontext }) {
  const wildarten = useWildarten();
  const [liste, setListe] = useState<Schein[]>([]);
  const [bearbeiten, setBearbeiten] = useState<Schein | 'neu' | null>(null);
  const [ansicht, setAnsicht] = useState<Schein | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [alle, setAlle] = useState(false);

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('begehungsscheine')
      .select(SPALTEN)
      .eq('revier_id', k.revierId)
      .is('geloescht_am', null)
      .order('gueltig_bis', { ascending: false });
    if (error) setFehler(fehlertext(error));
    setListe(data ?? []);
  }, [k.revierId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const aktive = liste.filter((s) => stand(s).aktiv);
  const sichtbar = alle ? liste : aktive;

  if (bearbeiten) {
    return (
      <ScheinFormular
        k={k}
        vorlage={bearbeiten === 'neu' ? null : bearbeiten}
        onFertig={async () => {
          setBearbeiten(null);
          await laden();
        }}
      />
    );
  }

  return (
    <Seite
      titel="Begehungsscheine"
      untertitel={`${aktive.length} ${aktive.length === 1 ? 'gültiger Schein' : 'gültige Scheine'}`}
      aktion={k.istInhaber ? <Knopf variante="akzent" onClick={() => setBearbeiten('neu')}>+ Schein</Knopf> : undefined}
    >
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <label className="filter">
        <input type="checkbox" checked={alle} onChange={(e) => setAlle(e.target.checked)} /> auch abgelaufene und widerrufene anzeigen
      </label>
      <Gruppe>
        {sichtbar.length === 0 && <Zeile label={alle ? 'Noch keine Begehungsscheine' : 'Keine gültigen Begehungsscheine'} />}
        {sichtbar.map((s) => {
          const st = stand(s);
          return (
            <button key={s.id} className="zeile zeile-knopf" onClick={() => setAnsicht(s)}>
              <span className="zeile-label">
                {s.gast_name}
                <small>
                  {datumDE(s.gueltig_von)} – {datumDE(s.gueltig_bis)} · {s.art === 'entgeltlich' ? 'entgeltlich' : 'unentgeltlich'}
                  {s.bereich ? ` · ${s.bereich}` : ''}
                </small>
                <span className="zeile-badges">
                  <span className={`badge ${st.klasse}`}>{st.text}</span>
                  {s.wildarten.length > 0 && (
                    <span className="badge">{s.wildarten.map((id) => wildarten.find((w) => w.id === id)?.name ?? id).join(', ')}</span>
                  )}
                </span>
              </span>
              <span className="zeile-pfeil" aria-hidden="true">›</span>
            </button>
          );
        })}
      </Gruppe>
      {!k.istInhaber && <Leer>Begehungsscheine stellt der Revierinhaber aus. Hier siehst du, wer im Revier eine Erlaubnis hat.</Leer>}
      {ansicht && <ScheinFenster k={k} schein={ansicht} onZurueck={() => setAnsicht(null)} onBearbeiten={() => { setBearbeiten(ansicht); setAnsicht(null); }} />}
    </Seite>
  );
}

function ScheinFenster({ k, schein, onZurueck, onBearbeiten }: { k: RevierKontext; schein: Schein; onZurueck: () => void; onBearbeiten: () => void }) {
  const wildarten = useWildarten();
  const st = stand(schein);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && onZurueck();
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onZurueck]);
  // Schwebendes Fenster (≥ 900 px) bzw. Vollbild-Sheet (Handy), unabhängig von der Seitenleiste
  return createPortal(
    <div className="schein-fenster" role="dialog" aria-label="Begehungsschein">
      <div className="schein-fenster-kopf">
        <h2>Begehungsschein</h2>
        <Knopf variante="sekundaer" onClick={() => window.print()}>Drucken</Knopf>
        <Knopf variante="ghost" onClick={onZurueck} aria-label="Schließen">Schließen</Knopf>
      </div>
      <article className="schein-druck">
        <header>
          <p className="schein-revier">Revier {k.revierName}</p>
          <h2>Begehungsschein</h2>
        </header>
        <dl>
          <dt>Inhaber der Erlaubnis</dt>
          <dd>{schein.gast_name}</dd>
          {schein.jagdschein_nr && (<><dt>Jagdschein-Nr.</dt><dd>{schein.jagdschein_nr}</dd></>)}
          {schein.gast_kontakt && (<><dt>Kontakt</dt><dd>{schein.gast_kontakt}</dd></>)}
          <dt>Gültig</dt>
          <dd>
            {datumDE(schein.gueltig_von)} bis {datumDE(schein.gueltig_bis)}
          </dd>
          <dt>Art</dt>
          <dd>
            {schein.art === 'entgeltlich' ? `entgeltlich${schein.entgelt_eur ? ` (${schein.entgelt_eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})` : ''}` : 'unentgeltlich'}
          </dd>
          <dt>Bereich</dt>
          <dd>{schein.bereich || 'gesamtes Revier'}</dd>
          <dt>Wildarten</dt>
          <dd>{schein.wildarten.length ? schein.wildarten.map((id) => wildarten.find((w) => w.id === id)?.name ?? id).join(', ') : 'nach Absprache / Abschussplan'}</dd>
          {schein.bedingungen && (<><dt>Bedingungen</dt><dd className="schein-text">{schein.bedingungen}</dd></>)}
        </dl>
        <p className="schein-status">
          Status: <span className={`badge ${st.klasse}`}>{st.text}</span>
          {schein.widerrufen_am && <> · widerrufen am {datumDE(schein.widerrufen_am)}</>}
        </p>
        <footer className="schein-unterschrift">
          <span>Ort, Datum</span>
          <span>Unterschrift Revierinhaber/Pächter</span>
        </footer>
      </article>
      {k.istInhaber && <Knopf variante="sekundaer" onClick={onBearbeiten}>Bearbeiten</Knopf>}
    </div>,
    document.body,
  );
}

function ScheinFormular({ k, vorlage, onFertig }: { k: RevierKontext; vorlage: Schein | null; onFertig: () => Promise<void> }) {
  const wildarten = useWildarten();
  const { zonen } = useZonen(k.revierId);
  const [gast, setGast] = useState(vorlage?.gast_name ?? '');
  const [kontakt, setKontakt] = useState(vorlage?.gast_kontakt ?? '');
  const [nummer, setNummer] = useState(vorlage?.jagdschein_nr ?? '');
  const [art, setArt] = useState(vorlage?.art ?? 'unentgeltlich');
  const [entgelt, setEntgelt] = useState(vorlage?.entgelt_eur ? String(vorlage.entgelt_eur).replace('.', ',') : '');
  const [von, setVon] = useState(vorlage?.gueltig_von ?? heuteISO());
  const [bis, setBis] = useState(vorlage?.gueltig_bis ?? '');
  const [bereich, setBereich] = useState(vorlage?.bereich ?? '');
  const [arten, setArten] = useState<string[]>(vorlage?.wildarten ?? []);
  const [bedingungen, setBedingungen] = useState(vorlage?.bedingungen ?? '');
  const [widerrufen, setWiderrufen] = useState(vorlage?.widerrufen_am ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const eur = entgelt.trim() ? Number(entgelt.replace(',', '.')) : null;
    if (eur !== null && (!Number.isFinite(eur) || eur < 0)) {
      setFehler('Bitte ein gültiges Entgelt angeben.');
      return;
    }
    if (bis < von) {
      setFehler('Das Ende der Gültigkeit liegt vor dem Beginn.');
      return;
    }
    setSpeichert(true);
    const daten = {
      revier_id: k.revierId,
      gast_name: gast.trim(),
      gast_kontakt: kontakt.trim() || null,
      jagdschein_nr: nummer.trim() || null,
      art,
      entgelt_eur: art === 'entgeltlich' ? eur : null,
      gueltig_von: von,
      gueltig_bis: bis,
      bereich: bereich.trim() || null,
      wildarten: arten,
      bedingungen: bedingungen.trim() || null,
      widerrufen_am: widerrufen || null,
    };
    const { error } = vorlage
      ? await supabase.from('begehungsscheine').update(daten).eq('id', vorlage.id)
      : await supabase.from('begehungsscheine').insert(daten);
    setSpeichert(false);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  async function loeschen() {
    if (!vorlage || !window.confirm('Diesen Begehungsschein löschen?')) return;
    const { error } = await supabase.from('begehungsscheine').update({ geloescht_am: new Date().toISOString() }).eq('id', vorlage.id);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  return (
    <Seite titel={vorlage ? 'Begehungsschein bearbeiten' : 'Begehungsschein ausstellen'} zurueck={() => void onFertig()}>
      <form onSubmit={speichern}>
        <Gruppe titel="Gast">
          <Feld label="Name" required value={gast} onChange={(e) => setGast(e.target.value)} />
          <Feld label="Kontakt" placeholder="Telefon oder E-Mail" value={kontakt} onChange={(e) => setKontakt(e.target.value)} />
          <Feld label="Jagdschein-Nr." placeholder="optional" value={nummer} onChange={(e) => setNummer(e.target.value)} />
        </Gruppe>
        <Gruppe titel="Gültigkeit">
          <Feld label="Von" type="date" required value={von} onChange={(e) => setVon(e.target.value)} />
          <Feld label="Bis" type="date" required value={bis} min={von} onChange={(e) => setBis(e.target.value)} />
          <Auswahl label="Art" value={art} onChange={(e) => setArt(e.target.value)}>
            <option value="unentgeltlich">unentgeltlich</option>
            <option value="entgeltlich">entgeltlich</option>
          </Auswahl>
          {art === 'entgeltlich' && <Feld label="Entgelt (€)" inputMode="decimal" value={entgelt} onChange={(e) => setEntgelt(e.target.value)} />}
        </Gruppe>
        <Gruppe titel="Umfang">
          <Feld label="Bereich" placeholder="leer = gesamtes Revier" list="bereiche" value={bereich} onChange={(e) => setBereich(e.target.value)} />
          <datalist id="bereiche">
            {zonen.map((z) => (
              <option key={z.id} value={z.name} />
            ))}
          </datalist>
        </Gruppe>
        <details className="werkzeug-abschnitt">
          <summary>Wildarten ({arten.length ? `${arten.length} gewählt` : 'alle nach Absprache'})</summary>
          <div className="wildarten-wahl">
            {wildarten.map((w, i) => (
              <label key={w.id} className="ebene" style={i === 8 ? { borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 4 } : undefined}>
                <input
                  type="checkbox"
                  checked={arten.includes(w.id)}
                  onChange={(e) => setArten((alt) => (e.target.checked ? [...alt, w.id] : alt.filter((x) => x !== w.id)))}
                />
                {w.name}
              </label>
            ))}
          </div>
        </details>
        <Gruppe>
          <Feld label="Bedingungen" placeholder="z. B. Abschussmeldung innerhalb 24 h" value={bedingungen} onChange={(e) => setBedingungen(e.target.value)} />
          {vorlage && <Feld label="Widerrufen am" type="date" value={widerrufen} onChange={(e) => setWiderrufen(e.target.value)} />}
        </Gruppe>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf type="submit" disabled={speichert || !gast.trim() || !bis}>
          {speichert ? 'Speichern …' : 'Speichern'}
        </Knopf>
        <Knopf type="button" variante="ghost" onClick={() => void onFertig()}>
          Abbrechen
        </Knopf>
        {vorlage && (
          <Knopf type="button" variante="gefahr" onClick={loeschen}>
            Schein löschen
          </Knopf>
        )}
      </form>
    </Seite>
  );
}
