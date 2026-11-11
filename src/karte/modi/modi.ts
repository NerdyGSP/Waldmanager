import { KARTEN_MODI, type KartenModus } from '../ebenen/typen';

// Kartenmodi als kleine Zustandsmaschine. Noch nicht an Karte.tsx angeschlossen.

export type ModusKontext = {
  /** Inhaber des aktuellen Forstbetriebs */
  istInhaber: boolean;
  /** PC oder iPad quer (ab 900 px) */
  breit: boolean;
};

export const MODUS_TITEL: Record<KartenModus, string> = {
  ansehen: 'Ansehen',
  erfassen: 'Erfassen',
  bearbeiten: 'Bearbeiten',
  druck: 'Druck',
};

/**
 * Wer darf welchen Modus betreten? Geometrien schreibt nur der Inhaber,
 * der Layoutdruck braucht die breite Ansicht.
 */
export function modusErlaubt(modus: KartenModus, k: ModusKontext): boolean {
  switch (modus) {
    case 'ansehen':
    case 'erfassen':
      return true;
    case 'bearbeiten':
      return k.istInhaber;
    case 'druck':
      return k.istInhaber && k.breit;
  }
}

export const erlaubteModi = (k: ModusKontext): KartenModus[] => KARTEN_MODI.filter((m) => modusErlaubt(m, k));

/** Zielmodus, falls erlaubt; sonst bleibt der aktuelle Modus (bzw. „ansehen“, wenn auch der nicht mehr erlaubt ist) */
export function modusWechseln(aktuell: KartenModus, ziel: KartenModus, k: ModusKontext): KartenModus {
  if (modusErlaubt(ziel, k)) return ziel;
  return modusErlaubt(aktuell, k) ? aktuell : 'ansehen';
}

export const istKartenModus = (m: unknown): m is KartenModus => typeof m === 'string' && (KARTEN_MODI as readonly string[]).includes(m);
