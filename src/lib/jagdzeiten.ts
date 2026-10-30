import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Tables } from './database.types';

export type Jagdzeit = Tables<'jagdzeiten'>;

export const BUNDESLAENDER = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern',
  'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
] as const;

export const RECHTSHINWEIS = 'Keine Rechtsauskunft – verbindlich ist die jeweilige Landesverordnung. Werte können sich ändern; im Zweifel bei der Jagdbehörde nachfragen.';

const CACHE = (bl: string) => `hegewerk.jagdzeiten.${bl}`;

/** Jagdzeiten eines Bundeslandes; lokal zwischengespeichert, damit sie auch offline verfügbar sind */
export function useJagdzeiten(bundesland: string) {
  const lesen = (): Jagdzeit[] | null => {
    try {
      const t = localStorage.getItem(CACHE(bundesland));
      return t ? (JSON.parse(t) as Jagdzeit[]) : null;
    } catch {
      return null;
    }
  };
  const [zeilen, setZeilen] = useState<Jagdzeit[] | null>(lesen);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { data, error } = await supabase.from('jagdzeiten').select('*').eq('bundesland', bundesland).order('sortierung');
    if (error) {
      setFehler(error.message);
      return;
    }
    setFehler(null);
    setZeilen(data ?? []);
    try {
      localStorage.setItem(CACHE(bundesland), JSON.stringify(data ?? []));
    } catch {
      /* Speicher voll oder gesperrt */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundesland]);

  useEffect(() => {
    setZeilen(lesen());
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundesland, laden]);

  return { zeilen, fehler, geladen: zeilen !== null };
}

