// Fachlogik der Fundmeldungen: Typen, Merkmale, Zeiträume und Auswertung je Bestand

export type FundTyp = 'kaeferbaum' | 'windwurf' | 'wildschaden' | 'sonstiges';

export const FUND_TYPEN: Array<{ wert: FundTyp; label: string; farbe: string }> = [
  { wert: 'kaeferbaum', label: 'Käferbaum', farbe: '#b23f2d' },
  { wert: 'windwurf', label: 'Windwurf', farbe: '#2f5e8a' },
  { wert: 'wildschaden', label: 'Wildschaden', farbe: '#a96d12' },
  { wert: 'sonstiges', label: 'Sonstiges', farbe: '#5d6d7e' },
];

/** Merkmale je Fundtyp (gespeichert als Schlüssel in funde.merkmal) */
export const MERKMALE: Record<FundTyp, Array<{ wert: string; label: string }>> = {
  kaeferbaum: [
    { wert: 'bohrmehl', label: 'Bohrmehl' },
    { wert: 'harzfluss', label: 'Harzfluss' },
    { wert: 'rote_krone', label: 'Rote Krone' },
    { wert: 'abgestorben', label: 'Abgestorben' },
  ],
  windwurf: [
    { wert: 'einzelwurf', label: 'Einzelwurf' },
    { wert: 'nesterwurf', label: 'Nesterwurf' },
    { wert: 'flaechenwurf', label: 'Flächenwurf' },
    { wert: 'bruch', label: 'Bruch' },
  ],
  wildschaden: [
    { wert: 'verbiss', label: 'Verbiss' },
    { wert: 'schaele', label: 'Schäle' },
    { wert: 'fege', label: 'Fege' },
  ],
  sonstiges: [],
};

export function typLabel(typ: string): string {
  return FUND_TYPEN.find((t) => t.wert === typ)?.label ?? typ;
}

export function typFarbe(typ: string): string {
  return FUND_TYPEN.find((t) => t.wert === typ)?.farbe ?? '#5d6d7e';
}

export function merkmalLabel(typ: string, merkmal: string | null): string | null {
  if (!merkmal) return null;
  return MERKMALE[typ as FundTyp]?.find((m) => m.wert === merkmal)?.label ?? merkmal;
}

/** Käferbäume zählen als Stückzahl, Windwurf zusätzlich als Menge in Festmetern */
export function mengeText(f: { typ: string; anzahl: number; menge_fm: number | null }): string {
  if (f.typ === 'windwurf' && f.menge_fm) return `ca. ${f.menge_fm.toLocaleString('de-DE')} fm`;
  if (f.typ === 'kaeferbaum') return `${f.anzahl} ${f.anzahl === 1 ? 'Baum' : 'Bäume'}`;
  return f.anzahl > 1 ? `${f.anzahl} Stellen` : '';
}

// ---------- Zeiträume ----------

export type Zeitraum = '30' | '90' | 'saison' | 'jahr' | 'alle';

export const ZEITRAEUME: Array<{ wert: Zeitraum; label: string }> = [
  { wert: '30', label: '30 Tage' },
  { wert: '90', label: '90 Tage' },
  { wert: 'saison', label: 'Käfersaison' },
  { wert: 'jahr', label: '12 Monate' },
  { wert: 'alle', label: 'Alle' },
];

/**
 * Beginn eines Zeitraums als ISO-Zeitpunkt (null = ohne Grenze).
 * Käfersaison: ab 1. April des laufenden Jahres; vor April die Saison des Vorjahres.
 */
export function zeitraumBeginn(z: Zeitraum, jetzt: Date = new Date()): string | null {
  const tage = (n: number) => new Date(jetzt.getTime() - n * 86400000).toISOString();
  switch (z) {
    case '30':
      return tage(30);
    case '90':
      return tage(90);
    case 'jahr':
      return tage(365);
    case 'saison': {
      const jahr = jetzt.getMonth() < 3 ? jetzt.getFullYear() - 1 : jetzt.getFullYear();
      return new Date(jahr, 3, 1).toISOString();
    }
    case 'alle':
      return null;
  }
}

export function imZeitraum(beobachtetAm: string, beginn: string | null): boolean {
  return !beginn || beobachtetAm >= beginn;
}

// ---------- Auswertung ----------

/** Gewicht eines Funds in der Heatmap: Käferbäume nach Anzahl, sonst 1 */
export function gewicht(f: { typ: string; anzahl: number }): number {
  return f.typ === 'kaeferbaum' ? Math.max(1, Math.min(f.anzahl, 20)) : 1;
}

/** Summe je Bestand, absteigend; Funde ohne Bestand unter dem Schlüssel „“ */
export function jeBestand(liste: Array<{ bestand_id: string | null; typ: string; anzahl: number }>): Array<{ bestandId: string; summe: number }> {
  const m = new Map<string, number>();
  for (const f of liste) m.set(f.bestand_id ?? '', (m.get(f.bestand_id ?? '') ?? 0) + gewicht(f));
  return [...m.entries()].map(([bestandId, summe]) => ({ bestandId, summe })).sort((a, b) => b.summe - a.summe);
}

// ---------- Foto ----------

/** Pfad im Bucket „fund-fotos“: erster Teil ist der Betrieb (Zugriffsregel) */
export function fotoPfad(betriebId: string, fundId: string): string {
  return `${betriebId}/${fundId}.jpg`;
}

/** Zielgröße beim Verkleinern: längste Kante höchstens max Pixel, Seitenverhältnis bleibt */
export function zielGroesse(breite: number, hoehe: number, max = 1600): { breite: number; hoehe: number } {
  const f = Math.min(1, max / Math.max(breite, hoehe));
  return { breite: Math.round(breite * f), hoehe: Math.round(hoehe * f) };
}
