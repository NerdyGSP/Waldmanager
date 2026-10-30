import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { navigieren } from '../../lib/router';
import { nameVergeben, zufallsFarben, ZONENFARBEN } from '../../lib/stammdaten';
import { freierName, kmText, ROUTENFOKUS, ROUTENTYPEN, routenTypFarbe, routenTypLabel, useRouten, useRoutenEbenen } from '../../lib/routen';
import { Auswahl, Farbwahl, Feld, Gruppe, Hinweis, Knopf, Leer, Zeile } from '../../components/ui';
import { Symbol } from '../../components/symbole';
const SPEICHER = 'hegewerk.routen.zu';
// Reiter „Routen“ im Modul „Zonen & Routen“: Ebenen aufklappbar, darunter die Routen
export function Routen({ k }) {
    const { routen, laedt, laden } = useRouten(k.revierId);
    const { ebenen, laden: ebenenLaden } = useRoutenEbenen(k.revierId);
    const [fehler, setFehler] = useState(null);
    const [zu, setZu] = useState(() => {
        try {
            return new Set(JSON.parse(localStorage.getItem(SPEICHER) ?? '[]'));
        }
        catch {
            return new Set();
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(SPEICHER, JSON.stringify([...zu]));
        }
        catch {
            /* nur für diese Sitzung */
        }
    }, [zu]);
    const umschalten = (id) => setZu((alt) => {
        const n = new Set(alt);
        if (n.has(id))
            n.delete(id);
        else
            n.add(id);
        return n;
    });
    const alleNeu = async () => {
        await Promise.all([laden(), ebenenLaden()]);
    };
    const gruppen = useMemo(() => {
        const liste = ebenen.map((e) => ({ ebene: e, routen: routen.filter((r) => r.ebeneId === e.id) }));
        const ohne = routen.filter((r) => !r.ebeneId || !ebenen.some((e) => e.id === r.ebeneId));
        if (ohne.length || ebenen.length === 0)
            liste.push({ ebene: null, routen: ohne });
        return liste;
    }, [routen, ebenen]);
    const routenNamen = routen.map((r) => r.name);
    async function umbenennen(r) {
        const neu = window.prompt('Neuer Name der Route:', r.name)?.trim();
        if (!neu || neu === r.name)
            return;
        if (nameVergeben(routenNamen, neu, r.name))
            return setFehler(`Eine Route „${neu}“ gibt es in diesem Revier bereits.`);
        const { error } = await supabase.from('pirschwege').update({ name: neu }).eq('id', r.id);
        setFehler(error ? fehlertext(error) : null);
        await alleNeu();
    }
    async function farbeSetzen(r, farbe) {
        const { error } = await supabase.from('pirschwege').update({ farbe }).eq('id', r.id);
        setFehler(error ? fehlertext(error) : null);
        await alleNeu();
    }
    async function ebeneZuweisen(r, ebeneId) {
        const { error } = await supabase.from('pirschwege').update({ ebene_id: ebeneId || null }).eq('id', r.id);
        setFehler(error ? fehlertext(error) : null);
        await alleNeu();
    }
    async function entfernen(r) {
        if (!window.confirm(`Route „${r.name}“ löschen?`))
            return;
        const { error } = await supabase.from('pirschwege').update({ geloescht_am: new Date().toISOString() }).eq('id', r.id);
        setFehler(error ? fehlertext(error) : null);
        await alleNeu();
    }
    function aufKarte(r) {
        try {
            sessionStorage.setItem(ROUTENFOKUS, JSON.stringify({ id: r.id, geometry: r.geometry, typ: r.typ, name: r.name }));
        }
        catch {
            /* ohne Fokus */
        }
        navigieren('/karte');
    }
    async function zufallsfarben(liste) {
        const farben = zufallsFarben(liste.length);
        const res = await Promise.all(liste.map((r, i) => supabase.from('pirschwege').update({ farbe: farben[i] }).eq('id', r.id)));
        const fehl = res.find((x) => x.error)?.error;
        setFehler(fehl ? fehlertext(fehl) : null);
        await alleNeu();
    }
    async function reihenfolge(i, richtung) {
        const a = ebenen[i];
        const b = ebenen[i + richtung];
        if (!a || !b)
            return;
        await Promise.all(ebenen.map((e, idx) => {
            const ziel = idx === i ? i + richtung : idx === i + richtung ? i : idx;
            return e.reihenfolge === ziel ? null : supabase.from('routen_ebenen').update({ reihenfolge: ziel }).eq('id', e.id);
        }));
        await ebenenLaden();
    }
    return (_jsxs(_Fragment, { children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), gruppen.length > 1 && (_jsxs("div", { className: "zonen-alle", children: [_jsx("button", { className: "link", onClick: () => setZu(new Set()), children: "Alle aufklappen" }), _jsx("button", { className: "link", onClick: () => setZu(new Set(gruppen.map((g) => g.ebene?.id ?? 'ohne'))), children: "Alle zuklappen" })] })), gruppen.map(({ ebene, routen: liste }, gi) => {
                const gid = ebene?.id ?? 'ohne';
                const offen = !zu.has(gid);
                return (_jsxs("section", { className: "gruppe", children: [_jsxs("div", { className: "gruppe-kopf", children: [_jsxs("button", { className: "gruppe-toggle", "aria-expanded": offen, onClick: () => umschalten(gid), children: [_jsx("span", { "aria-hidden": "true", children: _jsx(Symbol, { name: offen ? 'runter' : 'ausklappen', className: "symbol klein" }) }), ebene && _jsx("i", { className: "farbpunkt", style: { background: ebene.farbe ?? routenTypFarbe(ebene.typ) } }), _jsx("span", { className: "gruppe-titel", style: { margin: 0 }, children: `${ebene ? ebene.name : ebenen.length ? 'Ohne Ebene' : 'Routen'} · ${liste.length}` })] }), k.istInhaber && liste.length > 0 && (_jsx("button", { className: "link", onClick: () => void zufallsfarben(liste), title: "Weist jeder Route dieser Ebene eine andere, zuf\u00E4llige Farbe zu", children: "Zufallsfarben" })), k.istInhaber && ebene && (_jsxs("span", { className: "zeile-aktionen", children: [_jsx("button", { className: "link", onClick: () => void reihenfolge(gi, -1), disabled: gi === 0, "aria-label": "Ebene nach oben", children: "\u2191" }), _jsx("button", { className: "link", onClick: () => void reihenfolge(gi, 1), disabled: gi >= ebenen.length - 1, "aria-label": "Ebene nach unten", children: "\u2193" })] }))] }), offen && (_jsxs("div", { className: "gruppe-inhalt", children: [!laedt && liste.length === 0 && _jsx(Zeile, { label: "Noch keine Routen in dieser Ebene" }), liste.map((r) => {
                                    const farbe = r.farbe ?? ebene?.farbe ?? routenTypFarbe(r.typ);
                                    const passend = ebenen.filter((e) => e.typ === r.typ);
                                    return (_jsx(Zeile, { label: _jsxs("span", { className: "zone-name", children: [k.istInhaber ? (_jsx(Farbwahl, { wert: farbe, label: `Farbe der Route ${r.name}`, onAendern: (f) => void farbeSetzen(r, f) })) : (_jsx("i", { className: "farbpunkt", style: { background: farbe } })), r.name, _jsxs("small", { children: [_jsx("span", { className: "badge", children: routenTypLabel(r.typ) }), " ", kmText(r.laengeM), r.typ === 'treiberroute' && r.jagdOffen === false ? ' · Jagd abgeschlossen' : ''] })] }), children: _jsxs("span", { className: "zeile-aktionen", children: [k.istInhaber && passend.length > 0 && (_jsxs("select", { className: "zeile-auswahl", "aria-label": `Ebene von ${r.name}`, value: r.ebeneId ?? '', onChange: (e) => void ebeneZuweisen(r, e.target.value), children: [_jsx("option", { value: "", children: "Ohne Ebene" }), passend.map((e) => (_jsx("option", { value: e.id, children: e.name }, e.id)))] })), _jsx("button", { className: "link", onClick: () => aufKarte(r), children: "Auf Karte zeigen" }), k.istInhaber && (_jsxs(_Fragment, { children: [_jsx("button", { className: "link", onClick: () => void umbenennen(r), children: "Bearbeiten" }), _jsx("button", { className: "link gefahr", onClick: () => void entfernen(r), children: "L\u00F6schen" })] }))] }) }, r.id));
                                })] }))] }, gid));
            }), k.istInhaber ? _jsx(RoutenEbenen, { k: k, ebenen: ebenen, routen: routen, onGeaendert: alleNeu }) : _jsx(Leer, { children: "Routenebenen anlegen und \u00E4ndern kann nur der Revierinhaber." }), _jsx(Knopf, { variante: "sekundaer", onClick: () => navigieren('/karte'), children: "Routen auf der Karte zeichnen" })] }));
}
function RoutenEbenen({ k, ebenen, routen, onGeaendert }) {
    const [name, setName] = useState('');
    const [typ, setTyp] = useState('pirschweg');
    const [fehler, setFehler] = useState(null);
    const doppelt = name.trim() !== '' && nameVergeben(ebenen.map((e) => e.name), name);
    async function anlegen(e) {
        e.preventDefault();
        if (doppelt)
            return;
        setFehler(null);
        const { error } = await supabase.from('routen_ebenen').insert({
            revier_id: k.revierId,
            name: name.trim(),
            typ,
            reihenfolge: ebenen.length,
            wte_aktiv: typ === 'wte_route',
            farbe: ZONENFARBEN[(ebenen.length + 2) % ZONENFARBEN.length],
        });
        if (error)
            setFehler(error.code === '23505' ? `Eine Ebene „${name.trim()}“ gibt es bereits.` : fehlertext(error));
        else
            setName('');
        await onGeaendert();
    }
    async function aendern(ebene, werte) {
        setFehler(null);
        if (werte.name !== undefined) {
            if (!werte.name.trim())
                return;
            if (nameVergeben(ebenen.map((x) => x.name), werte.name, ebene.name))
                return setFehler(`Eine Ebene „${werte.name.trim()}“ gibt es bereits.`);
        }
        const { error } = await supabase.from('routen_ebenen').update(werte).eq('id', ebene.id);
        // Eine neu gesetzte Ebenenfarbe überschreibt die Farben ihrer Routen (wie bei den Zonen)
        if (!error && werte.farbe)
            await supabase.from('pirschwege').update({ farbe: werte.farbe }).eq('ebene_id', ebene.id);
        if (error)
            setFehler(fehlertext(error));
        await onGeaendert();
    }
    async function loeschen(ebene, mitRouten) {
        const anzahl = routen.filter((r) => r.ebeneId === ebene.id).length;
        if (mitRouten) {
            const eingabe = window.prompt(`Ebene „${ebene.name}“ samt ${anzahl} Routen löschen? Zur Bestätigung LÖSCHEN eintippen:`);
            if (eingabe?.trim() !== 'LÖSCHEN')
                return;
        }
        else {
            const frage = anzahl ? `Ebene „${ebene.name}“ löschen? Die ${anzahl} Routen darin bleiben erhalten und sind danach ohne Ebene.` : `Ebene „${ebene.name}“ löschen?`;
            if (!window.confirm(frage))
                return;
        }
        const { error } = await supabase.rpc('routen_ebene_loeschen', { p_ebene_id: ebene.id, p_mit_routen: mitRouten });
        if (error)
            setFehler(fehlertext(error));
        await onGeaendert();
    }
    return (_jsxs(_Fragment, { children: [_jsxs(Gruppe, { titel: "Routenebenen", fuss: "Eine Ebene enth\u00E4lt nur einen Routentyp. Die Ebenenfarbe wird auf alle Routen der Ebene angewendet; danach kannst du einzelne Routen abweichend einf\u00E4rben. Mit \u201EWTE\u201C markierte Ebenen sind im WTE-Modus der Karte sichtbar. Treiberroute-Ebenen zeigen auf der Karte nur Routen offener Jagden.", children: [ebenen.length === 0 && _jsx(Zeile, { label: "Noch keine Ebenen angelegt" }), ebenen.map((e) => (_jsx(Zeile, { label: _jsxs("span", { className: "zone-name", children: [_jsx("input", { type: "color", className: "farbwahl", "aria-label": `Farbe der Ebene ${e.name}`, value: e.farbe ?? routenTypFarbe(e.typ), onChange: (ev) => void aendern(e, { farbe: ev.target.value }) }), e.name, _jsxs("small", { children: [_jsx("span", { className: "badge", children: routenTypLabel(e.typ) }), " ", routen.filter((r) => r.ebeneId === e.id).length, " Routen"] })] }), children: _jsxs("span", { className: "zeile-aktionen", children: [e.typ === 'wte_route' && (_jsxs("label", { className: "ebene", title: "Routen dieser Ebene sind im WTE-Modus der Karte sichtbar", children: [_jsx("input", { type: "checkbox", checked: e.wte_aktiv, onChange: (ev) => void aendern(e, { wte_aktiv: ev.target.checked }) }), " WTE"] })), _jsx("button", { className: "link", onClick: () => {
                                        const neu = window.prompt('Neuer Name der Ebene:', e.name);
                                        if (neu && neu.trim() !== e.name)
                                            void aendern(e, { name: neu.trim() });
                                    }, children: "Umbenennen" }), _jsx("button", { className: "link gefahr", onClick: () => void loeschen(e, false), children: "L\u00F6schen" }), routen.some((r) => r.ebeneId === e.id) && (_jsx("button", { className: "link gefahr", onClick: () => void loeschen(e, true), children: "Samt Routen l\u00F6schen" }))] }) }, e.id)))] }), _jsxs("form", { onSubmit: anlegen, children: [_jsxs(Gruppe, { children: [_jsx(Feld, { label: "Neue Ebene", placeholder: "z. B. Pirschwege Nord", value: name, onChange: (e) => setName(e.target.value) }), _jsx(Auswahl, { label: "Routentyp", value: typ, onChange: (e) => setTyp(e.target.value), children: ROUTENTYPEN.map((t) => (_jsx("option", { value: t.wert, children: t.label }, t.wert))) })] }), doppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Ebene \u201E", name.trim(), "\u201C gibt es bereits."] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", variante: "sekundaer", disabled: !name.trim() || doppelt, children: "Ebene anlegen" })] })] }));
}
export { freierName };
