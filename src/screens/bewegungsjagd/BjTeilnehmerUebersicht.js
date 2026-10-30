import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useMemo, useState } from 'react';
import { useBreit } from '../../lib/useBreit';
import { codeAnzeigen } from '../../lib/bewegungsjagd';
import { nachAnstellern } from '../../lib/bjGruppen';
import { Knopf, Leer } from '../../components/ui';
const STATUSTEXT = { eingeladen: 'offen', zugesagt: 'zugesagt', abgesagt: 'abgesagt' };
const badge = (status) => `badge ${status === 'zugesagt' ? 'badge-gruen' : status === 'abgesagt' ? 'badge-rot' : ''}`;
const ja = (b) => (b ? 'ja' : '–');
const mailText = (t) => (t.mail_status ? (t.mail_status === 'gesendet' ? 'gesendet' : `Fehler${t.mail_fehler ? ` (${t.mail_fehler})` : ''}`) : '–');
// Wert je Spalte für die Sortierung
function sortWert(t, s, standName) {
    switch (s) {
        case 'name': return t.name.toLocaleLowerCase('de');
        case 'status': return t.status;
        case 'stand': return standName(t.zugeordnete_einrichtung_id).toLocaleLowerCase('de');
        case 'telefon': return t.telefon ?? '';
        case 'hund': return t.hat_hund ? 1 : 0;
        case 'horn': return t.hat_hornblaeser ? 1 : 0;
        case 'auto': return t.auto_vorhanden ? t.mitfahrplaetze ?? 0 : -1;
        case 'schuessel': return t.schuesseltreiben_teilnahme ? 1 : 0;
        case 'mail': return t.mail_status ?? '';
    }
}
// Teilnehmerübersicht der Jagdverwaltung: Zähler, Suche, Filter, sortierbare Tabelle (ab 900 px) bzw. Karten, Gruppen je Ansteller
export function BjTeilnehmerUebersicht({ tn, offen, schuesseltreiben, staende, standName, sendet, onAendern, onEntfernen, onErneutEinladen, onStandPerKarte, }) {
    const breit = useBreit();
    const [suche, setSuche] = useState('');
    const [status, setStatus] = useState('alle');
    const [anstellerFilter, setAnstellerFilter] = useState(''); // '' = alle, 'ohne' = ohne Gruppe, sonst Ansteller-ID
    const [sortSpalte, setSortSpalte] = useState(null);
    const [sortRichtung, setSortRichtung] = useState(1);
    const [zugeklappt, setZugeklappt] = useState(new Set());
    const [offenZeile, setOffenZeile] = useState(null);
    const anstellerListe = tn.filter((t) => t.ist_ansteller && t.aktiv);
    const sichtbar = useMemo(() => {
        const q = suche.trim().toLocaleLowerCase('de');
        const ids = new Set(tn.filter((t) => t.ist_ansteller).map((t) => t.id));
        return tn.filter((t) => {
            if (status !== 'alle' && t.status !== status)
                return false;
            if (q && ![t.name, t.email, t.telefon ?? '', t.anschrift ?? ''].some((x) => x.toLocaleLowerCase('de').includes(q)))
                return false;
            if (anstellerFilter) {
                const gruppe = t.ist_ansteller ? t.id : t.ansteller_id && ids.has(t.ansteller_id) ? t.ansteller_id : 'ohne';
                if (gruppe !== anstellerFilter)
                    return false;
            }
            return true;
        });
    }, [tn, suche, status, anstellerFilter]);
    const gruppen = useMemo(() => {
        const g = nachAnstellern(sichtbar);
        if (!sortSpalte)
            return g;
        const vergleich = (a, b) => {
            const x = sortWert(a, sortSpalte, standName);
            const y = sortWert(b, sortSpalte, standName);
            const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de');
            return (r || a.name.localeCompare(b.name, 'de')) * sortRichtung;
        };
        return g.map((gr) => ({ ...gr, mitglieder: [...gr.mitglieder].sort(vergleich) }));
    }, [sichtbar, sortSpalte, sortRichtung, standName]);
    const sortieren = (s) => {
        if (sortSpalte === s)
            setSortRichtung((r) => (r === 1 ? -1 : 1));
        else {
            setSortSpalte(s);
            setSortRichtung(1);
        }
    };
    const kopf = (s, text) => (_jsx("th", { scope: "col", "aria-sort": sortSpalte === s ? (sortRichtung === 1 ? 'ascending' : 'descending') : 'none', children: _jsxs("button", { type: "button", className: "link", onClick: () => sortieren(s), children: [text, sortSpalte === s ? (sortRichtung === 1 ? ' ▲' : ' ▼') : ''] }) }));
    const umschalten = (key) => setZugeklappt((alt) => {
        const n = new Set(alt);
        if (n.has(key))
            n.delete(key);
        else
            n.add(key);
        return n;
    });
    const standAuswahl = (t) => offen ? (_jsxs("select", { "aria-label": `Stand für ${t.name}`, value: t.zugeordnete_einrichtung_id ?? '', onChange: (e) => void onAendern(t, { zugeordnete_einrichtung_id: e.target.value || null }), children: [_jsx("option", { value: "", children: "\u2013 kein Stand \u2013" }), staende.map((e) => (_jsx("option", { value: e.id, children: e.label }, e.id)))] })) : (standName(t.zugeordnete_einrichtung_id) || '–');
    const anstellerAuswahl = (t) => offen && !t.ist_ansteller && anstellerListe.length > 0 ? (_jsxs("select", { "aria-label": `Ansteller für ${t.name}`, value: t.ansteller_id ?? '', onChange: (e) => void onAendern(t, { ansteller_id: e.target.value || null }), children: [_jsx("option", { value: "", children: "\u2013 ohne Ansteller \u2013" }), anstellerListe.map((a) => (_jsx("option", { value: a.id, children: a.name }, a.id)))] })) : null;
    const aktionen = (t) => offen ? (_jsxs("span", { className: "bj-zeile-aktionen", children: [anstellerAuswahl(t), _jsx(Knopf, { variante: "ghost", onClick: () => void onAendern(t, { aktiv: !t.aktiv }), children: t.aktiv ? 'Deaktivieren' : 'Aktivieren' }), _jsx(Knopf, { variante: "gefahr", onClick: () => void onEntfernen(t), children: "L\u00F6schen" })] })) : null;
    const detail = (t) => (_jsxs("div", { className: "bj-detail", children: [_jsxs("div", { children: [_jsx("strong", { children: "E-Mail:" }), " ", t.email] }), t.anschrift && (_jsxs("div", { children: [_jsx("strong", { children: "Anschrift:" }), " ", t.anschrift] })), _jsxs("div", { children: [_jsx("strong", { children: "Code:" }), " ", codeAnzeigen(t.einladungscode)] }), offen && (_jsxs("div", { className: "bj-zeile-aktionen", style: { justifyContent: 'flex-start' }, children: [_jsxs("label", { style: { display: 'inline-flex', gap: 4, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: t.ist_ansteller, onChange: (e) => void onAendern(t, { ist_ansteller: e.target.checked }) }), " Ansteller"] }), _jsx(Knopf, { variante: "ghost", onClick: () => onStandPerKarte(t), children: "Stand per Karte" }), t.aktiv && t.status === 'eingeladen' && (_jsx(Knopf, { variante: "ghost", disabled: sendet, onClick: () => void onErneutEinladen(t), children: "Erneut einladen" }))] }))] }));
    const spaltenAnzahl = 9 + (schuesseltreiben ? 1 : 0);
    const gruppenKopf = (g) => {
        const key = g.ansteller?.id ?? 'ohne';
        const zu = zugeklappt.has(key);
        const anzahl = g.mitglieder.length + (g.ansteller ? 1 : 0);
        return { key, zu, anzahl, text: g.ansteller ? `Gruppe von ${g.ansteller.name} (${anzahl})` : `Ohne Gruppe (${anzahl})` };
    };
    const tabellenZeile = (t, eingerueckt) => (_jsxs(Fragment, { children: [_jsxs("tr", { className: t.aktiv ? '' : 'inaktiv', children: [_jsxs("th", { scope: "row", style: { paddingLeft: eingerueckt ? 24 : undefined }, children: [_jsxs("button", { type: "button", className: "link", "aria-expanded": offenZeile === t.id, onClick: () => setOffenZeile(offenZeile === t.id ? null : t.id), children: [offenZeile === t.id ? '▾' : '▸', " ", t.name] }), t.ist_ansteller && _jsx("span", { className: "badge", children: " Ansteller" })] }), _jsx("td", { children: _jsx("span", { className: badge(t.status), children: STATUSTEXT[t.status] ?? t.status }) }), _jsx("td", { children: standAuswahl(t) }), _jsx("td", { children: t.telefon ?? '–' }), _jsx("td", { children: ja(t.hat_hund) }), _jsx("td", { children: ja(t.hat_hornblaeser) }), _jsx("td", { children: t.auto_vorhanden ? `ja, ${t.mitfahrplaetze ?? 0} Pl.` : '–' }), schuesseltreiben && _jsx("td", { children: ja(t.schuesseltreiben_teilnahme) }), _jsx("td", { children: mailText(t) }), _jsx("td", { children: offen && (_jsxs("details", { className: "bj-menue", children: [_jsx("summary", { "aria-label": `Aktionen für ${t.name}`, children: "\u22EF" }), _jsx("div", { className: "bj-menue-inhalt", children: aktionen(t) })] })) })] }), offenZeile === t.id && (_jsx("tr", { children: _jsx("td", { colSpan: spaltenAnzahl, children: detail(t) }) }))] }, t.id));
    const karte = (t, eingerueckt) => (_jsx("div", { className: `bj-zeile ${t.aktiv ? '' : 'inaktiv'} ${eingerueckt ? 'im-gruppe' : ''}`, children: _jsxs("span", { children: [_jsx("strong", { children: t.name }), " ", _jsx("span", { className: badge(t.status), children: STATUSTEXT[t.status] ?? t.status }), t.ist_ansteller && _jsx("span", { className: "badge", children: " Ansteller" }), _jsx("br", {}), _jsxs("small", { children: [t.telefon ? `${t.telefon} · ` : '', "Stand: ", standName(t.zugeordnete_einrichtung_id) || '–', t.status === 'zugesagt' && ` · ${[t.hat_hund && 'Hund', t.hat_hornblaeser && 'Hornbläser', t.auto_vorhanden && `Auto, ${t.mitfahrplaetze ?? 0} Pl.`, schuesseltreiben && t.schuesseltreiben_teilnahme && 'Schüsseltreiben'].filter(Boolean).join(', ') || 'keine Angaben'}`, t.mail_status ? ` · Mail ${mailText(t)}` : ''] }), _jsx("br", {}), _jsx("button", { type: "button", className: "link", "aria-expanded": offenZeile === t.id, onClick: () => setOffenZeile(offenZeile === t.id ? null : t.id), children: offenZeile === t.id ? 'Weniger' : 'Details & Aktionen' }), offenZeile === t.id && (_jsxs(_Fragment, { children: [detail(t), offen && (_jsxs("div", { className: "bj-zeile-aktionen", style: { justifyContent: 'flex-start', marginTop: 6 }, children: [standAuswahl(t), aktionen(t)] }))] }))] }) }, t.id));
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bj-filter", style: { padding: '10px var(--abstand)' }, children: [_jsx("input", { type: "search", placeholder: "Suchen (Name, E-Mail, Telefon)", "aria-label": "Teilnehmer suchen", value: suche, onChange: (e) => setSuche(e.target.value) }), _jsxs("select", { "aria-label": "Status filtern", value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "alle", children: "Alle Status" }), _jsx("option", { value: "eingeladen", children: "Offen" }), _jsx("option", { value: "zugesagt", children: "Zugesagt" }), _jsx("option", { value: "abgesagt", children: "Abgesagt" })] }), anstellerListe.length > 0 && (_jsxs("select", { "aria-label": "Nach Ansteller filtern", value: anstellerFilter, onChange: (e) => setAnstellerFilter(e.target.value), children: [_jsx("option", { value: "", children: "Alle Gruppen" }), anstellerListe.map((a) => (_jsxs("option", { value: a.id, children: ["Gruppe ", a.name] }, a.id))), _jsx("option", { value: "ohne", children: "Ohne Gruppe" })] }))] }), sichtbar.length === 0 && _jsx(Leer, { children: "Keine Teilnehmer in dieser Ansicht." }), sichtbar.length > 0 && breit && (_jsx("div", { className: "tabelle-rahmen", style: { border: 0, overflowX: 'auto' }, children: _jsxs("table", { className: "tabelle bj-tn-tabelle", children: [_jsx("thead", { children: _jsxs("tr", { children: [kopf('name', 'Name'), kopf('status', 'Status'), kopf('stand', 'Stand'), kopf('telefon', 'Telefon'), kopf('hund', 'Hund'), kopf('horn', 'Hornbläser'), kopf('auto', 'Auto/Plätze'), schuesseltreiben && kopf('schuessel', 'Schüsseltreiben'), kopf('mail', 'Mail'), _jsx("th", { scope: "col", children: "Aktionen" })] }) }), _jsx("tbody", { children: gruppen.map((g) => {
                                const { key, zu, text } = gruppenKopf(g);
                                return (_jsxs(Fragment, { children: [_jsx("tr", { className: "bj-gruppe-zeile", children: _jsx("td", { colSpan: spaltenAnzahl, children: _jsxs("button", { type: "button", className: "link", "aria-expanded": !zu, onClick: () => umschalten(key), children: [zu ? '▸' : '▾', " ", text] }) }) }), !zu && (_jsxs(_Fragment, { children: [g.ansteller && tabellenZeile(g.ansteller, false), g.mitglieder.map((t) => tabellenZeile(t, true))] }))] }, key));
                            }) })] }) })), sichtbar.length > 0 && !breit &&
                gruppen.map((g) => {
                    const { key, zu, text } = gruppenKopf(g);
                    return (_jsxs("div", { children: [_jsx("div", { className: "bj-gruppe-kopf", children: _jsxs("button", { onClick: () => umschalten(key), "aria-expanded": !zu, children: [zu ? '▸' : '▾', " ", text] }) }), !zu && (_jsxs(_Fragment, { children: [g.ansteller && karte(g.ansteller, false), g.mitglieder.map((t) => karte(t, true))] }))] }, key));
                })] }));
}
