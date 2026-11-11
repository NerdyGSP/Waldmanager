import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { navigieren } from '../lib/router';
import type { Mitgliedschaft, NutzerKontext } from '../lib/useNutzerKontext';
import { Auswahl, Einklappbar, Feld, Gruppe, Hinweis, Knopf, PasswortFeld, Seite, Segmente, Zeile } from '../components/ui';
import { useDarstellung, type Darstellung } from '../lib/darstellung';
import { MitgliederPanel } from './MitgliederPanel';

const BUNDESLAENDER = ['Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen'];

const ROLLEN = { inhaber: 'Inhaber', mitarbeiter: 'Mitarbeiter' } as const;

export function Einstellungen({
  kontext,
  nachAenderung,
}: {
  kontext: NutzerKontext;
  nachAenderung: (neueBetriebId?: string | null) => Promise<void>;
}) {
  return (
    <Seite titel="Einstellungen">
      <Einklappbar titel="Konto" speicher="einstellungen.konto">
        <Konto name={kontext.name} email={kontext.email} onGeaendert={() => nachAenderung()} />
        <p className="gruppe-fuss" style={{ padding: '0 var(--abstand)' }}>
          Datenschutz: Inhaber deiner Forstbetriebe sehen, wann du dich zuletzt angemeldet bzw. die App zuletzt genutzt hast (nur der Zeitpunkt, keine Orte oder Geräte).
        </p>
      </Einklappbar>
      <DarstellungWahl />
      <KartenSpeicher />
      <Gruppe titel="Lizenzen" fuss="Navigationsicons: Material Symbols (Google, Apache 2.0).">
        <Zeile label="Kartendaten © OpenStreetMap-Mitwirkende, Luftbild © GeoBasis-DE/LGLN, Daten geändert" />
      </Gruppe>

      <Knopf variante="gefahr" onClick={() => supabase.auth.signOut()}>
        Abmelden
      </Knopf>
    </Seite>
  );
}

// Betriebsverwaltung: Forstbetrieb, Mitglieder & Einladungen, Betrieb verlassen, Code einlösen
export function Betriebsverwaltung({
  userId,
  aktuell,
  nachAenderung,
}: {
  userId: string;
  aktuell: Mitgliedschaft | null;
  nachAenderung: (neueBetriebId?: string | null) => Promise<void>;
}) {
  return (
    <Seite titel="Forstbetrieb">
      {aktuell && (
        <>
          <Betrieb aktuell={aktuell} onGeaendert={() => nachAenderung()} />
          {aktuell.rolle === 'inhaber' ? (
            <MitgliederPanel betriebId={aktuell.betrieb.id} eigeneId={userId} />
          ) : (
            <BetriebVerlassen aktuell={aktuell} userId={userId} onVerlassen={() => nachAenderung()} />
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

function Betrieb({ aktuell, onGeaendert }: { aktuell: Mitgliedschaft; onGeaendert: () => Promise<void> }) {
  const istInhaber = aktuell.rolle === 'inhaber';
  const [name, setName] = useState(aktuell.betrieb.name);
  const [flaeche, setFlaeche] = useState(aktuell.betrieb.flaeche_ha ? String(aktuell.betrieb.flaeche_ha).replace('.', ',') : '');
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'erfolg'; text: string } | null>(null);

  useEffect(() => {
    setName(aktuell.betrieb.name);
    setFlaeche(aktuell.betrieb.flaeche_ha ? String(aktuell.betrieb.flaeche_ha).replace('.', ',') : '');
  }, [aktuell]);

  const geaendert =
    name.trim() !== aktuell.betrieb.name ||
    flaeche.trim() !== (aktuell.betrieb.flaeche_ha ? String(aktuell.betrieb.flaeche_ha).replace('.', ',') : '');

  async function bundeslandAendern(neu: string) {
    setMeldung(null);
    const { error } = await supabase.from('betriebe').update({ bundesland: neu }).eq('id', aktuell.betrieb.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    else {
      setMeldung({ art: 'erfolg', text: `Bundesland: ${neu}` });
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
    const { error } = await supabase.from('betriebe').update({ name: name.trim(), flaeche_ha: ha }).eq('id', aktuell.betrieb.id);
    if (error) setMeldung({ art: 'fehler', text: fehlertext(error) });
    else {
      setMeldung({ art: 'erfolg', text: 'Forstbetrieb gespeichert' });
      await onGeaendert();
    }
  }

  return (
    <form onSubmit={speichern}>
      <Gruppe
        titel="Forstbetrieb"
        fuss={istInhaber ? 'Die Fläche wird beim Zeichnen der Betriebsgrenze automatisch berechnet.' : undefined}
      >
        {istInhaber ? (
          <>
            <Feld label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Feld label="Fläche (ha)" inputMode="decimal" placeholder="nicht hinterlegt" value={flaeche} onChange={(e) => setFlaeche(e.target.value)} />
          </>
        ) : (
          <>
            <Zeile label="Name" wert={aktuell.betrieb.name} />
            <Zeile
              label="Fläche"
              wert={aktuell.betrieb.flaeche_ha ? `${aktuell.betrieb.flaeche_ha.toLocaleString('de-DE')} ha` : 'nicht hinterlegt'}
            />
          </>
        )}
        {istInhaber ? (
          <Auswahl label="Bundesland" value={aktuell.betrieb.bundesland} onChange={(e) => void bundeslandAendern(e.target.value)}>
            {BUNDESLAENDER.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Auswahl>
        ) : (
          <Zeile label="Bundesland" wert={aktuell.betrieb.bundesland} />
        )}
        <Zeile label="Deine Rolle" wert={ROLLEN[aktuell.rolle]} />
      </Gruppe>
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
      {istInhaber && geaendert && (
        <Knopf type="submit" variante="sekundaer">
          Forstbetrieb speichern
        </Knopf>
      )}
    </form>
  );
}

function BetriebVerlassen({
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
    if (!window.confirm(`Forstbetrieb „${aktuell.betrieb.name}“ wirklich verlassen?`)) return;
    const { error } = await supabase
      .from('betrieb_mitglieder')
      .delete()
      .eq('betrieb_id', aktuell.betrieb.id)
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
        Forstbetrieb verlassen
      </Knopf>
    </>
  );
}

export function CodeEinloesen({ onEingeloest }: { onEingeloest: (betriebId: string | null) => Promise<void> }) {
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
      <Gruppe titel="Einladungscode einlösen" fuss="Damit trittst du mit deinem bestehenden Konto einem weiteren Forstbetrieb bei.">
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

// Auf dem Gerät zwischengespeicherte Kartenkacheln (Luftbild, OpenStreetMap)
function KartenSpeicher() {
  const [anzahl, setAnzahl] = useState<number | null>(null);
  const zaehlen = async () => {
    try {
      setAnzahl((await (await caches.open('waldmanager-karten-v1')).keys()).length);
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
            await caches.delete('waldmanager-karten-v1');
            await zaehlen();
          }}
        >
          Leeren
        </Knopf>
      </Zeile>
    </Gruppe>
  );
}
