import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten, useZonen, wildartName } from '../../lib/stammdaten';
import { aktuellePosition, punktEWKT } from '../../lib/geo';
import { PositionWaehlen } from '../../components/PositionWaehlen';
import { speichernOderMerken } from '../../lib/offline';
import { datumZeitDE } from '../../lib/zeit';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente, Zaehler, Zeile } from '../../components/ui';
import { Symbol } from '../../components/symbole';
const SCHNELLWAHL = ['rehwild', 'schwarzwild', 'rotwild', 'damwild', 'fuchs', 'feldhase'];
export function Erfassung({ k }) {
    const wildarten = useWildarten();
    const { zonen } = useZonen(k.revierId);
    const [wildartId, setWildartId] = useState('rehwild');
    const [anzahl, setAnzahl] = useState(1);
    const [geschlecht, setGeschlecht] = useState('unbekannt');
    const [altersklasse, setAltersklasse] = useState('');
    const [zoneId, setZoneId] = useState('');
    const [bemerkung, setBemerkung] = useState('');
    const [position, setPosition] = useState(null);
    const [ortStatus, setOrtStatus] = useState('Position wird bestimmt …');
    const [meldung, setMeldung] = useState(null);
    const [liste, setListe] = useState([]);
    const klassen = wildarten.find((w) => w.id === wildartId)?.altersklassen ?? [];
    const ortBestimmen = useCallback(async () => {
        setOrtStatus('Position wird bestimmt …');
        const p = await aktuellePosition();
        setPosition(p);
        if (!p) {
            setOrtStatus('Keine Position – Erfassung ohne Ort möglich');
            return;
        }
        setOrtStatus(`Position ± ${p.genauigkeit} m`);
        if (navigator.onLine) {
            const { data } = await supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: p.lon, p_lat: p.lat });
            if (data)
                setZoneId(data);
        }
    }, [k.revierId]);
    const laden = useCallback(async () => {
        const { data } = await supabase
            .from('beobachtungen')
            .select('id, zeitpunkt, wildart_id, anzahl, geschlecht, altersklasse, zone_id, erfasst_von, bemerkung')
            .eq('revier_id', k.revierId)
            .is('geloescht_am', null)
            .order('zeitpunkt', { ascending: false })
            .limit(25);
        if (data)
            setListe(data);
    }, [k.revierId]);
    useEffect(() => {
        void ortBestimmen();
        void laden();
    }, [ortBestimmen, laden]);
    async function speichern() {
        setMeldung(null);
        try {
            const ergebnis = await speichernOderMerken({
                tabelle: 'beobachtungen',
                daten: {
                    id: crypto.randomUUID(),
                    revier_id: k.revierId,
                    zeitpunkt: new Date().toISOString(),
                    wildart_id: wildartId,
                    anzahl,
                    geschlecht,
                    altersklasse: altersklasse || null,
                    zone_id: zoneId || null,
                    bemerkung: bemerkung.trim() || null,
                    erfasst_von: k.userId,
                    geom: position ? punktEWKT(position.lon, position.lat) : null,
                },
            });
            setMeldung(ergebnis === 'gespeichert'
                ? { art: 'erfolg', text: `${anzahl} × ${wildartName(wildarten, wildartId)} gespeichert` }
                : { art: 'info', text: 'Kein Netz – gespeichert auf dem Gerät, wird automatisch übertragen' });
            setAnzahl(1);
            setGeschlecht('unbekannt');
            setAltersklasse('');
            setBemerkung('');
            if (ergebnis === 'gespeichert')
                await laden();
        }
        catch (err) {
            setMeldung({ art: 'fehler', text: fehlertext(err) });
        }
    }
    async function loeschen(b) {
        if (!window.confirm('Diese Beobachtung löschen?'))
            return;
        const { error } = await supabase.from('beobachtungen').delete().eq('id', b.id);
        if (error)
            setMeldung({ art: 'fehler', text: fehlertext(error) });
        await laden();
    }
    const weitere = wildarten.filter((w) => !SCHNELLWAHL.includes(w.id));
    return (_jsxs(Seite, { titel: "Einzelerfassung", untertitel: ortStatus, children: [_jsx("div", { className: "schnellwahl", role: "radiogroup", "aria-label": "Wildart", children: SCHNELLWAHL.map((id) => (_jsx("button", { type: "button", role: "radio", "aria-checked": wildartId === id, onClick: () => {
                        setWildartId(id);
                        setAltersklasse('');
                    }, children: wildartName(wildarten, id) }, id))) }), _jsxs(Gruppe, { children: [_jsxs(Auswahl, { label: "Andere Wildart", value: SCHNELLWAHL.includes(wildartId) ? '' : wildartId, onChange: (e) => {
                            if (e.target.value)
                                setWildartId(e.target.value);
                            setAltersklasse('');
                        }, children: [_jsx("option", { value: "", children: "\u2013" }), weitere.map((w) => (_jsx("option", { value: w.id, children: w.name }, w.id)))] }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Anzahl" }), _jsx(Zaehler, { label: "Anzahl", wert: anzahl, min: 1, onAendern: setAnzahl })] }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Geschlecht" }), _jsx(Segmente, { label: "Geschlecht", wert: geschlecht, onAendern: setGeschlecht, optionen: GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.kurz })) })] }), klassen.length > 0 && (_jsxs(Auswahl, { label: "Altersklasse", value: altersklasse, onChange: (e) => setAltersklasse(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), klassen.map((a) => (_jsx("option", { value: a, children: a }, a)))] })), _jsxs(Auswahl, { label: "Zone", value: zoneId, onChange: (e) => setZoneId(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), zonen.map((z) => (_jsx("option", { value: z.id, children: z.name }, z.id)))] }), _jsx(Feld, { label: "Bemerkung", value: bemerkung, onChange: (e) => setBemerkung(e.target.value) })] }), meldung && _jsx(Hinweis, { art: meldung.art, children: meldung.text }), _jsxs(Knopf, { onClick: speichern, children: [anzahl, " \u00D7 ", wildartName(wildarten, wildartId), " erfassen"] }), _jsxs(Knopf, { variante: "sekundaer", onClick: ortBestimmen, children: [_jsx(Symbol, { name: "position", className: "symbol klein" }), " Aktuelle Position verwenden"] }), _jsx(PositionWaehlen, { revierId: k.revierId, wert: position, onWaehlen: (p) => {
                    setPosition({ lon: p.lon, lat: p.lat, genauigkeit: 0 });
                    setOrtStatus('Position auf der Karte gewählt');
                    if (navigator.onLine)
                        void supabase.rpc('zone_an_position', { p_revier_id: k.revierId, p_lon: p.lon, p_lat: p.lat }).then(({ data }) => data && setZoneId(data));
                } }), _jsxs(Gruppe, { titel: "Zuletzt erfasst", children: [liste.length === 0 && _jsx(Zeile, { label: "Noch keine Beobachtungen" }), liste.map((b) => (_jsx(Zeile, { label: _jsxs(_Fragment, { children: [b.anzahl, " \u00D7 ", wildartName(wildarten, b.wildart_id), " ", GESCHLECHTER.find((g) => g.wert === b.geschlecht)?.kurz, b.altersklasse ? ` · ${b.altersklasse}` : '', _jsxs("small", { children: [datumZeitDE(b.zeitpunkt), zonen.find((z) => z.id === b.zone_id) ? ` · ${zonen.find((z) => z.id === b.zone_id)?.name}` : '', b.bemerkung ? ` · ${b.bemerkung}` : ''] })] }), children: (k.istInhaber || b.erfasst_von === k.userId) && (_jsx("button", { className: "link gefahr", onClick: () => loeschen(b), children: "L\u00F6schen" })) }, b.id)))] }), _jsx(Leer, { children: "Ohne Netz werden Erfassungen auf dem Ger\u00E4t gespeichert und \u00FCbertragen, sobald wieder Verbindung besteht." })] }));
}
