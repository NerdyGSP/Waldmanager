import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { datumDE } from '../../lib/zeit';
import { useBestaende, useMitglieder } from '../../lib/stammdaten';
import {
  FILTER,
  MASSNAHME_TYPEN,
  STATUS_LABEL,
  anzeigeStatus,
  heuteIso,
  naechsterStatus,
  passtZuFilter,
  sortieren,
  typLabel,
  zaehlen,
  type Filter,
} from '../../lib/massnahmen';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite } from '../../components/ui';
import type { BetriebKontext } from './kontext';

export type Massnahme = {
  id: string;
  titel: string;
  typ: string;
  status: string;
  faellig_am: string | null;
  bestand_id: string | null;
  zugewiesen_an: string | null;
  zustaendig_extern: string | null;
  beschreibung: string | null;
  erstellt_von: string | null;
};

const SPALTEN = 'id, titel, typ, status, faellig_am, bestand_id, zugewiesen_an, zustaendig_extern, beschreibung, erstellt_von';

export function useMassnahmen(betriebId: string, bestandId?: string) {
  const [liste, setListe] = useState<Massnahme[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    let q = supabase.from('massnahmen').select(SPALTEN).eq('betrieb_id', betriebId).is('geloescht_am', null);
    if (bestandId) q = q.eq('bestand_id', bestandId);
    const { data, error } = await q;
    setFehler(error ? fehlertext(error) : null);
    setListe(sortieren(data ?? []));
  }, [betriebId, bestandId]);
  useEffect(() => {
    void laden();
  }, [laden]);
  return { liste, fehler, laden };
}

