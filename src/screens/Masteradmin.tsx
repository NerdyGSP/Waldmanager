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
  hegering: string;
  revier: string;
  revierId: string;
  name: string;
  email: string;
  rolle: string;
  einladung: string | null; // Ablaufdatum der offenen Einladung
  login: string | null;
  userId?: string;
  einladungId?: string;
};
type Spalte = 'hegering' | 'revier' | 'name' | 'rolle' | 'einladung' | 'login';
const ROLLEN: Record<string, string> = { inhaber: 'Inhaber/Pächter', mitjaeger: 'Mitjäger' };

// Masteradmin: Gesamtübersicht der Mitgliedschaften (ohne Fachdaten) und Verwaltung von Hegeringen/Revieren
export function Masteradmin({ userId, nachAenderung }: { userId: string; nachAenderung: (revierId?: string | null) => Promise<void> }) {
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [suche, setSuche] = useState('');
  const [hegering, setHegering] = useState('');
  const [revier, setRevier] = useState('');
  const [sort, setSort] = useState<{ spalte: Spalte; auf: boolean }>({ spalte: 'hegering', auf: true });
  const [neuerCode, setNeuerCode] = useState<{ code: string; fuer: string } | null>(null);

  const laden = useCallback(async () => {
    const [m, e, l] = await Promise.all([
      supabase.from('revier_mitglieder').select('user_id, rolle, revier_id, reviere(name, hegeringe(name)), profiles(name, email)'),
      supabase
        .from('einladungen')
        .select('id, rolle, email, revier_id, gueltig_bis, reviere(name, hegeringe(name))')
        .is('eingeloest_am', null)
        .gt('gueltig_bis', new Date().toISOString()),
      supabase.rpc('masteradmin_letzte_logins'),
    ]);
    const err = m.error ?? e.error ?? l.error;
    if (err) setFehler(fehlertext(err));
    const logins = new Map((l.data ?? []).map((x) => [x.user_id, x.letzter_login] as const));
    const mitglieder: Zeile[] = (m.data ?? []).map((x) => ({
      key: `m-${x.revier_id}-${x.user_id}`,
      art: 'mitglied',
      hegering: x.reviere?.hegeringe?.name ?? '–',
      revier: x.reviere?.name ?? '–',
      revierId: x.revier_id,
      name: x.profiles?.name ?? '?',
      email: x.profiles?.email ?? '',
      rolle: x.rolle,
      einladung: null,
      login: logins.get(x.user_id) ?? null,
      userId: x.user_id,
    }));
    const einladungen: Zeile[] = (e.data ?? [])
      .filter((x) => x.revier_id)
      .map((x) => ({
        key: `e-${x.id}`,
        art: 'einladung',
        hegering: x.reviere?.hegeringe?.name ?? '–',
        revier: x.reviere?.name ?? '–',
        revierId: x.revier_id!,
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

  const hegeringe = useMemo(() => [...new Set(zeilen.map((z) => z.hegering))].sort((a, b) => a.localeCompare(b, 'de')), [zeilen]);
  const reviere = useMemo(() => [...new Set(zeilen.filter((z) => !hegering || z.hegering === hegering).map((z) => z.revier))].sort((a, b) => a.localeCompare(b, 'de')), [zeilen, hegering]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const wert = (z: Zeile): string => (sort.spalte === 'login' ? z.login ?? '' : sort.spalte === 'einladung' ? z.einladung ?? '' : z[sort.spalte]);
    return zeilen
      .filter((z) => (!hegering || z.hegering === hegering) && (!revier || z.revier === revier) && (!q || `${z.name} ${z.email}`.toLowerCase().includes(q)))
      .sort((a, b) => wert(a).localeCompare(wert(b), 'de') * (sort.auf ? 1 : -1) || a.revier.localeCompare(b.revier, 'de'));
  }, [zeilen, suche, hegering, revier, sort]);

  const kopf = (spalte: Spalte, titel: string) => (
    <th aria-sort={sort.spalte === spalte ? (sort.auf ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ spalte, auf: s.spalte === spalte ? !s.auf : true }))}>
        {titel} {sort.spalte === spalte ? <Symbol name={sort.auf ? 'nachOben' : 'nachUnten'} className="symbol klein" /> : ''}
      </button>
    </th>
  );

  async function entfernen(z: Zeile) {
    if (!window.confirm(`${z.name} aus „${z.revier}“ entfernen? Der Account bleibt bestehen.`)) return;
    const { error } = await supabase.from('revier_mitglieder').delete().eq('revier_id', z.revierId).eq('user_id', z.userId!);
    setFehler(error ? fehlertext(error) : null);
    await laden();
    await nachAenderung();
  }
  async function erneutSenden(z: Zeile) {
    const { data, error } = await supabase.rpc('einladung_erstellen', {
      p_revier_id: z.revierId,
      p_rolle: z.rolle as 'inhaber' | 'mitjaeger',
      p_email: z.email || undefined,
      p_gueltig_tage: 14,
    });
    if (error || !data) return setFehler(fehlertext(error ?? 'Einladung konnte nicht erstellt werden.'));
    await supabase.from('einladungen').delete().eq('id', z.einladungId!);
    setFehler(null);
    setNeuerCode({ code: data, fuer: `${z.email || 'Einladung'} · ${z.revier}` });
    await laden();
  }

  return (
    <Seite titel="Masteradmin">
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {neuerCode && <CodeAnzeige code={neuerCode.code} beschreibung={`Neue Einladung für ${neuerCode.fuer} (14 Tage gültig). Der alte Code ist ungültig – bitte dem Empfänger übermitteln.`} />}

      <Gruppe titel="Übersicht" fuss="Nur Mitgliedschaften und offene Einladungen – keine Fachdaten der Reviere.">
        <div className="ma-filter" style={{ padding: 10 }}>
          <input type="search" placeholder="Suche nach Name oder E-Mail" aria-label="Suche" value={suche} onChange={(e) => setSuche(e.target.value)} />
          <select aria-label="Hegering" value={hegering} onChange={(e) => { setHegering(e.target.value); setRevier(''); }}>
            <option value="">Alle Hegeringe</option>
            {hegeringe.map((h) => <option key={h}>{h}</option>)}
          </select>
          <select aria-label="Revier" value={revier} onChange={(e) => setRevier(e.target.value)}>
            <option value="">Alle Reviere</option>
            {reviere.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="ma-tabelle">
          <table>
            <thead>
              <tr>
                {kopf('hegering', 'Hegering')}
                {kopf('revier', 'Revier')}
                {kopf('name', 'User')}
                {kopf('rolle', 'Rolle')}
                {kopf('einladung', 'Einladung offen')}
                {kopf('login', 'Letzter Login')}
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {laedt && <tr><td colSpan={7}>Lade …</td></tr>}
              {!laedt && sichtbar.length === 0 && <tr><td colSpan={7}>Keine Einträge.</td></tr>}
              {sichtbar.map((z) => (
                <tr key={z.key}>
                  <td>{z.hegering}</td>
                  <td>{z.revier}</td>
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
