import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useMitglieder } from '../../lib/stammdaten';
import { datumDE, heuteISO } from '../../lib/zeit';
import type { Tables } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente } from '../../components/ui';
import type { RevierKontext } from './kontext';

type Aufgabe = Pick<Tables<'aufgaben'>, 'id' | 'titel' | 'beschreibung' | 'faellig_am' | 'status' | 'zugewiesen_an' | 'einrichtung_id' | 'erledigt_am' | 'erstellt_von' | 'liste_id'>;
type Liste = Pick<Tables<'aufgabenlisten'>, 'id' | 'name' | 'bewegungsjagd_id' | 'erstellt_von'>;
// Auswahl der Listenansicht: alle Aufgaben, nur ohne Liste oder eine bestimmte Liste
type Ansicht = 'alle' | 'ohne' | string;
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
  const [listen, setListen] = useState<Liste[]>([]);
  const [ansicht, setAnsicht] = useState<Ansicht>('alle');
  const [listeName, setListeName] = useState<string | null>(null); // null = Eingabe zu; '' = neue Liste; sonst Name
  const [listeUmbenennen, setListeUmbenennen] = useState(false);

  const listenLaden = useCallback(async () => {
    const { data } = await supabase.from('aufgabenlisten').select('id, name, bewegungsjagd_id, erstellt_von').eq('revier_id', k.revierId).is('geloescht_am', null).order('name');
    setListen(data ?? []);
  }, [k.revierId]);

  const laden = useCallback(async () => {
    void listenLaden();
    const { data, error } = await supabase
      .from('aufgaben')
      .select('id, titel, beschreibung, faellig_am, status, zugewiesen_an, einrichtung_id, erledigt_am, erstellt_von, liste_id')
      .eq('revier_id', k.revierId)
      .is('geloescht_am', null)
      .order('faellig_am', { ascending: true, nullsFirst: false })
      .order('erstellt_am', { ascending: false });
    if (error) setFehler(fehlertext(error));
    setListe(data ?? []);
  }, [k.revierId, listenLaden]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const imAusschnitt = useMemo(
    () => (ansicht === 'alle' ? liste : ansicht === 'ohne' ? liste.filter((a) => !a.liste_id) : liste.filter((a) => a.liste_id === ansicht)),
    [liste, ansicht],
  );
  const sichtbar = useMemo(() => {
    if (filter === 'erledigt') return imAusschnitt.filter((a) => a.status === 'erledigt').sort((a, b) => (b.erledigt_am ?? '').localeCompare(a.erledigt_am ?? ''));
    const offen = imAusschnitt.filter((a) => a.status !== 'erledigt');
    return filter === 'meine' ? offen.filter((a) => a.zugewiesen_an === k.userId) : offen;
  }, [imAusschnitt, filter, k.userId]);
  const fortschritt = (id: string | null) => {
    const l = liste.filter((a) => (id === null ? !a.liste_id : a.liste_id === id));
    return { fertig: l.filter((a) => a.status === 'erledigt').length, gesamt: l.length };
  };
  const aktiveListe = listen.find((l) => l.id === ansicht) ?? null;
  const listeVerwalten = (l: Liste) => k.istInhaber || l.erstellt_von === k.userId;

  async function listeSpeichern() {
    const n = (listeName ?? '').trim();
    if (!n) return;
    if (listeUmbenennen && aktiveListe) {
      const { error } = await supabase.from('aufgabenlisten').update({ name: n }).eq('id', aktiveListe.id);
      setFehler(error ? fehlertext(error) : null);
    } else {
      const { data, error } = await supabase.from('aufgabenlisten').insert({ revier_id: k.revierId, name: n, erstellt_von: k.userId }).select('id').single();
      setFehler(error ? fehlertext(error) : null);
      if (data) setAnsicht(data.id);
    }
    setListeName(null);
    setListeUmbenennen(false);
    await laden();
  }
  async function listeLoeschen(l: Liste) {
    if (l.bewegungsjagd_id) return setFehler('Die Liste einer Bewegungsjagd wird mit der Jagd verwaltet und kann hier nicht gelöscht werden.');
    if (!window.confirm(`Liste „${l.name}“ löschen? Die Aufgaben bleiben erhalten und stehen dann ohne Liste.`)) return;
    const r1 = await supabase.from('aufgaben').update({ liste_id: null }).eq('liste_id', l.id);
    const r2 = r1.error ? r1 : await supabase.from('aufgabenlisten').update({ geloescht_am: new Date().toISOString() }).eq('id', l.id);
    setFehler(r2.error ? fehlertext(r2.error) : null);
    setAnsicht('alle');
    await laden();
  }

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
        listen={listen}
        vorgabeListe={aktiveListe?.id ?? ''}
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
      <Gruppe>
        <button type="button" className="zeile liste-zeile" aria-pressed={ansicht === 'alle'} onClick={() => setAnsicht('alle')}>
          <span className="zeile-label">Alle Aufgaben</span>
          {ansicht === 'alle' && <span className="badge badge-gruen">gewählt</span>}
        </button>
        {listen.map((l) => {
          const f = fortschritt(l.id);
          return (
            <button key={l.id} type="button" className="zeile liste-zeile" aria-pressed={ansicht === l.id} onClick={() => setAnsicht(l.id)}>
              <span className="zeile-label">{l.name}</span>
              <span className={`badge ${f.gesamt > 0 && f.fertig === f.gesamt ? 'badge-gruen' : ''}`}>
                {f.fertig}/{f.gesamt} erledigt
              </span>
            </button>
          );
        })}
        <button type="button" className="zeile liste-zeile" aria-pressed={ansicht === 'ohne'} onClick={() => setAnsicht('ohne')}>
          <span className="zeile-label">Ohne Liste</span>
          <span className="badge">{fortschritt(null).fertig}/{fortschritt(null).gesamt} erledigt</span>
        </button>
      </Gruppe>
      {listeName === null ? (
        <div className="liste-aktionen">
          <Knopf variante="ghost" onClick={() => { setListeUmbenennen(false); setListeName(''); }}>+ Liste</Knopf>
          {aktiveListe && listeVerwalten(aktiveListe) && (
            <>
              <Knopf variante="ghost" onClick={() => { setListeUmbenennen(true); setListeName(aktiveListe.name); }}>Umbenennen</Knopf>
              <Knopf variante="ghost" onClick={() => void listeLoeschen(aktiveListe)}>Liste löschen</Knopf>
            </>
          )}
        </div>
      ) : (
        <Gruppe>
          <Feld label={listeUmbenennen ? 'Neuer Name' : 'Name der Liste'} placeholder="z. B. Hochsitze im Herbst" value={listeName} onChange={(e) => setListeName(e.target.value)} />
          <div className="liste-aktionen">
            <Knopf onClick={() => void listeSpeichern()} disabled={!listeName.trim()}>Speichern</Knopf>
            <Knopf variante="ghost" onClick={() => { setListeName(null); setListeUmbenennen(false); }}>Abbrechen</Knopf>
          </div>
        </Gruppe>
      )}
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
                    ansicht === 'alle' && a.liste_id ? listen.find((l) => l.id === a.liste_id)?.name : null,
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
  listen,
  vorgabeListe,
  onFertig,
}: {
  k: RevierKontext;
  vorlage: Aufgabe | null;
  mitglieder: ReturnType<typeof useMitglieder>;
  einrichtungen: Einrichtung[];
  listen: Liste[];
  vorgabeListe: string;
  onFertig: () => Promise<void>;
}) {
  const [titel, setTitel] = useState(vorlage?.titel ?? '');
  const [beschreibung, setBeschreibung] = useState(vorlage?.beschreibung ?? '');
  const [faellig, setFaellig] = useState(vorlage?.faellig_am ?? '');
  const [zugewiesen, setZugewiesen] = useState(vorlage?.zugewiesen_an ?? '');
  const [einrichtung, setEinrichtung] = useState(vorlage?.einrichtung_id ?? '');
  const [status, setStatus] = useState(vorlage?.status ?? 'offen');
  const [listeId, setListeId] = useState(vorlage ? vorlage.liste_id ?? '' : vorgabeListe);
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
      liste_id: listeId || null,
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
          <Auswahl label="Liste" value={listeId} onChange={(e) => setListeId(e.target.value)}>
            <option value="">ohne Liste</option>
            {listen.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
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