// Modul „Maßnahmen“: Filter oben, Tabelle, Formular für neue oder geänderte Maßnahmen
export function Massnahmen({ k }: { k: BetriebKontext }) {
  const { liste, fehler: ladeFehler, laden } = useMassnahmen(k.betriebId);
  const { bestaende } = useBestaende(k.betriebId);
  const mitglieder = useMitglieder(k.betriebId);
  const [filter, setFilter] = useState<Filter>('offen');
  const [bearbeiten, setBearbeiten] = useState<Massnahme | 'neu' | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const heute = heuteIso();

  const zahlen = useMemo(() => zaehlen(liste ?? [], heute), [liste, heute]);
  const sichtbar = useMemo(() => (liste ?? []).filter((m) => passtZuFilter(m, filter, heute)), [liste, filter, heute]);
  const bestandName = (id: string | null) => (id ? bestaende.find((b) => b.id === id)?.name ?? '–' : '–');
  const zustaendig = (m: Massnahme) => (m.zugewiesen_an ? mitglieder.find((x) => x.user_id === m.zugewiesen_an)?.name ?? '?' : m.zustaendig_extern ?? '–');
  const darfAendern = (m: Massnahme) => k.istInhaber || m.erstellt_von === k.userId || m.zugewiesen_an === k.userId;

  async function statusWeiter(m: Massnahme) {
    setFehler(null);
    const { error } = await supabase.from('massnahmen').update({ status: naechsterStatus(m.status) }).eq('id', m.id);
    if (error) setFehler(fehlertext(error));
    await laden();
  }

  if (bearbeiten) {
    return (
      <MassnahmeFormular
        k={k}
        massnahme={bearbeiten === 'neu' ? null : bearbeiten}
        bestaende={bestaende.map((b) => ({ id: b.id, name: b.name }))}
        mitglieder={mitglieder}
        onFertig={async () => {
          setBearbeiten(null);
          await laden();
        }}
        onAbbrechen={() => setBearbeiten(null)}
      />
    );
  }

  return (
    <Seite
      titel="Maßnahmen"
      untertitel="Status antippen, um ihn weiterzuschalten: geplant → in Arbeit → erledigt"
      aktion={
        <Knopf variante="primaer" onClick={() => setBearbeiten('neu')}>
          + Neue Maßnahme
        </Knopf>
      }
    >
      <div className="filter-chips" role="group" aria-label="Filter">
        {FILTER.map((f) => (
          <button key={f.wert} type="button" className="filter-chip" aria-pressed={filter === f.wert} onClick={() => setFilter(f.wert)}>
            {f.label}
            {f.wert !== 'alle' && <span className="filter-chip-zahl">{zahlen[f.wert]}</span>}
          </button>
        ))}
      </div>
      {(fehler ?? ladeFehler) && <Hinweis art="fehler">{fehler ?? ladeFehler}</Hinweis>}
      {liste === null ? (
        <Leer>Maßnahmen werden geladen …</Leer>
      ) : sichtbar.length === 0 ? (
        <Leer>{liste.length === 0 ? 'Noch keine Maßnahmen. Lege die erste über „+ Neue Maßnahme“ an.' : 'Keine Maßnahmen in diesem Filter.'}</Leer>
      ) : (
        <div className="tabelle-rahmen">
          <table className="tabelle massnahmen-tabelle">
            <thead>
              <tr>
                <th scope="col">Maßnahme</th>
                <th scope="col">Bestand</th>
                <th scope="col">Termin</th>
                <th scope="col">Zuständig</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {sichtbar.map((m) => {
                const s = anzeigeStatus(m, heute);
                return (
                  <tr key={m.id}>
                    <th scope="row">
                      {darfAendern(m) ? (
                        <button type="button" className="link" onClick={() => setBearbeiten(m)}>
                          {m.titel}
                        </button>
                      ) : (
                        m.titel
                      )}
                      <small>{[typLabel(m.typ), m.beschreibung].filter(Boolean).join(' · ')}</small>
                    </th>
                    <td>
                      {m.bestand_id ? (
                        <button type="button" className="link" onClick={() => navigieren(`/bestaende/${m.bestand_id}`)}>
                          {bestandName(m.bestand_id)}
                        </button>
                      ) : (
                        '–'
                      )}
                    </td>
                    <td className="zahl">{m.faellig_am ? datumDE(m.faellig_am) : '–'}</td>
                    <td>{zustaendig(m)}</td>
                    <td>
                      <button
                        type="button"
                        className={`status-pill status-${s}`}
                        disabled={!darfAendern(m)}
                        title={darfAendern(m) ? `Weiter zu „${STATUS_LABEL[naechsterStatus(m.status)]}“` : undefined}
                        onClick={() => void statusWeiter(m)}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Seite>
  );
}

/** Kompakte Liste für das Bestandsdetail */
export function MassnahmenKurz({ k, bestandId }: { k: BetriebKontext; bestandId: string }) {
  const { liste } = useMassnahmen(k.betriebId, bestandId);
  const heute = heuteIso();
  return (
    <Gruppe titel="Maßnahmen" fuss={liste?.length ? undefined : 'Für diesen Bestand ist nichts geplant.'}>
      {(liste ?? []).map((m) => {
        const s = anzeigeStatus(m, heute);
        return (
          <div key={m.id} className="zeile">
            <span className="zeile-label">
              {m.titel}
              <small>{[typLabel(m.typ), m.faellig_am ? datumDE(m.faellig_am) : null].filter(Boolean).join(' · ')}</small>
            </span>
            <span className={`status-pill status-${s}`}>{STATUS_LABEL[s]}</span>
          </div>
        );
      })}
      <div style={{ padding: '8px var(--abstand)' }}>
        <button type="button" className="link" onClick={() => navigieren('/massnahmen')}>
          Alle Maßnahmen ›
        </button>
      </div>
    </Gruppe>
  );
}

function MassnahmeFormular({
  k,
  massnahme,
  bestaende,
  mitglieder,
  onFertig,
  onAbbrechen,
}: {
  k: BetriebKontext;
  massnahme: Massnahme | null;
  bestaende: Array<{ id: string; name: string }>;
  mitglieder: Array<{ user_id: string; name: string }>;
  onFertig: () => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [titel, setTitel] = useState(massnahme?.titel ?? '');
  const [typ, setTyp] = useState(massnahme?.typ ?? 'sonstiges');
  const [bestandId, setBestandId] = useState(massnahme?.bestand_id ?? '');
  const [termin, setTermin] = useState(massnahme?.faellig_am ?? '');
  // Zuständig: Mitglied („m:<id>“), extern („extern“) oder niemand („“)
  const [zustaendig, setZustaendig] = useState(massnahme?.zugewiesen_an ? `m:${massnahme.zugewiesen_an}` : massnahme?.zustaendig_extern ? 'extern' : '');
  const [extern, setExtern] = useState(massnahme?.zustaendig_extern ?? '');
  const [beschreibung, setBeschreibung] = useState(massnahme?.beschreibung ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [loeschenFrage, setLoeschenFrage] = useState(false);

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setSpeichert(true);
    const werte = {
      titel: titel.trim(),
      typ,
      bestand_id: bestandId || null,
      faellig_am: termin || null,
      zugewiesen_an: zustaendig.startsWith('m:') ? zustaendig.slice(2) : null,
      zustaendig_extern: zustaendig === 'extern' ? extern.trim() || null : null,
      beschreibung: beschreibung.trim() || null,
    };
    const { error } = massnahme
      ? await supabase.from('massnahmen').update(werte).eq('id', massnahme.id)
      : await supabase.from('massnahmen').insert({ ...werte, betrieb_id: k.betriebId });
    setSpeichert(false);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  async function entfernen() {
    if (!massnahme) return;
    // Weiches Löschen, damit die Historie erhalten bleibt
    const { error } = await supabase.from('massnahmen').update({ geloescht_am: new Date().toISOString() }).eq('id', massnahme.id);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  return (
    <Seite titel={massnahme ? 'Maßnahme bearbeiten' : 'Neue Maßnahme'} zurueck={onAbbrechen}>
      <form onSubmit={speichern}>
        <Gruppe titel="Maßnahme">
          <Feld label="Titel" required placeholder="z. B. Käferkontrolle Westrand" value={titel} onChange={(e) => setTitel(e.target.value)} />
          <Auswahl label="Art" value={typ} onChange={(e) => setTyp(e.target.value)}>
            {MASSNAHME_TYPEN.map((t) => (
              <option key={t.wert} value={t.wert}>
                {t.label}
              </option>
            ))}
          </Auswahl>
          <Auswahl label="Bestand" value={bestandId} onChange={(e) => setBestandId(e.target.value)}>
            <option value="">– ganzer Betrieb –</option>
            {bestaende.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Auswahl>
          <Feld label="Termin" type="date" value={termin} onChange={(e) => setTermin(e.target.value)} />
          <Auswahl label="Zuständig" value={zustaendig} onChange={(e) => setZustaendig(e.target.value)}>
            <option value="">– offen –</option>
            {mitglieder.map((m) => (
              <option key={m.user_id} value={`m:${m.user_id}`}>
                {m.name}
              </option>
            ))}
            <option value="extern">Extern (Lohnunternehmer, Förster …)</option>
          </Auswahl>
          {zustaendig === 'extern' && <Feld label="Name" placeholder="z. B. Lohnunternehmer Hartwig" value={extern} onChange={(e) => setExtern(e.target.value)} />}
          <Feld label="Notiz" placeholder="optional, z. B. ca. 120 fm, Harvester" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} />
        </Gruppe>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf type="submit" variante="primaer" disabled={speichert || !titel.trim()}>
          {massnahme ? 'Speichern' : 'Anlegen'}
        </Knopf>
      </form>
      {massnahme &&
        (loeschenFrage ? (
          <>
            <Hinweis art="warnung">Maßnahme „{massnahme.titel}“ entfernen?</Hinweis>
            <Knopf variante="gefahr" onClick={() => void entfernen()}>
              Endgültig entfernen
            </Knopf>
            <Knopf variante="ghost" onClick={() => setLoeschenFrage(false)}>
              Abbrechen
            </Knopf>
          </>
        ) : (
          <Knopf variante="gefahr" onClick={() => setLoeschenFrage(true)}>
            Maßnahme entfernen
          </Knopf>
        ))}
    </Seite>
  );
}