export function monatTag(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function imZeitraum(z: Jagdzeit, md: string): boolean {
  if (z.ganzjaehrig || !z.jagdzeit_von || !z.jagdzeit_bis) return !!z.ganzjaehrig;
  return z.jagdzeit_von <= z.jagdzeit_bis ? md >= z.jagdzeit_von && md <= z.jagdzeit_bis : md >= z.jagdzeit_von || md <= z.jagdzeit_bis;
}

export function mdText(md: string): string {
  const [m, t] = md.split('-').map(Number);
  return `${t}.${m}.`;
}

export function zeitraumText(z: Jagdzeit): string {
  return z.ganzjaehrig ? 'ganzjährig' : `${mdText(z.jagdzeit_von!)}–${mdText(z.jagdzeit_bis!)}`;
}

export type Klasse = { name: string | null; zeilen: Jagdzeit[]; schonzeit: string | null; sonderregel: string | null };

export function klassen(zeilen: Jagdzeit[]): Klasse[] {
  const m = new Map<string, Klasse>();
  for (const z of [...zeilen].sort((a, b) => a.sortierung - b.sortierung)) {
    const k = z.klasse ?? '';
    const e = m.get(k) ?? { name: z.klasse, zeilen: [], schonzeit: null, sonderregel: null };
    e.zeilen.push(z);
    e.schonzeit ??= z.schonzeit_text;
    e.sonderregel ??= z.sonderregel;
    m.set(k, e);
  }
  return [...m.values()];
}

export type Status = 'jagdbar' | 'eingeschraenkt' | 'schonzeit';

// ---------- Jagdjahr-Skala: 1. April (0) bis 31. März (364), 29. Februar entfällt ----------
export const JAGDJAHR_TAGE = 365;
const MONATSLAENGE = [30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31]; // Apr … Mär
const MONATSSTART = MONATSLAENGE.map((_, i) => MONATSLAENGE.slice(0, i).reduce((a, n) => a + n, 0));
export const MONATSBUCHSTABEN = ['A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D', 'J', 'F', 'M'];
export const MONATSNAMEN_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Position (0–364) eines „MM-TT“ im Jagdjahr; der 29. Februar zählt als 28. Februar */
export function tagImJagdjahr(md: string): number {
  const [m, t] = md.split('-').map(Number) as [number, number];
  const mi = (m - 4 + 12) % 12;
  return MONATSSTART[mi]! + Math.min(t, MONATSLAENGE[mi]!) - 1;
}

/** Monatsmitten und -längen für die Beschriftung (proportional zur Monatslänge) */
export const MONATE_SKALA = MONATSLAENGE.map((n, i) => ({ start: MONATSSTART[i]!, laenge: n, buchstabe: MONATSBUCHSTABEN[i]! }));

export type Zeitraum = { von: number; bis: number; eingeschraenkt: boolean };

/** Zusammenhängende Zeiträume einer Klasse auf der Jagdjahr-Skala; Zeiträume über das Jagdjahr-Ende werden geteilt */
export function zeitraeume(klasse: Klasse): Zeitraum[] {
  const out: Zeitraum[] = [];
  for (const z of klasse.zeilen) {
    if (z.ganzjaehrig) {
      out.push({ von: 0, bis: JAGDJAHR_TAGE - 1, eingeschraenkt: z.eingeschraenkt });
      continue;
    }
    if (!z.jagdzeit_von || !z.jagdzeit_bis) continue;
    const v = tagImJagdjahr(z.jagdzeit_von);
    const b = tagImJagdjahr(z.jagdzeit_bis);
    if (v <= b) out.push({ von: v, bis: b, eingeschraenkt: z.eingeschraenkt });
    else {
      out.push({ von: v, bis: JAGDJAHR_TAGE - 1, eingeschraenkt: z.eingeschraenkt });
      out.push({ von: 0, bis: b, eingeschraenkt: z.eingeschraenkt });
    }
  }
  return out;
}

const tagLang = (md: string) => {
  const [m, t] = md.split('-').map(Number) as [number, number];
  return `${t}. ${MONATSNAMEN_LANG[m - 1]}`;
};

/** „1. April – 15. Mai, 1. September – 31. Januar“, ganzjährig = „ganzjährig“ */
export function zeitraumLang(klasse: Klasse): string {
  if (klasse.zeilen.some((z) => z.ganzjaehrig)) return 'ganzjährig';
  return klasse.zeilen
    .filter((z) => z.jagdzeit_von && z.jagdzeit_bis)
    .sort((a, b) => tagImJagdjahr(a.jagdzeit_von!) - tagImJagdjahr(b.jagdzeit_von!))
    .map((z) => `${tagLang(z.jagdzeit_von!)} – ${tagLang(z.jagdzeit_bis!)}`)
    .join(', ');
}

/** Status einer Klasse am Tag „MM-TT“: Zeitraum ohne Einschränkung gewinnt vor eingeschränktem */
export function statusKlasse(klasse: Klasse, md: string): Status {
  const treffer = klasse.zeilen.filter((z) => imZeitraum(z, md));
  if (!treffer.length) return 'schonzeit';
  return treffer.some((z) => !z.eingeschraenkt) ? 'jagdbar' : 'eingeschraenkt';
}

/** Status einer Wildart: alle Klassen jagdbar = jagdbar, keine = Schonzeit, sonst eingeschränkt */
export function statusAm(zeilen: Jagdzeit[], datum: Date): { status: Status; jagdbar: string[]; geschont: string[] } {
  const md = monatTag(datum);
  const jagdbar: string[] = [];
  const geschont: string[] = [];
  let eingeschraenkt = false;
  for (const k of klassen(zeilen)) {
    const s = statusKlasse(k, md);
    if (s === 'schonzeit') geschont.push(k.name ?? 'alle');
    else {
      jagdbar.push(k.name ?? 'alle');
      if (s === 'eingeschraenkt') eingeschraenkt = true;
    }
  }
  const status: Status = jagdbar.length === 0 ? 'schonzeit' : geschont.length === 0 && !eingeschraenkt ? 'jagdbar' : 'eingeschraenkt';
  return { status, jagdbar, geschont };
}

export const STATUS_TEXT: Record<Status, string> = { jagdbar: 'jagdbar', schonzeit: 'Schonzeit', eingeschraenkt: 'eingeschränkt' };

/** Tagesstatus über alle Klassen für die Übersicht (365 Werte): 2 = alle jagdbar, 1 = teils, 0 = Schonzeit */
export function tagesverlauf(klassenListe: Klasse[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < JAGDJAHR_TAGE; i++) {
    let mi = 0; while (mi < 11 && MONATSSTART[mi + 1]! <= i) mi++;
    const tag = i - MONATSSTART[mi]! + 1;
    const monat = ((mi + 3) % 12) + 1;
    const md = `${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
    const st = klassenListe.map((k) => statusKlasse(k, md));
    out.push(st.every((x) => x === 'jagdbar') ? 2 : st.some((x) => x !== 'schonzeit') ? 1 : 0);
  }
  return out;
}

/** Warntext, wenn eine Wildart am Datum (ganz oder teilweise) außerhalb der Jagdzeit liegt; sonst null */
export function jagdzeitWarnung(alle: Jagdzeit[] | null, wildartId: string, datum: Date): { art: 'warnung' | 'info'; text: string } | null {
  if (!alle) return null;
  const zeilen = alle.filter((z) => z.wildart_id === wildartId);
  if (!zeilen.length) return null;
  const s = statusAm(zeilen, datum);
  if (s.status === 'schonzeit') return { art: 'warnung', text: 'Laut hinterlegten Zeiten liegt dieses Datum außerhalb der Jagdzeit (Schonzeit). Bitte prüfen.' };
  if (s.status === 'eingeschraenkt')
    return { art: 'info', text: `Für diese Wildart gelten je nach Klasse unterschiedliche Zeiten oder Einschränkungen.${s.jagdbar.length ? ` Am Datum jagdbar: ${s.jagdbar.join(', ')}.` : ''}${s.geschont.length ? ` Schonzeit: ${s.geschont.join(', ')}.` : ''}` };
  return null;
}
