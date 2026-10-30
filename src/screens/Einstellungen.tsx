import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { navigieren } from '../lib/router';
import type { Mitgliedschaft, NutzerKontext } from '../lib/useNutzerKontext';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, PasswortFeld, Seite, Segmente, Zeile } from '../components/ui';
import { BUNDESLAENDER } from '../lib/jagdzeiten';
import { useDarstellung, type Darstellung } from '../lib/darstellung';
import { EREIGNIS_GRUPPEN } from '../lib/ereignisse';
import { MitgliederPanel } from './MitgliederPanel';
import { RevierdatenLoeschen } from './module/Revierdaten';

const ROLLEN = { inhaber: 'Revierinhaber/-pächter', mitjaeger: 'Mitjäger' } as const;

export function Einstellungen({
  kontext,
  userId,
  istInhaber,
  nachAenderung,
}: {
  kontext: NutzerKontext;
  userId: string;
  istInhaber: boolean;
  nachAenderung: (neueRevierId?: string | null) => Promise<void>;
}) {
  return (
    <Seite titel="Einstellungen">
      <details className="einklappbar">
        <summary>Konto</summary>
        <Konto name={kontext.name} email={kontext.email} onGeaendert={() => nachAenderung()} />
        <p className="gruppe-fuss" style={{ padding: '0 var(--abstand)' }}>
          Datenschutz: Inhaber deiner Reviere sehen, wann du dich zuletzt angemeldet bzw. die App zuletzt genutzt hast (nur der Zeitpunkt, keine Orte oder Geräte).
        </p>
      </details>
      <DarstellungWahl />
      <BenachrichtigungenWahl userId={userId} istInhaber={istInhaber} />
      <KartenSpeicher />
      <Gruppe titel="Lizenzen" fuss="Navigationsicons: Material Symbols (Google, Apache 2.0). Einrichtungssymbole: game-icons.net (Lorc, Delapouite u. a., CC BY 3.0).">
        <Zeile label="Kartendaten © OpenStreetMap-Mitwirkende, Luftbild © GeoBasis-DE/LGLN, Daten geändert" />
      </Gruppe>

      <Knopf variante="gefahr" onClick={() => supabase.auth.signOut()}>
        Abmelden
      </Knopf>
    </Seite>
  );
}

// Revierverwaltung: Revier, Mitglieder & Einladungen, Kartendaten löschen, Revier verlassen, Code einlösen
export function Reviermanagement({
  userId,
  aktuell,
  nachAenderung,
}: {
  userId: string;
  aktuell: Mitgliedschaft | null;
  nachAenderung: (neueRevierId?: string | null) => Promise<void>;
}) {
  return (
    <Seite titel="Reviermanagement">
      {aktuell && (
        <>
          <Revier aktuell={aktuell} onGeaendert={() => nachAenderung()} />
          <Gruppe titel="Einrichtungen">
            <div style={{ padding: '10px var(--abstand)' }}>
              <Knopf variante="sekundaer" onClick={() => navigieren('/reviermanagement/einrichtungen')}>
                Alle Einrichtungen (Tabelle)
              </Knopf>
            </div>
          </Gruppe>
          {aktuell.rolle === 'inhaber' ? (
            <>
              <MitgliederPanel revierId={aktuell.revier.id} eigeneId={userId} />
              <RevierdatenLoeschen revierId={aktuell.revier.id} onGeaendert={() => nachAenderung()} />
            </>
          ) : (
            <RevierVerlassen aktuell={aktuell} userId={userId} onVerlassen={() => nachAenderung()} />
          )}
        </>
      )}
      <CodeEinloesen onEingeloest={nachAenderung} />
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

  // Wirkt sofort auf das Modul „Jagd- & Schonzeiten“ und die Hinweise bei Abschüssen
  async function bundeslandAendern(neu: string) {
    setMeldung(null);
    const { error } = await supabase.from('reviere').update({ bundesland: neu }).eq('id', aktuell.revier.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    else {
      setMeldung({ art: 'erfolg', text: `Bundesland: ${neu}. Jagd- und Schonzeiten gelten jetzt für dieses Bundesland; Auswertungen des Vorjahres können abweichende Zeiten haben.` });
      await onGeaendert();
    }
  }

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
        {istInhaber ? (
          <Auswahl label="Bundesland" value={aktuell.revier.bundesland} onChange={(e) => void bundeslandAendern(e.target.value)}>
            {BUNDESLAENDER.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Auswahl>
        ) : (
          <Zeile label="Bundesland" wert={aktuell.revier.bundesland} />
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

// Benachrichtigungen: Ein/Aus je Ereignisgruppe, je Nutzer gespeichert
function BenachrichtigungenWahl({ userId, istInhaber }: { userId: string; istInhaber: boolean }) {
  const [werte, setWerte] = useState<Record<string, boolean> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    void supabase
      .from('profiles')
      .select('benachrichtigungen')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setFehler(fehlertext(error));
        else setWerte((data?.benachrichtigungen ?? {}) as Record<string, boolean>);
      });
  }, [userId]);
  async function umschalten(id: string, an: boolean) {
    if (!werte) return;
    const neu = { ...werte, [id]: an };
    setWerte(neu);
    const { error } = await supabase.from('profiles').update({ benachrichtigungen: neu }).eq('id', userId);
    if (error) {
      setWerte(werte);
      setFehler(fehlertext(error));
    } else setFehler(null);
  }
  const gruppen = EREIGNIS_GRUPPEN.filter((g) => istInhaber || !g.nurInhaber);
  return (
    <Gruppe titel="Benachrichtigungen" fuss="Steuert, welche Meldungen in der Glocke erscheinen. Eigene Aktionen werden nie gemeldet. Es gibt keinen E-Mail- oder Push-Versand.">
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {gruppen.map((g) => (
        <Zeile key={g.id} label={<><strong>{g.label}</strong><br /><small style={{ color: 'var(--text-leise)' }}>{g.text}</small></>}>
          <input
            type="checkbox"
            role="switch"
            aria-label={g.label}
            checked={werte ? werte[g.id] !== false : true}
            disabled={!werte}
            onChange={(e) => void umschalten(g.id, e.target.checked)}
          />
        </Zeile>
      ))}
    </Gruppe>
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

// Auf dem Gerät zwischengespeicherte Kartenkacheln (Luftbild, OpenStreetMap)
function KartenSpeicher() {
  const [anzahl, setAnzahl] = useState<number | null>(null);
  const zaehlen = async () => {
    try {
      setAnzahl((await (await caches.open('hegewerk-karten-v1')).keys()).length);
    } catch {
      setAnzahl(null);
    }
  };
  useEffect(() => {
    void zaehlen();
  }, []);
  if (anzahl === null) return null;
  return (
    <Gruppe titel="Kartenspeicher" fuss="Kacheln werden auf diesem Gerät zwischengespeichert, damit sie nicht erneut geladen werden müssen (spart mobile Daten).">
      <Zeile label={`${anzahl.toLocaleString('de-DE')} Kacheln gespeichert`}>
        <Knopf
          variante="sekundaer"
          disabled={anzahl === 0}
          onClick={async () => {
            await caches.delete('hegewerk-karten-v1');
            await zaehlen();
          }}
        >
          Leeren
        </Knopf>
      </Zeile>
    </Gruppe>
  );
}
