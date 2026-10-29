import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Geometry } from 'geojson';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { punktEWKT } from '../../lib/geo';
import { datumDE, heuteISO } from '../../lib/zeit';
import { EINRICHTUNGSTYPEN, useMitglieder } from '../../lib/stammdaten';
import { codeAnzeigen, emailGueltig, JAGDARTEN, neuerEntwurf, teilnehmerCsv, type TeilnehmerEntwurf } from '../../lib/bewegungsjagd';
import type { Tables } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Segmente, Seite } from '../../components/ui';
import type { RevierKontext } from '../module/kontext';
import type { BjMarker } from './BjKarte';

const BjKarte = lazy(() => import('./BjKarte'));
const kartenLaden = <div className="laden">Karte wird geladen …</div>;

type Jagd = Tables<'bewegungsjagden'>;
type Teilnehmer = Tables<'bewegungsjagd_teilnehmer'>;
type Einrichtung = { id: string; name: string | null; typ: string; lng: number; lat: number };

type KartenAuszug = { grenze: Geometry | null; einrichtungen: Einrichtung[] };

// Reviergrenze und Einrichtungen aus der Kartenabfrage (ein Aufruf je Ansicht)
function useRevierKarte(revierId: string): KartenAuszug {
  const [d, setD] = useState<KartenAuszug>({ grenze: null, einrichtungen: [] });
  useEffect(() => {
    void supabase.rpc('karte_daten', { p_revier_id: revierId, p_tage: 1 }).then(({ data }) => {
      const x = data as unknown as {
        grenze?: Geometry | null;
        einrichtungen?: Array<{ id?: string; geometry?: { coordinates?: number[] }; properties?: { id?: string; typ?: string; name?: string | null } }>;
      } | null;
      setD({
        grenze: x?.grenze ?? null,
        einrichtungen: (x?.einrichtungen ?? []).map((e) => ({
          id: e.id ?? e.properties?.id ?? '',
          name: e.properties?.name ?? null,
          typ: e.properties?.typ ?? 'sonstiges',
          lng: e.geometry?.coordinates?.[0] ?? 0,
          lat: e.geometry?.coordinates?.[1] ?? 0,
        })),
      });
    });
  }, [revierId]);
  return d;
}

const einrLabel = (e: Einrichtung) => e.name || (EINRICHTUNGSTYPEN.find((t) => t.wert === e.typ)?.label ?? e.typ);

// ---------- Übersicht (normales Modul) ----------

export function BewegungsjagdListe({ k }: { k: RevierKontext }) {
  const [liste, setListe] = useState<Jagd[] | null>(null);
  const [zahlen, setZahlen] = useState<Record<string, { zu: number; gesamt: number }>>({});
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!k.istInhaber) return;
    void (async () => {
      const { data, error } = await supabase.from('bewegungsjagden').select('*').eq('revier_id', k.revierId).is('geloescht_am', null).order('datum', { ascending: false });
      if (error) return setFehler(fehlertext(error));
      setListe(data ?? []);
      const ids = (data ?? []).map((j) => j.id);
      if (!ids.length) return;
      const { data: t } = await supabase.from('bewegungsjagd_teilnehmer').select('bewegungsjagd_id, status, aktiv').in('bewegungsjagd_id', ids);
      const z: Record<string, { zu: number; gesamt: number }> = {};
      for (const x of t ?? []) {
        if (!x.aktiv) continue;
        const e = (z[x.bewegungsjagd_id] ??= { zu: 0, gesamt: 0 });
        e.gesamt++;
        if (x.status === 'zugesagt') e.zu++;
      }
      setZahlen(z);
    })();
  }, [k.revierId, k.istInhaber]);

  if (!k.istInhaber) return <Seite titel="Bewegungsjagd"><Leer>Bewegungsjagden plant der Revierinhaber.</Leer></Seite>;

  return (
    <Seite titel="Bewegungsjagd" untertitel="Einladen, Zu- und Absagen sammeln, Stände zuweisen" aktion={<Knopf variante="akzent" onClick={() => navigieren('/bewegungsjagd/neu')}>+ Neue Jagd</Knopf>}>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {liste === null && !fehler && <div className="laden">Lade …</div>}
      {liste?.length === 0 && <Leer>Noch keine Bewegungsjagd angelegt.</Leer>}
      {!!liste?.length && (
        <Gruppe>
          {liste.map((j) => (
            <button key={j.id} className="bj-zeile" style={{ background: 'none', border: 0, textAlign: 'left', width: '100%', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => navigieren(`/bewegungsjagd/${j.id}`)}>
              <span>
                <strong>{j.titel}</strong>
                <br />
                <small>
                  {j.art} · {datumDE(j.datum)} · {zahlen[j.id]?.zu ?? 0} von {zahlen[j.id]?.gesamt ?? 0} zugesagt
                </small>
              </span>
              <span className={`badge ${j.status === 'offen' ? 'badge-gruen' : ''}`}>{j.status === 'offen' ? 'Offen' : 'Abgeschlossen'}</span>
            </button>
          ))}
        </Gruppe>
      )}
    </Seite>
  );
}

