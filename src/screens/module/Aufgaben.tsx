import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useMitglieder } from '../../lib/stammdaten';
import { datumDE, heuteISO } from '../../lib/zeit';
import type { Tables } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente } from '../../components/ui';
import type { RevierKontext } from './kontext';

type Aufgabe = Pick<Tables<'aufgaben'>, 'id' | 'titel' | 'beschreibung' | 'faellig_am' | 'status' | 'zugewiesen_an' | 'einrichtung_id' | 'erledigt_am' | 'erstellt_von'>;
type Einrichtung = { id: string; name: string | null; typ: string };

const STATUS = [
  { wert: 'offen', label: 'Offen' },
  { wert: 'in_arbeit', label: 'In Arbeit' },
  { wert: 'erledigt', label: 'Erledigt' },
];

function useEinrichtungen(revierId: string): Einrichtung[] {
  const [liste, setListe] = useState<Einrichtung[]>([]);
  useEffect(() => {
    void supabase
      .from('einrichtungen')
      .select('id, name, typ')
      .eq('revier_id', revierId)
      .is('geloescht_am', null)
      .order('name')
      .then(({ data }) => setListe(data ?? []));
  }, [revierId]);
  return liste;
}

const einrichtungLabel = (e: Einrichtung) => (e.name ? `${e.name} (${e.typ})` : e.typ);

