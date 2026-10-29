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
import { CodeEinloesen, Einstellungen } from './Einstellungen';
import { Freigaben } from './module/Freigaben';
import { Zonen } from './module/Zonen';
import { Abschuesse } from './module/Abschuesse';
import { Erfassung } from './module/Erfassung';
import { Zaehlung } from './module/Zaehlung';
import { Monitoring } from './module/Monitoring';
import type { RevierKontext } from './module/kontext';

// Die Karte ist groß (MapLibre) und wird erst bei Bedarf geladen
const Karte = lazy(() => import('./module/Karte'));

const ROLLEN = { inhaber: 'Inhaber/Pächter', mitjaeger: 'Mitjäger' } as const;

const MODULE = [
  { pfad: 'karte', titel: 'Karte', text: 'Reviergrenze, Zonen, Einrichtungen, Pirschwege, Wind, Heatmap', symbol: '🗺' },
  { pfad: 'zaehlung', titel: 'Wildzählung', text: 'Zählsitzung je Zone mit Gesamtübersicht und Historie', symbol: '🔢' },
  { pfad: 'erfassung', titel: 'Einzelerfassung', text: 'Beobachtungen unterwegs, auch ohne Netz', symbol: '👁' },
  { pfad: 'abschuesse', titel: 'Abschüsse', text: 'Strecke mit Wildart, Geschlecht, Altersklasse', symbol: '🎯' },
  { pfad: 'monitoring', titel: 'Monitoring', text: 'Statistik und Quervergleich im Hegering', symbol: '📈' },
  { pfad: 'zonen', titel: 'Zonen', text: 'Erfassungszonen anlegen und ordnen', symbol: '▦' },
  { pfad: 'freigaben', titel: 'Freigaben', text: 'Wildarten für den Quervergleich freigeben', symbol: '🤝' },
];

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

  if (kontext.laedt) {
    return <div className="laden">Lade Daten …</div>;
  }

  const modul = pfad[0];
  const revierKontext: RevierKontext | null = aktuell
    ? {
        revierId: aktuell.revier.id,
        revierName: aktuell.revier.name,
        flaecheHa: aktuell.revier.flaeche_ha,
        rolle: aktuell.rolle,
        istInhaber: aktuell.rolle === 'inhaber',
        userId: session.user.id,
        neuLaden: kontext.neuLaden,
      }
    : null;

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

        {modul === 'einstellungen' ? (
          <Einstellungen userId={session.user.id} kontext={kontext} aktuell={aktuell} revierWechseln={revierWechseln} />
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
  { pfad: 'abschuesse', titel: 'Abschüsse' },
  { pfad: 'monitoring', titel: 'Monitoring' },
  { pfad: 'zonen', titel: 'Zonen' },
  { pfad: 'freigaben', titel: 'Freigaben' },
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
}) {
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const titel = NAVIGATION.find((n) => n.pfad === modul)?.titel ?? '';

  return (
    <div className="desk">
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
          <h1>{titel}</h1>
        </div>

        <nav className="desk-nav" aria-label="Module">
          {NAVIGATION.map((n) => (
            <button key={n.pfad} aria-current={modul === n.pfad} onClick={() => navigieren(`/${n.pfad}`)}>
              <Symbol name={n.pfad} />
              <span>{n.titel}</span>
            </button>
          ))}
        </nav>

        <div className="desk-panel" ref={setPanelEl}>
          <EingebettetKontext.Provider value={true}>
            {kontext.fehler && <Hinweis art="fehler">{fehlertext(kontext.fehler)}</Hinweis>}
            {modul === 'karte' ? null : modul === 'einstellungen' ? (
              <Einstellungen userId={userId} kontext={kontext} aktuell={aktuell} revierWechseln={revierWechseln} />
            ) : (
              <ModulInhalt key={`${k.revierId}-${modul}`} modul={modul} unterpfad={unterpfad} k={k} />
            )}
          </EingebettetKontext.Provider>
        </div>
      </aside>

      <main className="desk-karte">
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

function ModulInhalt({ modul, unterpfad, k }: { modul: string; unterpfad: string[]; k: RevierKontext }) {
  switch (modul) {
    case 'freigaben':
      return <Freigaben k={k} />;
    case 'zonen':
      return <Zonen k={k} />;
    case 'abschuesse':
      return <Abschuesse k={k} />;
    case 'erfassung':
      return <Erfassung k={k} />;
    case 'zaehlung':
      return <Zaehlung k={k} sitzungId={unterpfad[0] ?? null} />;
    case 'monitoring':
      return <Monitoring k={k} />;
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
            ? 'Du bist noch keinem Revier zugeordnet. Reviere legst du in den Einstellungen im Bereich Masteradmin an.'
            : 'Du bist noch keinem Revier zugeordnet. Löse einen Einladungscode ein, den du vom Revierinhaber bekommen hast.'}
        </Hinweis>
        <CodeEinloesen
          onEingeloest={async (neueRevierId) => {
            await neuLaden();
            if (neueRevierId) revierWechseln(neueRevierId);
          }}
        />
        {istMasteradmin && (
          <Knopf variante="sekundaer" onClick={() => navigieren('/einstellungen')}>
            Zu den Einstellungen
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
          {MODULE.map((m) => (
            <button key={m.pfad} className="kachel" onClick={() => navigieren(`/${m.pfad}`)}>
              <span className="kachel-symbol" aria-hidden="true">
                {m.symbol}
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
