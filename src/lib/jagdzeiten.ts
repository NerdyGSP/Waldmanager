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
  for (const z of zeilen) {
    const k = z.klasse ?? '';
    const e = m.get(k) ?? { name: z.klasse, zeilen: [], schonzeit: null, sonderregel: null };
    e.zeilen.push(z);
    e.schonzeit ??= z.schonzeit_text;
    e.sonderregel ??= z.sonderregel;
    m.set(k, e);
  }
  return [...m.values()];
}

export type Status = 'jagdbar' | 'schonzeit' | 'teilweise';

/** Status einer Wildart an einem Tag: alle Klassen jagdbar, keine, oder nur einzelne (Sonderregel) */
export function statusAm(zeilen: Jagdzeit[], datum: Date): { status: Status; jagdbar: string[]; geschont: string[] } {
  const md = monatTag(datum);
  const ks = klassen(zeilen);
  const jagdbar: string[] = [];
  const geschont: string[] = [];
  for (const k of ks) (k.zeilen.some((z) => imZeitraum(z, md)) ? jagdbar : geschont).push(k.name ?? 'alle');
  const status: Status = geschont.length === 0 ? 'jagdbar' : jagdbar.length === 0 ? 'schonzeit' : 'teilweise';
  return { status, jagdbar, geschont };
}

export const STATUS_TEXT: Record<Status, string> = { jagdbar: 'jagdbar', schonzeit: 'Schonzeit', teilweise: 'Sonderregel' };

/** Je Monat: 'voll' = alle Klassen den ganzen Monat jagdbar, 'teil' = zeitweise/teilweise, 'zu' = Schonzeit */
export function monatsbalken(zeilen: Jagdzeit[]): Array<'voll' | 'teil' | 'zu'> {
  const ks = klassen(zeilen);
  const tage = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return tage.map((n, mi) => {
    let irgendwer = 0;
    let alle = 0;
    for (let t = 1; t <= n; t++) {
      const md = `${String(mi + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
      const k = ks.filter((x) => x.zeilen.some((z) => imZeitraum(z, md))).length;
      if (k > 0) irgendwer++;
      if (k === ks.length) alle++;
    }
    return alle === n ? 'voll' : irgendwer > 0 ? 'teil' : 'zu';
  });
}

/** Warntext, wenn eine Wildart am Datum (ganz oder teilweise) außerhalb der Jagdzeit liegt; sonst null */
export function jagdzeitWarnung(alle: Jagdzeit[] | null, wildartId: string, datum: Date): { art: 'warnung' | 'info'; text: string } | null {
  if (!alle) return null;
  const zeilen = alle.filter((z) => z.wildart_id === wildartId);
  if (!zeilen.length) return null;
  const s = statusAm(zeilen, datum);
  if (s.status === 'schonzeit') return { art: 'warnung', text: 'Laut hinterlegten Zeiten liegt dieses Datum außerhalb der Jagdzeit (Schonzeit). Bitte prüfen.' };
  if (s.status === 'teilweise')
    return { art: 'info', text: `Für diese Wildart gelten je nach Klasse unterschiedliche Zeiten. Am Datum jagdbar: ${s.jagdbar.join(', ')}. Schonzeit: ${s.geschont.join(', ')}.` };
  return null;
}
