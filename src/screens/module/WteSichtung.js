import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { FlaechenmodusWahl, STANDARD_BREITE_M } from './FlaechenmodusWahl';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten } from '../../lib/stammdaten';
import { speichernOderMerken } from '../../lib/offline';
import { heuteISO, mondphase } from '../../lib/zeit';
import { Auswahl, Hinweis, Knopf, Segmente, WildartOptionen, Zaehler } from '../../components/ui';
import { Symbol } from '../../components/symbole';
// Bottom-Sheet im WTE-Modus: Sichtung für die angetippte Zone direkt in die aktive Zählung eintragen.
// Gibt es keine aktive Zählung, bleibt die Eingabe stehen und die Zählung wird im selben Sheet gestartet.
export function WteSichtung({ k, zone, sitzung, ebenen, onSchliessen, onGespeichert, onSitzung, }) {
    const wildarten = useWildarten();
    const [wildartId, setWildartId] = useState('rehwild');
    const [anzahl, setAnzahl] = useState(1);
    const [geschlecht, setGeschlecht] = useState('unbekannt');
    const [altersklasse, setAltersklasse] = useState('');
    const [datum, setDatum] = useState(heuteISO());
    const [ebeneId, setEbeneId] = useState(zone.ebeneId ?? '');
    const [modus, setModus] = useState('zonen');
    const [breite, setBreite] = useState(STANDARD_BREITE_M);
    const [fehler, setFehler] = useState(null);
    const [laeuft, setLaeuft] = useState(false);
    const klassen = wildarten.find((w) => w.id === wildartId)?.altersklassen ?? [];
    const falscheEbene = !!sitzung?.ebene_id && sitzung.ebene_id !== zone.ebeneId;
    async function eintragen(s) {
        // Gleiche Zeile (Zone, Wildart, Geschlecht, Altersklasse) in der Zählung hochzählen statt doppelt anzulegen
        let id = crypto.randomUUID();
        let summe = anzahl;
        if (navigator.onLine) {
            let q = supabase.from('zaehlungen').select('id, anzahl').eq('sitzung_id', s.id).eq('zone_id', zone.id).eq('wildart_id', wildartId).eq('geschlecht', geschlecht).is('geloescht_am', null);
            q = altersklasse ? q.eq('altersklasse', altersklasse) : q.is('altersklasse', null);
            const { data } = await q.limit(1);
            if (data?.[0]) {
                id = data[0].id;
                summe = data[0].anzahl + anzahl;
            }
        }
        const r = await speichernOderMerken({
            tabelle: 'zaehlungen',
            daten: { id, sitzung_id: s.id, revier_id: k.revierId, zone_id: zone.id, wildart_id: wildartId, geschlecht, altersklasse: altersklasse || null, anzahl: summe, erfasst_von: k.userId },
        });
        const name = wildarten.find((w) => w.id === wildartId)?.name ?? wildartId;
        onGespeichert(`${anzahl} × ${name} in „${zone.name}“ ${r === 'gemerkt' ? 'auf dem Gerät gespeichert (wird übertragen)' : 'in die Zählung eingetragen'}`);
    }
    async function speichern(startenErst) {
        setFehler(null);
        setLaeuft(true);
        try {
            let s = sitzung;
            if (startenErst) {
                const mond = mondphase(new Date(`${datum}T20:00:00`));
                const { error } = await supabase.from('zaehlsitzungen').insert({
                    revier_id: k.revierId,
                    datum,
                    beginn: new Date().toISOString(),
                    mondphase: `${mond.name} (${mond.beleuchtung} %)`,
                    ebene_id: ebeneId || null,
                    flaechenmodus: modus,
                    streifenbreite_m: breite || STANDARD_BREITE_M,
                });
                // 23505: In diesem Revier läuft bereits eine Zählung (z. B. von einem anderen Gerät gestartet) – diese verwenden
                if (error && error.code !== '23505')
                    throw error;
                s = await onSitzung();
                if (!s)
                    throw new Error('Die Zählung konnte nicht gestartet werden.');
            }
            if (!s)
                return;
            await eintragen(s);
        }
        catch (err) {
            setFehler(fehlertext(err));
        }
        finally {
            setLaeuft(false);
        }
    }
    return (_jsxs("div", { className: "wte-sheet", role: "dialog", "aria-label": `Sichtung in ${zone.name}`, children: [_jsxs("div", { className: "wte-sheet-kopf", children: [_jsxs("strong", { children: ["Sichtung \u00B7 ", zone.name] }), _jsx("button", { type: "button", className: "link", onClick: onSchliessen, "aria-label": "Schlie\u00DFen", children: _jsx(Symbol, { name: "schliessen", className: "symbol klein" }) })] }), _jsx(Auswahl, { label: "Wildart", value: wildartId, onChange: (e) => { setWildartId(e.target.value); setAltersklasse(''); }, children: _jsx(WildartOptionen, { wildarten: wildarten }) }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Anzahl" }), _jsx(Zaehler, { label: "Anzahl", wert: anzahl, min: 1, onAendern: setAnzahl })] }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Geschlecht" }), _jsx(Segmente, { label: "Geschlecht", wert: geschlecht, onAendern: setGeschlecht, optionen: GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.kurz })) })] }), klassen.length > 0 && (_jsxs(Auswahl, { label: "Altersklasse", value: altersklasse, onChange: (e) => setAltersklasse(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), klassen.map((a) => (_jsx("option", { value: a, children: a }, a)))] })), sitzung ? (_jsxs(_Fragment, { children: [falscheEbene && _jsx(Hinweis, { art: "fehler", children: "Diese Zone geh\u00F6rt nicht zur Zonenebene der laufenden Z\u00E4hlung." }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { onClick: () => void speichern(false), disabled: laeuft || falscheEbene, children: laeuft ? 'Speichern …' : 'In Zählung eintragen' })] })) : (_jsxs("div", { className: "wte-neue-zaehlung", role: "group", "aria-label": "Neue Z\u00E4hlung", children: [_jsx(Hinweis, { art: "info", children: "Keine laufende Z\u00E4hlung. Starte eine neue \u2013 deine Eingabe bleibt erhalten und wird danach \u00FCbernommen." }), _jsxs("label", { className: "zeile feld", children: [_jsx("span", { className: "zeile-label", children: "Datum" }), _jsx("input", { type: "date", value: datum, onChange: (e) => setDatum(e.target.value) })] }), ebenen.length > 0 && (_jsxs(Auswahl, { label: "Zonenebene", value: ebeneId, onChange: (e) => setEbeneId(e.target.value), children: [_jsx("option", { value: "", children: "Alle Zonen" }), ebenen.map((x) => (_jsx("option", { value: x.id, children: x.name }, x.id)))] })), _jsx(FlaechenmodusWahl, { modus: modus, breite: breite, onModus: setModus, onBreite: setBreite }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { variante: "akzent", onClick: () => void speichern(true), disabled: laeuft || !datum, children: laeuft ? 'Starte …' : 'Zählung starten und eintragen' })] }))] }));
}
