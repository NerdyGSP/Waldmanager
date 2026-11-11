import { useAuth } from './auth/AuthProvider';
import { konfigurationFehlt } from './lib/supabase';
import { AuthScreen } from './screens/AuthScreen';
import { Home } from './screens/Home';
import { NeuesPasswort } from './screens/NeuesPasswort';
import { Hinweis } from './components/ui';
import { OfflineHinweis } from './components/OfflineHinweis';

export function App() {
  const { session, laedt, passwortNeuSetzen } = useAuth();

  if (konfigurationFehlt) {
    return (
      <main className="auth">
        <Hinweis art="fehler">
          Konfiguration fehlt: VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY müssen beim Build gesetzt sein.
        </Hinweis>
      </main>
    );
  }
  if (laedt) return <div className="laden">Waldmanager wird geladen …</div>;
  if (passwortNeuSetzen) return <NeuesPasswort />;
  if (!session) return <AuthScreen />;
  return (
    <>
      <OfflineHinweis />
      <Home key={session.user.id} session={session} />
    </>
  );
}
