import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [laedt, setLaedt] = useState(true);
    const [passwortNeuSetzen, setPasswortNeuSetzen] = useState(false);
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLaedt(false);
        });
        const { data } = supabase.auth.onAuthStateChange((ereignis, neueSession) => {
            setSession(neueSession);
            if (ereignis === 'PASSWORD_RECOVERY')
                setPasswortNeuSetzen(true);
        });
        return () => data.subscription.unsubscribe();
    }, []);
    return (_jsx(AuthContext.Provider, { value: { session, laedt, passwortNeuSetzen, passwortGesetzt: () => setPasswortNeuSetzen(false) }, children: children }));
}
export function useAuth() {
    const kontext = useContext(AuthContext);
    if (!kontext)
        throw new Error('useAuth außerhalb von AuthProvider');
    return kontext;
}
