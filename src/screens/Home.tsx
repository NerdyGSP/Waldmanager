import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fehlertext } from '../lib/fehler';
import { supabase } from '../lib/supabase';
import { gemerkterBetrieb, betriebMerken, useNutzerKontext, type Mitgliedschaft } from '../lib/useNutzerKontext';
import { navigieren, usePfad } from '../lib/router';
import { useWarteschlange } from '../lib/offline';
import { EingebettetKontext, Hinweis, Knopf } from '../components/ui';
import { Symbol } from '../components/symbole';
import { useBreit } from '../lib/useBreit';
import type { NutzerKontext } from '../lib/useNutzerKontext';
import { Logo } from './AuthScreen';
import { Betriebsverwaltung, CodeEinloesen, Einstellungen } from './Einstellungen';
import { Masteradmin } from './Masteradmin';
import { useModulBreite } from '../lib/modulBreite';
import { Segmente } from '../components/ui';
import { Bestaende } from './module/Bestaende';
import type { BetriebKontext } from './module/kontext';

// Die Karte ist groß (MapLibre) und wird erst bei Bedarf geladen
const Karte = lazy(() => import('./module/Karte'));

const ROLLEN = { inhaber: 'Inhaber', mitarbeiter: 'Mitarbeiter' } as const;

const MODULE = [
  { pfad: 'karte', titel: 'Karte', text: 'Betriebsgrenze und Bestände auf Karte und Luftbild', symbol: 'karte' },
  { pfad: 'bestaende', titel: 'Bestände', text: 'Bestände anlegen, Baumarten, Alter und Vorrat pflegen', symbol: 'zonen' },
  { pfad: 'forstbetrieb', titel: 'Forstbetrieb', text: 'Betrieb, Mitglieder und Einladungen', symbol: 'reviermanagement' },
  { pfad: 'masteradmin', titel: 'Masteradmin', text: 'Forstbetriebe und Nutzer im Überblick', symbol: 'masteradmin' },
];

// Seiten ohne Betriebs-Kontext-Modul (Einstellungen, Forstbetrieb, Masteradmin)
const SONDERSEITEN = ['einstellungen', 'forstbetrieb', 'masteradmin'];

