import { Segmente } from '../../components/ui';

export type Flaechenmodus = 'strecke' | 'zonen';
export const STANDARD_BREITE_M = 400;

export const modusText = (modus: Flaechenmodus, breite: number) => (modus === 'strecke' ? `Strecke × ${breite} m` : 'Zonenfläche');

// Umschalter „Fläche berechnen nach“: gefahrene Strecke × Streifenbreite oder Gesamtfläche der WTE-Zonen
export function FlaechenmodusWahl({
  modus,
  breite,
  onModus,
}: {
  modus: Flaechenmodus;
  breite: number;
  onModus: (m: Flaechenmodus) => void;
  onBreite?: (b: number) => void;
}) {
  return (
    <>
      <Segmente
        label="Fläche berechnen nach"
        wert={modus}
        onAendern={onModus}
        optionen={[
          { wert: 'strecke', label: `gefahrene Strecke × ${breite} m` },
          { wert: 'zonen', label: 'Gesamtfläche der WTE-Zonen' },
        ]}
      />
      {modus === 'strecke' && (
        <>
          <p className="gruppe-fuss" style={{ margin: 0 }}>
            Die Breite ist fest {breite} m ({breite / 2} m links und rechts der Route). Doppelt befahrene Strecken zählen nicht doppelt, Flächen außerhalb des Reviers entfallen. Für die Berechnung wird eine WTE-Route benötigt (zeichnen, per GPS aufzeichnen oder importieren).
          </p>
        </>
      )}
    </>
  );
}
