import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import type { Enums } from '../lib/database.types';
import { Auswahl, CodeAnzeige, Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';

type Mitglied = { user_id: string; rolle: Enums<'revier_rolle'>; name: string; email: string };

export function MitgliederPanel({ revierId, eigeneId }: { revierId: string; eigeneId: string }) {
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('revier_mitglieder')
      .select('user_id, rolle, profiles(name, email)')
      .eq('revier_id', revierId);
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setMitglieder(
      (data ?? [])
        .map((m) => ({
          user_id: m.user_id,
          rolle: m.rolle,
          name: m.profiles?.name ?? '–',
          email: m.profiles?.email ?? '',
        }))
        .sort((a, b) => (a.rolle === b.rolle ? a.name.localeCompare(b.name, 'de') : a.rolle === 'inhaber' ? -1 : 1)),
    );
  }, [revierId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function rolleAendern(m: Mitglied, rolle: Enums<'revier_rolle'>) {
    setFehler(null);
    const { error } = await supabase
      .from('revier_mitglieder')
      .update({ rolle })
      .eq('revier_id', revierId)
      .eq('user_id', m.user_id);
    if (error) setFehler(fehlertext(error));
    await laden();
  }

  async function entfernen(m: Mitglied) {
    if (!window.confirm(`${m.name} aus dem Revier entfernen?`)) return;
    setFehler(null);
    const { error } = await supabase
      .from('revier_mitglieder')
      .delete()
      .eq('revier_id', revierId)
      .eq('user_id', m.user_id);
    if (error) setFehler(fehlertext(error));
    await laden();
  }

  return (
    <>
      <Gruppe titel="Mitglieder">
        {mitglieder.map((m) => (
          <Zeile
            key={m.user_id}
            label={
              <>
                {m.name}
                <small>{m.email}</small>
              </>
            }
          >
            <select
              className="zeile-auswahl"
              aria-label={`Rolle von ${m.name}`}
              value={m.rolle}
              onChange={(e) => rolleAendern(m, e.target.value as Enums<'revier_rolle'>)}
            >
              <option value="inhaber">Inhaber/Pächter</option>
              <option value="mitjaeger">Mitjäger</option>
            </select>
            {m.user_id !== eigeneId && (
              <button className="link gefahr" onClick={() => entfernen(m)}>
                Entfernen
              </button>
            )}
          </Zeile>
        ))}
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <EinladungErstellen revierId={revierId} />
    </>
  );
}

export function EinladungErstellen({
  revierId,
  festeRolle,
  titel = 'Jemanden einladen',
}: {
  revierId: string;
  festeRolle?: Enums<'revier_rolle'>;
  titel?: string;
}) {
  const [rolle, setRolle] = useState<Enums<'revier_rolle'>>(festeRolle ?? 'mitjaeger');
  const [email, setEmail] = useState('');
  const [tage, setTage] = useState(14);
  const [code, setCode] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [mailInfo, setMailInfo] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setCode(null);
    setMailInfo(null);
    setLaedt(true);
    const adresse = email.trim();
    if (adresse) {
      // Mit E-Mail-Adresse: Code erstellen und die Einladung per Mail versenden
      const { data, error } = await supabase.functions.invoke('revier-einladen', {
        body: { revier_id: revierId, rolle: festeRolle ?? rolle, email: adresse, tage },
      });
      setLaedt(false);
      if (error || !data?.code) {
        setFehler(data?.fehler ?? (error ? fehlertext(error) : 'Einladung konnte nicht erstellt werden.'));
        return;
      }
      setCode(data.code);
      setMailInfo(data.mail ? `Einladung per E-Mail an ${adresse} gesendet.` : `Code erstellt, aber die E-Mail konnte nicht gesendet werden (${data.fehler ?? 'unbekannter Fehler'}). Gib den Code selbst weiter.`);
      return;
    }
    const { data, error } = await supabase.rpc('einladung_erstellen', {
      p_revier_id: revierId,
      p_rolle: festeRolle ?? rolle,
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
        fuss="Der Code ist einmal nutzbar. Mit E-Mail-Adresse kann ihn nur diese Person einlösen, und die Einladung wird ihr per E-Mail geschickt."
      >
        {!festeRolle && (
          <Auswahl label="Rolle" value={rolle} onChange={(e) => setRolle(e.target.value as Enums<'revier_rolle'>)}>
            <option value="mitjaeger">Mitjäger</option>
            <option value="inhaber">Inhaber/Pächter</option>
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
      {mailInfo && <Hinweis>{mailInfo}</Hinweis>}
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
