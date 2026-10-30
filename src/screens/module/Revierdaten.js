import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { Feld, Gruppe, Hinweis, Knopf } from '../../components/ui';
const ARTEN = [
    { id: 'grenze', tabelle: 'revier_grenzen', titel: 'Reviergrenze', hinweis: 'Die Revierfläche in ha bleibt unverändert, bis eine neue Grenze übernommen wird.' },
    { id: 'zonen', tabelle: 'zonen', titel: 'Zonen', hinweis: 'Zählwerte, Beobachtungen, Abschüsse und Wildschäden bleiben erhalten, verlieren aber ihre Zonenzuordnung.' },
    { id: 'ebenen', tabelle: 'zonen_ebenen', titel: 'Zonenebenen', hinweis: 'Die Ebene früherer Zählungen entfällt.' },
    { id: 'einrichtungen', tabelle: 'einrichtungen', titel: 'Einrichtungen', hinweis: 'Verknüpfungen in Abschüssen und Aufgaben werden entfernt.' },
    { id: 'pirschwege', tabelle: 'pirschwege', titel: 'Pirschwege', hinweis: '' },
];
// Nur für Inhaber: Karten- und Flächendaten eines Reviers vollständig entfernen (z. B. vor einem neuen Import)
export function RevierdatenLoeschen({ revierId, onGeaendert }) {
    const [zahlen, setZahlen] = useState({});
    const [auswahl, setAuswahl] = useState(new Set());
    const [bestaetigung, setBestaetigung] = useState('');
    const [laeuft, setLaeuft] = useState(false);
    const [meldung, setMeldung] = useState(null);
    const zaehlen = useCallback(async () => {
        const erg = await Promise.all(ARTEN.map(async (a) => {
            const { count } = await supabase.from(a.tabelle).select('*', { count: 'exact', head: true }).eq('revier_id', revierId);
            return [a.id, count ?? 0];
        }));
        setZahlen(Object.fromEntries(erg));
    }, [revierId]);
    useEffect(() => {
        void zaehlen();
    }, [zaehlen]);
    const umschalten = (id) => setAuswahl((alt) => {
        const neu = new Set(alt);
        if (neu.has(id))
            neu.delete(id);
        else
            neu.add(id);
        return neu;
    });
    async function loeschen() {
        setLaeuft(true);
        setMeldung(null);
        const geloescht = [];
        try {
            // Zonen vor Ebenen, damit nichts mehr auf eine Ebene zeigt
            for (const a of ARTEN.filter((x) => auswahl.has(x.id))) {
                const { error, count } = await supabase.from(a.tabelle).delete({ count: 'exact' }).eq('revier_id', revierId);
                if (error)
                    throw error;
                geloescht.push(`${(count ?? 0).toLocaleString('de-DE')} ${a.titel}`);
            }
            setMeldung({ art: 'erfolg', text: `Gelöscht: ${geloescht.join(', ')}.` });
            setAuswahl(new Set());
            setBestaetigung('');
            await onGeaendert();
        }
        catch (err) {
            setMeldung({ art: 'fehler', text: `Löschen abgebrochen${geloescht.length ? ` (bereits gelöscht: ${geloescht.join(', ')})` : ''}: ${fehlertext(err)}` });
        }
        finally {
            await zaehlen();
            setLaeuft(false);
        }
    }
    const bereit = auswahl.size > 0 && bestaetigung.trim().toUpperCase() === 'LÖSCHEN';
    return (_jsxs(_Fragment, { children: [meldung && _jsx(Hinweis, { art: meldung.art, children: meldung.text }), _jsxs(Gruppe, { titel: "Kartendaten des Reviers l\u00F6schen", fuss: "Zum Beispiel, um eine neue Reviergrenze mit Zonen neu hochzuladen (Datenimport). Das L\u00F6schen kann nicht r\u00FCckg\u00E4ngig gemacht werden.", children: [ARTEN.map((a) => (_jsxs("label", { className: "zeile", children: [_jsx("input", { type: "checkbox", checked: auswahl.has(a.id), onChange: () => umschalten(a.id), disabled: laeuft || !zahlen[a.id] }), _jsxs("span", { className: "zeile-label", children: [a.titel, _jsxs("small", { children: [zahlen[a.id] === undefined ? 'wird gezählt …' : a.id === 'grenze' ? (zahlen[a.id] ? 'vorhanden' : 'nicht vorhanden') : `${zahlen[a.id].toLocaleString('de-DE')} vorhanden`, a.hinweis && zahlen[a.id] ? ` · ${a.hinweis}` : ''] })] })] }, a.id))), _jsx("button", { type: "button", className: "link", style: { padding: '8px 16px' }, onClick: () => setAuswahl(new Set(ARTEN.filter((a) => zahlen[a.id]).map((a) => a.id))), disabled: laeuft, children: "Alles ausw\u00E4hlen" }), auswahl.size > 0 && (_jsx(Feld, { label: "Zur Best\u00E4tigung \u201EL\u00D6SCHEN\u201C eintippen", value: bestaetigung, onChange: (e) => setBestaetigung(e.target.value), autoComplete: "off", placeholder: "L\u00D6SCHEN" }))] }), _jsx(Knopf, { variante: "gefahr", disabled: !bereit || laeuft, onClick: () => void loeschen(), children: laeuft ? 'Löscht …' : auswahl.size ? `Ausgewählte Daten endgültig löschen (${auswahl.size})` : 'Daten zum Löschen auswählen' })] }));
}