export function Home({ session }: { session: Session }) {
  const kontext = useNutzerKontext(session.user.id);

  // Letzte Aktivität melden (Server begrenzt auf einmal pro Stunde)
  useEffect(() => {
    const melden = () => {
      if (document.visibilityState === 'visible') void supabase.rpc('aktivitaet_melden');
    };
    melden();
    document.addEventListener('visibilitychange', melden);
    return () => document.removeEventListener('visibilitychange', melden);
  }, []);
  const [betriebId, setBetriebId] = useState<string | null>(gemerkterBetrieb());
  const pfad = usePfad();
  const offen = useWarteschlange();
  const breit = useBreit();

  // Gültigen Betrieb wählen, sobald die Mitgliedschaften geladen sind
  useEffect(() => {
    if (kontext.laedt) return;
    const ids = kontext.mitgliedschaften.map((m) => m.betrieb.id);
    if (!betriebId || !ids.includes(betriebId)) setBetriebId(ids[0] ?? null);
  }, [kontext.laedt, kontext.mitgliedschaften, betriebId]);

  const aktuell = useMemo(
    () => kontext.mitgliedschaften.find((m) => m.betrieb.id === betriebId) ?? null,
    [kontext.mitgliedschaften, betriebId],
  );

  function betriebWechseln(id: string) {
    setBetriebId(id);
    betriebMerken(id);
  }
  const nachAenderung = async (neueBetriebId?: string | null) => {
    await kontext.neuLaden();
    if (neueBetriebId) betriebWechseln(neueBetriebId);
  };

  if (kontext.laedt) {
    return <div className="laden">Lade Daten …</div>;
  }

  const modul = pfad[0];
  const betriebKontext: BetriebKontext | null = aktuell
    ? {
        betriebId: aktuell.betrieb.id,
        betriebName: aktuell.betrieb.name,
        flaecheHa: aktuell.betrieb.flaeche_ha,
        bundesland: aktuell.betrieb.bundesland,
        rolle: aktuell.rolle,
        istInhaber: aktuell.rolle === 'inhaber',
        userId: session.user.id,
        neuLaden: kontext.neuLaden,
      }
    : null;

  // Browseransicht: Seitenleiste mit Navigation und Modulinhalt, rechts dauerhaft die Karte
  if (breit && betriebKontext) {
    return (
      <DesktopLayout
        modul={modul ?? 'karte'}
        unterpfad={pfad.slice(1)}
        k={betriebKontext}
        kontext={kontext}
        aktuell={aktuell}
        betriebId={betriebId}
        betriebWechseln={betriebWechseln}
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
          <span>Waldmanager</span>
        </button>

        {kontext.mitgliedschaften.length > 0 && (
          <label className="revier-wahl">
            <span className="visuell-versteckt">Aktueller Forstbetrieb</span>
            <select value={betriebId ?? ''} onChange={(e) => betriebWechseln(e.target.value)}>
              {kontext.mitgliedschaften.map((m) => (
                <option key={m.betrieb.id} value={m.betrieb.id}>
                  {m.betrieb.name}
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
        ) : modul && betriebKontext ? (
          <ModulInhalt key={`${betriebKontext.betriebId}-${modul}`} modul={modul} unterpfad={pfad.slice(1)} k={betriebKontext} />
        ) : (
          <Start
            aktuell={aktuell}
            name={kontext.name}
            istMasteradmin={kontext.istMasteradmin}
            neuLaden={kontext.neuLaden}
            betriebWechseln={betriebWechseln}
          />
        )}
      </main>
    </div>
  );
}

const NAVIGATION = [
  { pfad: 'karte', titel: 'Karte', symbol: 'karte' },
  { pfad: 'bestaende', titel: 'Bestände', symbol: 'zonen' },
  { pfad: 'forstbetrieb', titel: 'Forstbetrieb', symbol: 'reviermanagement' },
  { pfad: 'masteradmin', titel: 'Masteradmin', symbol: 'masteradmin' },
  { pfad: 'einstellungen', titel: 'Einstellungen', symbol: 'einstellungen' },
];

function DesktopLayout({
  modul,
  unterpfad,
  k,
  kontext,
  aktuell,
  betriebId,
  betriebWechseln,
  offen,
  userId,
  nachAenderung,
}: {
  modul: string;
  unterpfad: string[];
  k: BetriebKontext;
  kontext: NutzerKontext;
  aktuell: Mitgliedschaft | null;
  betriebId: string | null;
  betriebWechseln: (id: string) => void;
  offen: number;
  userId: string;
  nachAenderung: (neueBetriebId?: string | null) => Promise<void>;
}) {
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const [eingeklappt, setEingeklappt] = useState(() => {
    try {
      return localStorage.getItem('waldmanager.menue') === 'zu';
    } catch {
      return false;
    }
  });
  // Nach Modulwahl klappen die übrigen Module ein, das aktive bleibt sichtbar
  const [navZu, setNavZu] = useState(true);
  const titel = NAVIGATION.find((n) => n.pfad === modul)?.titel ?? '';
  const urlVoll = false;
  const [gespeicherteBreite, breiteSetzen] = useModulBreite(modul);
  const breiteWaehlbar = modul !== 'karte';
  const voll = urlVoll || (breiteWaehlbar && gespeicherteBreite === 'voll');

  function einklappen(zu: boolean) {
    setEingeklappt(zu);
    try {
      localStorage.setItem('waldmanager.menue', zu ? 'zu' : 'offen');
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
            <span>Waldmanager</span>
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
            <select className="desk-revier" aria-label="Aktueller Forstbetrieb" value={betriebId ?? ''} onChange={(e) => betriebWechseln(e.target.value)}>
              {kontext.mitgliedschaften.map((m) => (
                <option key={m.betrieb.id} value={m.betrieb.id}>
                  {m.betrieb.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="desk-revier-name">{k.betriebName}</div>
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
                  }}
                />
              </span>
            )}
          </h1>
        </div>

        <nav className={`desk-nav ${navZu && (voll || !eingeklappt) ? 'desk-nav-zu' : ''}`} aria-label="Module">
          {NAVIGATION.filter((n) => n.pfad !== 'masteradmin' || kontext.istMasteradmin).map((n) => (
            <button
              key={n.pfad}
              aria-current={modul === n.pfad}
              title={n.titel}
              onClick={() => {
                // Klick auf das aktive Modul blendet die Menüübersicht ein bzw. wieder aus
                if (modul === n.pfad && (voll || !eingeklappt)) {
                  setNavZu((z) => !z);
                  return;
                }
                // Im eingeklappten Menü öffnet ein Modul die Seitenleiste wieder (die Karte braucht sie nicht)
                if (eingeklappt && n.pfad !== 'karte') einklappen(false);
                setNavZu(true);
                navigieren(`/${n.pfad}`);
              }}
            >
              <Symbol name={n.symbol} />
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
              <ModulInhalt key={`${k.betriebId}-${modul}`} modul={modul} unterpfad={unterpfad} k={k} />
            )}
          </EingebettetKontext.Provider>
        </div>
      </aside>

      <main className="desk-karte" aria-hidden={voll}>
        <Suspense fallback={<div className="laden">Karte wird geladen …</div>}>
          <Karte
            key={k.betriebId}
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
  nachAenderung: (neueBetriebId?: string | null) => Promise<void>;
}) {
  if (modul === 'forstbetrieb') return <Betriebsverwaltung userId={userId} aktuell={aktuell} nachAenderung={nachAenderung} />;
  if (modul === 'masteradmin') return kontext.istMasteradmin ? <Masteradmin userId={userId} nachAenderung={nachAenderung} /> : <Hinweis>Diese Seite gibt es nicht.</Hinweis>;
  return <Einstellungen kontext={kontext} nachAenderung={nachAenderung} />;
}

function ModulInhalt({ modul, unterpfad, k }: { modul: string; unterpfad: string[]; k: BetriebKontext }) {
  switch (modul) {
    case 'bestaende':
      return <Bestaende k={k} unterpfad={unterpfad} />;
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

function Start({
  aktuell,
  name,
  istMasteradmin,
  neuLaden,
  betriebWechseln,
}: {
  aktuell: Mitgliedschaft | null;
  name: string;
  istMasteradmin: boolean;
  neuLaden: () => Promise<void>;
  betriebWechseln: (id: string) => void;
}) {
  if (!aktuell) {
    return (
      <>
        <Hinweis>
          {istMasteradmin
            ? 'Du bist noch keinem Forstbetrieb zugeordnet. Forstbetriebe legst du im Bereich Masteradmin an.'
            : 'Du bist noch keinem Forstbetrieb zugeordnet. Löse einen Einladungscode ein, den du vom Inhaber bekommen hast.'}
        </Hinweis>
        <CodeEinloesen
          onEingeloest={async (neueBetriebId) => {
            await neuLaden();
            if (neueBetriebId) betriebWechseln(neueBetriebId);
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
        <h1>{aktuell.betrieb.name}</h1>
        <p>
          {[aktuell.betrieb.flaeche_ha ? `${aktuell.betrieb.flaeche_ha.toLocaleString('de-DE')} ha` : null, ROLLEN[aktuell.rolle]]
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
                <Symbol name={m.symbol} className="symbol gross" />
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
