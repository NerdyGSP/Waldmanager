// Fachlogik der Maßnahmen: Typen, Status, Überfälligkeit, Filter und Sortierung

export type MassnahmeStatus = 'geplant' | 'in_arbeit' | 'erledigt';
/** Anzeige-Status: „überfällig“ ist kein gespeicherter Wert, sondern ergibt sich aus Termin und Status */
export type AnzeigeStatus = MassnahmeStatus | 'ueberfaellig';
export type Filter = 'offen' | AnzeigeStatus | 'alle';

export const MASSNAHME_TYPEN = [
  { wert: 'durchforstung', label: 'Durchforstung' },
  { wert: 'holzeinschlag', label: 'Holzeinschlag' },
  { wert: 'holzabfuhr', label: 'Holzabfuhr' },
  { wert: 'pflanzung', label: 'Pflanzung' },
  { wert: 'kulturpflege', label: 'Kulturpflege' },
  { wert: 'kaeferkontrolle', label: 'Käferkontrolle' },
  { wert: 'zaunbau', label: 'Zaunbau/-kontrolle' },
  { wert: 'wegebau', label: 'Wegebau' },
  { wert: 'grenzkontrolle', label: 'Grenzkontrolle' },
  { wert: 'sonstiges', label: 'Sonstiges' },
] as const;
export type MassnahmeTyp = (typeof MASSNAHME_TYPEN)[number]['wert'];

export const STATUS_LABEL: Record<AnzeigeStatus, string> = {
  geplant: 'Geplant',
  in_arbeit: 'In Arbeit',
  erledigt: 'Erledigt',
  ueberfaellig: 'Überfällig',
};

export const FILTER: Array<{ wert: Filter; label: string }> = [
  { wert: 'offen', label: 'Offen' },
  { wert: 'ueberfaellig', label: 'Überfällig' },
  { wert: 'in_arbeit', label: 'In Arbeit' },
  { wert: 'geplant', label: 'Geplant' },
  { wert: 'erledigt', label: 'Erledigt' },
  { wert: 'alle', label: 'Alle' },
];

export type MassnahmeKern = { status: string; faellig_am: string | null };

export function typLabel(typ: string): string {
  return MASSNAHME_TYPEN.find((t) => t.wert === typ)?.label ?? typ;
}

/** Heutiges Datum als JJJJ-MM-TT in Ortszeit */
export function heuteIso(jetzt: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())}`;
}

/** Überfällig: nicht erledigt und der Termin liegt vor heute (der Tag selbst zählt noch) */
export function istUeberfaellig(m: MassnahmeKern, heute: string = heuteIso()): boolean {
  return m.status !== 'erledigt' && !!m.faellig_am && m.faellig_am < heute;
}

export function anzeigeStatus(m: MassnahmeKern, heute: string = heuteIso()): AnzeigeStatus {
  if (istUeberfaellig(m, heute)) return 'ueberfaellig';
  return m.status === 'in_arbeit' || m.status === 'erledigt' ? m.status : 'geplant';
}

/** Ein Klick auf den Status schaltet weiter: geplant → in Arbeit → erledigt → geplant */
export function naechsterStatus(status: string): MassnahmeStatus {
  return status === 'geplant' ? 'in_arbeit' : status === 'in_arbeit' ? 'erledigt' : 'geplant';
}

export function passtZuFilter(m: MassnahmeKern, filter: Filter, heute: string = heuteIso()): boolean {
  if (filter === 'alle') return true;
  if (filter === 'offen') return m.status !== 'erledigt';
  const s = anzeigeStatus(m, heute);
  // „Geplant“ und „In Arbeit“ zeigen auch überfällige Einträge mit diesem Status
  if (filter === 'geplant' || filter === 'in_arbeit') return m.status === filter;
  return s === filter;
}

/** Offene zuerst, dann nach Termin aufsteigend (ohne Termin ans Ende); Erledigte zuletzt, neueste oben */
export function sortieren<T extends MassnahmeKern>(liste: T[]): T[] {
  return [...liste].sort((a, b) => {
    const ae = a.status === 'erledigt';
    const be = b.status === 'erledigt';
    if (ae !== be) return ae ? 1 : -1;
    const x = a.faellig_am ?? '9999-12-31';
    const y = b.faellig_am ?? '9999-12-31';
    return ae ? y.localeCompare(x) : x.localeCompare(y);
  });
}

export function zaehlen(liste: MassnahmeKern[], heute: string = heuteIso()): Record<Filter, number> {
  const z = { offen: 0, ueberfaellig: 0, in_arbeit: 0, geplant: 0, erledigt: 0, alle: liste.length } as Record<Filter, number>;
  for (const m of liste) for (const f of ['offen', 'ueberfaellig', 'in_arbeit', 'geplant', 'erledigt'] as const) if (passtZuFilter(m, f, heute)) z[f]++;
  return z;
}