// ---------- Vollbild: Assistent und Auswertung ----------

export function BewegungsjagdVollbild({ k, id }: { k: RevierKontext; id: string }) {
  return (
    <div className="bj-vollbild">
      <header className="bj-vollbild-kopf">
        <nav aria-label="Brotkrumen">
          <button onClick={() => navigieren('/bewegungsjagd')}>‹ Zurück zur Übersicht</button>
          <span>/</span>
          <span>{id === 'neu' ? 'Neue Bewegungsjagd' : 'Bewegungsjagd'}</span>
        </nav>
      </header>
      <main className="bj-vollbild-inhalt">
        {!k.istInhaber ? <Hinweis art="fehler">Nur der Revierinhaber kann Bewegungsjagden verwalten.</Hinweis> : id === 'neu' ? <Assistent k={k} /> : <Auswertung k={k} id={id} />}
      </main>
    </div>
  );
}

const SCHRITTE = ['Grunddaten', 'Teilnehmer', 'Details', 'Stände', 'Einladen'];

function Schritte({ aktuell }: { aktuell: number }) {
  return (
    <ol className="bj-schritte" aria-label="Schritte">
      {SCHRITTE.map((s, i) => (
        <li key={s} aria-current={i === aktuell ? 'step' : undefined}>
          {i + 1} · {s}
        </li>
      ))}
    </ol>
  );
}

function JaNein({ label, wert, onAendern }: { label: string; wert: boolean; onAendern: (v: boolean) => void }) {
  return (
    <div className="bj-ja-nein">
      <span>{label}</span>
      <Segmente label={label} optionen={[{ wert: 'ja', label: 'Ja' }, { wert: 'nein', label: 'Nein' }]} wert={wert ? 'ja' : 'nein'} onAendern={(v) => onAendern(v === 'ja')} />
    </div>
  );
}

