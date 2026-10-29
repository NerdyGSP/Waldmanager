import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { Feld, Gruppe, Hinweis, Knopf } from '../components/ui';

type Modus = 'anmelden' | 'registrieren' | 'vergessen';

export function AuthScreen() {
  const [modus, setModus] = useState<Modus>('anmelden');

  return (
    <main className="auth">
      <header className="auth-kopf">
        <Logo />
        <h1>Hegewerk</h1>
        <p>Wildtiererfassung und Reviermanagement im Hegering</p>
      </header>

      <div className="segment" role="tablist">
        <button role="tab" aria-selected={modus === 'anmelden'} onClick={() => setModus('anmelden')}>
          Anmelden
        </button>
        <button role="tab" aria-selected={modus === 'registrieren'} onClick={() => setModus('registrieren')}>
          Registrieren
        </button>
      </div>

      {modus === 'anmelden' && <Anmelden onVergessen={() => setModus('vergessen')} />}
      {modus === 'registrieren' && <Registrieren />}
      {modus === 'vergessen' && <Vergessen onZurueck={() => setModus('anmelden')} />}
    </main>
  );
}

function Anmelden({ onVergessen }: { onVergessen: () => void }) {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setLaedt(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: passwort });
    setLaedt(false);
    if (error) setFehler(fehlertext(error));
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe>
        <Feld label="E-Mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Feld label="Passwort" type="password" autoComplete="current-password" required value={passwort} onChange={(e) => setPasswort(e.target.value)} />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" disabled={laedt}>
        {laedt ? 'Anmelden …' : 'Anmelden'}
      </Knopf>
      <button type="button" className="link" onClick={onVergessen}>
        Passwort vergessen?
      </button>
    </form>
  );
}

function Registrieren() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState(false);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (passwort.length < 8) {
      setFehler('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setLaedt(true);
    try {
      const pruefung = await supabase.rpc('einladung_pruefen', { p_code: code });
      if (pruefung.error) throw pruefung.error;
      if (!pruefung.data?.[0]?.gueltig) {
        setFehler('Der Einladungscode ist ungültig, bereits eingelöst oder abgelaufen.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: passwort,
        options: {
          data: { name: name.trim(), einladungscode: code },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      // Ohne Session ist eine E-Mail-Bestätigung nötig
      if (!data.session) setGesendet(true);
    } catch (err) {
      setFehler(fehlertext(err));
    } finally {
      setLaedt(false);
    }
  }

  if (gesendet) {
    return (
      <Hinweis art="erfolg">
        Fast geschafft: Wir haben dir eine Bestätigungsmail an <strong>{email}</strong> geschickt. Nach dem Klick auf den
        Link kannst du dich mit E-Mail und Passwort anmelden – auf dem PC, iPad und iPhone.
      </Hinweis>
    );
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe fuss="Den Einladungscode bekommst du vom Revierinhaber oder -pächter.">
        <Feld
          label="Einladungscode"
          required
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(codeFormatieren(e.target.value))}
        />
      </Gruppe>
      <Gruppe>
        <Feld label="Name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Feld label="E-Mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Feld
          label="Passwort"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="mind. 8 Zeichen"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
        />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" disabled={laedt}>
        {laedt ? 'Registrieren …' : 'Registrieren'}
      </Knopf>
    </form>
  );
}

function Vergessen({ onZurueck }: { onZurueck: () => void }) {
  const [email, setEmail] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState(false);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setLaedt(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLaedt(false);
    if (error) setFehler(fehlertext(error));
    else setGesendet(true);
  }

  return (
    <form onSubmit={absenden}>
      {gesendet ? (
        <Hinweis art="erfolg">Falls ein Account existiert, ist ein Link zum Zurücksetzen unterwegs.</Hinweis>
      ) : (
        <>
          <Gruppe fuss="Du bekommst eine E-Mail mit einem Link zum Setzen eines neuen Passworts.">
            <Feld label="E-Mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Gruppe>
          {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
          <Knopf type="submit" disabled={laedt}>
            Link senden
          </Knopf>
        </>
      )}
      <button type="button" className="link" onClick={onZurueck}>
        Zurück zur Anmeldung
      </button>
    </form>
  );
}

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--akzent)" />
      <path
        d="M32 12l-11 16h7l-9 13h9v11h8V41h9l-9-13h7z"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
