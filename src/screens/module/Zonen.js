import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fehlertext } from '../../lib/fehler';
import { nameVergeben, useZonen, useZonenEbenen, zufallsFarben, ZONENFARBEN } from '../../lib/stammdaten';
import { navigieren } from '../../lib/router';
import { Auswahl, Farbwahl, Feld, Gruppe, Hinweis, Knopf, Leer, Seite, Zeile } from '../../components/ui';
import { Symbol } from '../../components/symbole';
import { AufteilenDialog } from './AufteilenDialog';
export function Zonen({ k }) {
    const { zonen, laedt, laden } = useZonen(k.revierId);
    const { ebenen, laden: ebenenLaden } = useZonenEbenen(k.revierId);
    const [fehler, setFehler] = useState(null);
    const [aufteilen, setAufteilen] = useState(false);
    // eingeklappte Gruppen (je Gerät gemerkt)
    const [zu, setZu] = useState(() => {
        try {
            return new Set(JSON.parse(localStorage.getItem('hegewerk.zonen.zu') ?? '[]'));
        }
        catch {
            return new Set();
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem('hegewerk.zonen.zu', JSON.stringify([...zu]));
        }
        catch {
            /* nur für diese Sitzung */
        }
    }, [zu]);
    const umschalten = (id) => setZu((alt) => {
        const neu = new Set(alt);
        if (neu.has(id))
            neu.delete(id);
        else
            neu.add(id);
        return neu;
    });
    // Zonen nach Ebene gruppieren; „Ohne Ebene“ zuletzt
    const gruppen = useMemo(() => {
        const liste = ebenen.map((e) => ({
            ebene: e,
            zonen: zonen.filter((z) => z.ebeneId === e.id),
        }));
        const ohne = zonen.filter((z) => !z.ebeneId || !ebenen.some((e) => e.id === z.ebeneId));
        if (ohne.length || ebenen.length === 0)
            liste.push({ ebene: null, zonen: ohne });
        return liste;
    }, [zonen, ebenen]);
    async function zufallsfarben(liste) {
        const farben = zufallsFarben(liste.length);
        const ergebnisse = await Promise.all(liste.map((z, i) => supabase.from('zonen').update({ farbe: farben[i] }).eq('id', z.id)));
        const fehl = ergebnisse.find((r) => r.error)?.error;
        setFehler(fehl ? fehlertext(fehl) : null);
        await laden();
    }
    async function alleNeuLaden() {
        await Promise.all([laden(), ebenenLaden()]);
    }
    async function umbenennen(z) {
        const neu = window.prompt('Neuer Name der Zone:', z.name)?.trim();
        if (!neu || neu === z.name)
            return;
        if (nameVergeben(zonen.map((x) => x.name), neu, z.name)) {
            setFehler(`Eine Zone „${neu}“ gibt es in diesem Revier bereits.`);
            return;
        }
        const { error } = await supabase.from('zonen').update({ name: neu }).eq('id', z.id);
        setFehler(error ? fehlertext(error) : null);
        await laden();
    }
    async function farbeSetzen(z, farbe) {
        const { error } = await supabase.from('zonen').update({ farbe }).eq('id', z.id);
        setFehler(error ? fehlertext(error) : null);
        await laden();
    }
    async function ebeneZuweisen(z, ebeneId) {
        const ebene = ebenen.find((e) => e.id === ebeneId);
        const { error } = await supabase
            .from('zonen')
            .update({ ebene_id: ebeneId || null, ...(ebene?.farbe ? { farbe: ebene.farbe } : {}) })
            .eq('id', z.id);
        setFehler(error ? fehlertext(error) : null);
        await laden();
    }
    async function verschieben(liste, index, richtung) {
        const a = liste[index];
        const b = liste[index + richtung];
        if (!a || !b)
            return;
        await Promise.all([
            supabase.from('zonen').update({ sortierung: b.sortierung }).eq('id', a.id),
            supabase.from('zonen').update({ sortierung: a.sortierung === b.sortierung ? b.sortierung + richtung : a.sortierung }).eq('id', b.id),
        ]);
        await laden();
    }
    async function entfernen(z) {
        if (!window.confirm(`Zone „${z.name}“ entfernen? Bisherige Zählungen bleiben erhalten.`))
            return;
        // Weiches Löschen, damit Historie und Offline-Geräte konsistent bleiben
        const { error } = await supabase.from('zonen').update({ geloescht_am: new Date().toISOString() }).eq('id', z.id);
        setFehler(error ? fehlertext(error) : null);
        await laden();
    }
    return (_jsxs(Seite, { titel: "Zonen", untertitel: "Erfassungszonen und individuelle Zonenebenen \u00B7 Farbe je Zone \u00FCber den Farbpunkt", children: [fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), gruppen.length > 1 && (_jsxs("div", { className: "zonen-alle", children: [_jsx("button", { className: "link", onClick: () => setZu(new Set()), children: "Alle aufklappen" }), _jsx("button", { className: "link", onClick: () => setZu(new Set(gruppen.map((g) => g.ebene?.id ?? 'ohne'))), children: "Alle zuklappen" })] })), gruppen.map(({ ebene, zonen: liste }) => {
                const gid = ebene?.id ?? 'ohne';
                const offen = !zu.has(gid);
                return (_jsxs("section", { className: "gruppe", children: [_jsxs("div", { className: "gruppe-kopf", children: [_jsxs("button", { className: "gruppe-toggle", "aria-expanded": offen, onClick: () => umschalten(gid), children: [_jsx("span", { "aria-hidden": "true", children: _jsx(Symbol, { name: offen ? 'runter' : 'ausklappen', className: "symbol klein" }) }), ebene && _jsx("i", { className: "farbpunkt", style: { background: ebene.farbe ?? 'var(--text-leise)' } }), _jsx("span", { className: "gruppe-titel", style: { margin: 0 }, children: `${ebene ? ebene.name : ebenen.length ? 'Ohne Ebene' : 'Zonen'} · ${liste.length}` })] }), k.istInhaber && liste.length > 0 && (_jsx("button", { className: "link", onClick: () => void zufallsfarben(liste), title: "Weist jeder Zone dieser Ebene eine andere, zuf\u00E4llige Farbe zu", children: "Zufallsfarben" }))] }), offen && _jsxs("div", { className: "gruppe-inhalt", children: [!laedt && liste.length === 0 && _jsx(Zeile, { label: "Noch keine Zonen in dieser Ebene" }), liste.map((z, i) => (_jsx(Zeile, { label: _jsxs("span", { className: "zone-name", children: [k.istInhaber ? (_jsx(Farbwahl, { wert: z.farbe ?? ebene?.farbe ?? '#1e5c3a', label: `Farbe der Zone ${z.name}`, onAendern: (f) => void farbeSetzen(z, f) })) : (_jsx("i", { className: "farbpunkt", style: { background: z.farbe ?? ebene?.farbe ?? 'var(--akzent)' } })), z.name, _jsx("small", { children: z.hatGeometrie ? 'Fläche gezeichnet' : 'ohne Fläche' })] }), children: k.istInhaber && (_jsxs("span", { className: "zeile-aktionen", children: [ebenen.length > 0 && (_jsxs("select", { className: "zeile-auswahl", "aria-label": `Ebene von ${z.name}`, value: z.ebeneId ?? '', onChange: (e) => ebeneZuweisen(z, e.target.value), children: [_jsx("option", { value: "", children: "Ohne Ebene" }), ebenen.map((e) => (_jsx("option", { value: e.id, children: e.name }, e.id)))] })), _jsx("button", { className: "link", onClick: () => verschieben(liste, i, -1), disabled: i === 0, "aria-label": "Nach oben", children: "\u2191" }), _jsx("button", { className: "link", onClick: () => verschieben(liste, i, 1), disabled: i === liste.length - 1, "aria-label": "Nach unten", children: "\u2193" }), _jsx("button", { className: "link", onClick: () => umbenennen(z), children: "Umbenennen" }), _jsx("button", { className: "link gefahr", onClick: () => entfernen(z), children: "Entfernen" })] })) }, z.id)))] })] }, gid));
            }), k.istInhaber ? (_jsxs(_Fragment, { children: [_jsx(ZoneAnlegen, { k: k, zonen: zonen, ebenen: ebenen, onAngelegt: laden }), _jsx(Ebenen, { k: k, ebenen: ebenen, zonen: zonen, onGeaendert: alleNeuLaden })] })) : (_jsx(Leer, { children: "Zonen und Ebenen anlegen und \u00E4ndern kann nur der Revierinhaber." })), _jsx(Knopf, { variante: "sekundaer", onClick: () => navigieren('/karte'), children: "Zonen auf der Karte zeichnen" }), k.istInhaber && (_jsx(Knopf, { variante: "sekundaer", onClick: () => setAufteilen(true), children: "Revier in gleich gro\u00DFe Zonen aufteilen" })), aufteilen && _jsx(AufteilenDialog, { revierId: k.revierId, onZu: () => setAufteilen(false), onAngelegt: alleNeuLaden })] }));
}
function ZoneAnlegen({ k, zonen, ebenen, onAngelegt, }) {
    const [name, setName] = useState('');
    const [ebeneId, setEbeneId] = useState('');
    const [fehler, setFehler] = useState(null);
    const doppelt = name.trim() !== '' && nameVergeben(zonen.map((z) => z.name), name);
    async function anlegen(e) {
        e.preventDefault();
        if (doppelt)
            return;
        setFehler(null);
        const ebene = ebenen.find((x) => x.id === ebeneId);
        const { error } = await supabase.from('zonen').insert({
            revier_id: k.revierId,
            name: name.trim(),
            ebene_id: ebeneId || null,
            sortierung: zonen.length,
            farbe: ebene?.farbe ?? ZONENFARBEN[zonen.length % ZONENFARBEN.length],
        });
        if (error)
            setFehler(fehlertext(error));
        else
            setName('');
        await onAngelegt();
    }
    return (_jsxs("form", { onSubmit: anlegen, children: [_jsxs(Gruppe, { titel: "Zone anlegen", children: [_jsx(Feld, { label: "Name", placeholder: "z. B. Feldmark Nord", required: true, value: name, onChange: (e) => setName(e.target.value) }), ebenen.length > 0 && (_jsxs(Auswahl, { label: "Ebene", value: ebeneId, onChange: (e) => setEbeneId(e.target.value), children: [_jsx("option", { value: "", children: "Ohne Ebene" }), ebenen.map((x) => (_jsx("option", { value: x.id, children: x.name }, x.id)))] }))] }), doppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Zone \u201E", name.trim(), "\u201C gibt es in diesem Revier bereits."] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", variante: "sekundaer", disabled: !name.trim() || doppelt, children: "Zone anlegen" })] }));
}
function Ebenen({ k, ebenen, zonen, onGeaendert, }) {
    const [name, setName] = useState('');
    const [fehler, setFehler] = useState(null);
    const doppelt = name.trim() !== '' && nameVergeben(ebenen.map((e) => e.name), name);
    async function anlegen(e) {
        e.preventDefault();
        if (doppelt)
            return;
        setFehler(null);
        const { error } = await supabase.from('zonen_ebenen').insert({
            revier_id: k.revierId,
            name: name.trim(),
            sortierung: ebenen.length,
            farbe: ZONENFARBEN[(ebenen.length + 2) % ZONENFARBEN.length],
        });
        if (error)
            setFehler(fehlertext(error));
        else
            setName('');
        await onGeaendert();
    }
    async function aendern(ebene, werte) {
        setFehler(null);
        if (werte.name !== undefined) {
            if (!werte.name.trim())
                return;
            if (nameVergeben(ebenen.map((x) => x.name), werte.name, ebene.name)) {
                setFehler(`Eine Ebene „${werte.name.trim()}“ gibt es bereits.`);
                return;
            }
        }
        const { error } = await supabase.from('zonen_ebenen').update(werte).eq('id', ebene.id);
        if (!error && werte.farbe) {
            // Zonen der Ebene übernehmen die Ebenenfarbe
            await supabase.from('zonen').update({ farbe: werte.farbe }).eq('ebene_id', ebene.id);
        }
        if (error)
            setFehler(fehlertext(error));
        await onGeaendert();
    }
    async function loeschen(ebene) {
        const anzahl = zonen.filter((z) => z.ebeneId === ebene.id).length;
        const frage = anzahl
            ? `Ebene „${ebene.name}“ löschen? Die ${anzahl} Zonen darin bleiben erhalten und sind danach ohne Ebene.`
            : `Ebene „${ebene.name}“ löschen?`;
        if (!window.confirm(frage))
            return;
        const { error } = await supabase.from('zonen_ebenen').delete().eq('id', ebene.id);
        if (error)
            setFehler(fehlertext(error));
        await onGeaendert();
    }
    return (_jsxs(_Fragment, { children: [_jsxs(Gruppe, { titel: "Zonenebenen", fuss: "Die Ebenenfarbe wird auf alle Zonen der Ebene angewendet; danach kannst du einzelne Zonen wieder abweichend einf\u00E4rben. Mit \u201EWTE\u201C markierte Ebenen sind im WTE-Modus der Karte (Wildtiererfassung) antippbar. Mit Ebenen legst du unabh\u00E4ngige Zoneneinteilungen an, z. B. \u201EZ\u00E4hlzonen\u201C und \u201EAnsitzbereiche\u201C. Auf der Karte l\u00E4sst sich jede Ebene einzeln ein- und ausblenden, eine Z\u00E4hlung kann auf eine Ebene beschr\u00E4nkt werden.", children: [ebenen.length === 0 && _jsx(Zeile, { label: "Noch keine Ebenen angelegt" }), ebenen.map((e) => (_jsx(Zeile, { label: _jsxs("span", { className: "zone-name", children: [_jsx("input", { type: "color", className: "farbwahl", "aria-label": `Farbe der Ebene ${e.name}`, value: e.farbe ?? '#1e5c3a', onChange: (ev) => void aendern(e, { farbe: ev.target.value }) }), e.name, _jsxs("small", { children: [zonen.filter((z) => z.ebeneId === e.id).length, " Zonen"] })] }), children: _jsxs("span", { className: "zeile-aktionen", children: [_jsxs("label", { className: "ebene", title: "Zonen dieser Ebene sind im WTE-Modus der Karte antippbar", children: [_jsx("input", { type: "checkbox", checked: e.wte_aktiv, onChange: (ev) => void aendern(e, { wte_aktiv: ev.target.checked }) }), " WTE"] }), _jsx("button", { className: "link", onClick: () => {
                                        const neu = window.prompt('Neuer Name der Ebene:', e.name);
                                        if (neu && neu.trim() !== e.name)
                                            void aendern(e, { name: neu.trim() });
                                    }, children: "Umbenennen" }), _jsx("button", { className: "link gefahr", onClick: () => loeschen(e), children: "L\u00F6schen" })] }) }, e.id)))] }), _jsxs("form", { onSubmit: anlegen, children: [_jsx(Gruppe, { children: _jsx(Feld, { label: "Neue Ebene", placeholder: "z. B. Z\u00E4hlzonen", value: name, onChange: (e) => setName(e.target.value) }) }), doppelt && _jsxs(Hinweis, { art: "fehler", children: ["Eine Ebene \u201E", name.trim(), "\u201C gibt es bereits."] }), fehler && _jsx(Hinweis, { art: "fehler", children: fehler }), _jsx(Knopf, { type: "submit", variante: "sekundaer", disabled: !name.trim() || doppelt, children: "Ebene anlegen" })] })] }));
}
