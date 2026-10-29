import { useAuth } from './auth/AuthProvider';
import { konfigurationFehlt } from './lib/supabase';
import { AuthScreen } from './screens/AuthScreen';
import { Home } from './screens/Home';
import { NeuesPasswort } from './screens/NeuesPasswort';
import { Hinweis } from './components/ui';
import { usePfad } from './lib/router';
import { BjTeilnehmer } from './screens/bewegungsjagd/BjTeilnehmer';

export function App() {
  const { session, laedt, passwortNeuSetzen } = useAuth();
  const pfad = usePfad();

  if (konfigurationFehlt) {
    return (
      <main className="auth">
        <Hinweis art="fehler">
          Konfiguration fehlt: VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY müssen beim Build gesetzt sein.
        </Hinweis>
      </main>
    );
  }
  // Öffentliche Anmeldeseite der Bewegungsjagd: Zugang nur mit Code, ohne Konto
  if (pfad[0] === 'bj' && pfad[1]) return <BjTeilnehmer jagdId={pfad[1]} />;
  if (laedt) return <div className="laden">Hegewerk wird geladen …</div>;
  if (passwortNeuSetzen) return <NeuesPasswort />;
  if (!session) return <AuthScreen />;
  return <Home key={session.user.id} session={session} />;
}
