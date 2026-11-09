import type { EbenenDeklaration, KartenModus } from './typen';

// Alle Kartenebenen, in Standardreihenfolge von oben nach unten.
// Neue Ebene = neuer Eintrag hier; gespeicherte Einstellungen werden automatisch ergänzt (einstellungen.ts).
// Stand Phase 1 (Beginn): Die Deklarationen spiegeln die Schichten, die Karte.tsx heute selbst anlegt.
const ANSEHEN_UND_PLANEN = ['ansehen', 'erfassen', 'bearbeiten', 'jagdtag', 'druck'] as const satisfies readonly KartenModus[];

export const EBENEN = [
  { id: 'einrichtungen', titel: 'Einrichtungen', gruppe: 'revier', schichten: ['einrichtungen-punkt'], standardSichtbar: true, standardDeckkraft: 1, modi: ANSEHEN_UND_PLANEN },
  { id: 'abschuesse', titel: 'Abschüsse', gruppe: 'geschehen', schichten: ['abschuesse-punkt'], standardSichtbar: false, standardDeckkraft: 1, modi: ['ansehen', 'druck'] },
  { id: 'pirschwege', titel: 'Pirschwege', gruppe: 'revier', schichten: ['pirschwege-linie'], standardSichtbar: true, standardDeckkraft: 1, modi: ANSEHEN_UND_PLANEN },
  { id: 'treiberrouten', titel: 'Treiberrouten', gruppe: 'revier', schichten: ['treiberrouten-linie', 'treiberrouten-pfeile'], standardSichtbar: true, standardDeckkraft: 1, modi: ['ansehen', 'bearbeiten', 'jagdtag', 'druck'] },
  { id: 'wteRouten', titel: 'WTE-Routen', gruppe: 'revier', schichten: ['wte-routen-linie', 'wte-routen-pfeile'], standardSichtbar: true, standardDeckkraft: 1, modi: ['ansehen', 'zaehlen', 'bearbeiten', 'druck'] },
  { id: 'heatmap', titel: 'Heatmap', gruppe: 'analyse', schichten: ['heatmap'], standardSichtbar: false, standardDeckkraft: 0.75, modi: ['ansehen', 'druck'] },
  { id: 'grenze', titel: 'Reviergrenze', gruppe: 'revier', schichten: ['grenze-linie'], standardSichtbar: true, standardDeckkraft: 1, modi: 'alle' },
  { id: 'zonen', titel: 'Zonen', gruppe: 'revier', schichten: ['zonen-flaeche', 'zonen-linie', 'zonen-auswahl'], standardSichtbar: true, standardDeckkraft: 0.55, modi: 'alle' },
  { id: 'felder', titel: 'Felder', gruppe: 'landwirtschaft', schichten: ['felder-flaeche', 'felder-linie'], standardSichtbar: false, standardDeckkraft: 0.45, modi: ANSEHEN_UND_PLANEN },
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
