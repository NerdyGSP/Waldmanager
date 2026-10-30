import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { fehlertext } from '../lib/fehler';
import { useAuth } from '../auth/AuthProvider';
import { Gruppe, Hinweis, Knopf, PasswortFeld } from '../components/ui';
export function NeuesPasswort() {
    const { passwortGesetzt } = useAuth();
    const [passwort, setPasswort] = useState('');
    const [fehler, setFehler] = useState(null);
    const [laedt, setLaedt] = useState(false);
    async function absenden(e) {
        e.preventDefault();
        if (passwort.length < 8) {
            setFehler('Das Passwort muss mindestens 8 Zeichen lang sein.');
            return;
        }
        setLaedt(true);
        const { error } = await supabase.auth.updateUser({ password: passwort });
        setLaedt(false);
        if (error)
            setFehler(fehlertext(error));
        else
            passwortGesetzt();
    }
    return (_jsxs("main", { className: "auth", children: [_jsx("header", { className: "auth-kopf", children: _jsx("h1", { children: "Neues Passwort" }) }), _jsxs("form", { onSubmit: absenden, children: [_jsx(Gruppe, { children: _jsx(PasswortFeld, { label: "Passwort", autoComplete: "new-password", required: true, minLength: 8, value: passwort, onChange: (e) => setPasswort(e.target.value) }) }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", disabled: laedt, children: "Speichern" })] })] }));
}
