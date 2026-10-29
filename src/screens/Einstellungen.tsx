import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { navigieren } from '../lib/router';
import type { Mitgliedschaft, NutzerKontext } from '../lib/useNutzerKontext';
import { Feld, Gruppe, Hinweis, Knopf, PasswortFeld, Seite, Segmente, Zeile } from '../components/ui';
import { useDarstellung, type Darstellung } from '../lib/darstellung';
import { MitgliederPanel } from './MitgliederPanel';
import { AdminPanel } from './AdminPanel';

const ROLLEN = { inhaber: 'Revierinhaber/-pächter', mitjaeger: 'Mitjäger' } as const;

export function Einstellungen({
  userId,
  kontext,
  aktuell,
  revierWechseln,
}: {
  userId: string;
  kontext: NutzerKontext;
  aktuell: Mitgliedschaft | null;
  revierWechseln: (id: string) => void;
}) {
  const nachAenderung = async (neueRevierId?: string | null) => {
    await kontext.neuLaden();
    if (neueRevierId) revierWechseln(neueRevierId);
  };

  return (
    <Seite titel="Einstellungen">
      <Konto name={kontext.name} email={kontext.email} onGeaendert={() => nachAenderung()} />
      <DarstellungWahl />

      {aktuell && (
        <>
          <Revier aktuell={aktuell} onGeaendert={() => nachAenderung()} />
          {aktuell.rolle === 'inhaber' ? (
            <MitgliederPanel revierId={aktuell.revier.id} eigeneId={userId} />
          ) : (
            <RevierVerlassen aktuell={aktuell} userId={userId} onVerlassen={() => nachAenderung()} />
          )}
        </>
      )}

      <CodeEinloesen onEingeloest={nachAenderung} />

      {kontext.istMasteradmin && <AdminPanel eigeneId={userId} onGeaendert={nachAenderung} />}

      <Knopf variante="gefahr" onClick={() => supabase.auth.signOut()}>
        Abmelden
      </Knopf>
    </Seite>
  );
}

