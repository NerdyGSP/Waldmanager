import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useWildarten, wildartName } from '../../lib/stammdaten';
import { aktuellesJagdjahr, datumDE, letzteJagdjahre } from '../../lib/zeit';
import { navigieren } from '../../lib/router';
import { Gruppe, Hinweis, Knopf, Leer, Seite, Segmente } from '../../components/ui';
import { Balken, Verlauf, VerlaufMehrere } from '../../components/diagramme';
import { Symbol } from '../../components/symbole';
import { useZaehlungGeaendert } from '../../lib/zaehlEreignis';
import { JagdjahrReport } from './JagdjahrReport';
// Zählwerte nach einer übertragenen Sichtung neu laden
function useAuffrischen() {
    const [n, setN] = useState(0);
    useZaehlungGeaendert((e) => {
        if (e.quelle === 'server')
            setN((x) => x + 1);
    });
    return n;
}
export function Monitoring({ k, breit = false, abgedockt = false }) {
    const voll = window.location.pathname.startsWith('/monitoring/voll');
    const wildarten = useWildarten();
    const [jahr, setJahr] = useState(aktuellesJagdjahr());
    const [ansicht, setAnsicht] = useState('revier');
    const [sitzungen, setSitzungen] = useState([]);
    const [strecke, setStrecke] = useState({});
    const [beobachtungen, setBeobachtungen] = useState(0);
    const [vergleich, setVergleich] = useState([]);
    const [hatFreigaben, setHatFreigaben] = useState(true);
    const [fehler, setFehler] = useState(null);
    const [verlaufArt, setVerlaufArt] = useState('rehwild');
    const auffrischen = useAuffrischen();
    useEffect(() => {
        void (async () => {
            setFehler(null);
            const [s, a, b, v, f] = await Promise.all([
                supabase
                    .from('zaehlsitzungen')
                    .select('id, datum, flaechenmodus, streifenbreite_m, strecke_km, flaeche_ha, zaehlungen(wildart_id, anzahl, geloescht_am)')
                    .eq('revier_id', k.revierId)
                    .eq('status', 'abgeschlossen')
                    .is('geloescht_am', null)
                    .gte('datum', jahr.von)
                    .lte('datum', jahr.bis)
                    .order('datum'),
                supabase
                    .from('abschuesse')
                    .select('wildart_id')
                    .or('art.eq.abschuss,and(art.eq.fang,fang_ergebnis.eq.gefangen)')
                    .eq('revier_id', k.revierId)
                    .is('geloescht_am', null)
                    .gte('erlegt_am', `${jahr.von}T00:00:00`)
                    .lte('erlegt_am', `${jahr.bis}T23:59:59`),
                supabase
                    .from('beobachtungen')
                    .select('id', { count: 'exact', head: true })
                    .eq('revier_id', k.revierId)
                    .is('geloescht_am', null)
                    .gte('zeitpunkt', `${jahr.von}T00:00:00`)
                    .lte('zeitpunkt', `${jahr.bis}T23:59:59`),
                supabase.rpc('quervergleich', { p_revier_id: k.revierId, p_von: jahr.von, p_bis: jahr.bis }),
                supabase.from('freigaben').select('wildart_id', { count: 'exact', head: true }).eq('revier_id', k.revierId),
            ]);
            const err = s.error ?? a.error ?? b.error ?? v.error ?? f.error;
            if (err)
                setFehler(fehlertext(err));
            setSitzungen((s.data ?? []).map((x) => {
                const arten = {};
                for (const z of x.zaehlungen)
                    if (!z.geloescht_am)
                        arten[z.wildart_id] = (arten[z.wildart_id] ?? 0) + z.anzahl;
                return { id: x.id, datum: x.datum, arten, modus: x.flaechenmodus, breite: x.streifenbreite_m, strecke: x.strecke_km === null ? null : Number(x.strecke_km), flaeche: x.flaeche_ha === null ? null : Number(x.flaeche_ha) };
            }));
            const st = {};
            for (const x of a.data ?? [])
                if (x.wildart_id)
                    st[x.wildart_id] = (st[x.wildart_id] ?? 0) + 1;
            setStrecke(st);
            setBeobachtungen(b.count ?? 0);
            setVergleich(v.data ?? []);
            setHatFreigaben((f.count ?? 0) > 0);
        })();
    }, [k.revierId, jahr, auffrischen]);
    const gezaehlteArten = useMemo(() => {
        const ids = new Set(sitzungen.flatMap((s) => Object.keys(s.arten)));
        return wildarten.filter((w) => ids.has(w.id));
    }, [sitzungen, wildarten]);
    useEffect(() => {
        if (gezaehlteArten.length && !gezaehlteArten.some((w) => w.id === verlaufArt))
            setVerlaufArt(gezaehlteArten[0].id);
    }, [gezaehlteArten, verlaufArt]);
    const maxJeArt = useMemo(() => {
        const m = {};
        for (const s of sitzungen)
            for (const [art, n] of Object.entries(s.arten))
                m[art] = Math.max(m[art] ?? 0, n);
        return m;
    }, [sitzungen]);
    // Höchstwerte je 100 ha: Bezug ist die gezählte Fläche der jeweiligen Zählung (Revierfläche nur als Ersatz, wenn keine festgeschrieben ist)
    const maxJe100 = useMemo(() => {
        const m = {};
        for (const s of sitzungen) {
            const fl = s.flaeche ?? k.flaecheHa;
            if (!fl)
                continue;
            for (const [art, n] of Object.entries(s.arten))
                m[art] = Math.max(m[art] ?? 0, (n / fl) * 100);
        }
        return m;
    }, [sitzungen, k.flaecheHa]);
    const gemischt = new Set(sitzungen.map((x) => x.modus)).size > 1;
    const streckeSumme = Object.values(strecke).reduce((a, n) => a + n, 0);
    return (_jsxs(Seite, { titel: "Monitoring", untertitel: `Jagdjahr ${jahr.label}`, aktion: breit && !abgedockt ? _jsx(Anordnung, { voll: voll }) : undefined, children: [_jsxs("div", { className: "filter-leiste", children: [ansicht !== 'jagdjahre' && _jsxs("label", { className: "filter", children: [_jsx("span", { children: "Jagdjahr" }), _jsx("select", { value: jahr.start, onChange: (e) => setJahr(letzteJagdjahre().find((j) => j.start === Number(e.target.value)) ?? jahr), children: letzteJagdjahre().map((j) => (_jsx("option", { value: j.start, children: j.label }, j.start))) })] }), _jsx(Segmente, { label: "Ansicht", wert: ansicht, onAendern: setAnsicht, optionen: [
                            { wert: 'revier', label: 'Mein Revier' },
                            { wert: 'jagdjahre', label: 'Jagdjahre' },
                            { wert: 'vergleich', label: 'Quervergleich' },
                        ] })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), ansicht === 'jagdjahre' ? (_jsx(JagdjahrReport, { k: k })) : ansicht === 'revier' ? (_jsx("div", { className: "monitoring-box", children: _jsxs("div", { className: "monitoring-raster", children: [_jsxs("div", { className: "kennzahlen breit", children: [_jsx(Kennzahl, { wert: sitzungen.length, label: "Z\u00E4hlungen" }), _jsx(Kennzahl, { wert: beobachtungen, label: "Beobachtungen" }), _jsx(Kennzahl, { wert: streckeSumme, label: "Absch\u00FCsse" }), _jsx(Kennzahl, { wert: k.flaecheHa ? (streckeSumme / k.flaecheHa) * 100 : null, nachkomma: 1, label: "Absch\u00FCsse je 100 ha" }), _jsx(Kennzahl, { wert: gezaehlteArten.length, label: "Gez\u00E4hlte Wildarten" }), _jsx(Kennzahl, { wert: Object.values(maxJeArt).reduce((a, n) => a + n, 0), label: "Summe der H\u00F6chstwerte" }), _jsx(Kennzahl, { wert: Object.keys(maxJe100).length ? Object.values(maxJe100).reduce((a, n) => a + n, 0) : null, nachkomma: 1, label: "H\u00F6chstwerte je 100 ha" })] }), breit && (_jsx("div", { className: "breit", children: _jsx(Jahresvergleich, { k: k, wildarten: wildarten }) })), sitzungen.length > 0 && (_jsx(Gruppe, { titel: "Gez\u00E4hlte Fl\u00E4che je Z\u00E4hlung", fuss: gemischt ? 'Achtung: Zählungen mit Strecke × Breite und mit Zonenfläche sind nicht streng vergleichbar.' : undefined, children: _jsx("div", { className: "tabelle-rahmen", style: { border: 0 }, children: _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Datum" }), _jsx("th", { scope: "col", children: "Modus" }), _jsx("th", { scope: "col", className: "zahl", children: "Strecke" }), _jsx("th", { scope: "col", className: "zahl", children: "Fl\u00E4che" })] }) }), _jsx("tbody", { children: sitzungen.map((x) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: datumDE(x.datum) }), _jsx("td", { children: _jsx("span", { className: `badge ${x.modus === 'strecke' ? 'badge-orange' : 'badge-gruen'}`, children: x.modus === 'strecke' ? `Strecke × ${x.breite} m` : 'Zonenfläche' }) }), _jsx("td", { className: "zahl", children: x.strecke !== null ? `${x.strecke.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km` : '–' }), _jsx("td", { className: "zahl", children: x.flaeche !== null ? `${x.flaeche.toLocaleString('de-DE')} ha` : '–' })] }, x.id))) })] }) }) })), _jsx(Gruppe, { titel: "Z\u00E4hlverlauf", children: gezaehlteArten.length === 0 ? (_jsx(Leer, { children: "Noch keine abgeschlossenen Z\u00E4hlungen in diesem Jagdjahr." })) : (_jsxs("div", { className: "diagramm-block", children: [_jsx("select", { className: "diagramm-wahl", value: verlaufArt, onChange: (e) => setVerlaufArt(e.target.value), "aria-label": "Wildart im Verlauf", children: gezaehlteArten.map((w) => (_jsx("option", { value: w.id, children: w.name }, w.id))) }), _jsx(Verlauf, { titel: `Gezählte ${wildartName(wildarten, verlaufArt)} je Zählung`, punkte: sitzungen.map((s) => ({
                                            label: new Date(`${s.datum}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                                            wert: s.arten[verlaufArt] ?? 0,
                                        })) })] })) }), gezaehlteArten.length > 0 && (_jsx(Gruppe, { titel: "H\u00F6chster Z\u00E4hlwert je Wildart", fuss: "Je 100 ha bezogen auf die gez\u00E4hlte Fl\u00E4che der jeweiligen Z\u00E4hlung.", children: _jsx("div", { className: "diagramm-block", children: _jsx(Balken, { zeilen: gezaehlteArten.map((w) => ({
                                        label: w.name,
                                        wert: maxJeArt[w.id] ?? 0,
                                        zusatz: maxJe100[w.id] !== undefined ? ` · ${maxJe100[w.id].toLocaleString('de-DE', { maximumFractionDigits: 1 })} / 100 ha` : undefined,
                                    })) }) }) })), _jsx(Gruppe, { titel: "Strecke je Wildart", children: streckeSumme === 0 ? (_jsx(Leer, { children: "Keine Absch\u00FCsse in diesem Jagdjahr." })) : (_jsx("div", { className: "diagramm-block", children: _jsx(Balken, { zeilen: Object.entries(strecke)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([id, n]) => ({ label: wildartName(wildarten, id), wert: n })) }) })) })] }) })) : (_jsx("div", { className: "monitoring-box", children: _jsx(Quervergleich, { daten: vergleich, hatFreigaben: hatFreigaben }) }))] }));
}
function Anordnung({ voll }) {
    return (_jsxs("div", { className: "monitoring-werkzeuge", children: [_jsx("button", { className: "knopf knopf-sekundaer klein", onClick: () => navigieren(voll ? '/monitoring' : '/monitoring/voll'), title: voll ? 'Zurück zur Seitenleiste mit Karte' : 'Monitoring über die ganze Breite anzeigen', children: voll ? 'Mit Karte' : 'Vollbreite' }), _jsxs("button", { className: "knopf knopf-sekundaer klein", onClick: () => window.open('/monitoring/fenster', 'hegewerk-monitoring', 'popup=yes,width=1500,height=950'), title: "Monitoring in einem eigenen Fenster \u00F6ffnen, z. B. auf dem zweiten Bildschirm", children: [_jsx(Symbol, { name: "abdocken" }), " Abdocken"] })] }));
}
function tagImJagdjahr(datum, start) {
    const t = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
    return Math.max(0, Math.min(365, Math.round((t(datum) - Date.UTC(start, 3, 1)) / 86400000)));
}
/** Mehrjahresvergleich: Zählverläufe und kumulierte Strecke mehrerer Jagdjahre übereinander */
function Jahresvergleich({ k, wildarten }) {
    const jahre = useMemo(() => letzteJagdjahre(6), []);
    const [gewaehlt, setGewaehlt] = useState(() => jahre.slice(0, 3).map((j) => j.start));
    const [kennzahl, setKennzahl] = useState('zaehlung');
    const [bezug, setBezug] = useState('stueck');
    const [art, setArt] = useState('');
    const [sitzungen, setSitzungen] = useState([]);
    const [abschuesse, setAbschuesse] = useState([]);
    const [fehler, setFehler] = useState(null);
    const [laedt, setLaedt] = useState(true);
    const auffrischen = useAuffrischen();
    useEffect(() => {
        let aktiv = true;
        const von = jahre[jahre.length - 1].von;
        setLaedt(true);
        void (async () => {
            const [s, a] = await Promise.all([
                supabase
                    .from('zaehlsitzungen')
                    .select('id, datum, flaechenmodus, streifenbreite_m, strecke_km, flaeche_ha, zaehlungen(wildart_id, anzahl, geloescht_am)')
                    .eq('revier_id', k.revierId)
                    .eq('status', 'abgeschlossen')
                    .is('geloescht_am', null)
                    .gte('datum', von)
                    .order('datum'),
                supabase
                    .from('abschuesse')
                    .select('wildart_id, erlegt_am')
                    .or('art.eq.abschuss,and(art.eq.fang,fang_ergebnis.eq.gefangen)')
                    .eq('revier_id', k.revierId)
                    .is('geloescht_am', null)
                    .gte('erlegt_am', `${von}T00:00:00`)
                    .order('erlegt_am')
                    .limit(5000),
            ]);
            if (!aktiv)
                return;
            const err = s.error ?? a.error;
            setFehler(err ? fehlertext(err) : null);
            setSitzungen((s.data ?? []).map((x) => {
                const arten = {};
                for (const z of x.zaehlungen)
                    if (!z.geloescht_am)
                        arten[z.wildart_id] = (arten[z.wildart_id] ?? 0) + z.anzahl;
                return { id: x.id, datum: x.datum, arten, modus: x.flaechenmodus, flaeche: x.flaeche_ha === null ? null : Number(x.flaeche_ha) };
            }));
            setAbschuesse((a.data ?? []).filter((x) => !!x.wildart_id));
            setLaedt(false);
        })();
        return () => {
            aktiv = false;
        };
    }, [k.revierId, jahre, auffrischen]);
    const verfuegbar = useMemo(() => {
        const ids = new Set([...sitzungen.flatMap((s) => Object.keys(s.arten)), ...abschuesse.map((x) => x.wildart_id)]);
        return wildarten.filter((w) => ids.has(w.id));
    }, [sitzungen, abschuesse, wildarten]);
    useEffect(() => {
        if (verfuegbar.length && !verfuegbar.some((w) => w.id === art))
            setArt(verfuegbar.find((w) => w.id === 'rehwild')?.id ?? verfuegbar[0].id);
    }, [verfuegbar, art]);
    // Je 100 ha: Bezug ist die gezählte Fläche der Zählung (Ersatz: Revierfläche)
    const faktorFuer = (s) => {
        const fl = s.flaeche ?? k.flaecheHa;
        return bezug === 'je100' && fl ? 100 / fl : 1;
    };
    const faktor = bezug === 'je100' && k.flaecheHa ? 100 / k.flaecheHa : 1;
    const imJahr = (datum, start) => datum >= `${start}-04-01` && datum <= `${start + 1}-03-31`;
    const gewaehlteJahre = jahre.filter((j) => gewaehlt.includes(j.start)).sort((a, b) => b.start - a.start);
    const serien = gewaehlteJahre.map((j) => {
        if (kennzahl === 'zaehlung') {
            return {
                id: String(j.start),
                label: `Jagdjahr ${j.label}`,
                punkte: sitzungen
                    .filter((s) => imJahr(s.datum, j.start) && s.arten[art] !== undefined)
                    .map((s) => ({ x: tagImJagdjahr(s.datum, j.start), wert: (s.arten[art] ?? 0) * faktorFuer(s), titel: datumDE(s.datum) })),
            };
        }
        let summe = 0;
        const punkte = [{ x: 0, wert: 0, titel: '1. April' }];
        for (const a of abschuesse) {
            const tag = a.erlegt_am.slice(0, 10);
            if (a.wildart_id !== art || !imJahr(tag, j.start))
                continue;
            summe++;
            punkte.push({ x: tagImJagdjahr(tag, j.start), wert: summe * faktor, titel: datumDE(tag) });
        }
        return { id: String(j.start), label: `Jagdjahr ${j.label}`, punkte };
    });
    // Kennzahlen je Jagdjahr
    const tabelle = gewaehlteJahre.map((j) => {
        const s = sitzungen.filter((x) => imJahr(x.datum, j.start));
        const werte = s.filter((x) => x.arten[art] !== undefined).map((x) => x.arten[art] * faktorFuer(x));
        const strecke = abschuesse.filter((x) => imJahr(x.erlegt_am.slice(0, 10), j.start));
        return {
            jahr: j,
            zaehlungen: werte.length,
            max: werte.length ? Math.max(...werte) : null,
            schnitt: werte.length ? werte.reduce((a, n) => a + n, 0) / werte.length : null,
            streckeArt: strecke.filter((x) => x.wildart_id === art).length,
            streckeAlle: strecke.length,
        };
    });
    const einheit = bezug === 'je100' ? ' je 100 ha' : ' Stück';
    const zahl = (n, nk = 1) => (n === null ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: nk }));
    const gemischtJahre = new Set(sitzungen.filter((x) => gewaehlteJahre.some((j) => imJahr(x.datum, j.start))).map((x) => x.modus)).size > 1;
    return (_jsx(Gruppe, { titel: "Jahresvergleich", fuss: "Z\u00E4hlungen: Summe aller Zonen je abgeschlossener Z\u00E4hlung. Strecke: Absch\u00FCsse der Wildart, kumuliert ab 1. April.", children: _jsxs("div", { className: "diagramm-block", children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsxs("div", { className: "filter-leiste", children: [_jsxs("label", { className: "filter", children: [_jsx("span", { children: "Wildart" }), _jsx("select", { value: art, onChange: (e) => setArt(e.target.value), "aria-label": "Wildart im Jahresvergleich", children: verfuegbar.map((w) => (_jsx("option", { value: w.id, children: w.name }, w.id))) })] }), _jsx(Segmente, { label: "Kennzahl", wert: kennzahl, onAendern: setKennzahl, optionen: [
                                { wert: 'zaehlung', label: 'Zählverlauf' },
                                { wert: 'strecke', label: 'Strecke' },
                            ] }), k.flaecheHa && (_jsx(Segmente, { label: "Bezug", wert: bezug, onAendern: setBezug, optionen: [
                                { wert: 'stueck', label: 'Stück' },
                                { wert: 'je100', label: 'je 100 ha' },
                            ] }))] }), _jsxs("fieldset", { className: "jahreswahl", style: { border: 0, padding: 0, margin: 0 }, children: [_jsx("legend", { className: "visuell-versteckt", children: "Jagdjahre im Vergleich" }), jahre.map((j) => (_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: gewaehlt.includes(j.start), onChange: (e) => setGewaehlt((alt) => (e.target.checked ? [...alt, j.start] : alt.filter((x) => x !== j.start))) }), j.label] }, j.start)))] }), bezug === 'je100' && gemischtJahre && (_jsx(Hinweis, { art: "warnung", children: "Die gew\u00E4hlten Jagdjahre enthalten Z\u00E4hlungen mit Strecke \u00D7 Breite und mit Zonenfl\u00E4che. Die Werte je 100 ha sind nicht streng vergleichbar." })), laedt ? (_jsx(Leer, { children: "Daten werden geladen \u2026" })) : serien.every((s) => s.punkte.length <= 1) ? (_jsx(Leer, { children: "F\u00FCr diese Auswahl liegen keine Werte vor." })) : (_jsx(VerlaufMehrere, { serien: serien, titel: `${wildartName(wildarten, art)}: ${kennzahl === 'zaehlung' ? 'Zählverlauf' : 'kumulierte Strecke'} je Jagdjahr`, hervorgehoben: String(gewaehlteJahre[0]?.start) })), tabelle.length > 0 && (_jsx("div", { className: "tabelle-rahmen", children: _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Jagdjahr" }), _jsx("th", { scope: "col", className: "zahl", children: "Z\u00E4hlungen" }), _jsxs("th", { scope: "col", className: "zahl", children: ["H\u00F6chstwert", einheit] }), _jsxs("th", { scope: "col", className: "zahl", children: ["\u00D8", einheit] }), _jsxs("th", { scope: "col", className: "zahl", children: ["Strecke ", wildartName(wildarten, art)] }), _jsx("th", { scope: "col", className: "zahl", children: "Strecke gesamt" })] }) }), _jsx("tbody", { children: tabelle.map((z) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: z.jahr.label }), _jsx("td", { className: "zahl", children: z.zaehlungen }), _jsx("td", { className: "zahl stark", children: zahl(z.max, 1) }), _jsx("td", { className: "zahl", children: zahl(z.schnitt, 1) }), _jsx("td", { className: "zahl", children: z.streckeArt }), _jsx("td", { className: "zahl", children: z.streckeAlle })] }, z.jahr.start))) })] }) }))] }) }));
}
function Kennzahl({ wert, label, nachkomma = 0 }) {
    return (_jsxs("div", { className: "kennzahl", children: [_jsx("strong", { children: wert === null ? '–' : wert.toLocaleString('de-DE', { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma }) }), _jsx("span", { children: label })] }));
}
function Quervergleich({ daten, hatFreigaben }) {
    const [kennzahl, setKennzahl] = useState('zaehlung');
    const nachArt = useMemo(() => {
        const m = new Map();
        for (const z of daten) {
            const e = m.get(z.wildart_id) ?? { name: z.wildart_name, zeilen: [] };
            e.zeilen.push(z);
            m.set(z.wildart_id, e);
        }
        return [...m.entries()];
    }, [daten]);
    if (!hatFreigaben) {
        return (_jsxs(_Fragment, { children: [_jsx(Hinweis, { children: "Der Quervergleich zeigt nur Wildarten, die dein Revier selbst freigibt. Noch ist nichts freigegeben." }), _jsx(Knopf, { variante: "sekundaer", onClick: () => navigieren('/freigaben'), children: "Zu den Freigaben" })] }));
    }
    const anzahlReviere = new Set(daten.filter((d) => !d.ist_durchschnitt).map((d) => d.revier_id)).size;
    return (_jsxs(_Fragment, { children: [_jsx(Segmente, { label: "Kennzahl", wert: kennzahl, onAendern: setKennzahl, optionen: [
                    { wert: 'zaehlung', label: 'Gezählt je 100 ha' },
                    { wert: 'abschuss', label: 'Abschüsse je 100 ha' },
                ] }), _jsxs(Leer, { children: [anzahlReviere, " ", anzahlReviere === 1 ? 'Revier' : 'Reviere', " im Vergleich. Gez\u00E4hlt = h\u00F6chster Wert einer abgeschlossenen Z\u00E4hlung im Jagdjahr. Der Hegering-Durchschnitt ist fl\u00E4chengewichtet. Bezug ist die Revierfl\u00E4che; \u201EStrecke\u201C kennzeichnet Z\u00E4hlungen per Streckenz\u00E4hlung (Strecke \u00D7 400 m)."] }), nachArt.length === 0 && _jsx(Leer, { children: "F\u00FCr diesen Zeitraum liegen keine freigegebenen Daten vor." }), nachArt.map(([id, { name, zeilen }]) => {
                const ohneFlaeche = zeilen.some((z) => !z.ist_durchschnitt && !z.flaeche_ha);
                return (_jsx(Gruppe, { titel: name, fuss: ohneFlaeche ? 'Reviere ohne hinterlegte Fläche fehlen im Wert je 100 ha.' : undefined, children: _jsx("div", { className: "diagramm-block", children: _jsx(Balken, { einheit: "", hervorheben: (s) => {
                                const z = zeilen.find((x) => (x.revier_id ?? 'schnitt') === s);
                                return z?.ist_durchschnitt ? 'schnitt' : z?.ist_eigenes ? 'eigen' : null;
                            }, zeilen: zeilen.map((z) => ({
                                schluessel: z.revier_id ?? 'schnitt',
                                label: z.revier_name,
                                wert: Number(kennzahl === 'zaehlung' ? z.gezaehlt_max_je_100ha : z.abschuesse_je_100ha) || 0,
                                zusatz: kennzahl === 'zaehlung'
                                    ? ` · max. ${Number(z.gezaehlt_max).toLocaleString('de-DE')} Stück${Number(z.strecke_zaehlungen) > 0 ? ` · Strecke (${Number(z.strecke_zaehlungen)} von ${Number(z.zaehlsitzungen)} Zählungen)` : ''}`
                                    : ` · ${Number(z.abschuesse).toLocaleString('de-DE')} Stück (♂ ${Number(z.abschuesse_maennlich).toLocaleString('de-DE')} / ♀ ${Number(z.abschuesse_weiblich).toLocaleString('de-DE')})`,
                            })) }) }) }, id));
            })] }));
}
