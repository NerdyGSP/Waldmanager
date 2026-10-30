import { useCallback, useEffect, useState } from 'react';
import type { Geometry } from 'geojson';
import { supabase } from './supabase';

export type RouteTyp = 'pirschweg' | 'wte_route' | 'treiberroute';
export const ROUTENTYPEN: Array<{ wert: RouteTyp; label: string; gruppe: string; farbe: string }> = [
  { wert: 'pirschweg', label: 'Pirschweg', gruppe: 'Pirschwege', farbe: '#7b4a12' },
  { wert: 'wte_route', label: 'WTE-Route', gruppe: 'WTE-Routen', farbe: '#00796b' },
  { wert: 'treiberroute', label: 'Treiberroute', gruppe: 'Treiberrouten', farbe: '#c2185b' },
];
export const routenTypLabel = (t: string) => ROUTENTYPEN.find((x) => x.wert === t)?.label ?? t;
export const routenTypFarbe = (t: string) => ROUTENTYPEN.find((x) => x.wert === t)?.farbe ?? '#5d6d7e';

export type RoutenEbene = { id: string; name: string; farbe: string | null; reihenfolge: number; typ: RouteTyp; wte_aktiv: boolean };
export type Route = {
  id: string;
  name: string;
  typ: RouteTyp;
  ebeneId: string | null;
  /** eigene Farbe oder, falls nicht gesetzt, die Ebenenfarbe */
  farbe: string | null;
  laengeM: number;
  bewegungsjagdId: string | null;
  jagdOffen: boolean | null;
  geometry: Geometry;
};

export function useRoutenEbenen(revierId: string) {
  const [ebenen, setEbenen] = useState<RoutenEbene[]>([]);
  const laden = useCallback(async () => {
    const { data } = await supabase
      .from('routen_ebenen')
      .select('id, name, farbe, reihenfolge, typ, wte_aktiv')
      .eq('revier_id', revierId)
      .is('geloescht_am', null)
      .order('reihenfolge')
      .order('name');
    setEbenen((data ?? []) as RoutenEbene[]);
  }, [revierId]);
  useEffect(() => {
    void laden();
  }, [laden]);
  return { ebenen, laden };
}

// Routen samt Geometrie und Länge über die Kartenabfrage
export function useRouten(revierId: string) {
  const [routen, setRouten] = useState<Route[]>([]);
  const [laedt, setLaedt] = useState(true);
  const laden = useCallback(async () => {
    const { data } = await supabase.rpc('karte_daten', { p_revier_id: revierId, p_tage: 1 });
    const x = data as unknown as { pirschwege?: Array<{ geometry: Geometry; properties: Record<string, unknown> }> } | null;
    setRouten(
      (x?.pirschwege ?? []).map((f) => ({
        id: String(f.properties.id),
        name: String(f.properties.name ?? ''),
        typ: f.properties.typ as RouteTyp,
        ebeneId: (f.properties.ebene_id as string | null) ?? null,
        farbe: (f.properties.farbe as string | null) ?? null,
        laengeM: Number(f.properties.laenge_m ?? 0),
        bewegungsjagdId: (f.properties.bewegungsjagd_id as string | null) ?? null,
        jagdOffen: (f.properties.jagd_offen as boolean | null) ?? null,
        geometry: f.geometry,
      })),
    );
    setLaedt(false);
  }, [revierId]);
  useEffect(() => {
    void laden();
  }, [laden]);
  return { routen, laedt, laden };
}

export const kmText = (m: number) => `${(m / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;

// Freien Routennamen finden (Namen sind je Revier eindeutig, ohne Groß-/Kleinschreibung)
export function freierName(vorhanden: Array<string | null | undefined>, basis: string): string {
  const belegt = new Set(vorhanden.map((n) => (n ?? '').trim().toLowerCase()));
  if (!belegt.has(basis.trim().toLowerCase())) return basis.trim();
  for (let i = 2; i < 1000; i++) if (!belegt.has(`${basis.trim()} ${i}`.toLowerCase())) return `${basis.trim()} ${i}`;
  return `${basis.trim()} ${Date.now()}`;
}

// Fokus für „Auf Karte zeigen“ (Karte liest und löscht ihn beim Laden)
export const ROUTENFOKUS = 'hegewerk:routenfokus';

// Zielebene für eine zu speichernde Route: vorhandene Ebene, neue Ebene (einmal je Name anlegen) oder keine
export async function ebeneBereitstellen(
  revierId: string,
  typ: RouteTyp,
  ebeneId: string,
  neuerName: string,
  bekannte: RoutenEbene[],
  cache: Map<string, string>,
): Promise<string | null> {
  if (ebeneId !== '__neu') return ebeneId || null;
  const name = neuerName.trim();
  const schluessel = `${typ}|${name.toLowerCase()}`;
  const vorhanden = cache.get(schluessel) ?? bekannte.find((e) => e.typ === typ && e.name.trim().toLowerCase() === name.toLowerCase())?.id;
  if (vorhanden) return vorhanden;
  const { data, error } = await supabase
    .from('routen_ebenen')
    .insert({ revier_id: revierId, name, typ, reihenfolge: bekannte.length + cache.size, wte_aktiv: typ === 'wte_route', farbe: ROUTENTYPEN.find((t) => t.wert === typ)?.farbe ?? null })
    .select('id')
    .single();
  if (error) throw error;
  cache.set(schluessel, data.id);
  return data.id;
}
