import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Geometry } from 'geojson';
import { supabase } from '../lib/supabase';
import { Knopf } from './ui';

const BjKarte = lazy(() => import('../screens/bewegungsjagd/BjKarte'));

export type Punkt = { lon: number; lat: number };

// Knopf „Auf Karte wählen“ mit Kartendialog (gleiche Karte wie der Treffpunkt der Bewegungsjagd).
// Der Marker lässt sich durch Tippen verschieben; erst „Übernehmen“ setzt die Koordinate.
export function PositionWaehlen({ revierId, wert, onWaehlen }: { revierId: string; wert: Punkt | null; onWaehlen: (p: Punkt) => void }) {
  const [offen, setOffen] = useState(false);
  const [vorschlag, setVorschlag] = useState<Punkt | null>(null);
  const [grenze, setGrenze] = useState<Geometry | null>(null);

  useEffect(() => {
    if (!offen) return;
    setVorschlag(wert);
    if (navigator.onLine)
      void supabase.rpc('karte_daten', { p_revier_id: revierId, p_tage: 1 }).then(({ data }) => setGrenze((data as unknown as { grenze?: Geometry | null } | null)?.grenze ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  return (
    <>
      <Knopf type="button" variante="sekundaer" onClick={() => setOffen(true)}>
        🗺️ Auf Karte wählen
      </Knopf>
      {offen &&
        createPortal(
          <div className="schein-fenster" role="dialog" aria-modal="true" aria-label="Position auf der Karte wählen">
            <div className="schein-fenster-kopf">
              <h2>Position wählen</h2>
              <Knopf type="button" variante="ghost" onClick={() => setOffen(false)}>
                Abbrechen
              </Knopf>
            </div>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Tippe auf die Karte, um den Marker zu setzen oder zu verschieben.</p>
            <Suspense fallback={<p>Karte lädt …</p>}>
              <BjKarte
                className="bj-karte bj-karte-hoch"
                marker={vorschlag ? [{ id: 'wahl', lng: vorschlag.lon, lat: vorschlag.lat, art: 'eigener', label: 'Gewählte Position' }] : []}
                grenze={grenze}
                waehlbar
                onWaehlen={(lng, lat) => setVorschlag({ lon: lng, lat })}
              />
            </Suspense>
            <small style={{ color: 'var(--color-text-muted)' }}>Offline sind nur bereits geladene Kartenausschnitte (Kartenspeicher) sichtbar.</small>
            <Knopf
              type="button"
              disabled={!vorschlag}
              onClick={() => {
                if (vorschlag) onWaehlen(vorschlag);
                setOffen(false);
              }}
            >
              Position übernehmen
            </Knopf>
          </div>,
          document.body,
        )}
    </>
  );
}
