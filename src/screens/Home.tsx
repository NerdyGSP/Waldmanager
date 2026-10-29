import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { codeFormatieren, fehlertext } from '../lib/fehler';
import { gemerktesRevier, revierMerken, useNutzerKontext } from '../lib/useNutzerKontext';
import { Feld, Gruppe, Hinweis, Knopf, Zeile } from '../components/ui';
import { Logo } from './AuthScreen';
import { MitgliederPanel } from './MitgliederPanel';
import { AdminPanel } from './AdminPanel';

const ROLLEN = { inhaber: 'Revierinhaber/-pächter', mitjaeger: 'Mitjäger' } as const;

const MODULE = [
  { titel: 'Karte', text: 'Reviergrenze, Zonen, Einrichtungen, Pirschwege' },
  { titel: 'Wildzählung', text: 'Zählsitzung je Zone mit Gesamtübersicht' },
  { titel: 'Einzelerfassung', text: 'Beobachtungen unterwegs, auch offline' },
  { titel: 'Abschüsse', text: 'Strecke mit Wildart, Geschlecht, Altersklasse' },
  { titel: 'Monitoring', text: 'Statistik, Heatmap, Quervergleich im Hegering' },
  { titel: 'Freigaben', text: 'Wildarten für den Quervergleich freigeben' },
];

export function Home({ session }: { session: Session }) {
  const kontext = useNutzerKontext(session.user.id);
  const [revierId, setRevierId] = useState<string | null>(gemerktesRevier());

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

  return (
    <div className="app">
      <header className="leiste">
        <div className="leiste-marke">
          <Logo />
          <span>Hegewerk</span>
        </div>

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
          <span className="nutzer-name">{kontext.name || kontext.email}</span>
          <Knopf variante="sekundaer" onClick={() => supabase.auth.signOut()}>
            Abmelden
          </Knopf>
        </div>
      </header>

      <main className="inhalt">
        {kontext.fehler && <Hinweis art="fehler">{fehlertext(kontext.fehler)}</Hinweis>}

        {aktuell ? (
          <>
            <Gruppe titel="Revier">
              <Zeile label="Name" wert={aktuell.revier.name} />
              <Zeile label="Hegering" wert={aktuell.revier.hegering ?? '–'} />
              <Zeile
                label="Fläche"
                wert={aktuell.revier.flaeche_ha ? `${aktuell.revier.flaeche_ha.toLocaleString('de-DE')} ha` : 'nicht hinterlegt'}
              />
              <Zeile label="Deine Rolle" wert={ROLLEN[aktuell.rolle]} />
            </Gruppe>

            <section>
              <h2 className="gruppe-titel">Module</h2>
              <div className="kacheln">
                {MODULE.map((m) => (
                  <div key={m.titel} className="kachel" aria-disabled="true">
                    <strong>{m.titel}</strong>
                    <span>{m.text}</span>
                    <em>in Arbeit</em>
                  </div>
                ))}
              </div>
            </section>

            {aktuell.rolle === 'inhaber' && (
              <MitgliederPanel revierId={aktuell.revier.id} eigeneId={session.user.id} />
            )}
          </>
        ) : (
          !kontext.istMasteradmin && (
            <Hinweis>
              Du bist noch keinem Revier zugeordnet. Löse unten einen Einladungscode ein, den du vom Revierinhaber
              bekommen hast.
            </Hinweis>
          )
        )}

        <CodeEinloesen
          onEingeloest={async (neueRevierId) => {
            await kontext.neuLaden();
            if (neueRevierId) revierWechseln(neueRevierId);
          }}
        />

        {kontext.istMasteradmin && (
          <AdminPanel
            eigeneId={session.user.id}
            onGeaendert={async (neueRevierId) => {
              await kontext.neuLaden();
              if (neueRevierId) revierWechseln(neueRevierId);
            }}
          />
        )}
      </main>
    </div>
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
