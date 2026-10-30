import { Segmente } from '../../components/ui';

export type Flaechenmodus = 'strecke' | 'zonen';
export const STANDARD_BREITE_M = 400;

export const modusText = (modus: Flaechenmodus) => (modus === 'strecke' ? `Strecke × ${STANDARD_BREITE_M} m` : 'Zonenfläche');

// Umschalter „Fläche berechnen nach“: gefahrene Strecke × Streifenbreite oder Gesamtfläche der WTE-Zonen
export function FlaechenmodusWahl({
  modus,
  onModus,
}: {
  modus: Flaechenmodus;
  onModus: (m: Flaechenmodus) => void;
}) {
  return (
    <>
      <Segmente
        label="Fläche berechnen nach"
        wert={modus}
        onAendern={onModus}
        optionen={[
          { wert: 'strecke', label: `gefahrene Strecke × ${STANDARD_BREITE_M} m` },
          { wert: 'zonen', label: 'Gesamtfläche der WTE-Zonen' },
        ]}
      />
      {modus === 'strecke' && (
        <>
          <p className="gruppe-fuss" style={{ margin: 0 }}>
            Die Breite ist fest {STANDARD_BREITE_M} m ({STANDARD_BREITE_M / 2} m links und rechts der Route). Doppelt befahrene Strecken zählen nicht doppelt, Flächen außerhalb des Reviers entfallen. Für die Berechnung wird eine WTE-Route benötigt (zeichnen, per GPS aufzeichnen oder importieren).
          </p>
        </>
      )}
    </>
  );
}