export function Aufgaben({ k }: { k: RevierKontext }) {
  const mitglieder = useMitglieder(k.revierId);
  const einrichtungen = useEinrichtungen(k.revierId);
  const [liste, setListe] = useState<Aufgabe[]>([]);
  const [filter, setFilter] = useState<'offen' | 'meine' | 'erledigt'>('offen');
  const [bearbeiten, setBearbeiten] = useState<Aufgabe | 'neu' | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('aufgaben')
      .select('id, titel, beschreibung, faellig_am, status, zugewiesen_an, einrichtung_id, erledigt_am, erstellt_von')
      .eq('revier_id', k.revierId)
      .is('geloescht_am', null)
      .order('faellig_am', { ascending: true, nullsFirst: false })
      .order('erstellt_am', { ascending: false });
    if (error) setFehler(fehlertext(error));
    setListe(data ?? []);
  }, [k.revierId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const sichtbar = useMemo(() => {
    if (filter === 'erledigt') return liste.filter((a) => a.status === 'erledigt').sort((a, b) => (b.erledigt_am ?? '').localeCompare(a.erledigt_am ?? ''));
    const offen = liste.filter((a) => a.status !== 'erledigt');
    return filter === 'meine' ? offen.filter((a) => a.zugewiesen_an === k.userId) : offen;
  }, [liste, filter, k.userId]);

  const name = (id: string | null) => mitglieder.find((m) => m.user_id === id)?.name;
  const ueberfaellig = (a: Aufgabe) => a.status !== 'erledigt' && !!a.faellig_am && a.faellig_am < heuteISO();
  const anzahlUeberfaellig = liste.filter(ueberfaellig).length;
  const darfAendern = (a: Aufgabe) => k.istInhaber || a.erstellt_von === k.userId || a.zugewiesen_an === k.userId;

  async function umschalten(a: Aufgabe) {
    const neu = a.status === 'erledigt' ? 'offen' : 'erledigt';
    const { error } = await supabase.from('aufgaben').update({ status: neu }).eq('id', a.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }

  if (bearbeiten) {
    return (
      <AufgabeFormular
        k={k}
        vorlage={bearbeiten === 'neu' ? null : bearbeiten}
        mitglieder={mitglieder}
        einrichtungen={einrichtungen}
        onFertig={async () => {
          setBearbeiten(null);
          await laden();
        }}
      />
    );
  }

  return (
    <Seite
      titel="Aufgaben"
      untertitel={`${liste.filter((a) => a.status !== 'erledigt').length} offen${anzahlUeberfaellig ? ` · ${anzahlUeberfaellig} überfällig` : ''}`}
      aktion={<Knopf variante="akzent" onClick={() => setBearbeiten('neu')}>+ Aufgabe</Knopf>}
    >
      <Segmente
        label="Anzeige"
        wert={filter}
        onAendern={setFilter}
        optionen={[
          { wert: 'offen', label: 'Offen' },
          { wert: 'meine', label: 'Meine' },
          { wert: 'erledigt', label: 'Erledigt' },
        ]}
      />
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      <Gruppe>
        {sichtbar.length === 0 && (
          <div className="zeile">
            <span className="zeile-label">{filter === 'erledigt' ? 'Noch nichts erledigt' : 'Keine offenen Aufgaben'}</span>
          </div>
        )}
        {sichtbar.map((a) => {
          const ein = einrichtungen.find((e) => e.id === a.einrichtung_id);
          return (
            <div key={a.id} className="zeile aufgabe-zeile">
              <button
                type="button"
                className={`haken ${a.status === 'erledigt' ? 'an' : ''}`}
                onClick={() => void umschalten(a)}
                disabled={!darfAendern(a)}
                aria-label={a.status === 'erledigt' ? `„${a.titel}“ wieder öffnen` : `„${a.titel}“ als erledigt markieren`}
                aria-pressed={a.status === 'erledigt'}
              >
                {a.status === 'erledigt' ? '✓' : ''}
              </button>
              <button type="button" className="aufgabe-text" onClick={() => setBearbeiten(a)}>
                <span className={a.status === 'erledigt' ? 'durch' : ''}>{a.titel}</span>
                <small>
                  {[
                    a.zugewiesen_an ? name(a.zugewiesen_an) : null,
                    ein ? einrichtungLabel(ein) : null,
                    a.status === 'in_arbeit' ? 'in Arbeit' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || ' '}
                </small>
              </button>
              {a.faellig_am && a.status !== 'erledigt' && (
                <span className={`badge ${ueberfaellig(a) ? 'badge-rot' : a.faellig_am === heuteISO() ? 'badge-orange' : ''}`}>
                  {ueberfaellig(a) ? 'überfällig · ' : ''}
                  {datumDE(a.faellig_am)}
                </span>
              )}
              {a.status === 'erledigt' && a.erledigt_am && <span className="badge badge-gruen">{datumDE(a.erledigt_am)}</span>}
            </div>
          );
        })}
      </Gruppe>
      <Leer>Alle Mitglieder können Aufgaben anlegen. Ändern und Erledigen können der Revierinhaber, die anlegende und die zugewiesene Person.</Leer>
    </Seite>
  );
}

function AufgabeFormular({
  k,
  vorlage,
  mitglieder,
  einrichtungen,
  onFertig,
}: {
  k: RevierKontext;
  vorlage: Aufgabe | null;
  mitglieder: ReturnType<typeof useMitglieder>;
  einrichtungen: Einrichtung[];
  onFertig: () => Promise<void>;
}) {
  const [titel, setTitel] = useState(vorlage?.titel ?? '');
  const [beschreibung, setBeschreibung] = useState(vorlage?.beschreibung ?? '');
  const [faellig, setFaellig] = useState(vorlage?.faellig_am ?? '');
  const [zugewiesen, setZugewiesen] = useState(vorlage?.zugewiesen_an ?? '');
  const [einrichtung, setEinrichtung] = useState(vorlage?.einrichtung_id ?? '');
  const [status, setStatus] = useState(vorlage?.status ?? 'offen');
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const darfAendern = !vorlage || k.istInhaber || vorlage.erstellt_von === k.userId || vorlage.zugewiesen_an === k.userId;
  const darfLoeschen = vorlage && (k.istInhaber || vorlage.erstellt_von === k.userId);

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setSpeichert(true);
    const daten = {
      revier_id: k.revierId,
      titel: titel.trim(),
      beschreibung: beschreibung.trim() || null,
      faellig_am: faellig || null,
      zugewiesen_an: zugewiesen || null,
      einrichtung_id: einrichtung || null,
      status,
    };
    const { error } = vorlage ? await supabase.from('aufgaben').update(daten).eq('id', vorlage.id) : await supabase.from('aufgaben').insert(daten);
    setSpeichert(false);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  async function loeschen() {
    if (!vorlage || !window.confirm('Diese Aufgabe löschen?')) return;
    const { error } = await supabase.from('aufgaben').update({ geloescht_am: new Date().toISOString() }).eq('id', vorlage.id);
    if (error) setFehler(fehlertext(error));
    else await onFertig();
  }

  return (
    <Seite titel={vorlage ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} zurueck={() => void onFertig()}>
      <form onSubmit={speichern}>
        <Gruppe>
          <Feld label="Titel" required placeholder="z. B. Hochsitz Eichenkanzel reparieren" value={titel} onChange={(e) => setTitel(e.target.value)} />
          <Feld label="Beschreibung" placeholder="optional" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} />
          <Feld label="Fällig am" type="date" value={faellig} onChange={(e) => setFaellig(e.target.value)} />
          <Auswahl label="Zuständig" value={zugewiesen} onChange={(e) => setZugewiesen(e.target.value)}>
            <option value="">niemand bestimmt</option>
            {mitglieder.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </Auswahl>
          <Auswahl label="Einrichtung" value={einrichtung} onChange={(e) => setEinrichtung(e.target.value)}>
            <option value="">–</option>
            {einrichtungen.map((x) => (
              <option key={x.id} value={x.id}>
                {einrichtungLabel(x)}
              </option>
            ))}
          </Auswahl>
          <Auswahl label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map((s) => (
              <option key={s.wert} value={s.wert}>
                {s.label}
              </option>
            ))}
          </Auswahl>
        </Gruppe>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        {darfAendern ? (
          <Knopf type="submit" disabled={speichert || !titel.trim()}>
            {speichert ? 'Speichern …' : 'Speichern'}
          </Knopf>
        ) : (
          <Leer>Diese Aufgabe kann nur der Revierinhaber, die anlegende oder die zugewiesene Person ändern.</Leer>
        )}
        <Knopf type="button" variante="ghost" onClick={() => void onFertig()}>
          Abbrechen
        </Knopf>
        {darfLoeschen && (
          <Knopf type="button" variante="gefahr" onClick={loeschen}>
            Aufgabe löschen
          </Knopf>
        )}
      </form>
    </Seite>
  );
}
