import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { fehlertext } from '../lib/fehler';
import { gemerktesRevier, revierMerken, useNutzerKontext } from '../lib/useNutzerKontext';
import { navigieren, usePfad } from '../lib/router';
import { useWarteschlange } from '../lib/offline';
import { EingebettetKontext, Hinweis, Knopf } from '../components/ui';
import { Symbol } from '../components/symbole';
import { useBreit } from '../lib/useBreit';
import { Logo } from './AuthScreen';
import { CodeEinloesen, Einstellungen, Reviermanagement } from './Einstellungen';
import { Masteradmin } from './Masteradmin';
import { useModulBreite } from '../lib/modulBreite';
import { Segmente } from '../components/ui';
import { Freigaben } from './module/Freigaben';
import { Jagdzeiten } from './module/Jagdzeiten';
import { Zonen } from './module/Zonen';
import { Abschuesse } from './module/Abschuesse';
import { Erfassung } from './module/Erfassung';
import { Zaehlung } from './module/Zaehlung';
import { Monitoring } from './module/Monitoring';
import { Wildschaeden } from './module/Wildschaeden';
import { Aufgaben } from './module/Aufgaben';
import { Begehungsscheine } from './module/Begehungsscheine';
import { Datenimport } from './module/Datenimport';
import { EinrichtungenVollbild } from './module/Einrichtungstabelle';
import { BewegungsjagdListe, BewegungsjagdVollbild } from './bewegungsjagd/Bewegungsjagd';
// Die Karte ist groß (MapLibre) und wird erst bei Bedarf geladen
const Karte = lazy(() => import('./module/Karte'));
const ROLLEN = { inhaber: 'Inhaber/Pächter', mitjaeger: 'Mitjäger' };
const MODULE = [
    { pfad: 'karte', titel: 'Karte', text: 'Reviergrenze, Zonen, Einrichtungen, Pirschwege, Wind, Heatmap', symbol: '🗺' },
    { pfad: 'zaehlung', titel: 'Wildzählung', text: 'Zählsitzung je Zone mit Gesamtübersicht und Historie', symbol: '🔢' },
    { pfad: 'erfassung', titel: 'Einzelerfassung', text: 'Beobachtungen unterwegs, auch ohne Netz', symbol: '👁' },
    { pfad: 'abschuesse', titel: 'Abschüsse & Fänge', text: 'Strecke und Fänge mit Wildart, Geschlecht, Altersklasse', symbol: '🎯' },
    { pfad: 'wildschaeden', titel: 'Wildschäden', text: 'Schäden erfassen, Anmeldefrist im Blick', symbol: '🌾' },
    { pfad: 'aufgaben', titel: 'Aufgaben', text: 'Revierarbeiten planen und verteilen', symbol: '✅' },
    { pfad: 'bewegungsjagd', titel: 'Bewegungsjagd', text: 'Einladen, Zu- und Absagen, Stände zuweisen', symbol: '🦌' },
    { pfad: 'begehungsscheine', titel: 'Begehungsscheine', text: 'Gastjäger-Scheine ausstellen und prüfen', symbol: '📄' },
    { pfad: 'monitoring', titel: 'Monitoring', text: 'Statistik und Quervergleich im Hegering', symbol: '📈' },
    { pfad: 'zonen', titel: 'Zonen', text: 'Erfassungszonen anlegen und ordnen', symbol: '▦' },
    { pfad: 'jagdzeiten', titel: 'Jagdzeiten', text: 'Was ist heute jagdbar? Zeiten und Sonderregeln je Wildart', symbol: '' },
    { pfad: 'freigaben', titel: 'Freigaben', text: 'Wildarten für den Quervergleich freigeben', symbol: '🤝' },
    { pfad: 'import', titel: 'Datenimport', text: 'Historische Zählungen und Abschüsse aus CSV', symbol: '⬆️' },
    { pfad: 'reviermanagement', titel: 'Reviermanagement', text: 'Revier, Mitglieder & Einladungen, Kartendaten', symbol: '🏡' },
    { pfad: 'masteradmin', titel: 'Masteradmin', text: 'Hegeringe, Reviere und User im Überblick', symbol: '🛡' },
];
// Seiten ohne Revier-Kontext-Modul (Einstellungen, Reviermanagement, Masteradmin)
const SONDERSEITEN = ['einstellungen', 'reviermanagement', 'masteradmin'];
export function Home({ session }) {
    const kontext = useNutzerKontext(session.user.id);
    const [revierId, setRevierId] = useState(gemerktesRevier());
    const pfad = usePfad();
    const offen = useWarteschlange();
    const breit = useBreit();
    // Gültiges Revier wählen, sobald die Mitgliedschaften geladen sind
    useEffect(() => {
        if (kontext.laedt)
            return;
        const ids = kontext.mitgliedschaften.map((m) => m.revier.id);
        if (!revierId || !ids.includes(revierId))
            setRevierId(ids[0] ?? null);
    }, [kontext.laedt, kontext.mitgliedschaften, revierId]);
    const aktuell = useMemo(() => kontext.mitgliedschaften.find((m) => m.revier.id === revierId) ?? null, [kontext.mitgliedschaften, revierId]);
    function revierWechseln(id) {
        setRevierId(id);
        revierMerken(id);
    }
    const nachAenderung = async (neueRevierId) => {
        await kontext.neuLaden();
        if (neueRevierId)
            revierWechseln(neueRevierId);
    };
    if (kontext.laedt) {
        return _jsx("div", { className: "laden", children: "Lade Daten \u2026" });
    }
    const modul = pfad[0];
    const revierKontext = aktuell
        ? {
            revierId: aktuell.revier.id,
            revierName: aktuell.revier.name,
            flaecheHa: aktuell.revier.flaeche_ha,
            bundesland: aktuell.revier.bundesland,
            rolle: aktuell.rolle,
            istInhaber: aktuell.rolle === 'inhaber',
            userId: session.user.id,
            neuLaden: kontext.neuLaden,
        }
        : null;
    // Abgedocktes Monitoring: eigenes Fenster ohne Seitenleiste und Karte
    if (revierKontext && modul === 'monitoring' && pfad[1] === 'fenster') {
        return _jsx(MonitoringFenster, { k: revierKontext, kontext: kontext, revierId: revierId, revierWechseln: revierWechseln });
    }
    // Bewegungsjagd (Assistent/Auswertung): Vollbild ohne Seitenleiste und Navigation
    if (revierKontext && modul === 'bewegungsjagd' && pfad[1]) {
        return _jsx(BewegungsjagdVollbild, { k: revierKontext, id: pfad[1] }, `${revierKontext.revierId}-${pfad[1]}`);
    }
    // Einrichtungstabelle: Vollbild ohne Seitenleiste
    if (revierKontext && modul === 'reviermanagement' && pfad[1] === 'einrichtungen') {
        return _jsx(EinrichtungenVollbild, { k: revierKontext }, revierKontext.revierId);
    }
    // Browseransicht: Seitenleiste mit Navigation und Modulinhalt, rechts dauerhaft die Karte
    if (breit && revierKontext) {
        return (_jsx(DesktopLayout, { modul: modul ?? 'karte', unterpfad: pfad.slice(1), k: revierKontext, kontext: kontext, aktuell: aktuell, revierId: revierId, revierWechseln: revierWechseln, offen: offen, userId: session.user.id, nachAenderung: nachAenderung }));
    }
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { className: "leiste", children: [_jsxs("button", { className: "leiste-marke", onClick: () => navigieren('/'), "aria-label": "Zur \u00DCbersicht", children: [_jsx(Logo, {}), _jsx("span", { children: "Hegewerk" })] }), kontext.mitgliedschaften.length > 0 && (_jsxs("label", { className: "revier-wahl", children: [_jsx("span", { className: "visuell-versteckt", children: "Aktuelles Revier" }), _jsx("select", { value: revierId ?? '', onChange: (e) => revierWechseln(e.target.value), children: kontext.mitgliedschaften.map((m) => (_jsx("option", { value: m.revier.id, children: m.revier.name }, m.revier.id))) })] })), _jsxs("div", { className: "leiste-nutzer", children: [offen > 0 && (_jsxs("span", { className: "warteschlange", title: "Noch nicht \u00FCbertragene Erfassungen", children: [offen, " offline"] })), _jsx("button", { className: `zahnrad ${modul === 'einstellungen' ? 'aktiv' : ''}`, onClick: () => navigieren('/einstellungen'), "aria-label": "Einstellungen", title: "Einstellungen", children: _jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" })] }) })] })] }), _jsxs("main", { className: modul === 'karte' ? 'inhalt inhalt-voll' : 'inhalt', children: [kontext.fehler && _jsx(Hinweis, { art: "fehler", children: fehlertext(kontext.fehler) }), modul && SONDERSEITEN.includes(modul) ? (_jsx(Sonderseite, { modul: modul, userId: session.user.id, kontext: kontext, aktuell: aktuell, nachAenderung: nachAenderung })) : modul && revierKontext ? (_jsx(ModulInhalt, { modul: modul, unterpfad: pfad.slice(1), k: revierKontext }, `${revierKontext.revierId}-${modul}`)) : (_jsx(Start, { aktuell: aktuell, name: kontext.name, istMasteradmin: kontext.istMasteradmin, neuLaden: kontext.neuLaden, revierWechseln: revierWechseln }))] })] }));
}
const NAVIGATION = [
    { pfad: 'karte', titel: 'Karte' },
    { pfad: 'zaehlung', titel: 'Wildzählung' },
    { pfad: 'erfassung', titel: 'Einzelerfassung' },
    { pfad: 'abschuesse', titel: 'Abschüsse & Fänge' },
    { pfad: 'wildschaeden', titel: 'Wildschäden' },
    { pfad: 'aufgaben', titel: 'Aufgaben' },
    { pfad: 'bewegungsjagd', titel: 'Bewegungsjagd' },
    { pfad: 'begehungsscheine', titel: 'Begehungsscheine' },
    { pfad: 'monitoring', titel: 'Monitoring' },
    { pfad: 'zonen', titel: 'Zonen' },
    { pfad: 'jagdzeiten', titel: 'Jagdzeiten' },
    { pfad: 'freigaben', titel: 'Freigaben' },
    { pfad: 'import', titel: 'Datenimport' },
    { pfad: 'reviermanagement', titel: 'Reviermanagement' },
    { pfad: 'masteradmin', titel: 'Masteradmin' },
    { pfad: 'einstellungen', titel: 'Einstellungen' },
];
function DesktopLayout({ modul, unterpfad, k, kontext, aktuell, revierId, revierWechseln, offen, userId, nachAenderung, }) {
    const [panelEl, setPanelEl] = useState(null);
    const [eingeklappt, setEingeklappt] = useState(() => {
        try {
            return localStorage.getItem('hegewerk.menue') === 'zu';
        }
        catch {
            return false;
        }
    });
    // Nach Modulwahl klappen die übrigen Module ein, das aktive bleibt sichtbar
    const [navZu, setNavZu] = useState(true);
    const titel = NAVIGATION.find((n) => n.pfad === modul)?.titel ?? '';
    // Monitoring kann die ganze Breite einnehmen (Karte ausgeblendet) – Adresse /monitoring/voll
    const urlVoll = modul === 'monitoring' && unterpfad[0] === 'voll';
    const [gespeicherteBreite, breiteSetzen] = useModulBreite(modul);
    const breiteWaehlbar = modul !== 'karte';
    const voll = urlVoll || (breiteWaehlbar && gespeicherteBreite === 'voll');
    function einklappen(zu) {
        setEingeklappt(zu);
        try {
            localStorage.setItem('hegewerk.menue', zu ? 'zu' : 'offen');
        }
        catch {
            /* Speicher nicht verfügbar – Zustand gilt nur für diese Sitzung */
        }
    }
    return (_jsxs("div", { className: `desk ${eingeklappt && !voll ? 'desk-zu' : ''} ${voll ? 'desk-voll' : ''}`, children: [_jsxs("aside", { className: "desk-seite", children: [_jsxs("div", { className: "desk-kopf", children: [_jsxs("div", { className: "desk-marke", children: [_jsx(Logo, {}), _jsx("span", { children: "Hegewerk" }), offen > 0 && (_jsxs("span", { className: "warteschlange", title: "Noch nicht \u00FCbertragene Erfassungen", children: [offen, " offline"] })), !voll && (_jsx("button", { className: "desk-einklappen", onClick: () => einklappen(!eingeklappt), "aria-label": eingeklappt ? 'Menü ausklappen' : 'Menü einklappen', "aria-expanded": !eingeklappt, title: eingeklappt ? 'Menü ausklappen' : 'Menü einklappen', children: _jsx(Symbol, { name: eingeklappt ? 'ausklappen' : 'einklappen' }) }))] }), kontext.mitgliedschaften.length > 1 ? (_jsx("select", { className: "desk-revier", "aria-label": "Aktuelles Revier", value: revierId ?? '', onChange: (e) => revierWechseln(e.target.value), children: kontext.mitgliedschaften.map((m) => (_jsx("option", { value: m.revier.id, children: m.revier.name }, m.revier.id))) })) : (_jsx("div", { className: "desk-revier-name", children: k.revierName })), _jsxs("h1", { children: [titel, breiteWaehlbar && (_jsx("span", { className: "breite-wahl", children: _jsx(Segmente, { label: "Modulbreite", optionen: [{ wert: 'drittel', label: '1/3' }, { wert: 'voll', label: 'Voll' }], wert: voll ? 'voll' : 'drittel', onAendern: (b) => {
                                                breiteSetzen(b);
                                                if (b === 'drittel' && urlVoll)
                                                    navigieren('/monitoring');
                                            } }) }))] })] }), _jsx("nav", { className: `desk-nav ${navZu && (voll || !eingeklappt) ? 'desk-nav-zu' : ''}`, "aria-label": "Module", children: NAVIGATION.filter((n) => n.pfad !== 'masteradmin' || kontext.istMasteradmin).map((n) => (_jsxs("button", { "aria-current": modul === n.pfad, title: n.titel, onClick: () => {
                                // Klick auf das aktive Modul blendet die Menüübersicht ein bzw. wieder aus
                                if (modul === n.pfad && (voll || !eingeklappt)) {
                                    setNavZu((z) => !z);
                                    return;
                                }
                                // Im eingeklappten Menü öffnet ein Modul die Seitenleiste wieder (die Karte braucht sie nicht)
                                if (eingeklappt && n.pfad !== 'karte')
                                    einklappen(false);
                                setNavZu(true);
                                navigieren(`/${n.pfad}`);
                            }, children: [_jsx(Symbol, { name: n.pfad }), _jsx("span", { children: n.titel })] }, n.pfad))) }), _jsx("div", { className: "desk-panel", ref: setPanelEl, children: _jsxs(EingebettetKontext.Provider, { value: true, children: [kontext.fehler && _jsx(Hinweis, { art: "fehler", children: fehlertext(kontext.fehler) }), modul === 'karte' ? null : SONDERSEITEN.includes(modul) ? (_jsx(Sonderseite, { modul: modul, userId: userId, kontext: kontext, aktuell: aktuell, nachAenderung: nachAenderung })) : (_jsx(ModulInhalt, { modul: modul, unterpfad: unterpfad, k: k, breit: true }, `${k.revierId}-${modul}`))] }) })] }), _jsx("main", { className: "desk-karte", "aria-hidden": voll, children: _jsx(Suspense, { fallback: _jsx("div", { className: "laden", children: "Karte wird geladen \u2026" }), children: _jsx(Karte, { k: k, eingebettet: true, panelZiel: modul === 'karte' ? panelEl : null, aktualisierung: `${modul}/${unterpfad.join('/')}` }, k.revierId) }) })] }));
}
function Sonderseite({ modul, userId, kontext, aktuell, nachAenderung, }) {
    if (modul === 'reviermanagement')
        return _jsx(Reviermanagement, { userId: userId, aktuell: aktuell, nachAenderung: nachAenderung });
    if (modul === 'masteradmin')
        return kontext.istMasteradmin ? _jsx(Masteradmin, { userId: userId, nachAenderung: nachAenderung }) : _jsx(Hinweis, { children: "Diese Seite gibt es nicht." });
    return _jsx(Einstellungen, { kontext: kontext, nachAenderung: nachAenderung });
}
function ModulInhalt({ modul, unterpfad, k, breit = false }) {
    switch (modul) {
        case 'jagdzeiten':
            return _jsx(Jagdzeiten, { k: k, unterpfad: unterpfad });
        case 'freigaben':
            return _jsx(Freigaben, { k: k });
        case 'zonen':
            return _jsx(Zonen, { k: k });
        case 'abschuesse':
            return _jsx(Abschuesse, { k: k, unterpfad: unterpfad });
        case 'erfassung':
            return _jsx(Erfassung, { k: k });
        case 'zaehlung':
            return _jsx(Zaehlung, { k: k, sitzungId: unterpfad[0] ?? null });
        case 'monitoring':
            return _jsx(Monitoring, { k: k, breit: breit });
        case 'wildschaeden':
            return _jsx(Wildschaeden, { k: k });
        case 'aufgaben':
            return _jsx(Aufgaben, { k: k });
        case 'bewegungsjagd':
            return _jsx(BewegungsjagdListe, { k: k });
        case 'begehungsscheine':
            return _jsx(Begehungsscheine, { k: k });
        case 'import':
            return _jsx(Datenimport, { k: k });
        case 'karte':
            return (_jsx(Suspense, { fallback: _jsx("div", { className: "laden", children: "Karte wird geladen \u2026" }), children: _jsx(Karte, { k: k }) }));
        default:
            return _jsx(Hinweis, { children: "Diese Seite gibt es nicht." });
    }
}
function MonitoringFenster({ k, kontext, revierId, revierWechseln, }) {
    return (_jsxs("div", { className: "monitoring-fenster", children: [_jsxs("header", { className: "monitoring-fenster-kopf", children: [_jsx(Logo, {}), _jsx("strong", { children: "Hegewerk Monitoring" }), kontext.mitgliedschaften.length > 1 ? (_jsx("select", { "aria-label": "Aktuelles Revier", value: revierId ?? '', onChange: (e) => revierWechseln(e.target.value), children: kontext.mitgliedschaften.map((m) => (_jsx("option", { value: m.revier.id, children: m.revier.name }, m.revier.id))) })) : (_jsx("span", { children: k.revierName })), _jsx("span", { className: "abstandhalter" }), _jsx("button", { className: "knopf knopf-sekundaer klein", onClick: () => window.close(), title: "Fenster schlie\u00DFen", children: "Fenster schlie\u00DFen" }), _jsx("button", { className: "knopf knopf-ghost klein", onClick: () => navigieren('/monitoring'), children: "Zur\u00FCck zur App" })] }), _jsx("main", { className: "monitoring-fenster-inhalt", children: _jsx(Monitoring, { k: k, breit: true, abgedockt: true }, k.revierId) })] }));
}
function Start({ aktuell, name, istMasteradmin, neuLaden, revierWechseln, }) {
    if (!aktuell) {
        return (_jsxs(_Fragment, { children: [_jsx(Hinweis, { children: istMasteradmin
                        ? 'Du bist noch keinem Revier zugeordnet. Reviere legst du im Bereich Masteradmin an.'
                        : 'Du bist noch keinem Revier zugeordnet. Löse einen Einladungscode ein, den du vom Revierinhaber bekommen hast.' }), _jsx(CodeEinloesen, { onEingeloest: async (neueRevierId) => {
                        await neuLaden();
                        if (neueRevierId)
                            revierWechseln(neueRevierId);
                    } }), istMasteradmin && (_jsx(Knopf, { variante: "sekundaer", onClick: () => navigieren('/masteradmin'), children: "Zum Masteradmin" }))] }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "start-kopf", children: [_jsx("h1", { children: aktuell.revier.name }), _jsxs("p", { children: [[aktuell.revier.hegering, aktuell.revier.flaeche_ha ? `${aktuell.revier.flaeche_ha.toLocaleString('de-DE')} ha` : null, ROLLEN[aktuell.rolle]]
                                .filter(Boolean)
                                .join(' · '), name ? ` · ${name}` : ''] })] }), _jsx("section", { children: _jsx("div", { className: "kacheln", children: MODULE.filter((m) => m.pfad !== 'masteradmin' || istMasteradmin).map((m) => (_jsxs("button", { className: "kachel", onClick: () => navigieren(`/${m.pfad}`), children: [_jsx("span", { className: "kachel-symbol", "aria-hidden": "true", children: _jsx(Symbol, { name: m.pfad, className: "symbol gross" }) }), _jsx("strong", { children: m.titel }), _jsx("span", { children: m.text })] }, m.pfad))) }) })] }));
}
