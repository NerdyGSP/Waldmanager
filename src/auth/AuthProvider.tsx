import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { offlineCacheLeeren } from '../lib/offlineCache';

type AuthState = {
  session: Session | null;
  laedt: boolean;
  passwortNeuSetzen: boolean;
  passwortGesetzt: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [passwortNeuSetzen, setPasswortNeuSetzen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLaedt(false);
    });

    const { data } = supabase.auth.onAuthStateChange((ereignis, neueSession) => {
      setSession(neueSession);
      if (ereignis === 'SIGNED_OUT') void offlineCacheLeeren();
      if (ereignis === 'PASSWORD_RECOVERY') setPasswortNeuSetzen(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, laedt, passwortNeuSetzen, passwortGesetzt: () => setPasswortNeuSetzen(false) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const kontext = useContext(AuthContext);
  if (!kontext) throw new Error('useAuth außerhalb von AuthProvider');
  return kontext;
}
