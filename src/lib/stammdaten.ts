import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Enums } from './database.types';

/** Baumartenanteil eines Bestands, gespeichert in bestaende.baumarten */
export type Baumartenanteil = { art: string; anteil: number };

export type Bestand = {
  id: string;
  name: string;
  abteilung: string | null;
  bestandestyp: string | null;
  baumarten: Baumartenanteil[];
  pflanzjahr: number | null;
  vorratVfmHa: number | null;
  farbe: string | null;
  sortierung: number;
  hatGeometrie: boolean;
};
export type Mitglied = { user_id: string; name: string; rolle: Enums<'betrieb_rolle'> };

/** Gängige Baumarten mit forstlichem Kürzel */
export const BAUMARTEN: Array<{ kuerzel: string; name: string; gruppe: 'nadel' | 'laub' }> = [
  { kuerzel: 'Fi', name: 'Fichte', gruppe: 'nadel' },
  { kuerzel: 'Ki', name: 'Kiefer', gruppe: 'nadel' },
  { kuerzel: 'Dgl', name: 'Douglasie', gruppe: 'nadel' },
  { kuerzel: 'Lä', name: 'Lärche', gruppe: 'nadel' },
  { kuerzel: 'Ta', name: 'Tanne', gruppe: 'nadel' },
  { kuerzel: 'Bu', name: 'Buche', gruppe: 'laub' },
  { kuerzel: 'Ei', name: 'Eiche', gruppe: 'laub' },
  { kuerzel: 'BAh', name: 'Bergahorn', gruppe: 'laub' },
  { kuerzel: 'Es', name: 'Esche', gruppe: 'laub' },
  { kuerzel: 'Hbu', name: 'Hainbuche', gruppe: 'laub' },
  { kuerzel: 'Bi', name: 'Birke', gruppe: 'laub' },
  { kuerzel: 'Erl', name: 'Erle', gruppe: 'laub' },
];

export function baumartName(kuerzel: string): string {
  return BAUMARTEN.find((b) => b.kuerzel === kuerzel)?.name ?? kuerzel;
}

/** Liest die Baumartenanteile robust aus dem JSON-Feld */
export function baumartenLesen(wert: unknown): Baumartenanteil[] {
  if (!Array.isArray(wert)) return [];
  return wert.flatMap((x) => {
    const o = x as { art?: unknown; anteil?: unknown };
    return typeof o?.art === 'string' && Number.isFinite(Number(o.anteil)) ? [{ art: o.art, anteil: Number(o.anteil) }] : [];
  });
}

/** Kurzform wie „Fi 80 · Lä 20“ */
export function baumartenText(liste: Baumartenanteil[]): string {
  return liste.map((b) => `${b.art} ${b.anteil}`).join(' · ');
}

export function useBestaende(betriebId: string) {
  const [bestaende, setBestaende] = useState<Bestand[]>([]);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async () => {
    const { data } = await supabase
      .from('bestaende')
      .select('id, name, abteilung, bestandestyp, baumarten, pflanzjahr, vorrat_vfm_ha, farbe, sortierung, geom')
      .eq('betrieb_id', betriebId)
      .is('geloescht_am', null)
      .order('sortierung')
      .order('name');
    setBestaende(
      (data ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        abteilung: b.abteilung,
        bestandestyp: b.bestandestyp,
        baumarten: baumartenLesen(b.baumarten),
        pflanzjahr: b.pflanzjahr,
        vorratVfmHa: b.vorrat_vfm_ha,
        farbe: b.farbe,
        sortierung: b.sortierung,
        hatGeometrie: b.geom !== null,
      })),
    );
    setLaedt(false);
  }, [betriebId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  return { bestaende, laedt, laden };
}

/** Prüft, ob ein Name (ohne Groß-/Kleinschreibung) schon vergeben ist */
export function nameVergeben(namen: Array<string | null | undefined>, name: string, ausser?: string | null): boolean {
  const n = name.trim().toLowerCase();
  return namen.some((x) => x != null && x.trim().toLowerCase() === n && x !== ausser);
}

export function useMitglieder(betriebId: string): Mitglied[] {
  const [liste, setListe] = useState<Mitglied[]>([]);
  useEffect(() => {
    void supabase
      .from('betrieb_mitglieder')
      .select('user_id, rolle, profiles(name)')
      .eq('betrieb_id', betriebId)
      .then(({ data }) =>
        setListe(
          (data ?? [])
            .map((m) => ({ user_id: m.user_id, rolle: m.rolle, name: m.profiles?.name ?? '?' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de')),
        ),
      );
  }, [betriebId]);
  return liste;
}

export const BESTANDSFARBEN = ['#2f6b4a', '#b5651d', '#1f6fb2', '#8e44ad', '#c0392b', '#16a085', '#d4a017', '#5d6d7e'];

// n gut unterscheidbare Zufallsfarben (Goldener Winkel, zufälliger Startton)
export function zufallsFarben(n: number): string[] {
  const start = Math.random() * 360;
  return Array.from({ length: n }, (_, i) => {
    const h = (start + i * 137.508) % 360;
    const sat = (52 + ((i * 17) % 26)) / 100;
    const l = (38 + ((i * 11) % 14)) / 100;
    const a = sat * Math.min(l, 1 - l);
    const f = (k: number) => {
      const kk = (k + h / 30) % 12;
      const c = l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  });
}