function Konto({ name, email, onGeaendert }: { name: string; email: string; onGeaendert: () => Promise<void> }) {
  const [neuerName, setNeuerName] = useState(name);
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg'; text: string } | null>(null);

  useEffect(() => setNeuerName(name), [name]);

  async function nameSpeichern(e: FormEvent) {
    e.preventDefault();
    setMeldung(null);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from('profiles').update({ name: neuerName.trim() }).eq('id', data.user.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    else {
      setMeldung({ art: 'erfolg', text: 'Name gespeichert' });
      await onGeaendert();
    }
  }

  async function passwortSpeichern(e: FormEvent) {
    e.preventDefault();
    setMeldung(null);
    if (passwort.length < 8) {
      setMeldung({ art: 'fehler', text: 'Das Passwort muss mindestens 8 Zeichen lang sein.' });
      return;
    }
    if (passwort !== wiederholung) {
      setMeldung({ art: 'fehler', text: 'Die beiden Passwörter stimmen nicht überein.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwort });
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    else {
      setPasswort('');
      setWiederholung('');
      setMeldung({ art: 'erfolg', text: 'Passwort geändert' });
    }
  }

  return (
    <>
      <form onSubmit={nameSpeichern}>
        <Gruppe titel="Mein Konto">
          <Feld label="Name" required value={neuerName} onChange={(e) => setNeuerName(e.target.value)} />
          <Zeile label="E-Mail" wert={email} />
        </Gruppe>
        {neuerName.trim() && neuerName.trim() !== name && (
          <Knopf type="submit" variante="sekundaer">
            Name speichern
          </Knopf>
        )}
      </form>

      <form onSubmit={passwortSpeichern}>
        <Gruppe titel="Passwort ändern">
          <PasswortFeld
            label="Neues Passwort"
            autoComplete="new-password"
            placeholder="mind. 8 Zeichen"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
          <PasswortFeld
            label="Wiederholen"
            autoComplete="new-password"
            value={wiederholung}
            onChange={(e) => setWiederholung(e.target.value)}
          />
        </Gruppe>
        {passwort && (
          <Knopf type="submit" variante="sekundaer">
            Passwort ändern
          </Knopf>
        )}
      </form>
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
    </>
  );
}

function Revier({ aktuell, onGeaendert }: { aktuell: Mitgliedschaft; onGeaendert: () => Promise<void> }) {
  const istInhaber = aktuell.rolle === 'inhaber';
  const [name, setName] = useState(aktuell.revier.name);
  const [flaeche, setFlaeche] = useState(aktuell.revier.flaeche_ha ? String(aktuell.revier.flaeche_ha).replace('.', ',') : '');
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg'; text: string } | null>(null);

  useEffect(() => {
    setName(aktuell.revier.name);
    setFlaeche(aktuell.revier.flaeche_ha ? String(aktuell.revier.flaeche_ha).replace('.', ',') : '');
  }, [aktuell]);

  const geaendert =
    name.trim() !== aktuell.revier.name ||
    flaeche.trim() !== (aktuell.revier.flaeche_ha ? String(aktuell.revier.flaeche_ha).replace('.', ',') : '');

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setMeldung(null);
    const ha = flaeche.trim() ? Number(flaeche.replace(',', '.')) : null;
    if (ha !== null && (!Number.isFinite(ha) || ha <= 0)) {
      setMeldung({ art: 'fehler', text: 'Bitte eine gültige Fläche in Hektar angeben.' });
      return;
    }
    const { error } = await supabase.from('reviere').update({ name: name.trim(), flaeche_ha: ha }).eq('id', aktuell.revier.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    else {
      setMeldung({ art: 'erfolg', text: 'Revier gespeichert' });
      await onGeaendert();
    }
  }

  return (
    <form onSubmit={speichern}>
      <Gruppe
        titel="Revier"
        fuss={istInhaber ? 'Die Fläche wird beim Zeichnen der Reviergrenze automatisch berechnet.' : undefined}
      >
        {istInhaber ? (
          <>
            <Feld label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Feld label="Fläche (ha)" inputMode="decimal" placeholder="nicht hinterlegt" value={flaeche} onChange={(e) => setFlaeche(e.target.value)} />
          </>
        ) : (
          <>
            <Zeile label="Name" wert={aktuell.revier.name} />
            <Zeile
              label="Fläche"
              wert={aktuell.revier.flaeche_ha ? `${aktuell.revier.flaeche_ha.toLocaleString('de-DE')} ha` : 'nicht hinterlegt'}
            />
          </>
        )}
        <Zeile label="Hegering" wert={aktuell.revier.hegering ?? '–'} />
        <Zeile label="Deine Rolle" wert={ROLLEN[aktuell.rolle]} />
      </Gruppe>
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
      {istInhaber && geaendert && (
        <Knopf type="submit" variante="sekundaer">
          Revier speichern
        </Knopf>
      )}
    </form>
  );
}

function RevierVerlassen({
  aktuell,
  userId,
  onVerlassen,
}: {
  aktuell: Mitgliedschaft;
  userId: string;
  onVerlassen: () => Promise<void>;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  async function verlassen() {
    if (!window.confirm(`Revier „${aktuell.revier.name}“ wirklich verlassen?`)) return;
    const { error } = await supabase
      .from('revier_mitglieder')
      .delete()
      .eq('revier_id', aktuell.revier.id)
      .eq('user_id', userId);
    if (error) setFehler(fehlertext(error));
    else {
      await onVerlassen();
      navigieren('/');
    }
  }
  return (
    <>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf variante="gefahr" onClick={verlassen}>
        Revier verlassen
      </Knopf>
    </>
  );
}

export function CodeEinloesen({ onEingeloest }: { onEingeloest: (revierId: string | null) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState(false);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setErfolg(false);
    setLaedt(true);
    const { data, error } = await supabase.rpc('einladung_einloesen', { p_code: code });
    setLaedt(false);
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setCode('');
    setErfolg(true);
    await onEingeloest(data ?? null);
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe titel="Einladungscode einlösen" fuss="Damit trittst du mit deinem bestehenden Account einem weiteren Revier bei.">
        <Feld
          label="Code"
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          value={code}
          onChange={(e) => setCode(codeFormatieren(e.target.value))}
        />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {erfolg && <Hinweis art="erfolg">Code eingelöst.</Hinweis>}
      <Knopf type="submit" variante="sekundaer" disabled={laedt || code.length < 9}>
        Einlösen
      </Knopf>
    </form>
  );
}

function DarstellungWahl() {
  const [wert, setWert] = useDarstellung();
  return (
    <Gruppe titel="Darstellung" fuss="„System“ folgt der Einstellung deines Geräts. Die Wahl gilt nur für diesen Browser.">
      <div style={{ padding: '10px var(--abstand)' }}>
        <Segmente<Darstellung>
          label="Darstellung"
          wert={wert}
          onAendern={setWert}
          optionen={[
            { wert: 'system', label: 'System' },
            { wert: 'hell', label: 'Hell' },
            { wert: 'dunkel', label: 'Dunkel' },
          ]}
        />
      </div>
    </Gruppe>
  );
}
