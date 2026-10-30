import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { Feld, Gruppe, Hinweis, Knopf, PasswortFeld } from '../components/ui';
export function AuthScreen() {
    const [modus, setModus] = useState('anmelden');
    return (_jsxs("main", { className: "auth", children: [_jsxs("header", { className: "auth-kopf", children: [_jsx(Logo, {}), _jsx("h1", { children: "Hegewerk" }), _jsx("p", { children: "Wildtiererfassung und Reviermanagement im Hegering" })] }), _jsxs("div", { className: "segment", role: "tablist", children: [_jsx("button", { role: "tab", "aria-selected": modus === 'anmelden', onClick: () => setModus('anmelden'), children: "Anmelden" }), _jsx("button", { role: "tab", "aria-selected": modus === 'registrieren', onClick: () => setModus('registrieren'), children: "Registrieren" })] }), modus === 'anmelden' && _jsx(Anmelden, { onVergessen: () => setModus('vergessen') }), modus === 'registrieren' && _jsx(Registrieren, {}), modus === 'vergessen' && _jsx(Vergessen, { onZurueck: () => setModus('anmelden') })] }));
}
function Anmelden({ onVergessen }) {
    const [email, setEmail] = useState('');
    const [passwort, setPasswort] = useState('');
    const [fehler, setFehler] = useState(null);
    const [laedt, setLaedt] = useState(false);
    async function absenden(e) {
        e.preventDefault();
        setFehler(null);
        setLaedt(true);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: passwort });
        setLaedt(false);
        if (error)
            setFehler(fehlertext(error));
    }
    return (_jsxs("form", { onSubmit: absenden, children: [_jsxs(Gruppe, { children: [_jsx(Feld, { label: "E-Mail", type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value) }), _jsx(PasswortFeld, { label: "Passwort", autoComplete: "current-password", required: true, value: passwort, onChange: (e) => setPasswort(e.target.value) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", disabled: laedt, children: laedt ? 'Anmelden …' : 'Anmelden' }), _jsx("button", { type: "button", className: "link", onClick: onVergessen, children: "Passwort vergessen?" })] }));
}
function Registrieren() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [passwort, setPasswort] = useState('');
    const [fehler, setFehler] = useState(null);
    const [gesendet, setGesendet] = useState(false);
    const [laedt, setLaedt] = useState(false);
    async function absenden(e) {
        e.preventDefault();
        setFehler(null);
        if (passwort.length < 8) {
            setFehler('Das Passwort muss mindestens 8 Zeichen lang sein.');
            return;
        }
        setLaedt(true);
        try {
            const pruefung = await supabase.rpc('einladung_pruefen', { p_code: code });
            if (pruefung.error)
                throw pruefung.error;
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
            if (error)
                throw error;
            // Ohne Session ist eine E-Mail-Bestätigung nötig
            if (!data.session)
                setGesendet(true);
        }
        catch (err) {
            setFehler(fehlertext(err));
        }
        finally {
            setLaedt(false);
        }
    }
    if (gesendet) {
        return (_jsxs(Hinweis, { art: "erfolg", children: ["Fast geschafft: Wir haben dir eine Best\u00E4tigungsmail an ", _jsx("strong", { children: email }), " geschickt. Nach dem Klick auf den Link kannst du dich mit E-Mail und Passwort anmelden \u2013 auf dem PC, iPad und iPhone."] }));
    }
    return (_jsxs("form", { onSubmit: absenden, children: [_jsx(Gruppe, { fuss: "Den Einladungscode bekommst du vom Revierinhaber oder -p\u00E4chter.", children: _jsx(Feld, { label: "Einladungscode", required: true, placeholder: "XXXX-XXXX", autoCapitalize: "characters", autoComplete: "off", spellCheck: false, value: code, onChange: (e) => setCode(codeFormatieren(e.target.value)) }) }), _jsxs(Gruppe, { children: [_jsx(Feld, { label: "Name", autoComplete: "name", required: true, value: name, onChange: (e) => setName(e.target.value) }), _jsx(Feld, { label: "E-Mail", type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value) }), _jsx(PasswortFeld, { label: "Passwort", autoComplete: "new-password", required: true, minLength: 8, placeholder: "mind. 8 Zeichen", value: passwort, onChange: (e) => setPasswort(e.target.value) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", disabled: laedt, children: laedt ? 'Registrieren …' : 'Registrieren' })] }));
}
function Vergessen({ onZurueck }) {
    const [email, setEmail] = useState('');
    const [fehler, setFehler] = useState(null);
    const [gesendet, setGesendet] = useState(false);
    const [laedt, setLaedt] = useState(false);
    async function absenden(e) {
        e.preventDefault();
        setFehler(null);
        setLaedt(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin,
        });
        setLaedt(false);
        if (error)
            setFehler(fehlertext(error));
        else
            setGesendet(true);
    }
    return (_jsxs("form", { onSubmit: absenden, children: [gesendet ? (_jsx(Hinweis, { art: "erfolg", children: "Falls ein Account existiert, ist ein Link zum Zur\u00FCcksetzen unterwegs." })) : (_jsxs(_Fragment, { children: [_jsx(Gruppe, { fuss: "Du bekommst eine E-Mail mit einem Link zum Setzen eines neuen Passworts.", children: _jsx(Feld, { label: "E-Mail", type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value) }) }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", disabled: laedt, children: "Link senden" })] })), _jsx("button", { type: "button", className: "link", onClick: onZurueck, children: "Zur\u00FCck zur Anmeldung" })] }));
}
export function Logo() {
    return (_jsxs("svg", { className: "logo", viewBox: "0 0 64 64", "aria-hidden": "true", children: [_jsx("rect", { width: "64", height: "64", rx: "14", fill: "var(--akzent)" }), _jsx("path", { d: "M32 12l-11 16h7l-9 13h9v11h8V41h9l-9-13h7z", fill: "none", stroke: "#fff", strokeWidth: "3.5", strokeLinejoin: "round" })] }));
}
