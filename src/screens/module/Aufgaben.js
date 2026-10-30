import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { useMitglieder } from '../../lib/stammdaten';
import { datumDE, heuteISO } from '../../lib/zeit';
import { Auswahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Segmente } from '../../components/ui';
const STATUS = [
    { wert: 'offen', label: 'Offen' },
    { wert: 'in_arbeit', label: 'In Arbeit' },
    { wert: 'erledigt', label: 'Erledigt' },
];
function useEinrichtungen(revierId) {
    const [liste, setListe] = useState([]);
    useEffect(() => {
        void supabase
            .from('einrichtungen')
            .select('id, name, typ')
            .eq('revier_id', revierId)
            .is('geloescht_am', null)
            .order('name')
            .then(({ data }) => setListe(data ?? []));
    }, [revierId]);
    return liste;
}
const einrichtungLabel = (e) => (e.name ? `${e.name} (${e.typ})` : e.typ);
export function Aufgaben({ k }) {
    const mitglieder = useMitglieder(k.revierId);
    const einrichtungen = useEinrichtungen(k.revierId);
    const [liste, setListe] = useState([]);
    const [filter, setFilter] = useState('offen');
    const [bearbeiten, setBearbeiten] = useState(null);
    const [fehler, setFehler] = useState(null);
    const [listen, setListen] = useState([]);
    const [ansicht, setAnsicht] = useState('alle');
    const [listeName, setListeName] = useState(null); // null = Eingabe zu; '' = neue Liste; sonst Name
    const [listeUmbenennen, setListeUmbenennen] = useState(false);
    const listenLaden = useCallback(async () => {
        const { data } = await supabase.from('aufgabenlisten').select('id, name, bewegungsjagd_id, erstellt_von').eq('revier_id', k.revierId).is('geloescht_am', null).order('name');
        setListen(data ?? []);
    }, [k.revierId]);
    const laden = useCallback(async () => {
        void listenLaden();
        const { data, error } = await supabase
            .from('aufgaben')
            .select('id, titel, beschreibung, faellig_am, status, zugewiesen_an, einrichtung_id, erledigt_am, erstellt_von, liste_id')
            .eq('revier_id', k.revierId)
            .is('geloescht_am', null)
            .order('faellig_am', { ascending: true, nullsFirst: false })
            .order('erstellt_am', { ascending: false });
        if (error)
            setFehler(fehlertext(error));
        setListe(data ?? []);
    }, [k.revierId, listenLaden]);
    useEffect(() => {
        void laden();
    }, [laden]);
    const imAusschnitt = useMemo(() => (ansicht === 'alle' ? liste : ansicht === 'ohne' ? liste.filter((a) => !a.liste_id) : liste.filter((a) => a.liste_id === ansicht)), [liste, ansicht]);
    const sichtbar = useMemo(() => {
        if (filter === 'erledigt')
            return imAusschnitt.filter((a) => a.status === 'erledigt').sort((a, b) => (b.erledigt_am ?? '').localeCompare(a.erledigt_am ?? ''));
        const offen = imAusschnitt.filter((a) => a.status !== 'erledigt');
        return filter === 'meine' ? offen.filter((a) => a.zugewiesen_an === k.userId) : offen;
    }, [imAusschnitt, filter, k.userId]);
    const fortschritt = (id) => {
        const l = liste.filter((a) => (id === null ? !a.liste_id : a.liste_id === id));
        return { fertig: l.filter((a) => a.status === 'erledigt').length, gesamt: l.length };
    };
    const aktiveListe = listen.find((l) => l.id === ansicht) ?? null;
    const listeVerwalten = (l) => k.istInhaber || l.erstellt_von === k.userId;
    async function listeSpeichern() {
        const n = (listeName ?? '').trim();
        if (!n)
            return;
        if (listeUmbenennen && aktiveListe) {
            const { error } = await supabase.from('aufgabenlisten').update({ name: n }).eq('id', aktiveListe.id);
            setFehler(error ? fehlertext(error) : null);
        }
        else {
            const { data, error } = await supabase.from('aufgabenlisten').insert({ revier_id: k.revierId, name: n, erstellt_von: k.userId }).select('id').single();
            setFehler(error ? fehlertext(error) : null);
            if (data)
                setAnsicht(data.id);
        }
        setListeName(null);
        setListeUmbenennen(false);
        await laden();
    }
    async function listeLoeschen(l) {
        if (l.bewegungsjagd_id)
            return setFehler('Die Liste einer Bewegungsjagd wird mit der Jagd verwaltet und kann hier nicht gelöscht werden.');
        if (!window.confirm(`Liste „${l.name}“ löschen? Die Aufgaben bleiben erhalten und stehen dann ohne Liste.`))
            return;
        const r1 = await supabase.from('aufgaben').update({ liste_id: null }).eq('liste_id', l.id);
        const r2 = r1.error ? r1 : await supabase.from('aufgabenlisten').update({ geloescht_am: new Date().toISOString() }).eq('id', l.id);
        setFehler(r2.error ? fehlertext(r2.error) : null);
        setAnsicht('alle');
        await laden();
    }
    const name = (id) => mitglieder.find((m) => m.user_id === id)?.name;
    const ueberfaellig = (a) => a.status !== 'erledigt' && !!a.faellig_am && a.faellig_am < heuteISO();
    const anzahlUeberfaellig = liste.filter(ueberfaellig).length;
    const darfAendern = (a) => k.istInhaber || a.erstellt_von === k.userId || a.zugewiesen_an === k.userId;
    async function umschalten(a) {
        const neu = a.status === 'erledigt' ? 'offen' : 'erledigt';
        const { error } = await supabase.from('aufgaben').update({ status: neu }).eq('id', a.id);
        setFehler(error ? fehlertext(error) : null);
        await laden();
    }
    if (bearbeiten) {
        return (_jsx(AufgabeFormular, { k: k, vorlage: bearbeiten === 'neu' ? null : bearbeiten, mitglieder: mitglieder, einrichtungen: einrichtungen, listen: listen, vorgabeListe: aktiveListe?.id ?? '', onFertig: async () => {
                setBearbeiten(null);
                await laden();
            } }));
    }
    return (_jsxs(Seite, { titel: "Aufgaben", untertitel: `${liste.filter((a) => a.status !== 'erledigt').length} offen${anzahlUeberfaellig ? ` · ${anzahlUeberfaellig} überfällig` : ''}`, aktion: _jsx(Knopf, { variante: "akzent", onClick: () => setBearbeiten('neu'), children: "+ Aufgabe" }), children: [_jsxs(Gruppe, { children: [_jsxs("button", { type: "button", className: "zeile liste-zeile", "aria-pressed": ansicht === 'alle', onClick: () => setAnsicht('alle'), children: [_jsx("span", { className: "zeile-label", children: "Alle Aufgaben" }), ansicht === 'alle' && _jsx("span", { className: "badge badge-gruen", children: "gew\u00E4hlt" })] }), listen.map((l) => {
                        const f = fortschritt(l.id);
                        return (_jsxs("button", { type: "button", className: "zeile liste-zeile", "aria-pressed": ansicht === l.id, onClick: () => setAnsicht(l.id), children: [_jsx("span", { className: "zeile-label", children: l.name }), _jsxs("span", { className: `badge ${f.gesamt > 0 && f.fertig === f.gesamt ? 'badge-gruen' : ''}`, children: [f.fertig, "/", f.gesamt, " erledigt"] })] }, l.id));
                    }), _jsxs("button", { type: "button", className: "zeile liste-zeile", "aria-pressed": ansicht === 'ohne', onClick: () => setAnsicht('ohne'), children: [_jsx("span", { className: "zeile-label", children: "Ohne Liste" }), _jsxs("span", { className: "badge", children: [fortschritt(null).fertig, "/", fortschritt(null).gesamt, " erledigt"] })] })] }), listeName === null ? (_jsxs("div", { className: "liste-aktionen", children: [_jsx(Knopf, { variante: "ghost", onClick: () => { setListeUmbenennen(false); setListeName(''); }, children: "+ Liste" }), aktiveListe && listeVerwalten(aktiveListe) && (_jsxs(_Fragment, { children: [_jsx(Knopf, { variante: "ghost", onClick: () => { setListeUmbenennen(true); setListeName(aktiveListe.name); }, children: "Umbenennen" }), _jsx(Knopf, { variante: "ghost", onClick: () => void listeLoeschen(aktiveListe), children: "Liste l\u00F6schen" })] }))] })) : (_jsxs(Gruppe, { children: [_jsx(Feld, { label: listeUmbenennen ? 'Neuer Name' : 'Name der Liste', placeholder: "z. B. Hochsitze im Herbst", value: listeName, onChange: (e) => setListeName(e.target.value) }), _jsxs("div", { className: "liste-aktionen", children: [_jsx(Knopf, { onClick: () => void listeSpeichern(), disabled: !listeName.trim(), children: "Speichern" }), _jsx(Knopf, { variante: "ghost", onClick: () => { setListeName(null); setListeUmbenennen(false); }, children: "Abbrechen" })] })] })), _jsx(Segmente, { label: "Anzeige", wert: filter, onAendern: setFilter, optionen: [
                    { wert: 'offen', label: 'Offen' },
                    { wert: 'meine', label: 'Meine' },
                    { wert: 'erledigt', label: 'Erledigt' },
                ] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsxs(Gruppe, { children: [sichtbar.length === 0 && (_jsx("div", { className: "zeile", children: _jsx("span", { className: "zeile-label", children: filter === 'erledigt' ? 'Noch nichts erledigt' : 'Keine offenen Aufgaben' }) })), sichtbar.map((a) => {
                        const ein = einrichtungen.find((e) => e.id === a.einrichtung_id);
                        return (_jsxs("div", { className: "zeile aufgabe-zeile", children: [_jsx("button", { type: "button", className: `haken ${a.status === 'erledigt' ? 'an' : ''}`, onClick: () => void umschalten(a), disabled: !darfAendern(a), "aria-label": a.status === 'erledigt' ? `„${a.titel}“ wieder öffnen` : `„${a.titel}“ als erledigt markieren`, "aria-pressed": a.status === 'erledigt', children: a.status === 'erledigt' ? '✓' : '' }), _jsxs("button", { type: "button", className: "aufgabe-text", onClick: () => setBearbeiten(a), children: [_jsx("span", { className: a.status === 'erledigt' ? 'durch' : '', children: a.titel }), _jsx("small", { children: [
                                                a.zugewiesen_an ? name(a.zugewiesen_an) : null,
                                                ein ? einrichtungLabel(ein) : null,
                                                ansicht === 'alle' && a.liste_id ? listen.find((l) => l.id === a.liste_id)?.name : null,
                                                a.status === 'in_arbeit' ? 'in Arbeit' : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ') || ' ' })] }), a.faellig_am && a.status !== 'erledigt' && (_jsxs("span", { className: `badge ${ueberfaellig(a) ? 'badge-rot' : a.faellig_am === heuteISO() ? 'badge-orange' : ''}`, children: [ueberfaellig(a) ? 'überfällig · ' : '', datumDE(a.faellig_am)] })), a.status === 'erledigt' && a.erledigt_am && _jsx("span", { className: "badge badge-gruen", children: datumDE(a.erledigt_am) })] }, a.id));
                    })] }), _jsx(Leer, { children: "Alle Mitglieder k\u00F6nnen Aufgaben anlegen. \u00C4ndern und Erledigen k\u00F6nnen der Revierinhaber, die anlegende und die zugewiesene Person." })] }));
}
function AufgabeFormular({ k, vorlage, mitglieder, einrichtungen, listen, vorgabeListe, onFertig, }) {
    const [titel, setTitel] = useState(vorlage?.titel ?? '');
    const [beschreibung, setBeschreibung] = useState(vorlage?.beschreibung ?? '');
    const [faellig, setFaellig] = useState(vorlage?.faellig_am ?? '');
    const [zugewiesen, setZugewiesen] = useState(vorlage?.zugewiesen_an ?? '');
    const [einrichtung, setEinrichtung] = useState(vorlage?.einrichtung_id ?? '');
    const [status, setStatus] = useState(vorlage?.status ?? 'offen');
    const [listeId, setListeId] = useState(vorlage ? vorlage.liste_id ?? '' : vorgabeListe);
    const [fehler, setFehler] = useState(null);
    const [speichert, setSpeichert] = useState(false);
    const darfAendern = !vorlage || k.istInhaber || vorlage.erstellt_von === k.userId || vorlage.zugewiesen_an === k.userId;
    const darfLoeschen = vorlage && (k.istInhaber || vorlage.erstellt_von === k.userId);
    async function speichern(e) {
        e.preventDefault();
        setFehler(null);
        setSpeichert(true);
        const daten = {
            revier_id: k.revierId,
            titel: titel.trim(),
            beschreibung: beschreibung.trim() || null,
            faellig_am: faellig || null,
            zugewiesen_an: zugewiesen || null,
            einrichtung_id: einrichtung || null,
            liste_id: listeId || null,
            status,
        };
        const { error } = vorlage ? await supabase.from('aufgaben').update(daten).eq('id', vorlage.id) : await supabase.from('aufgaben').insert(daten);
        setSpeichert(false);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    async function loeschen() {
        if (!vorlage || !window.confirm('Diese Aufgabe löschen?'))
            return;
        const { error } = await supabase.from('aufgaben').update({ geloescht_am: new Date().toISOString() }).eq('id', vorlage.id);
        if (error)
            setFehler(fehlertext(error));
        else
            await onFertig();
    }
    return (_jsx(Seite, { titel: vorlage ? 'Aufgabe bearbeiten' : 'Neue Aufgabe', zurueck: () => void onFertig(), children: _jsxs("form", { onSubmit: speichern, children: [_jsxs(Gruppe, { children: [_jsx(Feld, { label: "Titel", required: true, placeholder: "z. B. Hochsitz Eichenkanzel reparieren", value: titel, onChange: (e) => setTitel(e.target.value) }), _jsx(Feld, { label: "Beschreibung", placeholder: "optional", value: beschreibung, onChange: (e) => setBeschreibung(e.target.value) }), _jsx(Feld, { label: "F\u00E4llig am", type: "date", value: faellig, onChange: (e) => setFaellig(e.target.value) }), _jsxs(Auswahl, { label: "Zust\u00E4ndig", value: zugewiesen, onChange: (e) => setZugewiesen(e.target.value), children: [_jsx("option", { value: "", children: "niemand bestimmt" }), mitglieder.map((m) => (_jsx("option", { value: m.user_id, children: m.name }, m.user_id)))] }), _jsxs(Auswahl, { label: "Einrichtung", value: einrichtung, onChange: (e) => setEinrichtung(e.target.value), children: [_jsx("option", { value: "", children: "\u2013" }), einrichtungen.map((x) => (_jsx("option", { value: x.id, children: einrichtungLabel(x) }, x.id)))] }), _jsxs(Auswahl, { label: "Liste", value: listeId, onChange: (e) => setListeId(e.target.value), children: [_jsx("option", { value: "", children: "ohne Liste" }), listen.map((l) => (_jsx("option", { value: l.id, children: l.name }, l.id)))] }), _jsx(Auswahl, { label: "Status", value: status, onChange: (e) => setStatus(e.target.value), children: STATUS.map((s) => (_jsx("option", { value: s.wert, children: s.label }, s.wert))) })] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), darfAendern ? (_jsx(Knopf, { type: "submit", disabled: speichert || !titel.trim(), children: speichert ? 'Speichern …' : 'Speichern' })) : (_jsx(Leer, { children: "Diese Aufgabe kann nur der Revierinhaber, die anlegende oder die zugewiesene Person \u00E4ndern." })), _jsx(Knopf, { type: "button", variante: "ghost", onClick: () => void onFertig(), children: "Abbrechen" }), darfLoeschen && (_jsx(Knopf, { type: "button", variante: "gefahr", onClick: loeschen, children: "Aufgabe l\u00F6schen" }))] }) }));
}
