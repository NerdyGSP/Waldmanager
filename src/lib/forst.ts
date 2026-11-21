import type { Baumartenanteil } from './stammdaten';

/** Bestandesalter in Jahren aus dem Pflanzjahr (Stichtag: heute) */
export function bestandesalter(pflanzjahr: number | null, heute: Date = new Date()): number | null {
  if (pflanzjahr == null) return null;
  const alter = heute.getFullYear() - pflanzjahr;
  return alter >= 0 ? alter : null;
}

/** Pflanzjahr aus einem Alter (Gegenrichtung für Eingabefelder) */
export function pflanzjahrAusAlter(alter: number, heute: Date = new Date()): number {
  return heute.getFullYear() - alter;
}

/** Summe der Anteile in Prozent */
export function anteilSumme(liste: Baumartenanteil[]): number {
  return liste.reduce((a, b) => a + b.anteil, 0);
}

/**
 * Prüft die Baumartenanteile: jede Art höchstens einmal, Anteile 1–100, Summe genau 100.
 * Gibt einen Fehlertext zurück oder null, wenn alles passt. Eine leere Liste ist erlaubt.
 */
export function baumartenPruefen(liste: Baumartenanteil[]): string | null {
  if (liste.length === 0) return null;
  const arten = new Set<string>();
  for (const b of liste) {
    if (!b.art) return 'Bitte für jede Zeile eine Baumart wählen.';
    if (arten.has(b.art)) return `${b.art} ist doppelt eingetragen.`;
    arten.add(b.art);
    if (!Number.isInteger(b.anteil) || b.anteil < 1 || b.anteil > 100) return 'Anteile müssen ganze Zahlen zwischen 1 und 100 sein.';
  }
  const summe = anteilSumme(liste);
  return summe === 100 ? null : `Die Anteile ergeben ${summe} %, nicht 100 %.`;
}

// ---------- Wuchsstadium ----------

export type Wuchsstadium = 'kultur' | 'dickung' | 'stangenholz' | 'baumholz';

/**
 * Grobe Wuchsstadien nach Alter (Faustwerte, baumartenunabhängig):
 * Kultur bis 5 Jahre, Dickung bis 15, Stangenholz bis 40, danach Baumholz.
 */
export const WUCHSSTADIEN: Array<{ wert: Wuchsstadium; label: string; bisAlter: number; farbe: string }> = [
  { wert: 'kultur', label: 'Kultur', bisAlter: 5, farbe: '#d9e8a6' },
  { wert: 'dickung', label: 'Dickung', bisAlter: 15, farbe: '#9cc96b' },
  { wert: 'stangenholz', label: 'Stangenholz', bisAlter: 40, farbe: '#4f9a52' },
  { wert: 'baumholz', label: 'Baumholz', bisAlter: Infinity, farbe: '#1f5c3a' },
];
export const STADIUM_OHNE_ALTER_FARBE = '#9aa5a0';

export function wuchsstadium(pflanzjahr: number | null, heute: Date = new Date()): Wuchsstadium | null {
  const alter = bestandesalter(pflanzjahr, heute);
  if (alter == null) return null;
  return WUCHSSTADIEN.find((s) => alter <= s.bisAlter)!.wert;
}

export function stadiumLabel(s: Wuchsstadium | null): string {
  return WUCHSSTADIEN.find((x) => x.wert === s)?.label ?? 'ohne Alter';
}

export function stadiumFarbe(s: Wuchsstadium | null): string {
  return WUCHSSTADIEN.find((x) => x.wert === s)?.farbe ?? STADIUM_OHNE_ALTER_FARBE;
}

/** Hauptbaumart = Art mit dem größten Anteil (bei Gleichstand die zuerst genannte) */
export function hauptbaumart(liste: Baumartenanteil[]): string | null {
  let beste: Baumartenanteil | null = null;
  for (const b of liste) if (!beste || b.anteil > beste.anteil) beste = b;
  return beste?.art ?? null;
}
