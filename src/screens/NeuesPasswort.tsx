import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { useAuth } from '../auth/AuthProvider';
import { Gruppe, Hinweis, Knopf, PasswortFeld } from '../components/ui';

export function NeuesPasswort() {
  const { passwortGesetzt } = useAuth();
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (passwort.length < 8) {
      setFehler('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setLaedt(true);
    const { error } = await supabase.auth.updateUser({ password: passwort });
    setLaedt(false);
    if (error) setFehler(fehlertext(error));
    else passwortGesetzt();
  }

  return (
    <main className="auth">
      <header className="auth-kopf">
        <h1>Neues Passwort</h1>
      </header>
      <form onSubmit={absenden}>
        <Gruppe>
          <PasswortFeld
            label="Passwort"
            autoComplete="new-password"
            required
            minLength={8}
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
        </Gruppe>
        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
        <Knopf type="submit" disabled={laedt}>
          Speichern
        </Knopf>
      </form>
    </main>
  );
}
