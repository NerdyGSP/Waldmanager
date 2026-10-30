import { jsx as _jsx } from "react/jsx-runtime";
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
        return (_jsx("main", { className: "auth", children: _jsx(Hinweis, { art: "fehler", children: "Konfiguration fehlt: VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY m\u00FCssen beim Build gesetzt sein." }) }));
    }
    // Öffentliche Anmeldeseite der Bewegungsjagd: Zugang nur mit Code, ohne Konto
    if (pfad[0] === 'bj' && pfad[1])
        return _jsx(BjTeilnehmer, { jagdId: pfad[1] });
    if (laedt)
        return _jsx("div", { className: "laden", children: "Hegewerk wird geladen \u2026" });
    if (passwortNeuSetzen)
        return _jsx(NeuesPasswort, {});
    if (!session)
        return _jsx(AuthScreen, {});
    return _jsx(Home, { session: session }, session.user.id);
}
