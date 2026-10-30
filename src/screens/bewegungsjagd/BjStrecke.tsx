import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten, wildartName } from '../../lib/stammdaten';
import { jagdzeitWarnung, useJagdzeiten } from '../../lib/jagdzeiten';
import { punktEWKT } from '../../lib/geo';
import type { Enums } from '../../lib/database.types';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Segmente, WildartOptionen } from '../../components/ui';
import { AuditZeile } from '../../components/AuditZeile';

export type StreckeEintrag = {
  id: string;
  art: string;
  wildart_id: string | null;
  geschlecht: Enums<'geschlecht'>;
  altersklasse: string | null;
  gewicht_kg: number | null;
  einrichtung_id: string | null;
  erleger_teilnehmer_id: string | null;
  erleger_name: string | null;
  erlegt_am: string;
  bemerkung: string | null;
};

// Strecke einer Bewegungsjagd: direkt in `abschuesse` (mit bewegungsjagd_id), keine Kopie
export function useBjStrecke(jagdId: string) {
  const [liste, setListe] = useState<StreckeEintrag[]>([]);
  const laden = useCallback(async () => {
    const { data } = await supabase
      .from('abschuesse')
      .select('id, art, wildart_id, geschlecht, altersklasse, gewicht_kg, einrichtung_id, erleger_teilnehmer_id, erleger_name, erlegt_am, bemerkung')
      .eq('bewegungsjagd_id', jagdId)
      .is('geloescht_am', null)
      .order('erlegt_am');
    setListe((data ?? []) as StreckeEintrag[]);
  }, [jagdId]);
  useEffect(() => {
    void laden();
  }, [laden]);
  return { liste, laden };
}

