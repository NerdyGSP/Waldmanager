import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { GESCHLECHTER, useWildarten, wildartName } from '../../lib/stammdaten';
import { jagdzeitWarnung, useJagdzeiten } from '../../lib/jagdzeiten';
import { punktEWKT } from '../../lib/geo';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Segmente, WildartOptionen } from '../../components/ui';
import { AuditZeile } from '../../components/AuditZeile';
// Strecke einer Bewegungsjagd: direkt in `abschuesse` (mit bewegungsjagd_id), keine Kopie
export function useBjStrecke(jagdId) {
    const [liste, setListe] = useState([]);
    const laden = useCallback(async () => {
        const { data } = await supabase
            .from('abschuesse')
            .select('id, art, wildart_id, geschlecht, altersklasse, gewicht_kg, einrichtung_id, erleger_teilnehmer_id, erleger_name, erlegt_am, bemerkung')
            .eq('bewegungsjagd_id', jagdId)
            .is('geloescht_am', null)
            .order('erlegt_am');
        setListe((data ?? []));
    }, [jagdId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    return { liste, laden };
}
// Zusammenfassung „N Stück, davon …“
export function streckeText(liste, name) {
    const m = new Map();
    for (const e of liste)
        m.set(e.wildart_id ?? '', (m.get(e.wildart_id ?? '') ?? 0) + 1);
    const teile = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${n} ${name(w)}`);
    return `${liste.length} Stück${teile.length ? `, davon ${teile.join(', ')}` : ''}`;
}
const HAUPTARTEN = ['schwarzwild', 'rehwild', 'rotwild', 'damwild', 'fuchs', 'dachs', 'waschbaer', 'feldhase'];
export function BjStrecke({ revierId, bundesland, jagd, staende, teilnehmer, liste, offen, onGeaendert, }) {
    const wildarten = useWildarten();
    const { zeilen: jagdzeiten } = useJagdzeiten(bundesland);
    const [modus, setModus] = useState('schnell');
    const [fehler, setFehler] = useState(null);
    const [laeuft, setLaeuft] = useState(false);
    const wname = useCallback((id) => wildartName(wildarten, id), [wildarten]);
    // Position: Koordinate des Standes, sonst Treffpunkt
    const position = (standId) => {
        const s = staende.find((x) => x.id === standId);
        if (s)
            return punktEWKT(s.lng, s.lat);
        return jagd.treffpunkt_lng != null && jagd.treffpunkt_lat != null ? punktEWKT(jagd.treffpunkt_lng, jagd.treffpunkt_lat) : null;
    };
    const zeit = (hhmm) => new Date(`${jagd.datum}T${hhmm || '12:00'}:00`).toISOString();
    // ---------- Schnell: Matrix Wildart × Stand ----------
    const [zeilenArten, setZeilenArten] = useState(HAUPTARTEN);
    const [matrix, setMatrix] = useState({});
    const [weitere, setWeitere] = useState('');
    const spalten = [...staende.map((s) => ({ id: s.id, label: s.label })), { id: '', label: 'Ohne Stand' }];
    const summeMatrix = Object.values(matrix).reduce((a, n) => a + n, 0);
    async function matrixSpeichern() {
        setFehler(null);
        setLaeuft(true);
        const zeilen = [];
        for (const [schluessel, n] of Object.entries(matrix)) {
            if (n <= 0)
                continue;
            const [wildart, standId] = schluessel.split('|');
            for (let i = 0; i < n; i++) {
                const geom = position(standId || null);
                zeilen.push({
                    revier_id: revierId,
                    art: 'abschuss',
                    bewegungsjagd_id: jagd.id,
                    wildart_id: wildart,
                    geschlecht: 'unbekannt',
                    einrichtung_id: standId || null,
                    erlegt_am: zeit('12:00'),
                    erleger_id: null,
                    ...(geom ? { geom } : {}),
                });
            }
        }
        if (zeilen.length) {
            const { error } = await supabase.from('abschuesse').insert(zeilen);
            if (error)
                setFehler(fehlertext(error));
            else
                setMatrix({});
        }
        setLaeuft(false);
        await onGeaendert();
    }
    // ---------- Einzeln ----------
    const leer = { art: 'abschuss', wildart: 'schwarzwild', geschlecht: 'unbekannt', alter: '', stand: '', erleger: '', freitext: '', uhr: '', gewicht: '', bemerkung: '' };
    const [f, setF] = useState(leer);
    const [bearbeitet, setBearbeitet] = useState(null);
    const klassen = wildarten.find((w) => w.id === f.wildart)?.altersklassen ?? [];
    const warnung = jagdzeitWarnung(jagdzeiten, f.wildart, new Date(`${jagd.datum}T12:00:00`));
    const zugesagt = teilnehmer.filter((t) => t.status === 'zugesagt');
    async function einzelnSpeichern() {
        setFehler(null);
        const kg = f.gewicht.trim() ? Number(f.gewicht.replace(',', '.')) : null;
        if (kg !== null && (!Number.isFinite(kg) || kg <= 0)) {
            setFehler('Bitte ein gültiges Gewicht angeben.');
            return;
        }
        setLaeuft(true);
        const tn = f.erleger && f.erleger !== '_frei' ? zugesagt.find((t) => t.id === f.erleger) : null;
        const geom = position(f.stand || null);
        const daten = {
            revier_id: revierId,
            art: f.art,
            bewegungsjagd_id: jagd.id,
            wildart_id: f.wildart,
            geschlecht: f.geschlecht,
            altersklasse: f.alter || null,
            gewicht_kg: kg,
            einrichtung_id: f.stand || null,
            erleger_teilnehmer_id: tn?.id ?? null,
            erleger_name: tn ? tn.name : f.erleger === '_frei' ? f.freitext.trim() || null : null,
            erlegt_am: zeit(f.uhr),
            bemerkung: f.bemerkung.trim() || null,
            ...(geom ? { geom } : {}),
        };
        const { error } = bearbeitet ? await supabase.from('abschuesse').update(daten).eq('id', bearbeitet.id) : await supabase.from('abschuesse').insert(daten);
        setLaeuft(false);
        if (error) {
            setFehler(fehlertext(error));
            return;
        }
        setF({ ...leer, wildart: f.wildart, art: f.art });
        setBearbeitet(null);
        await onGeaendert();
    }
    function bearbeiten(e) {
        setModus('einzeln');
        setBearbeitet(e);
        const d = new Date(e.erlegt_am);
        setF({
            art: e.art,
            wildart: e.wildart_id ?? 'schwarzwild',
            geschlecht: e.geschlecht,
            alter: e.altersklasse ?? '',
            stand: e.einrichtung_id ?? '',
            erleger: e.erleger_teilnehmer_id ?? (e.erleger_name ? '_frei' : ''),
            freitext: e.erleger_teilnehmer_id ? '' : (e.erleger_name ?? ''),
            uhr: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            gewicht: e.gewicht_kg ? String(e.gewicht_kg).replace('.', ',') : '',
            bemerkung: e.bemerkung ?? '',
        });
    }
    async function loeschen(e) {
        if (!window.confirm('Diesen Eintrag löschen?'))
            return;
        const { error } = await supabase.from('abschuesse').delete().eq('id', e.id);
        setFehler(error ? fehlertext(error) : null);
        await onGeaendert();
    }
    const summe = useMemo(() => {
        const m = new Map();
        for (const e of liste)
            m.set(e.wildart_id ?? '', (m.get(e.wildart_id ?? '') ?? 0) + 1);
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [liste]);
    const standLabel = (id) => staende.find((s) => s.id === id)?.label ?? '';
    const sichtbareArten = zeilenArten.filter((a) => wildarten.some((w) => w.id === a));
    return (_jsxs(Gruppe, { titel: `Strecke: ${liste.length} Stück`, fuss: offen ? 'Einträge landen direkt unter „Strecke“, in der Statistik und im Jagdjahr-Report. Bis zum Abschluss der Jagd sind sie hier bearbeitbar.' : 'Nach dem Abschluss änderst du Einträge unter „Strecke“.', children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), offen && (_jsx("div", { style: { padding: '8px var(--abstand)' }, children: _jsx(Segmente, { label: "Erfassung", wert: modus, onAendern: setModus, optionen: [{ wert: 'schnell', label: 'Schnell (Matrix)' }, { wert: 'einzeln', label: 'Einzeln' }] }) })), offen && modus === 'schnell' && (_jsxs("div", { style: { padding: '0 var(--abstand) 8px' }, children: [_jsx("div", { className: "tabelle-rahmen", style: { overflowX: 'auto' }, children: _jsxs("table", { className: "tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Wildart" }), spalten.map((s) => (_jsx("th", { scope: "col", className: "zahl", children: s.label }, s.id || 'ohne')))] }) }), _jsx("tbody", { children: sichtbareArten.map((a) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: wname(a) }), spalten.map((s) => {
                                                const key = `${a}|${s.id}`;
                                                return (_jsx("td", { className: "zahl", children: _jsx("input", { type: "number", min: 0, inputMode: "numeric", "aria-label": `${wname(a)} ${s.label}`, style: { width: 56 }, value: matrix[key] ? matrix[key] : '', onChange: (e) => setMatrix((m) => ({ ...m, [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })) }) }, key));
                                            })] }, a))) })] }) }), _jsxs(Auswahl, { label: "Weitere Wildart", value: weitere, onChange: (e) => { if (e.target.value)
                            setZeilenArten((z) => (z.includes(e.target.value) ? z : [...z, e.target.value])); setWeitere(''); }, children: [_jsx("option", { value: "", children: "\u2013 hinzuf\u00FCgen \u2013" }), _jsx(WildartOptionen, { wildarten: wildarten })] }), _jsxs("div", { className: "bj-ja-nein", children: [_jsxs("span", { children: [summeMatrix, " St\u00FCck vorgemerkt"] }), _jsx(Knopf, { variante: "akzent", disabled: laeuft || summeMatrix === 0, onClick: () => void matrixSpeichern(), children: laeuft ? 'Speichere …' : `${summeMatrix} Stück eintragen` })] })] })), offen && modus === 'einzeln' && (_jsxs("div", { style: { padding: '0 var(--abstand) 8px' }, children: [_jsx(Segmente, { label: "Art", wert: f.art, onAendern: (a) => setF({ ...f, art: a }), optionen: [{ wert: 'abschuss', label: 'Abschuss' }, { wert: 'fallwild', label: 'Fallwild' }] }), _jsx(Auswahl, { label: "Wildart", value: f.wildart, onChange: (e) => setF({ ...f, wildart: e.target.value, alter: '' }), children: _jsx(WildartOptionen, { wildarten: wildarten }) }), _jsxs("div", { className: "zeile", children: [_jsx("span", { className: "zeile-label", children: "Geschlecht" }), _jsx(Segmente, { label: "Geschlecht", wert: f.geschlecht, onAendern: (g) => setF({ ...f, geschlecht: g }), optionen: GESCHLECHTER.map((g) => ({ wert: g.wert, label: g.kurz })) })] }), klassen.length > 0 && (_jsxs(Auswahl, { label: "Altersklasse", value: f.alter, onChange: (e) => setF({ ...f, alter: e.target.value }), children: [_jsx("option", { value: "", children: "\u2013" }), klassen.map((a) => (_jsx("option", { value: a, children: a }, a)))] })), _jsxs(Auswahl, { label: "Stand", value: f.stand, onChange: (e) => setF({ ...f, stand: e.target.value }), children: [_jsx("option", { value: "", children: "\u2013 ohne Stand (Position: Treffpunkt) \u2013" }), staende.map((s) => (_jsx("option", { value: s.id, children: s.label }, s.id)))] }), _jsxs(Auswahl, { label: "Erleger", value: f.erleger, onChange: (e) => setF({ ...f, erleger: e.target.value }), children: [_jsx("option", { value: "", children: "\u2013 unbekannt \u2013" }), zugesagt.map((t) => (_jsx("option", { value: t.id, children: t.name }, t.id))), _jsx("option", { value: "_frei", children: "Anderer (Freitext) \u2026" })] }), f.erleger === '_frei' && _jsx(Feld, { label: "Name des Erlegers", value: f.freitext, onChange: (e) => setF({ ...f, freitext: e.target.value }) }), _jsx(Feld, { label: "Uhrzeit", type: "time", value: f.uhr, onChange: (e) => setF({ ...f, uhr: e.target.value }) }), _jsx(Feld, { label: "Gewicht (kg, optional)", inputMode: "decimal", value: f.gewicht, onChange: (e) => setF({ ...f, gewicht: e.target.value }) }), _jsx(Feld, { label: "Bemerkung", value: f.bemerkung, onChange: (e) => setF({ ...f, bemerkung: e.target.value }) }), warnung && _jsxs(Hinweis, { art: warnung.art === 'warnung' ? 'warnung' : 'info', children: [warnung.text, " (Hinweis, kein Speicherverbot.)"] }), _jsxs("div", { className: "bj-ja-nein", children: [_jsx("span", { children: bearbeitet ? 'Eintrag wird bearbeitet' : '' }), _jsxs("span", { style: { display: 'flex', gap: 6 }, children: [bearbeitet && (_jsx(Knopf, { variante: "ghost", onClick: () => { setBearbeitet(null); setF(leer); }, children: "Abbrechen" })), _jsx(Knopf, { variante: "akzent", disabled: laeuft, onClick: () => void einzelnSpeichern(), children: laeuft ? 'Speichere …' : bearbeitet ? 'Änderung speichern' : 'Eintrag hinzufügen' })] })] })] })), liste.length === 0 ? (_jsx("p", { className: "gruppe-fuss", style: { margin: 0, padding: '4px var(--abstand) 8px' }, children: "Noch keine Strecke erfasst." })) : (_jsxs("div", { style: { padding: '4px var(--abstand) 8px' }, children: [_jsxs("p", { style: { margin: '0 0 6px', fontSize: '.9rem' }, children: [_jsxs("strong", { children: [liste.length, " St\u00FCck"] }), ": ", summe.map(([w, n]) => `${n} ${wname(w)}`).join(', ')] }), _jsxs("details", { children: [_jsxs("summary", { children: ["Einzeleintr\u00E4ge (", liste.length, ")"] }), _jsx("ul", { style: { listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 4 }, children: liste.map((e) => (_jsxs("li", { style: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }, children: [_jsxs("span", { children: [e.art === 'fallwild' ? 'Fallwild · ' : '', wname(e.wildart_id ?? ''), " ", GESCHLECHTER.find((g) => g.wert === e.geschlecht)?.kurz, e.altersklasse ? ` · ${e.altersklasse}` : '', _jsxs("small", { style: { color: 'var(--text-leise)' }, children: [' ', "\u00B7 ", new Date(e.erlegt_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), standLabel(e.einrichtung_id) ? ` · ${standLabel(e.einrichtung_id)}` : '', e.erleger_name ? ` · ${e.erleger_name}` : '', e.gewicht_kg ? ` · ${e.gewicht_kg.toLocaleString('de-DE')} kg` : ''] }), !offen && _jsx(AuditZeile, { tabelle: "abschuesse", id: e.id })] }), offen && (_jsxs("span", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { type: "button", className: "link", onClick: () => bearbeiten(e), children: "Bearbeiten" }), _jsx("button", { type: "button", className: "link gefahr", onClick: () => void loeschen(e), children: "L\u00F6schen" })] }))] }, e.id))) })] })] }))] }));
}
