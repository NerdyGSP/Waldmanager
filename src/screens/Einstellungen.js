import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { navigieren } from '../lib/router';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, PasswortFeld, Seite, Segmente, Zeile } from '../components/ui';
import { BUNDESLAENDER } from '../lib/jagdzeiten';
import { useDarstellung } from '../lib/darstellung';
import { EREIGNIS_GRUPPEN } from '../lib/ereignisse';
import { MitgliederPanel } from './MitgliederPanel';
import { RevierdatenLoeschen } from './module/Revierdaten';
const ROLLEN = { inhaber: 'Revierinhaber/-pächter', mitjaeger: 'Mitjäger' };
export function Einstellungen({ kontext, userId, istInhaber, nachAenderung, }) {
    return (_jsxs(Seite, { titel: "Einstellungen", children: [_jsxs("details", { className: "einklappbar", children: [_jsx("summary", { children: "Konto" }), _jsx(Konto, { name: kontext.name, email: kontext.email, onGeaendert: () => nachAenderung() })] }), _jsx(DarstellungWahl, {}), _jsx(BenachrichtigungenWahl, { userId: userId, istInhaber: istInhaber }), _jsx(KartenSpeicher, {}), _jsx(Gruppe, { titel: "Lizenzen", fuss: "Navigationsicons: Material Symbols (Google, Apache 2.0). Einrichtungssymbole: game-icons.net (Lorc, Delapouite u. a., CC BY 3.0).", children: _jsx(Zeile, { label: "Kartendaten \u00A9 OpenStreetMap-Mitwirkende, Luftbild \u00A9 LGLN" }) }), _jsx(Knopf, { variante: "gefahr", onClick: () => supabase.auth.signOut(), children: "Abmelden" })] }));
}
// Revierverwaltung: Revier, Mitglieder & Einladungen, Kartendaten löschen, Revier verlassen, Code einlösen
export function Reviermanagement({ userId, aktuell, nachAenderung, }) {
    return (_jsxs(Seite, { titel: "Reviermanagement", children: [aktuell && (_jsxs(_Fragment, { children: [_jsx(Revier, { aktuell: aktuell, onGeaendert: () => nachAenderung() }), _jsx(Gruppe, { titel: "Einrichtungen", children: _jsx("div", { style: { padding: '10px var(--abstand)' }, children: _jsx(Knopf, { variante: "sekundaer", onClick: () => navigieren('/reviermanagement/einrichtungen'), children: "Alle Einrichtungen (Tabelle)" }) }) }), aktuell.rolle === 'inhaber' ? (_jsxs(_Fragment, { children: [_jsx(MitgliederPanel, { revierId: aktuell.revier.id, eigeneId: userId }), _jsx(RevierdatenLoeschen, { revierId: aktuell.revier.id, onGeaendert: () => nachAenderung() })] })) : (_jsx(RevierVerlassen, { aktuell: aktuell, userId: userId, onVerlassen: () => nachAenderung() }))] })), _jsx(CodeEinloesen, { onEingeloest: nachAenderung })] }));
}
function Konto({ name, email, onGeaendert }) {
    const [neuerName, setNeuerName] = useState(name);
    const [passwort, setPasswort] = useState('');
    const [wiederholung, setWiederholung] = useState('');
    const [meldung, setMeldung] = useState(null);
    useEffect(() => setNeuerName(name), [name]);
    async function nameSpeichern(e) {
        e.preventDefault();
        setMeldung(null);
        const { data } = await supabase.auth.getUser();
        if (!data.user)
            return;
        const { error } = await supabase.from('profiles').update({ name: neuerName.trim() }).eq('id', data.user.id);
        if (error)
            setMeldung({ art: 'fehler', text: fehlertext(error) });
        else {
            setMeldung({ art: 'erfolg', text: 'Name gespeichert' });
            await onGeaendert();
        }
    }
    async function passwortSpeichern(e) {
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
        if (error)
            setMeldung({ art: 'fehler', text: fehlertext(error) });
        else {
            setPasswort('');
            setWiederholung('');
            setMeldung({ art: 'erfolg', text: 'Passwort geändert' });
        }
    }
    return (_jsxs(_Fragment, { children: [_jsxs("form", { onSubmit: nameSpeichern, children: [_jsxs(Gruppe, { titel: "Mein Konto", children: [_jsx(Feld, { label: "Name", required: true, value: neuerName, onChange: (e) => setNeuerName(e.target.value) }), _jsx(Zeile, { label: "E-Mail", wert: email })] }), neuerName.trim() && neuerName.trim() !== name && (_jsx(Knopf, { type: "submit", variante: "sekundaer", children: "Name speichern" }))] }), _jsxs("form", { onSubmit: passwortSpeichern, children: [_jsxs(Gruppe, { titel: "Passwort \u00E4ndern", children: [_jsx(PasswortFeld, { label: "Neues Passwort", autoComplete: "new-password", placeholder: "mind. 8 Zeichen", value: passwort, onChange: (e) => setPasswort(e.target.value) }), _jsx(PasswortFeld, { label: "Wiederholen", autoComplete: "new-password", value: wiederholung, onChange: (e) => setWiederholung(e.target.value) })] }), passwort && (_jsx(Knopf, { type: "submit", variante: "sekundaer", children: "Passwort \u00E4ndern" }))] }), meldung && _jsx(Hinweis, { art: meldung.art, children: meldung.text })] }));
}
function Revier({ aktuell, onGeaendert }) {
    const istInhaber = aktuell.rolle === 'inhaber';
    const [name, setName] = useState(aktuell.revier.name);
    const [flaeche, setFlaeche] = useState(aktuell.revier.flaeche_ha ? String(aktuell.revier.flaeche_ha).replace('.', ',') : '');
    const [meldung, setMeldung] = useState(null);
    useEffect(() => {
        setName(aktuell.revier.name);
        setFlaeche(aktuell.revier.flaeche_ha ? String(aktuell.revier.flaeche_ha).replace('.', ',') : '');
    }, [aktuell]);
    const geaendert = name.trim() !== aktuell.revier.name ||
        flaeche.trim() !== (aktuell.revier.flaeche_ha ? String(aktuell.revier.flaeche_ha).replace('.', ',') : '');
    // Wirkt sofort auf das Modul „Jagd- & Schonzeiten“ und die Hinweise bei Abschüssen
    async function bundeslandAendern(neu) {
        setMeldung(null);
        const { error } = await supabase.from('reviere').update({ bundesland: neu }).eq('id', aktuell.revier.id);
        if (error)
            setMeldung({ art: 'fehler', text: fehlertext(error) });
        else {
            setMeldung({ art: 'erfolg', text: `Bundesland: ${neu}. Jagd- und Schonzeiten gelten jetzt für dieses Bundesland; Auswertungen des Vorjahres können abweichende Zeiten haben.` });
            await onGeaendert();
        }
    }
    async function speichern(e) {
        e.preventDefault();
        setMeldung(null);
        const ha = flaeche.trim() ? Number(flaeche.replace(',', '.')) : null;
        if (ha !== null && (!Number.isFinite(ha) || ha <= 0)) {
            setMeldung({ art: 'fehler', text: 'Bitte eine gültige Fläche in Hektar angeben.' });
            return;
        }
        const { error } = await supabase.from('reviere').update({ name: name.trim(), flaeche_ha: ha }).eq('id', aktuell.revier.id);
        if (error)
            setMeldung({ art: 'fehler', text: fehlertext(error) });
        else {
            setMeldung({ art: 'erfolg', text: 'Revier gespeichert' });
            await onGeaendert();
        }
    }
    return (_jsxs("form", { onSubmit: speichern, children: [_jsxs(Gruppe, { titel: "Revier", fuss: istInhaber ? 'Die Fläche wird beim Zeichnen der Reviergrenze automatisch berechnet.' : undefined, children: [istInhaber ? (_jsxs(_Fragment, { children: [_jsx(Feld, { label: "Name", required: true, value: name, onChange: (e) => setName(e.target.value) }), _jsx(Feld, { label: "Fl\u00E4che (ha)", inputMode: "decimal", placeholder: "nicht hinterlegt", value: flaeche, onChange: (e) => setFlaeche(e.target.value) })] })) : (_jsxs(_Fragment, { children: [_jsx(Zeile, { label: "Name", wert: aktuell.revier.name }), _jsx(Zeile, { label: "Fl\u00E4che", wert: aktuell.revier.flaeche_ha ? `${aktuell.revier.flaeche_ha.toLocaleString('de-DE')} ha` : 'nicht hinterlegt' })] })), istInhaber ? (_jsx(Auswahl, { label: "Bundesland", value: aktuell.revier.bundesland, onChange: (e) => void bundeslandAendern(e.target.value), children: BUNDESLAENDER.map((b) => (_jsx("option", { value: b, children: b }, b))) })) : (_jsx(Zeile, { label: "Bundesland", wert: aktuell.revier.bundesland })), _jsx(Zeile, { label: "Hegering", wert: aktuell.revier.hegering ?? '–' }), _jsx(Zeile, { label: "Deine Rolle", wert: ROLLEN[aktuell.rolle] })] }), meldung && _jsx(Hinweis, { art: meldung.art, children: meldung.text }), istInhaber && geaendert && (_jsx(Knopf, { type: "submit", variante: "sekundaer", children: "Revier speichern" }))] }));
}
function RevierVerlassen({ aktuell, userId, onVerlassen, }) {
    const [fehler, setFehler] = useState(null);
    async function verlassen() {
        if (!window.confirm(`Revier „${aktuell.revier.name}“ wirklich verlassen?`))
            return;
        const { error } = await supabase
            .from('revier_mitglieder')
            .delete()
            .eq('revier_id', aktuell.revier.id)
            .eq('user_id', userId);
        if (error)
            setFehler(fehlertext(error));
        else {
            await onVerlassen();
            navigieren('/');
        }
    }
    return (_jsxs(_Fragment, { children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { variante: "gefahr", onClick: verlassen, children: "Revier verlassen" })] }));
}
export function CodeEinloesen({ onEingeloest }) {
    const [code, setCode] = useState('');
    const [fehler, setFehler] = useState(null);
    const [erfolg, setErfolg] = useState(false);
    const [laedt, setLaedt] = useState(false);
    async function absenden(e) {
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
    return (_jsxs("form", { onSubmit: absenden, children: [_jsx(Gruppe, { titel: "Einladungscode einl\u00F6sen", fuss: "Damit trittst du mit deinem bestehenden Account einem weiteren Revier bei.", children: _jsx(Feld, { label: "Code", placeholder: "XXXX-XXXX", autoCapitalize: "characters", autoComplete: "off", spellCheck: false, required: true, value: code, onChange: (e) => setCode(codeFormatieren(e.target.value)) }) }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), erfolg && _jsx(Hinweis, { art: "erfolg", children: "Code eingel\u00F6st." }), _jsx(Knopf, { type: "submit", variante: "sekundaer", disabled: laedt || code.length < 9, children: "Einl\u00F6sen" })] }));
}
// Benachrichtigungen: Ein/Aus je Ereignisgruppe, je Nutzer gespeichert
function BenachrichtigungenWahl({ userId, istInhaber }) {
    const [werte, setWerte] = useState(null);
    const [fehler, setFehler] = useState(null);
    useEffect(() => {
        void supabase
            .from('profiles')
            .select('benachrichtigungen')
            .eq('id', userId)
            .maybeSingle()
            .then(({ data, error }) => {
            if (error)
                setFehler(fehlertext(error));
            else
                setWerte((data?.benachrichtigungen ?? {}));
        });
    }, [userId]);
    async function umschalten(id, an) {
        if (!werte)
            return;
        const neu = { ...werte, [id]: an };
        setWerte(neu);
        const { error } = await supabase.from('profiles').update({ benachrichtigungen: neu }).eq('id', userId);
        if (error) {
            setWerte(werte);
            setFehler(fehlertext(error));
        }
        else
            setFehler(null);
    }
    const gruppen = EREIGNIS_GRUPPEN.filter((g) => istInhaber || !g.nurInhaber);
    return (_jsxs(Gruppe, { titel: "Benachrichtigungen", fuss: "Steuert, welche Meldungen in der Glocke erscheinen. Eigene Aktionen werden nie gemeldet. Es gibt keinen E-Mail- oder Push-Versand.", children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), gruppen.map((g) => (_jsx(Zeile, { label: _jsxs(_Fragment, { children: [_jsx("strong", { children: g.label }), _jsx("br", {}), _jsx("small", { style: { color: 'var(--text-leise)' }, children: g.text })] }), children: _jsx("input", { type: "checkbox", role: "switch", "aria-label": g.label, checked: werte ? werte[g.id] !== false : true, disabled: !werte, onChange: (e) => void umschalten(g.id, e.target.checked) }) }, g.id)))] }));
}
function DarstellungWahl() {
    const [wert, setWert] = useDarstellung();
    return (_jsx(Gruppe, { titel: "Darstellung", fuss: "\u201ESystem\u201C folgt der Einstellung deines Ger\u00E4ts. Die Wahl gilt nur f\u00FCr diesen Browser.", children: _jsx("div", { style: { padding: '10px var(--abstand)' }, children: _jsx(Segmente, { label: "Darstellung", wert: wert, onAendern: setWert, optionen: [
                    { wert: 'system', label: 'System' },
                    { wert: 'hell', label: 'Hell' },
                    { wert: 'dunkel', label: 'Dunkel' },
                ] }) }) }));
}
// Auf dem Gerät zwischengespeicherte Kartenkacheln (Luftbild, OpenStreetMap)
function KartenSpeicher() {
    const [anzahl, setAnzahl] = useState(null);
    const zaehlen = async () => {
        try {
            setAnzahl((await (await caches.open('hegewerk-karten-v1')).keys()).length);
        }
        catch {
            setAnzahl(null);
        }
    };
    useEffect(() => {
        void zaehlen();
    }, []);
    if (anzahl === null)
        return null;
    return (_jsx(Gruppe, { titel: "Kartenspeicher", fuss: "Kacheln werden auf diesem Ger\u00E4t zwischengespeichert, damit sie nicht erneut geladen werden m\u00FCssen (spart mobile Daten).", children: _jsx(Zeile, { label: `${anzahl.toLocaleString('de-DE')} Kacheln gespeichert`, children: _jsx(Knopf, { variante: "sekundaer", disabled: anzahl === 0, onClick: async () => {
                    await caches.delete('hegewerk-karten-v1');
                    await zaehlen();
                }, children: "Leeren" }) }) }));
}
