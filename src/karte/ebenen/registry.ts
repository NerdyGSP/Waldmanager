import type { EbenenDeklaration, KartenModus } from './typen';

// Alle Kartenebenen, in Standardreihenfolge von oben nach unten.
// Neue Ebene = neuer Eintrag hier; gespeicherte Einstellungen werden automatisch ergänzt (einstellungen.ts).

export const EBENEN = [
  { id: 'grenze', titel: 'Betriebsgrenze', gruppe: 'betrieb', schichten: ['grenze-linie'], standardSichtbar: true, standardDeckkraft: 1, modi: 'alle' },
  { id: 'bestaende', titel: 'Bestände', gruppe: 'betrieb', schichten: ['bestaende-flaeche', 'bestaende-linie', 'bestaende-auswahl'], standardSichtbar: true, standardDeckkraft: 0.55, modi: 'alle' },
  { id: 'luftbild', titel: 'Luftbild', gruppe: 'basis', schichten: ['luftbild'], standardSichtbar: false, standardDeckkraft: 1, modi: 'alle' },
] as const satisfies readonly EbenenDeklaration[];

export type EbenenId = (typeof EBENEN)[number]['id'];

const alsRecord = <W>(wert: (e: EbenenDeklaration<EbenenId>) => W): Record<EbenenId, W> =>
  Object.fromEntries(EBENEN.map((e) => [e.id, wert(e)])) as Record<EbenenId, W>;

/** Logische Ebene → MapLibre-Schichten */
export const EBENEN_SCHICHTEN: Record<EbenenId, readonly string[]> = alsRecord((e) => e.schichten);
/** Reihenfolge ohne gespeicherte Einstellung, oben → unten */
export const STANDARD_REIHENFOLGE: readonly EbenenId[] = EBENEN.map((e) => e.id);
export const STANDARD_DECKKRAFT: Readonly<Record<EbenenId, number>> = alsRecord((e) => e.standardDeckkraft);
/** Sichtbarkeit ohne gespeicherte Einstellung (frisches Objekt, darf als React-Zustand dienen) */
export const standardSichtbarkeit = (): Record<EbenenId, boolean> => alsRecord((e) => e.standardSichtbar);

export const istEbenenId = (id: unknown): id is EbenenId => typeof id === 'string' && EBENEN.some((e) => e.id === id);

export function ebene(id: EbenenId): EbenenDeklaration<EbenenId> {
  return EBENEN.find((e) => e.id === id)!;
}

/** Darf die Ebene im Modus überhaupt erscheinen? (Die Nutzerwahl Ein/Aus kommt zusätzlich dazu.) */
export function imModusErlaubt(id: EbenenId, modus: KartenModus): boolean {
  const m: readonly KartenModus[] | 'alle' = ebene(id).modi;
  return m === 'alle' || m.includes(modus);
}