// Zusammenfassung „N Stück, davon …“
export function streckeText(liste: StreckeEintrag[], name: (id: string) => string): string {
  const m = new Map<string, number>();
  for (const e of liste) m.set(e.wildart_id ?? '', (m.get(e.wildart_id ?? '') ?? 0) + 1);
  const teile = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${n} ${name(w)}`);
  return `${liste.length} Stück${teile.length ? `, davon ${teile.join(', ')}` : ''}`;
}

type Stand = { id: string; label: string; lng: number; lat: number };
type Tn = { id: string; name: string; status: string };

const HAUPTARTEN = ['schwarzwild', 'rehwild', 'rotwild', 'damwild', 'fuchs', 'dachs', 'waschbaer', 'feldhase'];

export function BjStrecke({
  revierId,
  bundesland,
  jagd,
  staende,
  teilnehmer,
  liste,
  offen,
  onGeaendert,
}: {
  revierId: string;
  bundesland: string;
  jagd: { id: string; datum: string; treffpunkt_lng: number | null; treffpunkt_lat: number | null };
  staende: Stand[];
  teilnehmer: Tn[];
  liste: StreckeEintrag[];
  offen: boolean;
  onGeaendert: () => Promise<void>;
}) {
  const wildarten = useWildarten();
  const { zeilen: jagdzeiten } = useJagdzeiten(bundesland);
  const [modus, setModus] = useState<'schnell' | 'einzeln'>('schnell');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const wname = useCallback((id: string) => wildartName(wildarten, id), [wildarten]);

  // Position: Koordinate des Standes, sonst Treffpunkt
  const position = (standId: string | null): string | null => {
    const s = staende.find((x) => x.id === standId);
    if (s) return punktEWKT(s.lng, s.lat);
    return jagd.treffpunkt_lng != null && jagd.treffpunkt_lat != null ? punktEWKT(jagd.treffpunkt_lng, jagd.treffpunkt_lat) : null;
  };
  const zeit = (hhmm: string) => new Date(`${jagd.datum}T${hhmm || '12:00'}:00`).toISOString();

  // ---------- Schnell: Matrix Wildart × Stand ----------
  const [zeilenArten, setZeilenArten] = useState<string[]>(HAUPTARTEN);
  const [matrix, setMatrix] = useState<Record<string, number>>({});
  const [weitere, setWeitere] = useState('');
  const spalten = [...staende.map((s) => ({ id: s.id, label: s.label })), { id: '', label: 'Ohne Stand' }];
  const summeMatrix = Object.values(matrix).reduce((a, n) => a + n, 0);

  async function matrixSpeichern() {
    setFehler(null);
    setLaeuft(true);
    const zeilen: Array<Record<string, unknown>> = [];
    for (const [schluessel, n] of Object.entries(matrix)) {
      if (n <= 0) continue;
      const [wildart, standId] = schluessel.split('|') as [string, string];
      for (let i = 0; i < n; i++) {
        const geom = position(standId || null);
        zeilen.push({
          revier_id: revierId,
          art: 'abschuss',
          bewegungsjagd_id: jagd.id,
          wildart_id: wildart,
          geschlecht: 'unbekannt',
          einrichtung_id: standId || null,
          erlegt_am: zeit('12:00'),
          erleger_id: null,
          ...(geom ? { geom } : {}),
        });
      }
    }
    if (zeilen.length) {
      const { error } = await supabase.from('abschuesse').insert(zeilen as never);
      if (error) setFehler(fehlertext(error));
      else setMatrix({});
    }
    setLaeuft(false);
    await onGeaendert();
  }

  // ---------- Einzeln ----------
  const leer = { art: 'abschuss', wildart: 'schwarzwild', geschlecht: 'unbekannt' as Enums<'geschlecht'>, alter: '', stand: '', erleger: '', freitext: '', uhr: '', gewicht: '', bemerkung: '' };
  const [f, setF] = useState(leer);
  const [bearbeitet, setBearbeitet] = useState<StreckeEintrag | null>(null);
  const klassen = wildarten.find((w) => w.id === f.wildart)?.altersklassen ?? [];
  const warnung = jagdzeitWarnung(jagdzeiten, f.wildart, new Date(`${jagd.datum}T12:00:00`));
  const zugesagt = teilnehmer.filter((t) => t.status === 'zugesagt');

  async function einzelnSpeichern() {
    setFehler(null);
    const kg = f.gewicht.trim() ? Number(f.gewicht.replace(',', '.')) : null;
    if (kg !== null && (!Number.isFinite(kg) || kg <= 0)) {
      setFehler('Bitte ein gültiges Gewicht angeben.');
      return;
    }
    setLaeuft(true);
    const tn = f.erleger && f.erleger !== '_frei' ? zugesagt.find((t) => t.id === f.erleger) : null;
    const geom = position(f.stand || null);
    const daten = {
      revier_id: revierId,
      art: f.art,
      bewegungsjagd_id: jagd.id,
      wildart_id: f.wildart,
      geschlecht: f.geschlecht,
      altersklasse: f.alter || null,
      gewicht_kg: kg,
      einrichtung_id: f.stand || null,
      erleger_teilnehmer_id: tn?.id ?? null,
      erleger_name: tn ? tn.name : f.erleger === '_frei' ? f.freitext.trim() || null : null,
      erlegt_am: zeit(f.uhr),
      bemerkung: f.bemerkung.trim() || null,
      ...(geom ? { geom } : {}),
    };
    const { error } = bearbeitet ? await supabase.from('abschuesse').update(daten).eq('id', bearbeitet.id) : await supabase.from('abschuesse').insert(daten);
    setLaeuft(false);
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setF({ ...leer, wildart: f.wildart, art: f.art });
    setBearbeitet(null);
    await onGeaendert();
  }

  function bearbeiten(e: StreckeEintrag) {
    setModus('einzeln');
    setBearbeitet(e);
    const d = new Date(e.erlegt_am);
    setF({
      art: e.art,
      wildart: e.wildart_id ?? 'schwarzwild',
      geschlecht: e.geschlecht,
      alter: e.altersklasse ?? '',
      stand: e.einrichtung_id ?? '',
      erleger: e.erleger_teilnehmer_id ?? (e.erleger_name ? '_frei' : ''),
      freitext: e.erleger_teilnehmer_id ? '' : (e.erleger_name ?? ''),
      uhr: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      gewicht: e.gewicht_kg ? String(e.gewicht_kg).replace('.', ',') : '',
      bemerkung: e.bemerkung ?? '',
    });
  }

  async function loeschen(e: StreckeEintrag) {
    if (!window.confirm('Diesen Eintrag löschen?')) return;
    const { error } = await supabase.from('abschuesse').delete().eq('id', e.id);
    setFehler(error ? fehlertext(error) : null);
    await onGeaendert();
  }

  const summe = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of liste) m.set(e.wildart_id ?? '', (m.get(e.wildart_id ?? '') ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [liste]);
  const standLabel = (id: string | null) => staende.find((s) => s.id === id)?.label ?? '';
  const sichtbareArten = zeilenArten.filter((a) => wildarten.some((w) => w.id === a));

  return (
    <Gruppe
      titel={`Strecke: ${liste.length} Stück`}
      fuss={offen ? 'Einträge landen direkt unter „Abschüsse & Fänge“, in der Statistik und im Jagdjahr-Report. Bis zum Abschluss der Jagd sind sie hier bearbeitbar.' : 'Nach dem Abschluss änderst du Einträge unter „Abschüsse & Fänge“.'}
    >
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

      {offen && (
        <div style={{ padding: '8px var(--abstand)' }}>
          <Segmente label="Erfassung" wert={modus} onAendern={setModus} optionen={[{ wert: 'schnell', label: 'Schnell (Matrix)' }, { wert: 'einzeln', label: 'Einzeln' }]} />
        </div>
      )}

      {offen && modus === 'schnell' && (
        <div style={{ padding: '0 var(--abstand) 8px' }}>
          <div className="tabelle-rahmen" style={{ overflowX: 'auto' }}>
            <table className="tabelle">
              <thead>
                <tr>
                  <th scope="col">Wildart</th>
                  {spalten.map((s) => (
                    <th key={s.id || 'ohne'} scope="col" className="zahl">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sichtbareArten.map((a) => (
                  <tr key={a}>
                    <th scope="row">{wname(a)}</th>
                    {spalten.map((s) => {
                      const key = `${a}|${s.id}`;
                      return (
                        <td key={key} className="zahl">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={`${wname(a)} ${s.label}`}
                            style={{ width: 56 }}
                            value={matrix[key] ? matrix[key] : ''}
                            onChange={(e) => setMatrix((m) => ({ ...m, [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Auswahl label="Weitere Wildart" value={weitere} onChange={(e) => { if (e.target.value) setZeilenArten((z) => (z.includes(e.target.value) ? z : [...z, e.target.value])); setWeitere(''); }}>
            <option value="">– hinzufügen –</option>
            <WildartOptionen wildarten={wildarten} />
          </Auswahl>
          <div className="bj-ja-nein">
            <span>{summeMatrix} Stück vorgemerkt</span>
            <Knopf variante="akzent" disabled={laeuft || summeMatrix === 0} onClick={() => void matrixSpeichern()}>
              {laeuft ? 'Speichere …' : `${summeMatrix} Stück eintragen`}
            </Knopf>
          </div>
        </div>
      )}

      {offen && modus === 'einzeln' && (
        <div style={{ padding: '0 var(--abstand) 8px' }}>
          <Segmente label="Art" wert={f.art} onAendern={(a) => setF({ ...f, art: a })} optionen={[{ wert: 'abschuss', label: 'Abschuss' }, { wert: 'fallwild', label: 'Fallwild' }]} />
          <Auswahl label="Wildart" value={f.wildart} onChange={(e) => setF({ ...f, wildart: e.target.value, alter: '' })}>
            <WildartOptionen wildarten={wildarten} />
          </Auswahl>
          <div className="zeile">
            <span className="zeile-label">Geschlecht</span>
            <Segmente label="Geschlecht" wert={f.geschlecht} onAendern={(g) => setF({ ...f, geschlecht: g })} optionen={GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.kurz }))} />
          </div>
          {klassen.length > 0 && (
            <Auswahl label="Altersklasse" value={f.alter} onChange={(e) => setF({ ...f, alter: e.target.value })}>
              <option value="">–</option>
              {klassen.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Auswahl>
          )}
          <Auswahl label="Stand" value={f.stand} onChange={(e) => setF({ ...f, stand: e.target.value })}>
            <option value="">– ohne Stand (Position: Treffpunkt) –</option>
            {staende.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Auswahl>
          <Auswahl label="Erleger" value={f.erleger} onChange={(e) => setF({ ...f, erleger: e.target.value })}>
            <option value="">– unbekannt –</option>
            {zugesagt.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="_frei">Anderer (Freitext) …</option>
          </Auswahl>
          {f.erleger === '_frei' && <Feld label="Name des Erlegers" value={f.freitext} onChange={(e) => setF({ ...f, freitext: e.target.value })} />}
          <Feld label="Uhrzeit" type="time" value={f.uhr} onChange={(e) => setF({ ...f, uhr: e.target.value })} />
          <Feld label="Gewicht (kg, optional)" inputMode="decimal" value={f.gewicht} onChange={(e) => setF({ ...f, gewicht: e.target.value })} />
          <Feld label="Bemerkung" value={f.bemerkung} onChange={(e) => setF({ ...f, bemerkung: e.target.value })} />
          {warnung && <Hinweis art={warnung.art === 'warnung' ? 'warnung' : 'info'}>{warnung.text} (Hinweis, kein Speicherverbot.)</Hinweis>}
          <div className="bj-ja-nein">
            <span>{bearbeitet ? 'Eintrag wird bearbeitet' : ''}</span>
            <span style={{ display: 'flex', gap: 6 }}>
              {bearbeitet && (
                <Knopf variante="ghost" onClick={() => { setBearbeitet(null); setF(leer); }}>
                  Abbrechen
                </Knopf>
              )}
              <Knopf variante="akzent" disabled={laeuft} onClick={() => void einzelnSpeichern()}>
                {laeuft ? 'Speichere …' : bearbeitet ? 'Änderung speichern' : 'Eintrag hinzufügen'}
              </Knopf>
            </span>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <p className="gruppe-fuss" style={{ margin: 0, padding: '4px var(--abstand) 8px' }}>Noch keine Strecke erfasst.</p>
      ) : (
        <div style={{ padding: '4px var(--abstand) 8px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '.9rem' }}>
            <strong>{liste.length} Stück</strong>: {summe.map(([w, n]) => `${n} ${wname(w)}`).join(', ')}
          </p>
          <details>
            <summary>Einzeleinträge ({liste.length})</summary>
            <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 4 }}>
              {liste.map((e) => (
                <li key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span>
                    {e.art === 'fallwild' ? 'Fallwild · ' : ''}
                    {wname(e.wildart_id ?? '')} {GESCHLECHTER.find((g) => g.wert === e.geschlecht)?.kurz}
                    {e.altersklasse ? ` · ${e.altersklasse}` : ''}
                    <small style={{ color: 'var(--text-leise)' }}>
                      {' '}
                      · {new Date(e.erlegt_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      {standLabel(e.einrichtung_id) ? ` · ${standLabel(e.einrichtung_id)}` : ''}
                      {e.erleger_name ? ` · ${e.erleger_name}` : ''}
                      {e.gewicht_kg ? ` · ${e.gewicht_kg.toLocaleString('de-DE')} kg` : ''}
                    </small>
                    {!offen && <AuditZeile tabelle="abschuesse" id={e.id} />}
                  </span>
                  {offen && (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="link" onClick={() => bearbeiten(e)}>Bearbeiten</button>
                      <button type="button" className="link gefahr" onClick={() => void loeschen(e)}>Löschen</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Gruppe>
  );
}
