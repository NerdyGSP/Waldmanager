import { STANDARD_DECKKRAFT, STANDARD_REIHENFOLGE, istEbenenId, type EbenenId } from './registry';

// Reihenfolge und Deckkraft der Ebenen je Gerät
export const EBENEN_SPEICHER = 'waldmanager.karte.ebenen';

export type EbenenEinstellungen = { reihenfolge: EbenenId[]; deckkraft: Record<EbenenId, number> };

export const standardEinstellungen = (): EbenenEinstellungen => ({ reihenfolge: [...STANDARD_REIHENFOLGE], deckkraft: { ...STANDARD_DECKKRAFT } });

/**
 * Gespeicherte Reihenfolge an die aktuelle Registry anpassen: unbekannte und doppelte Ebenen fallen weg,
 * neue Ebenen rücken an ihren Standardplatz (direkt über die nächste bekannte Ebene darunter).
 * So bleibt die Nutzerreihenfolge erhalten, wenn eine Ebene hinzukommt.
 */
export function reihenfolgeAnpassen(gespeichert: unknown): EbenenId[] {
  if (!Array.isArray(gespeichert)) return [...STANDARD_REIHENFOLGE];
  const liste: EbenenId[] = [];
  for (const id of gespeichert) if (istEbenenId(id) && !liste.includes(id)) liste.push(id);
  if (!liste.length) return [...STANDARD_REIHENFOLGE];
  STANDARD_REIHENFOLGE.forEach((id, i) => {
    if (liste.includes(id)) return;
    const darunter = STANDARD_REIHENFOLGE.slice(i + 1).find((x) => liste.includes(x));
    liste.splice(darunter ? liste.indexOf(darunter) : liste.length, 0, id);
  });
  return liste;
}

/** Rohwert aus dem Speicher prüfen und ergänzen; ungültige Werte fallen auf den Standard zurück */
export function einstellungenAusRoh(roh: unknown): EbenenEinstellungen {
  const r = (roh && typeof roh === 'object' ? roh : {}) as { reihenfolge?: unknown; deckkraft?: Record<string, unknown> | null };
  const deckkraft = { ...STANDARD_DECKKRAFT };
  for (const id of STANDARD_REIHENFOLGE) {
    const w = r.deckkraft?.[id];
    if (typeof w === 'number' && w >= 0 && w <= 1) deckkraft[id] = w;
  }
  return { reihenfolge: reihenfolgeAnpassen(r.reihenfolge), deckkraft };
}

export function ebenenEinstellungenLesen(speicher: Pick<Storage, 'getItem'> = localStorage): EbenenEinstellungen {
  try {
    return einstellungenAusRoh(JSON.parse(speicher.getItem(EBENEN_SPEICHER) ?? 'null'));
  } catch {
    return standardEinstellungen();
  }
}
