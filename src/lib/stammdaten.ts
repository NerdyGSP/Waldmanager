import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Enums, Tables } from './database.types';

export type Wildart = Pick<Tables<'wildarten'>, 'id' | 'name' | 'gruppe' | 'sortierung' | 'altersklassen'>;
export type Zone = {
  id: string;
  name: string;
  farbe: string | null;
  sortierung: number;
  hatGeometrie: boolean;
  ebeneId: string | null;
};
export type ZonenEbene = { id: string; name: string; farbe: string | null; sortierung: number };
export type Mitglied = { user_id: string; name: string; rolle: Enums<'revier_rolle'> };

let wildartenCache: Wildart[] | null = null;

export function useWildarten(): Wildart[] {
  const [liste, setListe] = useState<Wildart[]>(wildartenCache ?? []);
  useEffect(() => {
    if (wildartenCache) return;
    void supabase
      .from('wildarten')
      .select('id, name, gruppe, sortierung, altersklassen')
      .order('sortierung')
      .then(({ data }) => {
        wildartenCache = [...(data ?? [])].sort((a, b) => a.sortierung - b.sortierung);
        setListe(wildartenCache);
      });
  }, []);
  return liste;
}

export function wildartName(liste: Wildart[], id: string): string {
  return liste.find((w) => w.id === id)?.name ?? id;
}

export function useZonen(revierId: string) {
  const [zonen, setZonen] = useState<Zone[]>([]);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async () => {
    const { data } = await supabase
      .from('zonen')
      .select('id, name, farbe, sortierung, geom, ebene_id')
      .eq('revier_id', revierId)
      .is('geloescht_am', null)
      .order('sortierung')
      .order('name');
    setZonen(
      (data ?? []).map((z) => ({
        id: z.id,
        name: z.name,
        farbe: z.farbe,
        sortierung: z.sortierung,
        hatGeometrie: z.geom !== null,
        ebeneId: z.ebene_id,
      })),
    );
    setLaedt(false);
  }, [revierId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  return { zonen, laedt, laden };
}

export function useZonenEbenen(revierId: string) {
  const [ebenen, setEbenen] = useState<ZonenEbene[]>([]);
  const laden = useCallback(async () => {
    const { data } = await supabase
      .from('zonen_ebenen')
      .select('id, name, farbe, sortierung')
      .eq('revier_id', revierId)
      .order('sortierung')
      .order('name');
    setEbenen(data ?? []);
  }, [revierId]);
  useEffect(() => {
    void laden();
  }, [laden]);
  return { ebenen, laden };
}

/** Prüft, ob ein Name (ohne Groß-/Kleinschreibung) schon vergeben ist */
export function nameVergeben(namen: Array<string | null | undefined>, name: string, ausser?: string | null): boolean {
  const n = name.trim().toLowerCase();
  return namen.some((x) => x != null && x.trim().toLowerCase() === n && x !== ausser);
}

export function useMitglieder(revierId: string): Mitglied[] {
  const [liste, setListe] = useState<Mitglied[]>([]);
  useEffect(() => {
    void supabase
      .from('revier_mitglieder')
      .select('user_id, rolle, profiles(name)')
      .eq('revier_id', revierId)
      .then(({ data }) =>
        setListe(
          (data ?? [])
            .map((m) => ({ user_id: m.user_id, rolle: m.rolle, name: m.profiles?.name ?? '?' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de')),
        ),
      );
  }, [revierId]);
  return liste;
}

export const GESCHLECHTER: Array<{ wert: Enums<'geschlecht'>; label: string; kurz: string }> = [
  { wert: 'maennlich', label: 'männlich', kurz: '♂' },
  { wert: 'weiblich', label: 'weiblich', kurz: '♀' },
  { wert: 'unbekannt', label: 'unbekannt', kurz: '?' },
];

export const ZONENFARBEN = ['#1e5c3a', '#b5651d', '#1f6fb2', '#8e44ad', '#c0392b', '#16a085', '#d4a017', '#5d6d7e'];

export const EINRICHTUNGSTYPEN: Array<{ wert: Enums<'einrichtung_typ'>; label: string; farbe: string }> = [
  { wert: 'hochsitz', label: 'Hochsitz', farbe: '#8b5a2b' },
  { wert: 'kanzel', label: 'Kanzel', farbe: '#5d3a1a' },
  { wert: 'ansitzleiter', label: 'Ansitzleiter', farbe: '#b07d4f' },
  { wert: 'bodensitz', label: 'Bodensitz', farbe: '#a0855b' },
  { wert: 'kirrung', label: 'Kirrung', farbe: '#d4a017' },
  { wert: 'salzlecke', label: 'Salzlecke', farbe: '#9aa5b1' },
  { wert: 'fuetterung', label: 'Fütterung', farbe: '#c97b2a' },
  { wert: 'wildacker', label: 'Wildacker', farbe: '#4caf50' },
  { wert: 'wildkamera', label: 'Wildkamera', farbe: '#1f6fb2' },
  { wert: 'falle', label: 'Falle', farbe: '#7f4f9e' },
  { wert: 'sonstiges', label: 'Sonstiges', farbe: '#5d6d7e' },
];
