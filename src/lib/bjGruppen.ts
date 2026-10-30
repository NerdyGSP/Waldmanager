import type { Tables } from './database.types';

export type BjTeilnehmerZeile = Tables<'bewegungsjagd_teilnehmer'>;
export type BjGruppe<T extends BjTeilnehmerZeile = BjTeilnehmerZeile> = { ansteller: T | null; mitglieder: T[] };

const nach = (a: BjTeilnehmerZeile, b: BjTeilnehmerZeile) => a.name.localeCompare(b.name, 'de');

// Gruppen je Ansteller (alphabetisch), danach „Ohne Gruppe“. Der Ansteller gehört zu seiner eigenen Gruppe
// und steht dort nicht noch einmal unter den Mitgliedern.
export function nachAnstellern<T extends BjTeilnehmerZeile>(tn: T[]): BjGruppe<T>[] {
  const ansteller = tn.filter((t) => t.ist_ansteller).sort(nach);
  const gruppen: BjGruppe<T>[] = ansteller.map((a) => ({ ansteller: a, mitglieder: tn.filter((t) => t.ansteller_id === a.id && !t.ist_ansteller).sort(nach) }));
  const ids = new Set(ansteller.map((a) => a.id));
  const ohne = tn.filter((t) => !t.ist_ansteller && (!t.ansteller_id || !ids.has(t.ansteller_id))).sort(nach);
  if (ohne.length) gruppen.push({ ansteller: null, mitglieder: ohne });
  return gruppen;
}
