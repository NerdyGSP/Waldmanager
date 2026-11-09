// Feldgrenzen (Schläge): Laden der Ebene für die Karte und Farben je Fruchtgruppe
import { useCallback, useEffect, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { supabase } from './supabase';
import { fruchtgruppe } from './fruchtgruppen';

export type FeldEbene = {
  id: string;
  name: string;
  anbaujahr: number | null;
  quelle: string | null;
  farben: Record<string, string>;
  erstellt_am: string;
  anzahl: number;
  hektar: number;
};
export type FeldProps = {
  id: string;
  ebene_id: string;
  name: string;
  schlag_nr: string | null;
  frucht_roh: string | null;
  fruchtgruppe: string;
  flaeche_ha: number;
  flaeche_im_revier_ha: number;
  farbe: string;
};
export type FeldFeature = Feature<Geometry, FeldProps>;

/** Farbe einer Gruppe: Wert der Ebene, sonst Standardfarbe */
export const gruppenFarbe = (farben: Record<string, string> | undefined, gruppe: string): string => farben?.[gruppe] ?? fruchtgruppe(gruppe).farbe;

export function useFelder(revierId: string, aktiv: boolean, wahl: string | null) {
  const [ebenen, setEbenen] = useState<FeldEbene[]>([]);
  const [ebeneId, setEbeneId] = useState<string | null>(null);
  const [fc, setFc] = useState<FeatureCollection<Geometry, FeldProps>>({ type: 'FeatureCollection', features: [] });
  const [fehler, setFehler] = useState(false);

  const laden = useCallback(async () => {
    const { data, error } = await supabase.rpc('felder_laden', { p_revier: revierId, p_ebene: wahl ?? undefined });
    if (error) {
      setFehler(true);
      return;
    }
    setFehler(false);
    const d = data as unknown as { ebenen: FeldEbene[]; ebene_id: string | null; flaechen: FeatureCollection<Geometry, Omit<FeldProps, 'farbe'>> };
    const eb = d.ebenen ?? [];
    const farben = eb.find((e) => e.id === d.ebene_id)?.farben ?? {};
    setEbenen(eb);
    setEbeneId(d.ebene_id);
    setFc({
      type: 'FeatureCollection',
      features: (d.flaechen?.features ?? []).map((f) => ({ ...f, properties: { ...f.properties, farbe: gruppenFarbe(farben, f.properties.fruchtgruppe) } })),
    });
  }, [revierId, wahl]);

  // Daten werden erst beim Einschalten geladen
  useEffect(() => {
    if (aktiv) void laden();
  }, [aktiv, laden]);

  return { ebenen, ebeneId, fc, fehler, laden };
}
