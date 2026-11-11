import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import type { Enums } from '../lib/database.types';
import { useBreit } from '../lib/useBreit';
import { Auswahl, CodeAnzeige, Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';

type Mitglied = { user_id: string; rolle: Enums<'betrieb_rolle'>; name: string; email: string; login: string | null; aktiv: string | null };
type OffeneEinladung = { code: string; rolle: string; email: string | null; gueltig_bis: string };

const INAKTIV_TAGE = 90;
const zeitpunktDE = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// „vor 2 Tagen“
function vorZeit(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const f = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
  if (min < 2) return 'gerade eben';
  if (min < 60) return f.format(-min, 'minute');
  if (min < 60 * 24) return f.format(-Math.round(min / 60), 'hour');
  if (min < 60 * 24 * 60) return f.format(-Math.round(min / 1440), 'day');
  if (min < 60 * 24 * 365) return f.format(-Math.round(min / 43200), 'month');
  return f.format(-Math.round(min / 525600), 'year');
}

// Aktivität = letzte App-Nutzung, sonst letzte Anmeldung
const referenz = (m: Mitglied) => m.aktiv ?? m.login;

function Aktivitaet({ m }: { m: Mitglied }) {
  const ref = referenz(m);
  if (!ref) return <span className="aktiv-text">Noch nie angemeldet</span>;
  const inaktiv = Date.now() - new Date(ref).getTime() > INAKTIV_TAGE * 86400000;
  const tipp = [m.aktiv ? `Zuletzt aktiv: ${zeitpunktDE(m.aktiv)}` : null, m.login ? `Letzte Anmeldung: ${zeitpunktDE(m.login)}` : null].filter(Boolean).join('\n');
  return (
    <span className="aktiv-text" title={tipp}>
      {m.aktiv ? 'Zuletzt aktiv' : 'Letzte Anmeldung'} {vorZeit(ref)}
      {inaktiv && <span className="badge-inaktiv">Inaktiv</span>}
    </span>
  );
}

export function MitgliederPanel({ betriebId, eigeneId }: { betriebId: string; eigeneId: string }) {
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [offene, setOffene] = useState<OffeneEinladung[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sortierung, setSortierung] = useState<'name' | 'aktivitaet'>('name');
  const [zeigeAktivitaet, setZeigeAktivitaet] = useState(false);
  const breit = useBreit();

  const laden = useCallback(async () => {
    const [mit, logins, einl] = await Promise.all([
      supabase.from('betrieb_mitglieder').select('user_id, rolle, profiles(name, email)').eq('betrieb_id', betriebId),
      supabase.rpc('betrieb_letzte_logins', { p_betrieb_id: betriebId }),
      supabase.from('einladungen').select('code, rolle, email, gueltig_bis').eq('betrieb_id', betriebId).is('eingeloest_am', null).gt('gueltig_bis', new Date().toISOString()).order('gueltig_bis'),
    ]);
    if (mit.error) {
      setFehler(fehlertext(mit.error));
      return;
    }
    // Nur Inhaber des Betriebs bekommen Werte; sonst bleibt die Spalte ausgeblendet
    const aktivMap = new Map((logins.data ?? []).map((l) => [l.user_id, l]));
    setZeigeAktivitaet(!logins.error && aktivMap.size > 0);
    setOffene(einl.error ? [] : (einl.data ?? []));
    setMitglieder(
      (mit.data ?? []).map((m) => ({
        user_id: m.user_id,
        rolle: m.rolle,
        name: m.profiles?.name ?? '–',
        email: m.profiles?.email ?? '',
        login: aktivMap.get(m.user_id)?.letzter_login ?? null,
        aktiv: aktivMap.get(m.user_id)?.zuletzt_aktiv_am ?? null,
      })),
    );
  }, [betriebId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const sortiert = [...mitglieder].sort((a, b) => {
    if (sortierung === 'aktivitaet') {
      // Zuletzt aktive zuerst, „nie angemeldet“ am Ende
      const x = referenz(a);
      const y = referenz(b);
      if (x !== y) return !x ? 1 : !y ? -1 : y.localeCompare(x);
    }
    return a.rolle === b.rolle ? a.name.localeCompare(b.name, 'de') : a.rolle === 'inhaber' ? -1 : 1;
  });

  async function rolleAendern(m: Mitglied, rolle: Enums<'betrieb_rolle'>) {
    setFehler(null);
    const { error } = await supabase
      .from('betrieb_mitglieder')
      .update({ rolle })
      .eq('betrieb_id', betriebId)
      .eq('user_id', m.user_id);
    if (error) setFehler(fehlertext(error));
    await laden();
  }

  async function entfernen(m: Mitglied) {
    if (!window.confirm(`${m.name} aus dem Forstbetrieb entfernen?`)) return;
    setFehler(null);
    const { error } = await supabase
      .from('betrieb_mitglieder')
      .delete()
      .eq('betrieb_id', betriebId)
      .eq('user_id', m.user_id);
    if (error) setFehler(fehlertext(error));
    await laden();
  }

  return (
    <>
      <Gruppe titel="Mitglieder">
        {zeigeAktivitaet && (
          <div style={{ padding: '8px var(--abstand) 0' }}>
            <Auswahl label="Sortieren nach" value={sortierung} onChange={(e) => setSortierung(e.target.value as 'name' | 'aktivitaet')}>
              <option value="name">Name</option>
              <option value="aktivitaet">Letzter Login (zuletzt aktive zuerst)</option>
            </Auswahl>
          </div>
        )}
        {breit && zeigeAktivitaet ? (
          <table className="mitglieder-tabelle">
            <thead>
              <tr>
                <th>Mitglied</th>
                <th>Rolle</th>
                <th>
                  <button type="button" className="link" onClick={() => setSortierung((s) => (s === 'aktivitaet' ? 'name' : 'aktivitaet'))}>
                    Letzter Login {sortierung === 'aktivitaet' ? '↓' : ''}
                  </button>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortiert.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    {m.name}
                    <small>{m.email}</small>
                  </td>
                  <td>
                    <select className="zeile-auswahl" aria-label={`Rolle von ${m.name}`} value={m.rolle} onChange={(e) => rolleAendern(m, e.target.value as Enums<'betrieb_rolle'>)}>
                      <option value="inhaber">Inhaber</option>
                      <option value="mitarbeiter">Mitarbeiter</option>
                    </select>
                  </td>
                  <td>
                    <Aktivitaet m={m} />
                  </td>
                  <td>
                    {m.user_id !== eigeneId && (
                      <button className="link gefahr" onClick={() => entfernen(m)}>
                        Entfernen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {offene.map((e) => (
                <tr key={e.code} className="offen">
                  <td>
                    {e.email ?? 'Einladung ohne E-Mail'}
                    <small>{e.rolle === 'inhaber' ? 'Inhaber' : 'Mitarbeiter'} · gültig bis {new Date(e.gueltig_bis).toLocaleDateString('de-DE')}</small>
                  </td>
                  <td />
                  <td>
                    <span className="aktiv-text">Einladung offen</span>
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            {sortiert.map((m) => (
              <Zeile
                key={m.user_id}
                label={
                  <>
                    {m.name}
                    <small>{m.email}</small>
                    {zeigeAktivitaet && (
                      <small>
                        <Aktivitaet m={m} />
                      </small>
                    )}
                  </>
                }
              >
                <select className="zeile-auswahl" aria-label={`Rolle von ${m.name}`} value={m.rolle} onChange={(e) => rolleAendern(m, e.target.value as Enums<'betrieb_rolle'>)}>
                  <option value="inhaber">Inhaber</option>
                  <option value="mitarbeiter">Mitarbeiter</option>
                </select>
                {m.user_id !== eigeneId && (
                  <button className="link gefahr" onClick={() => entfernen(m)}>
                    Entfernen
                  </button>
                )}
              </Zeile>
            ))}
            {offene.map((e) => (
              <Zeile
                key={e.code}
                label={
                  <>
                    {e.email ?? 'Einladung ohne E-Mail'}
                    <small>
                      Einladung offen · {e.rolle === 'inhaber' ? 'Inhaber' : 'Mitarbeiter'} · gültig bis {new Date(e.gueltig_bis).toLocaleDateString('de-DE')}
                    </small>
                  </>
                }
              />
            ))}
          </>
        )}
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <EinladungErstellen betriebId={betriebId} />
    </>
  );
}

export function EinladungErstellen({
  betriebId,
  festeRolle,
  titel = 'Jemanden einladen',
}: {
  betriebId: string;
  festeRolle?: Enums<'betrieb_rolle'>;
  titel?: string;
}) {
  const [rolle, setRolle] = useState<Enums<'betrieb_rolle'>>(festeRolle ?? 'mitarbeiter');
  const [email, setEmail] = useState('');
  const [tage, setTage] = useState(14);
  const [code, setCode] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setCode(null);
    setLaedt(true);
    const { data, error } = await supabase.rpc('einladung_erstellen', {
      p_betrieb_id: betriebId,
      p_rolle: festeRolle ?? rolle,
      p_email: email.trim() || undefined,
      p_gueltig_tage: tage,
    });
    setLaedt(false);
    if (error) setFehler(fehlertext(error));
    else setCode(data);
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe
        titel={titel}
        fuss="Der Code ist einmal nutzbar. Mit E-Mail-Adresse kann ihn nur diese Person einlösen. Es wird keine E-Mail verschickt – gib den Code selbst weiter."
      >
        {!festeRolle && (
          <Auswahl label="Rolle" value={rolle} onChange={(e) => setRolle(e.target.value as Enums<'betrieb_rolle'>)}>
            <option value="mitarbeiter">Mitarbeiter</option>
            <option value="inhaber">Inhaber</option>
          </Auswahl>
        )}
        <Feld label="E-Mail (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Auswahl label="Gültig" value={tage} onChange={(e) => setTage(Number(e.target.value))}>
          <option value={7}>7 Tage</option>
          <option value={14}>14 Tage</option>
          <option value={30}>30 Tage</option>
          <option value={90}>90 Tage</option>
        </Auswahl>
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {code ? (
        <CodeAnzeige
          code={code}
          beschreibung={`Gib diesen Code weiter. Registrierung unter ${window.location.origin} mit E-Mail, Name und Code.`}
        />
      ) : (
        <Knopf type="submit" variante="sekundaer" disabled={laedt}>
          Einladungscode erstellen
        </Knopf>
      )}
    </form>
  );
}
