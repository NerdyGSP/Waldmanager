// Typen des Kartenkerns. Eine Ebene wird deklariert, nicht in einer Komponente verdrahtet.

/** Gruppen im Ebenen-Panel, von oben nach unten */
export const EBENEN_GRUPPEN = ['geschehen', 'analyse', 'betrieb', 'recht', 'basis'] as const;
export type EbenenGruppe = (typeof EBENEN_GRUPPEN)[number];

export const GRUPPEN_TITEL: Record<EbenenGruppe, string> = {
  geschehen: 'Geschehen',
  analyse: 'Analyse',
  betrieb: 'Forstbetrieb',
  recht: 'Recht & Schutz',
  basis: 'Basiskarte',
};

/** Kartenmodi: genau einer ist aktiv und legt Ebenen, Klickverhalten und Werkzeuge fest */
export const KARTEN_MODI = ['ansehen', 'erfassen', 'bearbeiten', 'druck'] as const;
export type KartenModus = (typeof KARTEN_MODI)[number];

export type EbenenDeklaration<Id extends string = string> = {
  /** Stabiler Schlüssel; steht in gespeicherten Einstellungen und Kartenansichten */
  id: Id;
  /** Name im Ebenen-Panel */
  titel: string;
  gruppe: EbenenGruppe;
  /** MapLibre-Schichten dieser Ebene, in Zeichenreihenfolge (erste liegt unten) */
  schichten: readonly string[];
  /** Sichtbarkeit ohne gespeicherte Einstellung */
  standardSichtbar: boolean;
  /** Deckkraft 0–1 ohne gespeicherte Einstellung */
  standardDeckkraft: number;
  /** Modi, in denen die Ebene angezeigt werden darf */
  modi: readonly KartenModus[] | 'alle';
};
