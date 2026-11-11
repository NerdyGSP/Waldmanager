import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { datumDE } from '../lib/zeit';
import { CodeAnzeige, Gruppe, Hinweis, Knopf, Seite } from '../components/ui';
import { AdminPanel } from './AdminPanel';
import { Symbol } from '../components/symbole';

type Zeile = {
  key: string;
  art: 'mitglied' | 'einladung';
  betrieb: string;
  betriebId: string;
  name: string;
  email: string;
  rolle: string;
  einladung: string | null; // Ablaufdatum der offenen Einladung
  login: string | null;
  userId?: string;
  einladungId?: string;
};
type Spalte = 'betrieb' | 'name' | 'rolle' | 'einladung' | 'login';
const ROLLEN: Record<string, string> = { inhaber: 'Inhaber', mitarbeiter: 'Mitarbeiter' };

// Masteradmin: Gesamtübersicht der Mitgliedschaften (ohne Fachdaten) und Verwaltung der Forstbetriebe
export function Masteradmin({ userId, nachAenderung }: { userId: string; nachAenderung: (betriebId?: string | null) => Promise<void> }) {
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [suche, setSuche] = useState('');
  const [betrieb, setBetrieb] = useState('');
  const [sort, setSort] = useState<{ spalte: Spalte; auf: boolean }>({ spalte: 'betrieb', auf: true });
  const [neuerCode, setNeuerCode] = useState<{ code: string; fuer: string } | null>(null);

  const laden = useCallback(async () => {
    const [m, e, l] = await Promise.all([
      supabase.from('betrieb_mitglieder').select('user_id, rolle, betrieb_id, betriebe(name), profiles(name, email)'),
      supabase
        .from('einladungen')
        .select('id, rolle, email, betrieb_id, gueltig_bis, betriebe(name)')
        .is('eingeloest_am', null)
        .gt('gueltig_bis', new Date().toISOString()),
      supabase.rpc('masteradmin_letzte_logins'),
    ]);
    const err = m.error ?? e.error ?? l.error;
    if (err) setFehler(fehlertext(err));
    const logins = new Map((l.data ?? []).map((x) => [x.user_id, x.letzter_login] as const));
    const mitglieder: Zeile[] = (m.data ?? []).map((x) => ({
      key: `m-${x.betrieb_id}-${x.user_id}`,
      art: 'mitglied',
      betrieb: x.betriebe?.name ?? '–',
      betriebId: x.betrieb_id,
      name: x.profiles?.name ?? '?',
      email: x.profiles?.email ?? '',
      rolle: x.rolle,
      einladung: null,
      login: logins.get(x.user_id) ?? null,
      userId: x.user_id,
    }));
    const einladungen: Zeile[] = (e.data ?? [])
      .filter((x) => x.betrieb_id)
      .map((x) => ({
        key: `e-${x.id}`,
        art: 'einladung',
        betrieb: x.betriebe?.name ?? '–',
        betriebId: x.betrieb_id!,
        name: '(noch nicht registriert)',
        email: x.email ?? '',
        rolle: x.rolle,
        einladung: x.gueltig_bis,
        login: null,
        einladungId: x.id,
      }));
    setZeilen([...mitglieder, ...einladungen]);
    setLaedt(false);
  }, []);
  useEffect(() => {
    void laden();
  }, [laden]);

  const betriebe = useMemo(() => [...new Set(zeilen.map((z) => z.betrieb))].sort((a, b) => a.localeCompare(b, 'de')), [zeilen]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const wert = (z: Zeile): string => (sort.spalte === 'login' ? z.login ?? '' : sort.spalte === 'einladung' ? z.einladung ?? '' : z[sort.spalte]);
    return zeilen
      .filter((z) => (!betrieb || z.betrieb === betrieb) && (!q || `${z.name} ${z.email}`.toLowerCase().includes(q)))
      .sort((a, b) => wert(a).localeCompare(wert(b), 'de') * (sort.auf ? 1 : -1) || a.betrieb.localeCompare(b.betrieb, 'de'));
  }, [zeilen, suche, betrieb, sort]);

  const kopf = (spalte: Spalte, titel: string) => (
    <th aria-sort={sort.spalte === spalte ? (sort.auf ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ spalte, auf: s.spalte === spalte ? !s.auf : true }))}>
        {titel} {sort.spalte === spalte ? <Symbol name={sort.auf ? 'nachOben' : 'nachUnten'} className="symbol klein" /> : ''}
      </button>
    </th>
  );

  async function entfernen(z: Zeile) {
    if (!window.confirm(`${z.name} aus „${z.betrieb}“ entfernen? Der Account bleibt bestehen.`)) return;
    const { error } = await supabase.from('betrieb_mitglieder').delete().eq('betrieb_id', z.betriebId).eq('user_id', z.userId!);
    setFehler(error ? fehlertext(error) : null);
    await laden();
    await nachAenderung();
  }
  async function erneutSenden(z: Zeile) {
    const { data, error } = await supabase.rpc('einladung_erstellen', {
      p_betrieb_id: z.betriebId,
      p_rolle: z.rolle as 'inhaber' | 'mitarbeiter',
      p_email: z.email || undefined,
      p_gueltig_tage: 14,
    });
    if (error || !data) return setFehler(fehlertext(error ?? 'Einladung konnte nicht erstellt werden.'));
    await supabase.from('einladungen').delete().eq('id', z.einladungId!);
    setFehler(null);
    setNeuerCode({ code: data, fuer: `${z.email || 'Einladung'} · ${z.betrieb}` });
    await laden();
  }

  return (
    <Seite titel="Masteradmin">
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {neuerCode && <CodeAnzeige code={neuerCode.code} beschreibung={`Neue Einladung für ${neuerCode.fuer} (14 Tage gültig). Der alte Code ist ungültig – bitte dem Empfänger übermitteln.`} />}

      <Gruppe titel="Übersicht" fuss="Nur Mitgliedschaften und offene Einladungen – keine Fachdaten der Forstbetriebe.">
        <div className="ma-filter" style={{ padding: 10 }}>
          <input type="search" placeholder="Suche nach Name oder E-Mail" aria-label="Suche" value={suche} onChange={(e) => setSuche(e.target.value)} />
          <select aria-label="Forstbetrieb" value={betrieb} onChange={(e) => setBetrieb(e.target.value)}>
            <option value="">Alle Forstbetriebe</option>
            {betriebe.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="ma-tabelle">
          <table>
            <thead>
              <tr>
                {kopf('betrieb', 'Forstbetrieb')}
                {kopf('name', 'User')}
                {kopf('rolle', 'Rolle')}
                {kopf('einladung', 'Einladung offen')}
                {kopf('login', 'Letzter Login')}
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {laedt && <tr><td colSpan={6}>Lade …</td></tr>}
              {!laedt && sichtbar.length === 0 && <tr><td colSpan={6}>Keine Einträge.</td></tr>}
              {sichtbar.map((z) => (
                <tr key={z.key}>
                  <td>{z.betrieb}</td>
                  <td>{z.name}<small>{z.email}</small></td>
                  <td>{ROLLEN[z.rolle] ?? z.rolle}</td>
                  <td>{z.einladung ? `ja, bis ${datumDE(z.einladung)}` : '–'}</td>
                  <td>{z.login ? new Date(z.login).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–'}</td>
                  <td>
                    {z.art === 'mitglied' ? (
                      <button className="link gefahr" onClick={() => void entfernen(z)}>Mitgliedschaft entfernen</button>
                    ) : (
                      <button className="link" onClick={() => void erneutSenden(z)}>Einladung erneut senden</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Gruppe>
      <Knopf variante="ghost" onClick={() => void laden()}>Aktualisieren</Knopf>

      <AdminPanel eigeneId={userId} onGeaendert={async (id) => { await nachAenderung(id); await laden(); }} />
    </Seite>
  );
}