function Assistent({ k }: { k: RevierKontext }) {
  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const { grenze, einrichtungen } = useRevierKarte(k.revierId);

  // 1 Grunddaten
  const [titel, setTitel] = useState('');
  const [art, setArt] = useState<(typeof JAGDARTEN)[number]>('Drückjagd');
  const [datum, setDatum] = useState(heuteISO());
  const [uhrzeit, setUhrzeit] = useState('09:00');
  const [treffpunkt, setTreffpunkt] = useState<[number, number] | null>(null);
  const [karteOffen, setKarteOffen] = useState(false);
  // 2 Teilnehmer
  const [teilnehmer, setTeilnehmer] = useState<TeilnehmerEntwurf[]>([]);
  const [neuName, setNeuName] = useState('');
  const [neuMail, setNeuMail] = useState('');
  // 3 Details
  const [text, setText] = useState('');
  const [st, setSt] = useState(false);
  const [stAdresse, setStAdresse] = useState('');
  const [stPflicht, setStPflicht] = useState(false);
  const [hb, setHb] = useState(false);
  const [hbBetrag, setHbBetrag] = useState('');
  // 4 Stände
  const [filterTyp, setFilterTyp] = useState('drueckjagdbock');
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  // 5 Einladen
  const [jagdId, setJagdId] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [versand, setVersand] = useState<Array<{ id: string; ok: boolean; fehler?: string }> | null>(null);
  const [angelegteTn, setAngelegteTn] = useState<Teilnehmer[]>([]);
  const dateiRef = useRef<HTMLInputElement>(null);
  const [mitglieder, setMitglieder] = useState<Array<{ user_id: string; name: string; email: string }>>([]);
  useEffect(() => {
    void supabase
      .from('revier_mitglieder')
      .select('user_id, profiles(name, email)')
      .eq('revier_id', k.revierId)
      .then(({ data }) =>
        setMitglieder(
          (data ?? [])
            .map((m) => ({ user_id: m.user_id, name: m.profiles?.name ?? '', email: m.profiles?.email ?? '' }))
            .filter((m) => m.name && m.email)
            .sort((a, b) => a.name.localeCompare(b.name, 'de')),
        ),
      );
  }, [k.revierId]);
  const schonDa = (email: string) => teilnehmer.some((t) => t.email.toLowerCase() === email.toLowerCase());

  const aktive = teilnehmer.filter((t) => t.aktiv);
  const ungueltig = (t: TeilnehmerEntwurf) => !emailGueltig(t.email) || !t.name;
  const typen = useMemo(() => EINRICHTUNGSTYPEN.filter((t) => einrichtungen.some((e) => e.typ === t.wert)), [einrichtungen]);
  const gefiltert = einrichtungen.filter((e) => e.typ === filterTyp);
  useEffect(() => {
    // Standard: Drückjagdbock; gibt es keine, den ersten vorhandenen Typ
    if (einrichtungen.length && !einrichtungen.some((e) => e.typ === 'drueckjagdbock') && typen[0]) setFilterTyp(typen[0].wert);
  }, [einrichtungen, typen]);

  async function csvWaehlen(f: File | undefined) {
    if (!f) return;
    try {
      const neue = teilnehmerCsv(await f.arrayBuffer());
      if (!neue.length) throw new Error('leer');
      setTeilnehmer((alt) => [...alt, ...neue]);
      setFehler(null);
    } catch {
      setFehler('Die Datei konnte nicht gelesen werden. Erwartet wird „Name;E-Mail“ je Zeile.');
    }
    if (dateiRef.current) dateiRef.current.value = '';
  }

  function weiter() {
    setFehler(null);
    if (schritt === 0) {
      if (!titel.trim() || !datum) return setFehler('Bitte Titel und Datum angeben.');
      if (!treffpunkt) return setFehler('Bitte den Treffpunkt auf der Karte festlegen.');
    }
    if (schritt === 1) {
      if (!aktive.length) return setFehler('Bitte mindestens einen aktiven Teilnehmer angeben.');
      if (aktive.some(ungueltig)) return setFehler('Bitte ungültige E-Mail-Adressen korrigieren, entfernen oder deaktivieren.');
    }
    if (schritt === 2 && hb && !(Number(hbBetrag.replace(',', '.')) > 0)) return setFehler('Bitte einen Hegebeitrag größer 0 angeben.');
    if (schritt === 3) return void anlegen();
    setSchritt(schritt + 1);
  }

  async function anlegen() {
    setSpeichert(true);
    const betrag = hb ? Number(hbBetrag.replace(',', '.')) : null;
    const { data: j, error } = await supabase
      .from('bewegungsjagden')
      .insert({
        revier_id: k.revierId,
        titel: titel.trim(),
        art,
        datum,
        uhrzeit: uhrzeit || null,
        treffpunkt: treffpunkt ? punktEWKT(treffpunkt[0], treffpunkt[1]) : null,
        schuesseltreiben: st,
        schuesseltreiben_adresse: st ? stAdresse.trim() || null : null,
        schuesseltreiben_anmeldung_pflicht: st && stPflicht,
        hegebeitrag_aktiv: hb,
        hegebeitrag_betrag: betrag,
        einladungstext: text.trim() || null,
      })
      .select('id')
      .single();
    if (error || !j) {
      setSpeichert(false);
      return setFehler(fehlertext(error));
    }
    await supabase.from('aufgabenlisten').insert({ revier_id: k.revierId, name: `Jagd: ${titel.trim()}`, bewegungsjagd_id: j.id, erstellt_von: k.userId });
    const { data: tn, error: e2 } = await supabase
      .from('bewegungsjagd_teilnehmer')
      .insert(teilnehmer.map((t) => ({ bewegungsjagd_id: j.id, name: t.name, email: t.email, aktiv: t.aktiv, zugeordnete_einrichtung_id: zuordnung[t.key] || null })))
      .select('*');
    setSpeichert(false);
    if (e2) {
      await supabase.from('bewegungsjagden').delete().eq('id', j.id);
      return setFehler(fehlertext(e2));
    }
    setJagdId(j.id);
    setAngelegteTn(tn ?? []);
    setSchritt(4);
  }

  async function senden() {
    if (!jagdId) return;
    setSpeichert(true);
    setFehler(null);
    const { data, error } = await supabase.functions.invoke('bj-einladen', { body: { jagd_id: jagdId } });
    setSpeichert(false);
    if (error || (data as { fehler?: string })?.fehler) return setFehler((data as { fehler?: string })?.fehler ?? 'Der Versand ist fehlgeschlagen. Die Bewegungsjagd ist angelegt, du kannst die Einladungen später erneut versuchen.');
    setVersand((data as { ergebnisse: Array<{ id: string; ok: boolean; fehler?: string }> }).ergebnisse);
  }

  function automatisch() {
    const frei = gefiltert.filter((e) => !Object.values(zuordnung).includes(e.id));
    const neu = { ...zuordnung };
    for (const t of aktive) if (!neu[t.key] && frei.length) neu[t.key] = frei.shift()!.id;
    setZuordnung(neu);
  }

  const marker: BjMarker[] = treffpunkt ? [{ id: 'tp', lng: treffpunkt[0], lat: treffpunkt[1], art: 'treffpunkt', label: 'Treffpunkt' }] : [];

  return (
    <>
      <Schritte aktuell={schritt} />
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {schritt === 0 && (
        <Gruppe titel="Grunddaten">
          <Feld label="Titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Drückjagd Eichenwald" />
          <Auswahl label="Art" value={art} onChange={(e) => setArt(e.target.value as typeof art)}>
            {JAGDARTEN.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Auswahl>
          <Feld label="Datum" type="date" min={heuteISO()} value={datum} onChange={(e) => setDatum(e.target.value)} />
          <Feld label="Uhrzeit" type="time" value={uhrzeit} onChange={(e) => setUhrzeit(e.target.value)} />
          <div className="bj-ja-nein">
            <span>{treffpunkt ? `Treffpunkt: ${treffpunkt[1].toFixed(5)}, ${treffpunkt[0].toFixed(5)}` : 'Treffpunkt noch nicht gesetzt'}</span>
            <Knopf type="button" variante="sekundaer" onClick={() => setKarteOffen(true)}>
              {treffpunkt ? 'Ändern' : 'Auf Karte wählen'}
            </Knopf>
          </div>
        </Gruppe>
      )}
      {karteOffen && (
        <div className="bj-dialog-hintergrund" role="dialog" aria-modal="true" aria-label="Treffpunkt wählen">
          <div className="bj-dialog" style={{ maxWidth: 720 }}>
            <strong>Treffpunkt wählen</strong>
            <p style={{ margin: 0, fontSize: '.88rem', color: 'var(--color-text-muted)' }}>Tippe auf die Karte, um den Treffpunkt zu setzen.</p>
            <Suspense fallback={kartenLaden}>
              <BjKarte className="bj-karte bj-karte-hoch" marker={marker} grenze={grenze} waehlbar onWaehlen={(lng, lat) => setTreffpunkt([lng, lat])} />
            </Suspense>
            <div className="bj-dialog-knoepfe">
              <Knopf variante="akzent" disabled={!treffpunkt} onClick={() => setKarteOffen(false)}>
                Übernehmen
              </Knopf>
            </div>
          </div>
        </div>
      )}

      {schritt === 1 && (
        <>
          <Gruppe titel="Teilnehmer" fuss="CSV mit „Name;E-Mail“ je Zeile (Trennzeichen wird erkannt) oder einzeln hinzufügen.">
            <div className="bj-ja-nein">
              <span>{teilnehmer.length} Einträge · {aktive.length} aktiv</span>
              <span>
                <input ref={dateiRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => void csvWaehlen(e.target.files?.[0])} />
                <Knopf type="button" variante="sekundaer" onClick={() => dateiRef.current?.click()}>
                  CSV hochladen
                </Knopf>
              </span>
            </div>
            <Feld label="Name" value={neuName} onChange={(e) => setNeuName(e.target.value)} />
            <Feld label="E-Mail" type="email" value={neuMail} onChange={(e) => setNeuMail(e.target.value)} />
            <div className="bj-ja-nein">
              <span />
              <Knopf
                type="button"
                variante="sekundaer"
                disabled={!neuName.trim() || !neuMail.trim()}
                onClick={() => {
                  setTeilnehmer((a) => [...a, neuerEntwurf(neuName, neuMail)]);
                  setNeuName('');
                  setNeuMail('');
                }}
              >
                Hinzufügen
              </Knopf>
            </div>
          </Gruppe>
          {mitglieder.length > 0 && (
            <Gruppe titel="Reviermitglieder" fuss="Bereits im Revier angemeldete Jäger übernehmen.">
              <div className="bj-ja-nein">
                <span>{mitglieder.filter((m) => !schonDa(m.email)).length} noch nicht übernommen</span>
                <Knopf
                  type="button"
                  variante="sekundaer"
                  disabled={mitglieder.every((m) => schonDa(m.email))}
                  onClick={() => setTeilnehmer((a) => [...a, ...mitglieder.filter((m) => !a.some((t) => t.email.toLowerCase() === m.email.toLowerCase())).map((m) => neuerEntwurf(m.name, m.email))])}
                >
                  Alle übernehmen
                </Knopf>
              </div>
              {mitglieder.map((m) => (
                <div key={m.user_id} className="bj-zeile">
                  <span>
                    {m.name}
                    <br />
                    <small>{m.email}</small>
                  </span>
                  <Knopf type="button" variante="ghost" disabled={schonDa(m.email)} onClick={() => setTeilnehmer((a) => [...a, neuerEntwurf(m.name, m.email)])}>
                    {schonDa(m.email) ? 'Übernommen' : 'Hinzufügen'}
                  </Knopf>
                </div>
              ))}
            </Gruppe>
          )}
          {teilnehmer.length > 0 && (
            <Gruppe titel="Vorschau">
              {teilnehmer.map((t) => (
                <div key={t.key} className={`bj-zeile ${t.aktiv ? '' : 'inaktiv'}`}>
                  <span>
                    <strong>{t.name || '(ohne Name)'}</strong>
                    <br />
                    <small>
                      {t.email || '(ohne E-Mail)'} {ungueltig(t) && <span className="badge badge-rot">ungültig</span>}
                    </small>
                  </span>
                  <span className="bj-zeile-aktionen">
                    <Knopf type="button" variante="ghost" onClick={() => setTeilnehmer((a) => a.map((x) => (x.key === t.key ? { ...x, aktiv: !x.aktiv } : x)))}>
                      {t.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                    </Knopf>
                    <Knopf type="button" variante="gefahr" onClick={() => setTeilnehmer((a) => a.filter((x) => x.key !== t.key))}>
                      Löschen
                    </Knopf>
                  </span>
                </div>
              ))}
            </Gruppe>
          )}
        </>
      )}

      {schritt === 2 && (
        <>
          <Gruppe titel="Details" fuss="Hund, Jagdhornbläser sowie Auto und Mitfahrplätze fragen wir bei der Zusage automatisch ab.">
            <label className="bj-text">
              <span>Einladungstext (erscheint in der E-Mail und auf der Anmeldeseite)</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <JaNein label="Schüsseltreiben" wert={st} onAendern={setSt} />
            {st && (
              <>
                <Feld label="Adresse" value={stAdresse} onChange={(e) => setStAdresse(e.target.value)} placeholder="Straße, Ort" />
                <JaNein label="Anmeldung verpflichtend" wert={stPflicht} onAendern={setStPflicht} />
              </>
            )}
            <JaNein label="Hegebeitrag" wert={hb} onAendern={setHb} />
            {hb && <Feld label="Betrag (€)" inputMode="decimal" value={hbBetrag} onChange={(e) => setHbBetrag(e.target.value)} placeholder="z. B. 25" />}
          </Gruppe>
        </>
      )}

      {schritt === 3 && (
        <Gruppe titel="Stände zuweisen" fuss={`Es gibt ${einrichtungen.filter((e) => e.typ === 'drueckjagdbock').length} Drückjagdböcke im Revier. Die Zuweisung ist optional.`}>
          <Auswahl label="Einrichtungstyp" value={filterTyp} onChange={(e) => setFilterTyp(e.target.value)}>
            {EINRICHTUNGSTYPEN.map((t) => (
              <option key={t.wert} value={t.wert}>
                {t.label} ({einrichtungen.filter((e) => e.typ === t.wert).length})
              </option>
            ))}
          </Auswahl>
          <div className="bj-ja-nein">
            <span />
            <Knopf type="button" variante="sekundaer" onClick={automatisch}>
              Automatisch zuordnen
            </Knopf>
          </div>
          {aktive.map((t) => (
            <Auswahl key={t.key} label={t.name} value={zuordnung[t.key] ?? ''} onChange={(e) => setZuordnung((z) => ({ ...z, [t.key]: e.target.value }))}>
              <option value="">– kein Stand –</option>
              {gefiltert.map((e) => {
                const vergeben = Object.entries(zuordnung).some(([key, v]) => v === e.id && key !== t.key);
                return (
                  <option key={e.id} value={e.id} disabled={vergeben}>
                    {einrLabel(e)}
                    {vergeben ? ' (vergeben)' : ''}
                  </option>
                );
              })}
              {zuordnung[t.key] && !gefiltert.some((e) => e.id === zuordnung[t.key]) && <option value={zuordnung[t.key]}>{einrLabel(einrichtungen.find((e) => e.id === zuordnung[t.key])!)}</option>}
            </Auswahl>
          ))}
        </Gruppe>
      )}

      {schritt === 4 && (
        <Gruppe titel="Einladungen versenden" fuss="Jeder aktive Teilnehmer erhält eine E-Mail mit persönlichem Link und Code (XXXX-XXXX). Der Code gilt bis zum Jagdtag.">
          <div className="bj-ja-nein">
            <span>{angelegteTn.filter((t) => t.aktiv).length} Empfänger</span>
            {!versand && (
              <Knopf variante="akzent" disabled={speichert} onClick={() => void senden()}>
                {speichert ? 'Sende …' : 'Einladungen senden'}
              </Knopf>
            )}
          </div>
          {versand &&
            angelegteTn
              .filter((t) => t.aktiv)
              .map((t) => {
                const r = versand.find((x) => x.id === t.id);
                return (
                  <div key={t.id} className="bj-zeile">
                    <span>
                      {t.name}
                      <br />
                      <small>{t.email}{r?.fehler ? ` · ${r.fehler}` : ''}</small>
                    </span>
                    <span className={`badge ${r?.ok ? 'badge-gruen' : 'badge-rot'}`}>{r?.ok ? 'gesendet' : 'Fehler'}</span>
                  </div>
                );
              })}
        </Gruppe>
      )}

      <div className="bj-dialog-knoepfe">
        {schritt > 0 && schritt < 4 && (
          <Knopf variante="ghost" onClick={() => setSchritt(schritt - 1)} disabled={speichert}>
            Zurück
          </Knopf>
        )}
        {schritt < 4 ? (
          <Knopf variante="akzent" onClick={weiter} disabled={speichert}>
            {schritt === 3 ? (speichert ? 'Lege an …' : 'Anlegen & weiter') : 'Weiter'}
          </Knopf>
        ) : (
          <Knopf variante={versand ? 'akzent' : 'sekundaer'} onClick={() => navigieren(`/bewegungsjagd/${jagdId}`)} disabled={speichert}>
            {versand ? 'Zur Auswertung' : 'Ohne Versand zur Auswertung'}
          </Knopf>
        )}
      </div>
    </>
  );
}

// ---------- Auswertung ----------

type Aufgabe = Pick<Tables<'aufgaben'>, 'id' | 'titel' | 'faellig_am' | 'status' | 'zugewiesen_an'>;
type StatusFilter = 'alle' | 'eingeladen' | 'zugesagt' | 'abgesagt';

function Auswertung({ k, id }: { k: RevierKontext; id: string }) {
  const [jagd, setJagd] = useState<Jagd | null>(null);
  const [tn, setTn] = useState<Teilnehmer[]>([]);
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('alle');
  const [abschluss, setAbschluss] = useState(false);
  const [kommentar, setKommentar] = useState('');
  const [aufgabeTitel, setAufgabeTitel] = useState('');
  const [aufgabeFaellig, setAufgabeFaellig] = useState('');
  const [aufgabeWer, setAufgabeWer] = useState('');
  const { grenze, einrichtungen } = useRevierKarte(k.revierId);
  const mitglieder = useMitglieder(k.revierId);

  const laden = useCallback(async () => {
    const [{ data: j, error }, { data: t }, { data: l }] = await Promise.all([
      supabase.from('bewegungsjagden').select('*').eq('id', id).eq('revier_id', k.revierId).maybeSingle(),
      supabase.from('bewegungsjagd_teilnehmer').select('*').eq('bewegungsjagd_id', id).order('name'),
      supabase.from('aufgabenlisten').select('id').eq('bewegungsjagd_id', id).is('geloescht_am', null).maybeSingle(),
    ]);
    const { data: a } = l
      ? await supabase.from('aufgaben').select('id, titel, faellig_am, status, zugewiesen_an').eq('liste_id', l.id).is('geloescht_am', null).order('faellig_am', { nullsFirst: false })
      : { data: [] as Aufgabe[] };
    if (error) setFehler(fehlertext(error));
    else if (!j) setFehler('Diese Bewegungsjagd gibt es nicht (mehr).');
    setJagd(j);
    setTn(t ?? []);
    setAufgaben(a ?? []);
  }, [id, k.revierId]);
  useEffect(() => {
    void laden();
  }, [laden]);

  const z = useMemo(() => {
    const zu = tn.filter((t) => t.status === 'zugesagt');
    return {
      zu: zu.length,
      ab: tn.filter((t) => t.status === 'abgesagt').length,
      offen: tn.filter((t) => t.aktiv && t.status === 'eingeladen').length,
      hunde: zu.filter((t) => t.hat_hund).length,
      hornblaeser: zu.filter((t) => t.hat_hornblaeser).length,
      plaetze: zu.reduce((s, t) => s + (t.auto_vorhanden ? t.mitfahrplaetze ?? 0 : 0), 0),
      schuessel: zu.filter((t) => t.schuesseltreiben_teilnahme).length,
      hege: jagd?.hegebeitrag_aktiv ? zu.length * Number(jagd.hegebeitrag_betrag ?? 0) : 0,
    };
  }, [tn, jagd]);

  if (!jagd) return fehler ? <Hinweis art="fehler">{fehler}</Hinweis> : <div className="laden">Lade …</div>;
  const offen = jagd.status === 'offen';
  const sichtbar = tn.filter((t) => filter === 'alle' || t.status === filter);
  const stand = (eid: string | null) => einrichtungen.find((e) => e.id === eid);
  const marker: BjMarker[] = [
    ...(jagd.treffpunkt_lng != null && jagd.treffpunkt_lat != null ? [{ id: 'tp', lng: jagd.treffpunkt_lng, lat: jagd.treffpunkt_lat, art: 'treffpunkt' as const, label: 'Treffpunkt' }] : []),
    ...einrichtungen.filter((e) => e.typ === 'drueckjagdbock').map((e) => ({ id: e.id, lng: e.lng, lat: e.lat, art: 'bock' as const, label: einrLabel(e) })),
  ];

  async function aendern(t: Teilnehmer, felder: Partial<Teilnehmer>) {
    const { error } = await supabase.from('bewegungsjagd_teilnehmer').update(felder).eq('id', t.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }
  async function entfernen(t: Teilnehmer) {
    if (!window.confirm(`${t.name} aus der Einladungsliste entfernen?`)) return;
    const { error } = await supabase.from('bewegungsjagd_teilnehmer').delete().eq('id', t.id);
    setFehler(error ? fehlertext(error) : null);
    await laden();
  }
  async function abschliessen(mitKommentar: boolean) {
    const { error } = await supabase.from('bewegungsjagden').update({ status: 'abgeschlossen', abschlusskommentar: mitKommentar ? kommentar.trim() || null : null }).eq('id', id);
    setFehler(error ? fehlertext(error) : null);
    setAbschluss(false);
    await laden();
  }
  async function aufgabeAnlegen() {
    if (!aufgabeTitel.trim()) return;
    let { data: l } = await supabase.from('aufgabenlisten').select('id').eq('bewegungsjagd_id', id).is('geloescht_am', null).maybeSingle();
    if (!l) {
      const r = await supabase.from('aufgabenlisten').insert({ revier_id: k.revierId, name: `Jagd: ${jagd?.titel ?? 'Bewegungsjagd'}`, bewegungsjagd_id: id, erstellt_von: k.userId }).select('id').single();
      if (r.error) return setFehler(fehlertext(r.error));
      l = r.data;
    }
    const { error } = await supabase.from('aufgaben').insert({
      revier_id: k.revierId,
      liste_id: l.id,
      titel: aufgabeTitel.trim(),
      faellig_am: aufgabeFaellig || null,
      zugewiesen_an: aufgabeWer || null,
      erstellt_von: k.userId,
    });
    if (error) return setFehler(fehlertext(error));
    setAufgabeTitel('');
    setAufgabeFaellig('');
    setAufgabeWer('');
    await laden();
  }
  async function aufgabeUmschalten(a: Aufgabe) {
    await supabase.from('aufgaben').update({ status: a.status === 'erledigt' ? 'offen' : 'erledigt' }).eq('id', a.id);
    await laden();
  }

  const link = `${window.location.origin}/bj/${jagd.id}`;

  return (
    <>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{jagd.titel}</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)' }}>
          {jagd.art} · {datumDE(jagd.datum)}
          {jagd.uhrzeit ? `, ${jagd.uhrzeit.slice(0, 5)} Uhr` : ''} ·{' '}
          <span className={`badge ${offen ? 'badge-gruen' : ''}`}>{offen ? 'Offen' : 'Abgeschlossen'}</span>
        </p>
      </div>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      <div className="bj-zaehler">
        <div><strong>{z.zu}</strong><span>Zusagen</span></div>
        <div><strong>{z.ab}</strong><span>Absagen</span></div>
        <div><strong>{z.offen}</strong><span>Ohne Antwort</span></div>
        <div><strong>{z.hunde}</strong><span>Hunde</span></div>
        <div><strong>{z.hornblaeser}</strong><span>Hornbläser</span></div>
        <div><strong>{z.plaetze}</strong><span>Mitfahrplätze</span></div>
        {jagd.schuesseltreiben && <div><strong>{z.schuessel}</strong><span>Schüsseltreiben</span></div>}
        {jagd.hegebeitrag_aktiv && <div><strong>{z.hege.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong><span>Hegebeitrag (Zusagen)</span></div>}
      </div>

      <Gruppe titel="Teilnehmer">
        <div style={{ padding: '10px var(--abstand)' }}>
          <Segmente<StatusFilter>
            label="Statusfilter"
            optionen={[{ wert: 'alle', label: 'Alle' }, { wert: 'eingeladen', label: 'Offen' }, { wert: 'zugesagt', label: 'Zugesagt' }, { wert: 'abgesagt', label: 'Abgesagt' }]}
            wert={filter}
            onAendern={setFilter}
          />
        </div>
        {sichtbar.length === 0 && <Leer>Keine Teilnehmer in dieser Ansicht.</Leer>}
        {sichtbar.map((t) => (
          <div key={t.id} className={`bj-zeile ${t.aktiv ? '' : 'inaktiv'}`}>
            <span>
              <strong>{t.name}</strong> <span className={`badge ${t.status === 'zugesagt' ? 'badge-gruen' : t.status === 'abgesagt' ? 'badge-rot' : ''}`}>{t.status === 'eingeladen' ? 'offen' : t.status}</span>
              <br />
              <small>
                {t.email} · Code {codeAnzeigen(t.einladungscode)}
                {t.mail_status && ` · Mail ${t.mail_status === 'gesendet' ? 'gesendet' : `Fehler (${t.mail_fehler ?? '?'})`}`}
              </small>
              {t.status === 'zugesagt' && (
                <>
                  <br />
                  <small>
                    {[t.hat_hund && 'Hund', t.hat_hornblaeser && 'Hornbläser', t.auto_vorhanden && `Auto, ${t.mitfahrplaetze ?? 0} Mitfahrplätze`, t.schuesseltreiben_teilnahme && 'Schüsseltreiben', t.anschrift].filter(Boolean).join(' · ')}
                  </small>
                </>
              )}
            </span>
            <span className="bj-zeile-aktionen">
              {offen ? (
                <>
                  <select aria-label={`Stand für ${t.name}`} value={t.zugeordnete_einrichtung_id ?? ''} onChange={(e) => void aendern(t, { zugeordnete_einrichtung_id: e.target.value || null })}>
                    <option value="">– kein Stand –</option>
                    {einrichtungen.filter((e) => e.typ === 'drueckjagdbock' || e.id === t.zugeordnete_einrichtung_id).map((e) => (
                      <option key={e.id} value={e.id}>
                        {einrLabel(e)}
                      </option>
                    ))}
                  </select>
                  <Knopf variante="ghost" onClick={() => void aendern(t, { aktiv: !t.aktiv })}>{t.aktiv ? 'Deaktivieren' : 'Aktivieren'}</Knopf>
                  <Knopf variante="gefahr" onClick={() => void entfernen(t)}>Löschen</Knopf>
                </>
              ) : (
                <small>{stand(t.zugeordnete_einrichtung_id) ? einrLabel(stand(t.zugeordnete_einrichtung_id)!) : ''}</small>
              )}
            </span>
          </div>
        ))}
      </Gruppe>

      <Gruppe titel="Karte">
        <div style={{ padding: 10 }}>
          <Suspense fallback={kartenLaden}>
            <BjKarte marker={marker} grenze={grenze} />
          </Suspense>
        </div>
      </Gruppe>

      <Gruppe titel="Aufgaben zur Jagd">
        {aufgaben.length === 0 && <Leer>Noch keine Aufgaben.</Leer>}
        {aufgaben.map((a) => (
          <div key={a.id} className="bj-zeile">
            <span>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={a.status === 'erledigt'} onChange={() => void aufgabeUmschalten(a)} />
                <span style={a.status === 'erledigt' ? { textDecoration: 'line-through' } : undefined}>{a.titel}</span>
              </label>
              <small>
                {a.faellig_am ? `fällig ${datumDE(a.faellig_am)}` : 'ohne Fälligkeit'}
                {a.zugewiesen_an ? ` · ${mitglieder.find((m) => m.user_id === a.zugewiesen_an)?.name ?? ''}` : ''}
              </small>
            </span>
          </div>
        ))}
        <Feld label="Neue Aufgabe" value={aufgabeTitel} onChange={(e) => setAufgabeTitel(e.target.value)} placeholder="z. B. Stände prüfen" />
        <Feld label="Fällig am" type="date" value={aufgabeFaellig} onChange={(e) => setAufgabeFaellig(e.target.value)} />
        <Auswahl label="Zuständig" value={aufgabeWer} onChange={(e) => setAufgabeWer(e.target.value)}>
          <option value="">– niemand –</option>
          {mitglieder.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.name}</option>
          ))}
        </Auswahl>
        <div className="bj-ja-nein"><span /><Knopf variante="sekundaer" disabled={!aufgabeTitel.trim()} onClick={() => void aufgabeAnlegen()}>Aufgabe hinzufügen</Knopf></div>
      </Gruppe>

      <Gruppe titel="Anmeldeseite" fuss="Teilnehmer öffnen die Seite über den Link in ihrer E-Mail.">
        <div className="bj-text"><span>{link}</span></div>
      </Gruppe>

      {jagd.abschlusskommentar && (
        <Gruppe titel="Abschlusskommentar">
          <div className="bj-text"><span style={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>{jagd.abschlusskommentar}</span></div>
        </Gruppe>
      )}
      {offen && (
        <div className="bj-dialog-knoepfe">
          <Knopf variante="akzent" onClick={() => setAbschluss(true)}>Jagd abschließen</Knopf>
        </div>
      )}

      {abschluss && (
        <div className="bj-dialog-hintergrund" role="dialog" aria-modal="true" aria-label="Jagd abschließen">
          <div className="bj-dialog">
            <strong>Kommentare speichern?</strong>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '.9rem' }}>Nach dem Abschluss sind keine Zu- oder Absagen mehr möglich.</p>
            <label className="bj-text" style={{ padding: 0 }}>
              <span>Abschlusskommentar (optional)</span>
              <textarea value={kommentar} onChange={(e) => setKommentar(e.target.value)} />
            </label>
            <div className="bj-dialog-knoepfe">
              <Knopf variante="ghost" onClick={() => setAbschluss(false)}>Abbrechen</Knopf>
              <Knopf variante="sekundaer" onClick={() => void abschliessen(false)}>Ohne Kommentar</Knopf>
              <Knopf variante="akzent" onClick={() => void abschliessen(true)}>Speichern & abschließen</Knopf>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

