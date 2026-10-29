import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { gemerktesRevier, revierMerken, useNutzerKontext, type Mitgliedschaft } from '../lib/useNutzerKontext';
import { navigieren, usePfad } from '../lib/router';
import { useWarteschlange } from '../lib/offline';
import { Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';
import { Logo } from './AuthScreen';
import { MitgliederPanel } from './MitgliederPanel';
import { AdminPanel } from './AdminPanel';
import { Freigaben } from './module/Freigaben';
import { Zonen } from './module/Zonen';
import { Abschuesse } from './module/Abschuesse';
import { Erfassung } from './module/Erfassung';
import { Zaehlung } from './module/Zaehlung';
import { Monitoring } from './module/Monitoring';
import type { RevierKontext } from './module/kontext';

// Die Karte ist groß (MapLibre) und wird erst bei Bedarf geladen
const Karte = lazy(() => import('./module/Karte'));

const ROLLEN = { inhaber: 'Revierinhaber/-pächter', mitjaeger: 'Mitjäger' } as const;

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
          <span className="nutzer-name">{kontext.name || kontext.email}</span>
          <Knopf variante="sekundaer" onClick={() => supabase.auth.signOut()}>
            Abmelden
          </Knopf>
        </div>
      </header>

      <main className={modul === 'karte' ? 'inhalt inhalt-voll' : 'inhalt'}>
        {kontext.fehler && <Hinweis art="fehler">{fehlertext(kontext.fehler)}</Hinweis>}

        {modul && revierKontext ? (
          <ModulInhalt key={`${revierKontext.revierId}-${modul}`} modul={modul} unterpfad={pfad.slice(1)} k={revierKontext} />
        ) : (
          <Start
            aktuell={aktuell}
            session={session}
            istMasteradmin={kontext.istMasteradmin}
            neuLaden={kontext.neuLaden}
            revierWechseln={revierWechseln}
          />
        )}
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
  session,
  istMasteradmin,
  neuLaden,
  revierWechseln,
}: {
  aktuell: Mitgliedschaft | null;
  session: Session;
  istMasteradmin: boolean;
  neuLaden: () => Promise<void>;
  revierWechseln: (id: string) => void;
}) {
  return (
    <>
      {aktuell ? (
        <>
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

          <Gruppe titel="Revier">
            <Zeile label="Name" wert={aktuell.revier.name} />
            <Zeile label="Hegering" wert={aktuell.revier.hegering ?? '–'} />
            <Zeile
              label="Fläche"
              wert={aktuell.revier.flaeche_ha ? `${aktuell.revier.flaeche_ha.toLocaleString('de-DE')} ha` : 'nicht hinterlegt'}
            />
            <Zeile label="Deine Rolle" wert={ROLLEN[aktuell.rolle]} />
          </Gruppe>

          {aktuell.rolle === 'inhaber' && <MitgliederPanel revierId={aktuell.revier.id} eigeneId={session.user.id} />}
        </>
      ) : (
        !istMasteradmin && (
          <Hinweis>
            Du bist noch keinem Revier zugeordnet. Löse unten einen Einladungscode ein, den du vom Revierinhaber bekommen
            hast.
          </Hinweis>
        )
      )}

      <CodeEinloesen
        onEingeloest={async (neueRevierId) => {
          await neuLaden();
          if (neueRevierId) revierWechseln(neueRevierId);
        }}
      />

      {istMasteradmin && (
        <AdminPanel
          eigeneId={session.user.id}
          onGeaendert={async (neueRevierId) => {
            await neuLaden();
            if (neueRevierId) revierWechseln(neueRevierId);
          }}
        />
      )}
    </>
  );
}

function CodeEinloesen({ onEingeloest }: { onEingeloest: (revierId: string | null) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState(false);
  const [laedt, setLaedt] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setErfolg(false);
    setLaedt(true);
    const { data, error } = await supabase.rpc('einladung_einloesen', { p_code: code });
    setLaedt(false);
    if (error) {
      setFehler(fehlertext(error));
      return;
    }
    setCode('');
    setErfolg(true);
    await onEingeloest(data ?? null);
  }

  return (
    <form onSubmit={absenden}>
      <Gruppe titel="Einladungscode einlösen" fuss="Damit trittst du mit deinem bestehenden Account einem weiteren Revier bei.">
        <Feld
          label="Code"
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          value={code}
          onChange={(e) => setCode(codeFormatieren(e.target.value))}
        />
      </Gruppe>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {erfolg && <Hinweis art="erfolg">Code eingelöst.</Hinweis>}
      <Knopf type="submit" variante="sekundaer" disabled={laedt || code.length < 9}>
        Einlösen
      </Knopf>
    </form>
  );
}
