import { Feld, Segmente } from '../../components/ui';

export type Flaechenmodus = 'strecke' | 'zonen';
export const STANDARD_BREITE_M = 400;

export const modusText = (modus: Flaechenmodus, breite: number) => (modus === 'strecke' ? `Strecke × ${breite} m` : 'Zonenfläche');

// Umschalter „Fläche berechnen nach“: gefahrene Strecke × Streifenbreite oder Gesamtfläche der WTE-Zonen
export function FlaechenmodusWahl({
  modus,
  breite,
  onModus,
  onBreite,
}: {
  modus: Flaechenmodus;
  breite: number;
  onModus: (m: Flaechenmodus) => void;
  onBreite: (b: number) => void;
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
          <Feld
            label="Streifenbreite (m)"
            inputMode="numeric"
            value={String(breite)}
            onChange={(e) => onBreite(Math.min(2000, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
          />
          <p className="gruppe-fuss" style={{ margin: 0 }}>
            Die Breite gilt beidseits der Route ({breite / 2} m links und rechts). Doppelt befahrene Strecken zählen nicht doppelt, Flächen außerhalb des Reviers entfallen. Für die Berechnung wird eine WTE-Route benötigt (zeichnen, per GPS aufzeichnen oder importieren).
          </p>
        </>
      )}
    </>
  );
}
