import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { DruckPortal } from '../../components/DruckPortal';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, useZonen } from '../../lib/stammdaten';
import { datumDE, heuteISO } from '../../lib/zeit';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile } from '../../components/ui';
const SPALTEN = 'id, gast_name, gast_kontakt, jagdschein_nr, art, entgelt_eur, gueltig_von, gueltig_bis, bereich, wildarten, bedingungen, widerrufen_am';
function stand(s) {
    const heute = heuteISO();
    if (s.widerrufen_am)
        return { text: 'widerrufen', klasse: 'badge-rot', aktiv: false };
    if (s.gueltig_bis < heute)
        return { text: 'abgelaufen', klasse: '', aktiv: false };
    if (s.gueltig_von > heute)
        return { text: `ab ${datumDE(s.gueltig_von)}`, klasse: '', aktiv: false };
    const rest = Math.round((new Date(`${s.gueltig_bis}T12:00:00`).getTime() - new Date(`${heute}T12:00:00`).getTime()) / 86400000);
    if (rest <= 7)
        return { text: rest === 0 ? 'läuft heute ab' : `noch ${rest} ${rest === 1 ? 'Tag' : 'Tage'}`, klasse: 'badge-orange', aktiv: true };
    return { text: 'gültig', klasse: 'badge-gruen', aktiv: true };
}
export function Begehungsscheine({ k }) {
    const wildarten = useWildarten();
    const [liste, setListe] = useState([]);
    const [bearbeiten, setBearbeiten] = useState(null);
    const [ansicht, setAnsicht] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [alle, setAlle] = useState(false);
    const laden = useCallback(async () => {
        const { data, error } = await supabase
            .from('begehungsscheine')
            .select(SPALTEN)
            .eq('revier_id', k.revierId)
            .is('geloescht_am', null)
            .order('gueltig_bis', { ascending: false });
        if (error)
            setFehler(fehlertext(error));
        setListe(data ?? []);
    }, [k.revierId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    const aktive = liste.filter((s) => stand(s).aktiv);
    const sichtbar = alle ? liste : aktive;
    if (bearbeiten) {
        return (_jsx(ScheinFormular, { k: k, vorlage: bearbeiten === 'neu' ? null : bearbeiten, onFertig: async () => {
                setBearbeiten(null);
                await laden();
            } }));
    }
    return (_jsxs(Seite, { titel: "Begehungsscheine", untertitel: `${aktive.length} ${aktive.length === 1 ? 'gültiger Schein' : 'gültige Scheine'}`, aktion: k.istInhaber ? _jsx(Knopf, { variante: "akzent", onClick: () => setBearbeiten('neu'), children: "+ Schein" }) : undefined, children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsxs("label", { className: "filter", children: [_jsx("input", { type: "checkbox", checked: alle, onChange: (e) => setAlle(e.target.checked) }), " auch abgelaufene und widerrufene anzeigen"] }), _jsxs(Gruppe, { children: [sichtbar.length === 0 && _jsx(Zeile, { label: alle ? 'Noch keine Begehungsscheine' : 'Keine gültigen Begehungsscheine' }), sichtbar.map((s) => {
                        const st = stand(s);
                        return (_jsxs("button", { className: "zeile zeile-knopf", onClick: () => setAnsicht(s), children: [_jsxs("span", { className: "zeile-label", children: [s.gast_name, _jsxs("small", { children: [datumDE(s.gueltig_von), " \u2013 ", datumDE(s.gueltig_bis), " \u00B7 ", s.art === 'entgeltlich' ? 'entgeltlich' : 'unentgeltlich', s.bereich ? ` · ${s.bereich}` : ''] }), _jsxs("span", { className: "zeile-badges", children: [_jsx("span", { className: `badge ${st.klasse}`, children: st.text }), s.wildarten.length > 0 && (_jsx("span", { className: "badge", children: s.wildarten.map((id) => wildarten.find((w) => w.id === id)?.name ?? id).join(', ') }))] })] }), _jsx("span", { className: "zeile-pfeil", "aria-hidden": "true", children: "\u203A" })] }, s.id));
                    })] }), !k.istInhaber && _jsx(Leer, { children: "Begehungsscheine stellt der Revierinhaber aus. Hier siehst du, wer im Revier eine Erlaubnis hat." }), ansicht && _jsx(ScheinFenster, { k: k, schein: ansicht, onZurueck: () => setAnsicht(null), onBearbeiten: () => { setBearbeiten(ansicht); setAnsicht(null); } })] }));
}
function ScheinFenster({ k, schein, onZurueck, onBearbeiten }) {
    const wildarten = useWildarten();
    const st = stand(schein);
    useEffect(() => {
        const taste = (e) => e.key === 'Escape' && onZurueck();
        window.addEventListener('keydown', taste);
        return () => window.removeEventListener('keydown', taste);
    }, [onZurueck]);
    // Schwebendes Fenster (≥ 900 px) bzw. Vollbild-Sheet (Handy), unabhängig von der Seitenleiste
    return (_jsx(DruckPortal, { children: _jsxs("div", { className: "schein-fenster", role: "dialog", "aria-label": "Begehungsschein", children: [_jsxs("div", { className: "schein-fenster-kopf", children: [_jsx("h2", { children: "Begehungsschein" }), _jsx(Knopf, { variante: "sekundaer", onClick: () => window.print(), children: "Drucken" }), _jsx(Knopf, { variante: "ghost", onClick: onZurueck, "aria-label": "Schlie\u00DFen", children: "Schlie\u00DFen" })] }), _jsxs("article", { className: "schein-druck", children: [_jsxs("header", { children: [_jsxs("p", { className: "schein-revier", children: ["Revier ", k.revierName] }), _jsx("h2", { children: "Begehungsschein" })] }), _jsxs("dl", { children: [_jsx("dt", { children: "Inhaber der Erlaubnis" }), _jsx("dd", { children: schein.gast_name }), schein.jagdschein_nr && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "Jagdschein-Nr." }), _jsx("dd", { children: schein.jagdschein_nr })] })), schein.gast_kontakt && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "Kontakt" }), _jsx("dd", { children: schein.gast_kontakt })] })), _jsx("dt", { children: "G\u00FCltig" }), _jsxs("dd", { children: [datumDE(schein.gueltig_von), " bis ", datumDE(schein.gueltig_bis)] }), _jsx("dt", { children: "Art" }), _jsx("dd", { children: schein.art === 'entgeltlich' ? `entgeltlich${schein.entgelt_eur ? ` (${schein.entgelt_eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})` : ''}` : 'unentgeltlich' }), _jsx("dt", { children: "Bereich" }), _jsx("dd", { children: schein.bereich || 'gesamtes Revier' }), _jsx("dt", { children: "Wildarten" }), _jsx("dd", { children: schein.wildarten.length ? schein.wildarten.map((id) => wildarten.find((w) => w.id === id)?.name ?? id).join(', ') : 'nach Absprache / Abschussplan' }), schein.bedingungen && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "Bedingungen" }), _jsx("dd", { className: "schein-text", children: schein.bedingungen })] }))] }), _jsxs("p", { className: "schein-status", children: ["Status: ", _jsx("span", { className: `badge ${st.klasse}`, children: st.text }), schein.widerrufen_am && _jsxs(_Fragment, { children: [" \u00B7 widerrufen am ", datumDE(schein.widerrufen_am)] })] }), _jsxs("footer", { className: "schein-unterschrift", children: [_jsx("span", { children: "Ort, Datum" }), _jsx("span", { children: "Unterschrift Revierinhaber/P\u00E4chter" })] })] }), k.istInhaber && _jsx(Knopf, { variante: "sekundaer", onClick: onBearbeiten, children: "Bearbeiten" })] }) }));
}
function ScheinFormular({ k, vorlage, onFertig }) {
    const wildarten = useWildarten();
    const { zonen } = useZonen(k.revierId);
    const [gast, setGast] = useState(vorlage?.gast_name ?? '');
    const [kontakt, setKontakt] = useState(vorlage?.gast_kontakt ?? '');
    const [nummer, setNummer] = useState(vorlage?.jagdschein_nr ?? '');
    const [art, setArt] = useState(vorlage?.art ?? 'unentgeltlich');
    const [entgelt, setEntgelt] = useState(vorlage?.entgelt_eur ? String(vorlage.entgelt_eur).replace('.', ',') : '');
    const [von, setVon] = useState(vorlage?.gueltig_von ?? heuteISO());
    const [bis, setBis] = useState(vorlage?.gueltig_bis ?? '');
    const [bereich, setBereich] = useState(vorlage?.bereich ?? '');
    const [arten, setArten] = useState(vorlage?.wildarten ?? []);
    const [bedingungen, setBedingungen] = useState(vorlage?.bedingungen ?? '');
    const [widerrufen, setWiderrufen] = useState(vorlage?.widerrufen_am ?? '');
    const [fehler, setFehler] = useState(null);
    const [speichert, setSpeichert] = useState(false);
    async function speichern(e) {
        e.preventDefault();
        setFehler(null);
        const eur = entgelt.trim() ? Number(entgelt.replace(',', '.')) : null;
        if (eur !== null && (!Number.isFinite(eur) || eur < 0)) {
            setFehler('Bitte ein gültiges Entgelt angeben.');
            return;
        }
        if (bis < von) {
            setFehler('Das Ende der Gültigkeit liegt vor dem Beginn.');
            return;
        }
        setSpeichert(true);
        const daten = {
            revier_id: k.revierId,
            gast_name: gast.trim(),
            gast_kontakt: kontakt.trim() || null,
            jagdschein_nr: nummer.trim() || null,
            art,
            entgelt_eur: art === 'entgeltlich' ? eur : null,
            gueltig_von: von,
            gueltig_bis: bis,
            bereich: bereich.trim() || null,
            wildarten: arten,
            bedingungen: bedingungen.trim() || null,
            widerrufen_am: widerrufen || null,
        };
        const { error } = vorlage
            ? await supabase.from('begehungsscheine').update(daten).eq('id', vorlage.id)
            : await supabase.from('begehungsscheine').insert(daten);
        setSpeichert(false);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    async function loeschen() {
        if (!vorlage || !window.confirm('Diesen Begehungsschein löschen?'))
            return;
        const { error } = await supabase.from('begehungsscheine').update({ geloescht_am: new Date().toISOString() }).eq('id', vorlage.id);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    return (_jsx(Seite, { titel: vorlage ? 'Begehungsschein bearbeiten' : 'Begehungsschein ausstellen', zurueck: () => void onFertig(), children: _jsxs("form", { onSubmit: speichern, children: [_jsxs(Gruppe, { titel: "Gast", children: [_jsx(Feld, { label: "Name", required: true, value: gast, onChange: (e) => setGast(e.target.value) }), _jsx(Feld, { label: "Kontakt", placeholder: "Telefon oder E-Mail", value: kontakt, onChange: (e) => setKontakt(e.target.value) }), _jsx(Feld, { label: "Jagdschein-Nr.", placeholder: "optional", value: nummer, onChange: (e) => setNummer(e.target.value) })] }), _jsxs(Gruppe, { titel: "G\u00FCltigkeit", children: [_jsx(Feld, { label: "Von", type: "date", required: true, value: von, onChange: (e) => setVon(e.target.value) }), _jsx(Feld, { label: "Bis", type: "date", required: true, value: bis, min: von, onChange: (e) => setBis(e.target.value) }), _jsxs(Auswahl, { label: "Art", value: art, onChange: (e) => setArt(e.target.value), children: [_jsx("option", { value: "unentgeltlich", children: "unentgeltlich" }), _jsx("option", { value: "entgeltlich", children: "entgeltlich" })] }), art === 'entgeltlich' && _jsx(Feld, { label: "Entgelt (\u20AC)", inputMode: "decimal", value: entgelt, onChange: (e) => setEntgelt(e.target.value) })] }), _jsxs(Gruppe, { titel: "Umfang", children: [_jsx(Feld, { label: "Bereich", placeholder: "leer = gesamtes Revier", list: "bereiche", value: bereich, onChange: (e) => setBereich(e.target.value) }), _jsx("datalist", { id: "bereiche", children: zonen.map((z) => (_jsx("option", { value: z.name }, z.id))) })] }), _jsxs("details", { className: "werkzeug-abschnitt", children: [_jsxs("summary", { children: ["Wildarten (", arten.length ? `${arten.length} gewählt` : 'alle nach Absprache', ")"] }), _jsx("div", { className: "wildarten-wahl", children: wildarten.map((w, i) => (_jsxs("label", { className: "ebene", style: i === 8 ? { borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 4 } : undefined, children: [_jsx("input", { type: "checkbox", checked: arten.includes(w.id), onChange: (e) => setArten((alt) => (e.target.checked ? [...alt, w.id] : alt.filter((x) => x !== w.id))) }), w.name] }, w.id))) })] }), _jsxs(Gruppe, { children: [_jsx(Feld, { label: "Bedingungen", placeholder: "z. B. Abschussmeldung innerhalb 24 h", value: bedingungen, onChange: (e) => setBedingungen(e.target.value) }), vorlage && _jsx(Feld, { label: "Widerrufen am", type: "date", value: widerrufen, onChange: (e) => setWiderrufen(e.target.value) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", disabled: speichert || !gast.trim() || !bis, children: speichert ? 'Speichern …' : 'Speichern' }), _jsx(Knopf, { type: "button", variante: "ghost", onClick: () => void onFertig(), children: "Abbrechen" }), vorlage && (_jsx(Knopf, { type: "button", variante: "gefahr", onClick: loeschen, children: "Schein l\u00F6schen" }))] }) }));
}
