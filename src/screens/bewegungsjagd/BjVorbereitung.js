import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { Feld, Gruppe, Hinweis, Knopf, Leer } from '../../components/ui';
const BjKarte = lazy(() => import('./BjKarte'));
const kartenLaden = _jsx("div", { className: "laden", children: "Karte wird geladen \u2026" });
// Jagdleitung, Rettungspunkte und Infotext einer Bewegungsjagd laden
export function useBjVorbereitung(jagdId) {
    const [leitung, setLeitung] = useState([]);
    const [rettung, setRettung] = useState([]);
    const laden = useCallback(async () => {
        const [l, r] = await Promise.all([
            supabase.from('bewegungsjagd_jagdleitung').select('*').eq('bewegungsjagd_id', jagdId).order('sortierung').order('erstellt_am'),
            supabase.from('bewegungsjagd_rettungspunkte').select('*').eq('bewegungsjagd_id', jagdId).order('erstellt_am'),
        ]);
        setLeitung(l.data ?? []);
        setRettung(r.data ?? []);
    }, [jagdId]);
    useEffect(() => {
        void laden();
    }, [laden]);
    return { leitung, rettung, laden };
}
export function JagdleitungBlock({ jagd, leitung, aenderbar, onGeaendert }) {
    const [name, setName] = useState('');
    const [telefon, setTelefon] = useState('');
    const [funktion, setFunktion] = useState('Jagdleiter');
    const [info, setInfo] = useState(jagd.info_jagdleitung ?? '');
    const [fehler, setFehler] = useState(null);
    const [gespeichert, setGespeichert] = useState(false);
    async function hinzufuegen() {
        if (!name.trim())
            return;
        const { error } = await supabase.from('bewegungsjagd_jagdleitung').insert({ bewegungsjagd_id: jagd.id, name: name.trim(), telefon: telefon.trim() || null, funktion: funktion.trim() || null, sortierung: leitung.length });
        setFehler(error ? fehlertext(error) : null);
        if (!error) {
            setName('');
            setTelefon('');
            setFunktion('Stellvertreter');
        }
        await onGeaendert();
    }
    async function entfernen(l) {
        const { error } = await supabase.from('bewegungsjagd_jagdleitung').delete().eq('id', l.id);
        setFehler(error ? fehlertext(error) : null);
        await onGeaendert();
    }
    async function infoSpeichern() {
        const { error } = await supabase.from('bewegungsjagden').update({ info_jagdleitung: info.trim() || null }).eq('id', jagd.id);
        setFehler(error ? fehlertext(error) : null);
        setGespeichert(!error);
        await onGeaendert();
    }
    return (_jsxs(Gruppe, { titel: "Jagdleitung", fuss: "Die Jagdleitung (Name, Telefon) sehen Teilnehmer auf ihrer Anstellinformation; die Infos f\u00FCr die Jagdleitung erscheinen nur in der Jagdtag-Mappe.", children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), leitung.length === 0 && _jsx(Leer, { children: "Noch keine Jagdleitung eingetragen." }), leitung.map((l) => (_jsxs("div", { className: "bj-zeile", children: [_jsxs("span", { children: [_jsx("strong", { children: l.name }), _jsx("br", {}), _jsx("small", { children: [l.funktion, l.telefon].filter(Boolean).join(' · ') })] }), aenderbar && (_jsx("span", { className: "bj-zeile-aktionen", children: _jsx(Knopf, { variante: "gefahr", onClick: () => void entfernen(l), children: "L\u00F6schen" }) }))] }, l.id))), aenderbar && (_jsxs("div", { style: { padding: '0 var(--abstand)' }, children: [_jsx(Feld, { label: "Name", value: name, onChange: (e) => setName(e.target.value) }), _jsx(Feld, { label: "Telefon", type: "tel", value: telefon, onChange: (e) => setTelefon(e.target.value) }), _jsx(Feld, { label: "Funktion", value: funktion, onChange: (e) => setFunktion(e.target.value), placeholder: "Jagdleiter, Stellvertreter, \u2026" }), _jsxs("div", { className: "bj-ja-nein", children: [_jsx("span", {}), _jsx(Knopf, { variante: "sekundaer", disabled: !name.trim(), onClick: () => void hinzufuegen(), children: "Hinzuf\u00FCgen" })] })] })), _jsxs("label", { className: "bj-text", children: [_jsx("span", { children: "Infos zur Bewegungsjagd f\u00FCr die Jagdleitung" }), _jsx("textarea", { value: info, readOnly: !aenderbar, rows: 4, onChange: (e) => { setInfo(e.target.value); setGespeichert(false); }, placeholder: "z. B. Ablauf, Funkkanal, Treiber, Besonderheiten" })] }), aenderbar && (_jsxs("div", { className: "bj-ja-nein", children: [_jsx("span", { children: gespeichert ? 'Gespeichert.' : '' }), _jsx(Knopf, { variante: "sekundaer", onClick: () => void infoSpeichern(), children: "Infos speichern" })] }))] }));
}
export function RettungspunkteBlock({ jagd, rettung, grenze, treffpunkt, aenderbar, onGeaendert }) {
    const [offen, setOffen] = useState(false);
    const [punkt, setPunkt] = useState(null);
    const [name, setName] = useState('');
    const [bemerkung, setBemerkung] = useState('');
    const [fehler, setFehler] = useState(null);
    async function speichern() {
        if (!punkt || !name.trim())
            return;
        const { error } = await supabase.from('bewegungsjagd_rettungspunkte').insert({ bewegungsjagd_id: jagd.id, name: name.trim(), bemerkung: bemerkung.trim() || null, lng: punkt[0], lat: punkt[1] });
        setFehler(error ? fehlertext(error) : null);
        if (!error) {
            setOffen(false);
            setPunkt(null);
            setName('');
            setBemerkung('');
        }
        await onGeaendert();
    }
    async function entfernen(r) {
        if (!window.confirm(`Rettungspunkt „${r.name}“ entfernen?`))
            return;
        const { error } = await supabase.from('bewegungsjagd_rettungspunkte').delete().eq('id', r.id);
        setFehler(error ? fehlertext(error) : null);
        await onGeaendert();
    }
    const marker = [
        ...(treffpunkt ? [{ id: 'tp', lng: treffpunkt[0], lat: treffpunkt[1], art: 'treffpunkt', label: 'Treffpunkt' }] : []),
        ...rettung.map((r) => ({ id: r.id, lng: r.lng, lat: r.lat, art: 'rettung', label: r.name })),
        ...(punkt ? [{ id: 'neu', lng: punkt[0], lat: punkt[1], art: 'rettung', label: name.trim() || 'Neuer Punkt' }] : []),
    ];
    return (_jsxs(Gruppe, { titel: "Rettungspunkte", fuss: "Sichtbar auf der Teilnehmerseite, in der Anstellinformation und in den Druckkarten.", children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), rettung.length === 0 && _jsx(Leer, { children: "Noch keine Rettungspunkte festgelegt." }), rettung.map((r) => (_jsxs("div", { className: "bj-zeile", children: [_jsxs("span", { children: [_jsx("strong", { children: r.name }), _jsx("br", {}), _jsx("small", { children: [r.bemerkung, `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`].filter(Boolean).join(' · ') })] }), aenderbar && (_jsx("span", { className: "bj-zeile-aktionen", children: _jsx(Knopf, { variante: "gefahr", onClick: () => void entfernen(r), children: "L\u00F6schen" }) }))] }, r.id))), aenderbar && !offen && (_jsxs("div", { className: "bj-ja-nein", children: [_jsx("span", {}), _jsx(Knopf, { variante: "sekundaer", onClick: () => setOffen(true), children: "+ Rettungspunkt auf Karte setzen" })] })), aenderbar && offen && (_jsxs("div", { style: { padding: '0 var(--abstand) 10px' }, children: [_jsx("p", { style: { margin: '8px 0', fontSize: '.85rem', color: 'var(--color-text-muted)' }, children: "Auf die Karte tippen, um den Punkt zu setzen, dann benennen." }), _jsx(Suspense, { fallback: kartenLaden, children: _jsx(BjKarte, { className: "bj-karte bj-karte-hoch", marker: marker, grenze: grenze, waehlbar: true, onWaehlen: (lng, lat) => setPunkt([lng, lat]) }) }), _jsx(Feld, { label: "Name", value: name, onChange: (e) => setName(e.target.value), placeholder: "z. B. Rettungspunkt 1 \u2013 Waldweg Ost" }), _jsx(Feld, { label: "Bemerkung (optional)", value: bemerkung, onChange: (e) => setBemerkung(e.target.value), placeholder: "z. B. Zufahrt \u00FCber Feldweg" }), _jsxs("div", { className: "bj-ja-nein", children: [_jsx(Knopf, { variante: "ghost", onClick: () => { setOffen(false); setPunkt(null); }, children: "Abbrechen" }), _jsx(Knopf, { variante: "akzent", disabled: !punkt || !name.trim(), onClick: () => void speichern(), children: "Rettungspunkt speichern" })] })] }))] }));
}
// Kartendialog „Stand wählen“: freie Stände grün, belegte grau mit Namen des Teilnehmers
export function StandKartenDialog({ teilnehmer, alle, staende, grenze, onWaehlen, onZu }) {
    const [rueckfrage, setRueckfrage] = useState(null);
    const belegt = (id) => alle.find((t) => t.id !== teilnehmer.id && t.aktiv && t.zugeordnete_einrichtung_id === id);
    const label = (e) => e.name || 'Stand';
    const marker = staende.map((e) => {
        if (e.id === teilnehmer.zugeordnete_einrichtung_id)
            return { id: e.id, lng: e.lng, lat: e.lat, art: 'eigener', label: `${label(e)} (aktuell)` };
        const b = belegt(e.id);
        return b ? { id: e.id, lng: e.lng, lat: e.lat, art: 'belegt', label: `${label(e)}: ${b.name}` } : { id: e.id, lng: e.lng, lat: e.lat, art: 'frei', label: label(e) };
    });
    function klick(id) {
        const e = staende.find((s) => s.id === id);
        if (!e || id === teilnehmer.zugeordnete_einrichtung_id)
            return;
        const b = belegt(id);
        if (b)
            setRueckfrage({ stand: e, inhaber: b });
        else
            onWaehlen(id, null, 'frei');
    }
    return (_jsx("div", { className: "bj-dialog-hintergrund", role: "dialog", "aria-modal": "true", "aria-label": "Stand w\u00E4hlen", children: _jsxs("div", { className: "bj-dialog", style: { width: 'min(760px, 96vw)' }, children: [_jsxs("strong", { children: ["Stand f\u00FCr ", teilnehmer.name, " w\u00E4hlen"] }), _jsx("p", { style: { margin: 0, color: 'var(--color-text-muted)', fontSize: '.85rem' }, children: "Gr\u00FCn = frei, grau = belegt (mit Namen), orange = aktueller Stand. Antippen weist den Stand zu." }), _jsx(Suspense, { fallback: kartenLaden, children: _jsx(BjKarte, { className: "bj-karte bj-karte-hoch", marker: marker, grenze: grenze, onMarkerKlick: klick }) }), rueckfrage && (_jsxs(Hinweis, { art: "warnung", children: [_jsx("strong", { children: label(rueckfrage.stand) }), " ist von ", _jsx("strong", { children: rueckfrage.inhaber.name }), " belegt. Tauschen oder ersetzen?", _jsxs("div", { className: "bj-dialog-knoepfe", style: { marginTop: 8 }, children: [_jsx(Knopf, { variante: "ghost", onClick: () => setRueckfrage(null), children: "Abbrechen" }), _jsxs(Knopf, { variante: "sekundaer", onClick: () => onWaehlen(rueckfrage.stand.id, rueckfrage.inhaber, 'ersetzen'), children: ["Ersetzen (", rueckfrage.inhaber.name, " verliert den Stand)"] }), _jsx(Knopf, { variante: "akzent", onClick: () => onWaehlen(rueckfrage.stand.id, rueckfrage.inhaber, 'tauschen'), children: "Tauschen" })] })] })), _jsx("div", { className: "bj-dialog-knoepfe", children: _jsx(Knopf, { variante: "ghost", onClick: onZu, children: "Schlie\u00DFen" }) })] }) }));
}
