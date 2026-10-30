import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fehlertext } from '../lib/fehler';
import { gemerktesRevier, revierMerken, useNutzerKontext, type Mitgliedschaft } from '../lib/useNutzerKontext';
import { navigieren, usePfad } from '../lib/router';
import { useWarteschlange } from '../lib/offline';
import { EingebettetKontext, Hinweis, Knopf } from '../components/ui';
import { Symbol } from '../components/symbole';
import { useBreit } from '../lib/useBreit';
import type { NutzerKontext } from '../lib/useNutzerKontext';
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
import { BewegungsjagdListe, BewegungsjagdVollbild } from './bewegungsjagd/Bewegungsjagd';
import type { RevierKontext } from './module/kontext';

// Die Karte ist groß (MapLibre) und wird erst bei Bedarf geladen
const Karte = lazy(() => import('./module/Karte'));

const ROLLEN = { inhaber: 'Inhaber/Pächter', mitjaeger: 'Mitjäger' } as const;

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

export function Home({ session }: { session: Session }) {
  const kontext = useNutzerKontext(session.user.id);
  const [revierId, setRevierId] = useState<string | null>(gemerktesRevier());
  const pfad = usePfad();
  const offen = useWarteschlange();
  const breit = useBreit();

  // Gültiges Revier wählen, sobald die Mitgliedschaften geladen sind
  useEffect(() => {
    if (kontext.laedt) return;
    const ids = kontext.mitgliedschaften.map((m) => m.revier.id);
    if (!revierId || !ids.includes(revierId)) setRevierId(ids[0] ?? null);
  }, [kontext.laedt, kontext.mitgliedschaften, revierId]);

  const aktuell = useMemo(
    () => kontext.mitgliedschaften.find((m) => m.revier.id === revierId) ?? null,
    [kontext.mitgliedschaften, revierId],
  );

  function revierWechseln(id: string) {
    setRevierId(id);
    revierMerken(id);
  }
  const nachAenderung = async (neueRevierId?: string | null) => {
    await kontext.neuLaden();
    if (neueRevierId) revierWechseln(neueRevierId);
  };

  if (kontext.laedt) {
    return <div className="laden">Lade Daten …</div>;
  }

  const modul = pfad[0];
  const revierKontext: RevierKontext | null = aktuell
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
    return <MonitoringFenster k={revierKontext} kontext={kontext} revierId={revierId} revierWechseln={revierWechseln} />;
  }

  // Bewegungsjagd (Assistent/Auswertung): Vollbild ohne Seitenleiste und Navigation
  if (revierKontext && modul === 'bewegungsjagd' && pfad[1]) {
    return <BewegungsjagdVollbild key={`${revierKontext.revierId}-${pfad[1]}`} k={revierKontext} id={pfad[1]} />;
  }

  // Browseransicht: Seitenleiste mit Navigation und Modulinhalt, rechts dauerhaft die Karte
  if (breit && revierKontext) {
    return (
      <DesktopLayout
        modul={modul ?? 'karte'}
        unterpfad={pfad.slice(1)}
        k={revierKontext}
        kontext={kontext}
        aktuell={aktuell}
        revierId={revierId}
        revierWechseln={revierWechseln}
        offen={offen}
        userId={session.user.id}
        nachAenderung={nachAenderung}
      />
    );
  }

  return (
    <div className="app">
      <header className="leiste">
        <button className="leiste-marke" onClick={() => navigieren('/')} aria-label="Zur Übersicht">
          <Logo />
          <span>Hegewerk</span>
        </button>

        {kontext.mitgliedschaften.length > 0 && (
          <label className="revier-wahl">
            <span className="visuell-versteckt">Aktuelles Revier</span>
            <select value={revierId ?? ''} onChange={(e) => revierWechseln(e.target.value)}>
              {kontext.mitgliedschaften.map((m) => (
                <option key={m.revier.id} value={m.revier.id}>
                  {m.revier.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="leiste-nutzer">
          {offen > 0 && (
            <span className="warteschlange" title="Noch nicht übertragene Erfassungen">
              {offen} offline
            </span>
          )}
          <button
            className={`zahnrad ${modul === 'einstellungen' ? 'aktiv' : ''}`}
            onClick={() => navigieren('/einstellungen')}
            aria-label="Einstellungen"
            title="Einstellungen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      <main className={modul === 'karte' ? 'inhalt inhalt-voll' : 'inhalt'}>
        {kontext.fehler && <Hinweis art="fehler">{fehlertext(kontext.fehler)}</Hinweis>}

        {modul && SONDERSEITEN.includes(modul) ? (
          <Sonderseite modul={modul} userId={session.user.id} kontext={kontext} aktuell={aktuell} nachAenderung={nachAenderung} />
        ) : modul && revierKontext ? (
          <ModulInhalt key={`${revierKontext.revierId}-${modul}`} modul={modul} unterpfad={pfad.slice(1)} k={revierKontext} />
        ) : (
          <Start
            aktuell={aktuell}
            name={kontext.name}
            istMasteradmin={kontext.istMasteradmin}
            neuLaden={kontext.neuLaden}
            revierWechseln={revierWechseln}
          />
        )}
      </main>
    </div>
  );
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

function DesktopLayout({
  modul,
  unterpfad,
  k,
  kontext,
  aktuell,
  revierId,
  revierWechseln,
  offen,
  userId,
  nachAenderung,
}: {
  modul: string;
  unterpfad: string[];
  k: RevierKontext;
  kontext: NutzerKontext;
  aktuell: Mitgliedschaft | null;
  revierId: string | null;
  revierWechseln: (id: string) => void;
  offen: number;
  userId: string;
  nachAenderung: (neueRevierId?: string | null) => Promise<void>;
}) {
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const [eingeklappt, setEingeklappt] = useState(() => {
    try {
      return localStorage.getItem('hegewerk.menue') === 'zu';
    } catch {
      return false;
    }
  });
  // Nach Modulwahl klappen die übrigen Module ein, das aktive bleibt sichtbar
  const [navZu, setNavZu] = useState(true);
  const navUmschalten = () => setNavZu((z) => !z);
  const titel = NAVIGATION.find((n) => n.pfad === modul)?.titel ?? '';
  // Monitoring kann die ganze Breite einnehmen (Karte ausgeblendet) – Adresse /monitoring/voll
  const urlVoll = modul === 'monitoring' && unterpfad[0] === 'voll';
  const [gespeicherteBreite, breiteSetzen] = useModulBreite(modul);
  const breiteWaehlbar = modul !== 'karte';
  const voll = urlVoll || (breiteWaehlbar && gespeicherteBreite === 'voll');

  function einklappen(zu: boolean) {
    setEingeklappt(zu);
    try {
      localStorage.setItem('hegewerk.menue', zu ? 'zu' : 'offen');
    } catch {
      /* Speicher nicht verfügbar – Zustand gilt nur für diese Sitzung */
    }
  }

  return (
    <div className={`desk ${eingeklappt && !voll ? 'desk-zu' : ''} ${voll ? 'desk-voll' : ''}`}>
      <aside className="desk-seite">
        <div className="desk-kopf">
          <div className="desk-marke">
            <Logo />
            <span>Hegewerk</span>
            {offen > 0 && (
              <span className="warteschlange" title="Noch nicht übertragene Erfassungen">
                {offen} offline
              </span>
            )}
            {!voll && (
              <button
                className="desk-einklappen"
                onClick={() => einklappen(!eingeklappt)}
                aria-label={eingeklappt ? 'Menü ausklappen' : 'Menü einklappen'}
                aria-expanded={!eingeklappt}
                title={eingeklappt ? 'Menü ausklappen' : 'Menü einklappen'}
              >
                <Symbol name={eingeklappt ? 'ausklappen' : 'einklappen'} />
              </button>
            )}
          </div>
          {kontext.mitgliedschaften.length > 1 ? (
            <select className="desk-revier" aria-label="Aktuelles Revier" value={revierId ?? ''} onChange={(e) => revierWechseln(e.target.value)}>
              {kontext.mitgliedschaften.map((m) => (
                <option key={m.revier.id} value={m.revier.id}>
                  {m.revier.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="desk-revier-name">{k.revierName}</div>
          )}
          <h1>
            {titel}
            {breiteWaehlbar && (
              <span className="breite-wahl">
                <Segmente<'drittel' | 'voll'>
                  label="Modulbreite"
                  optionen={[{ wert: 'drittel', label: '1/3' }, { wert: 'voll', label: 'Voll' }]}
                  wert={voll ? 'voll' : 'drittel'}
                  onAendern={(b) => {
                    breiteSetzen(b);
                    if (b === 'drittel' && urlVoll) navigieren('/monitoring');
                  }}
                />
              </span>
            )}
          </h1>
        </div>

        {(voll || !eingeklappt) && (
          <button className="desk-nav-schalter" onClick={navUmschalten} aria-expanded={!navZu} aria-controls="desk-nav">
            <span>{navZu ? 'Alle Module zeigen' : 'Nur aktives Modul'}</span>
            <span aria-hidden="true">{navZu ? '▾' : '▴'}</span>
          </button>
        )}
        <nav id="desk-nav" className={`desk-nav ${navZu && (voll || !eingeklappt) ? 'desk-nav-zu' : ''}`} aria-label="Module">
          {NAVIGATION.filter((n) => n.pfad !== 'masteradmin' || kontext.istMasteradmin).map((n) => (
            <button
              key={n.pfad}
              aria-current={modul === n.pfad}
              title={n.titel}
              onClick={() => {
                // Im eingeklappten Menü öffnet ein Modul die Seitenleiste wieder (die Karte braucht sie nicht)
                if (eingeklappt && n.pfad !== 'karte') einklappen(false);
                setNavZu(true);
                navigieren(`/${n.pfad}`);
              }}
            >
              <Symbol name={n.pfad} />
              <span>{n.titel}</span>
            </button>
          ))}
        </nav>

        <div className="desk-panel" ref={setPanelEl}>
          <EingebettetKontext.Provider value={true}>
            {kontext.fehler && <Hinweis art="fehler">{fehlertext(kontext.fehler)}</Hinweis>}
            {modul === 'karte' ? null : SONDERSEITEN.includes(modul) ? (
              <Sonderseite modul={modul} userId={userId} kontext={kontext} aktuell={aktuell} nachAenderung={nachAenderung} />
            ) : (
              <ModulInhalt key={`${k.revierId}-${modul}`} modul={modul} unterpfad={unterpfad} k={k} breit />
            )}
          </EingebettetKontext.Provider>
        </div>
      </aside>

      <main className="desk-karte" aria-hidden={voll}>
        <Suspense fallback={<div className="laden">Karte wird geladen …</div>}>
          <Karte
            key={k.revierId}
            k={k}
            eingebettet
            panelZiel={modul === 'karte' ? panelEl : null}
            aktualisierung={`${modul}/${unterpfad.join('/')}`}
          />
        </Suspense>
      </main>
    </div>
  );
}

function Sonderseite({
  modul,
  userId,
  kontext,
  aktuell,
  nachAenderung,
}: {
  modul: string;
  userId: string;
  kontext: NutzerKontext;
  aktuell: Mitgliedschaft | null;
  nachAenderung: (neueRevierId?: string | null) => Promise<void>;
}) {
  if (modul === 'reviermanagement') return <Reviermanagement userId={userId} aktuell={aktuell} nachAenderung={nachAenderung} />;
  if (modul === 'masteradmin') return kontext.istMasteradmin ? <Masteradmin userId={userId} nachAenderung={nachAenderung} /> : <Hinweis>Diese Seite gibt es nicht.</Hinweis>;
  return <Einstellungen kontext={kontext} nachAenderung={nachAenderung} />;
}

function ModulInhalt({ modul, unterpfad, k, breit = false }: { modul: string; unterpfad: string[]; k: RevierKontext; breit?: boolean }) {
  switch (modul) {
    case 'jagdzeiten':
      return <Jagdzeiten k={k} unterpfad={unterpfad} />;
    case 'freigaben':
      return <Freigaben k={k} />;
    case 'zonen':
      return <Zonen k={k} />;
    case 'abschuesse':
      return <Abschuesse k={k} unterpfad={unterpfad} />;
    case 'erfassung':
      return <Erfassung k={k} />;
    case 'zaehlung':
      return <Zaehlung k={k} sitzungId={unterpfad[0] ?? null} />;
    case 'monitoring':
      return <Monitoring k={k} breit={breit} />;
    case 'wildschaeden':
      return <Wildschaeden k={k} />;
    case 'aufgaben':
      return <Aufgaben k={k} />;
    case 'bewegungsjagd':
      return <BewegungsjagdListe k={k} />;
    case 'begehungsscheine':
      return <Begehungsscheine k={k} />;
    case 'import':
      return <Datenimport k={k} />;
    case 'karte':
      return (
        <Suspense fallback={<div className="laden">Karte wird geladen …</div>}>
          <Karte k={k} />
        </Suspense>
      );
    default:
      return <Hinweis>Diese Seite gibt es nicht.</Hinweis>;
  }
}

function MonitoringFenster({
  k,
  kontext,
  revierId,
  revierWechseln,
}: {
  k: RevierKontext;
  kontext: NutzerKontext;
  revierId: string | null;
  revierWechseln: (id: string) => void;
}) {
  return (
    <div className="monitoring-fenster">
      <header className="monitoring-fenster-kopf">
        <Logo />
        <strong>Hegewerk Monitoring</strong>
        {kontext.mitgliedschaften.length > 1 ? (
          <select aria-label="Aktuelles Revier" value={revierId ?? ''} onChange={(e) => revierWechseln(e.target.value)}>
            {kontext.mitgliedschaften.map((m) => (
              <option key={m.revier.id} value={m.revier.id}>
                {m.revier.name}
              </option>
            ))}
          </select>
        ) : (
          <span>{k.revierName}</span>
        )}
        <span className="abstandhalter" />
        <button className="knopf knopf-sekundaer klein" onClick={() => window.close()} title="Fenster schließen">
          Fenster schließen
        </button>
        <button className="knopf knopf-ghost klein" onClick={() => navigieren('/monitoring')}>
          Zurück zur App
        </button>
      </header>
      <main className="monitoring-fenster-inhalt">
        <Monitoring key={k.revierId} k={k} breit abgedockt />
      </main>
    </div>
  );
}

function Start({
  aktuell,
  name,
  istMasteradmin,
  neuLaden,
  revierWechseln,
}: {
  aktuell: Mitgliedschaft | null;
  name: string;
  istMasteradmin: boolean;
  neuLaden: () => Promise<void>;
  revierWechseln: (id: string) => void;
}) {
  if (!aktuell) {
    return (
      <>
        <Hinweis>
          {istMasteradmin
            ? 'Du bist noch keinem Revier zugeordnet. Reviere legst du im Bereich Masteradmin an.'
            : 'Du bist noch keinem Revier zugeordnet. Löse einen Einladungscode ein, den du vom Revierinhaber bekommen hast.'}
        </Hinweis>
        <CodeEinloesen
          onEingeloest={async (neueRevierId) => {
            await neuLaden();
            if (neueRevierId) revierWechseln(neueRevierId);
          }}
        />
        {istMasteradmin && (
          <Knopf variante="sekundaer" onClick={() => navigieren('/masteradmin')}>
            Zum Masteradmin
          </Knopf>
        )}
      </>
    );
  }

  return (
    <>
      <header className="start-kopf">
        <h1>{aktuell.revier.name}</h1>
        <p>
          {[aktuell.revier.hegering, aktuell.revier.flaeche_ha ? `${aktuell.revier.flaeche_ha.toLocaleString('de-DE')} ha` : null, ROLLEN[aktuell.rolle]]
            .filter(Boolean)
            .join(' · ')}
          {name ? ` · ${name}` : ''}
        </p>
      </header>
      <section>
        <div className="kacheln">
          {MODULE.filter((m) => m.pfad !== 'masteradmin' || istMasteradmin).map((m) => (
            <button key={m.pfad} className="kachel" onClick={() => navigieren(`/${m.pfad}`)}>
              <span className="kachel-symbol" aria-hidden="true">
                <Symbol name={m.pfad} className="symbol gross" />
              </span>
              <strong>{m.titel}</strong>
              <span>{m.text}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
