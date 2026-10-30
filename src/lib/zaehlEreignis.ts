import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Gemeinsamer Auffrischungs-Mechanismus für Zählungen:
// Nach jedem Speichern einer Sichtung (online oder in die Warteschlange) wird `hegewerk:zaehlung-geaendert` ausgelöst.
export const ZAEHLUNG_EREIGNIS = 'hegewerk:zaehlung-geaendert';

export type ZaehlZeile = { id: string; sitzung_id: string; zone_id: string | null; anzahl: number; wildart_id?: string; geschlecht?: string };
export type ZaehlEreignis = {
  sitzungId: string;
  zoneId: string | null;
  // lokal: sofort angezeigt, noch nicht bestätigt · server: Datenbank hat den Wert (neu laden)
  quelle: 'lokal' | 'server';
  zeile?: ZaehlZeile;
};

export function zaehlungGeaendert(e: ZaehlEreignis) {
  window.dispatchEvent(new CustomEvent<ZaehlEreignis>(ZAEHLUNG_EREIGNIS, { detail: e }));
}

export function useZaehlungGeaendert(callback: (e: ZaehlEreignis) => void) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const h = (ev: Event) => ref.current((ev as CustomEvent<ZaehlEreignis>).detail);
    window.addEventListener(ZAEHLUNG_EREIGNIS, h);
    return () => window.removeEventListener(ZAEHLUNG_EREIGNIS, h);
  }, []);
}

// Summen der Sichtungen je Zone für eine Sitzung – mit sofortiger lokaler Anzeige.
// Zeilen werden über ihre ID ersetzt (Upsert-Semantik): nach der Synchronisation wird nichts doppelt gezählt.
export function useZonenSummen(sitzungId: string | null, wartende: (sitzungId: string) => ZaehlZeile[]): Record<string, number> {
  const [zeilen, setZeilen] = useState<Map<string, ZaehlZeile>>(new Map());

  const laden = useCallback(async () => {
    if (!sitzungId) {
      setZeilen(new Map());
      return;
    }
    const { data } = navigator.onLine
      ? await supabase.from('zaehlungen').select('id, sitzung_id, zone_id, anzahl').eq('sitzung_id', sitzungId).is('geloescht_am', null)
      : { data: null };
    const m = new Map<string, ZaehlZeile>();
    for (const z of data ?? []) m.set(z.id, z);
    for (const z of wartende(sitzungId)) m.set(z.id, z);
    setZeilen(m);
  }, [sitzungId, wartende]);

  useEffect(() => {
    void laden();
  }, [laden]);

  useZaehlungGeaendert((e) => {
    if (e.sitzungId !== sitzungId) return;
    if (e.zeile) {
      const z = e.zeile;
      setZeilen((alt) => new Map(alt).set(z.id, z));
    }
    if (e.quelle === 'server') void laden();
  });

  const summen: Record<string, number> = {};
  for (const z of zeilen.values()) summen[z.zone_id ?? 'ohne'] = (summen[z.zone_id ?? 'ohne'] ?? 0) + z.anzahl;
  return summen;
}
