import { baumartName } from './stammdaten';

// Polter: aufgearbeitetes Holz am Weg, das noch abgefahren werden muss.
// Nach FRIST_TAGE gilt ein liegendes Polter als überfällig (Käfer, Entwertung, Vergessen).

export const FRIST_TAGE = 28;
export const POLTER_FARBE = '#8a5a2b';
export const POLTER_FARBE_UEBERFAELLIG = '#c32319';

export type PolterStatus = 'liegt' | 'abgefahren';
export type PolterFilter = 'liegt' | 'ueberfaellig' | 'abgefahren' | 'alle';

export type PolterKern = {
  status: string;
  abgelegt_am: string;
  baumart?: string | null;
  stueck?: number | null;
  menge_fm?: number | null;
};

const TAG_MS = 24 * 3600 * 1000;

/** Volle Tage seit dem Ablegen (nie negativ) */
export function liegtSeitTage(abgelegtAm: string, jetzt: Date = new Date()): number {
  const t = new Date(abgelegtAm).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((jetzt.getTime() - t) / TAG_MS)) : 0;
}

export function istUeberfaellig(p: PolterKern, jetzt: Date = new Date()): boolean {
  return p.status === 'liegt' && liegtSeitTage(p.abgelegt_am, jetzt) >= FRIST_TAGE;
}

/** „liegt seit heute“, „liegt seit 1 Tag“, „liegt seit 94 Tagen“ */
export function liegtSeitText(abgelegtAm: string, jetzt: Date = new Date()): string {
  const tage = liegtSeitTage(abgelegtAm, jetzt);
  return tage === 0 ? 'liegt seit heute' : `liegt seit ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`;
}

/** „Fichte · ca. 3 fm“, „12 Stück“; leer, wenn nichts angegeben ist */
export function polterText(p: Pick<PolterKern, 'baumart' | 'stueck' | 'menge_fm'>): string {
  return [
    p.baumart ? baumartName(p.baumart) : null,
    p.menge_fm ? `ca. ${Number(p.menge_fm).toLocaleString('de-DE')} fm` : null,
    p.stueck ? `${p.stueck} Stück` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function passtZuFilter(p: PolterKern, filter: PolterFilter, jetzt: Date = new Date()): boolean {
  if (filter === 'alle') return true;
  if (filter === 'ueberfaellig') return istUeberfaellig(p, jetzt);
  return p.status === filter;
}

/** Liegende zuerst, die ältesten oben; abgefahrene danach, die jüngsten oben */
export function sortieren<T extends PolterKern>(liste: T[]): T[] {
  const zeit = (p: PolterKern) => new Date(p.abgelegt_am).getTime();
  return [...liste].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'liegt' ? -1 : 1;
    return a.status === 'liegt' ? zeit(a) - zeit(b) : zeit(b) - zeit(a);
  });
}

export function zaehlen(liste: PolterKern[], jetzt: Date = new Date()): Record<PolterFilter, number> {
  const z: Record<PolterFilter, number> = { liegt: 0, ueberfaellig: 0, abgefahren: 0, alle: liste.length };
  for (const p of liste) for (const f of ['liegt', 'ueberfaellig', 'abgefahren'] as const) if (passtZuFilter(p, f, jetzt)) z[f]++;
  return z;
}
