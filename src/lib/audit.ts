import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Ab diesem Zeitpunkt füllt die Datenbank Ersteller/Bearbeiter automatisch. Ältere Datensätze haben keine Angabe („–“),
// neuere ohne Angabe gehören zu einem gelöschten Account („Ehemaliges Mitglied“).
export const AUDIT_AB = '2026-10-30T12:30:00Z';

const cache = new Map<string, string>();

export function useProfilNamen(ids: Array<string | null | undefined>): Map<string, string> {
  const gueltig = [...new Set(ids.filter((x): x is string => !!x))];
  const schluessel = gueltig.sort().join(',');
  const [, setZaehler] = useState(0);
  useEffect(() => {
    const fehlend = gueltig.filter((id) => !cache.has(id));
    if (!fehlend.length) return;
    let aktiv = true;
    void supabase
      .from('profiles')
      .select('id, name')
      .in('id', fehlend)
      .then(({ data }) => {
        for (const p of data ?? []) cache.set(p.id, p.name);
        for (const id of fehlend) if (!cache.has(id)) cache.set(id, 'Mitglied');
        if (aktiv) setZaehler((z) => z + 1);
      });
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  return cache;
}

export function personText(id: string | null | undefined, am: string | null | undefined, namen: Map<string, string>): string {
  if (id) return namen.get(id) ?? '…';
  if (am && am >= AUDIT_AB) return 'Ehemaliges Mitglied';
  return '–';
}

export type AuditTabelle = 'einrichtungen' | 'zonen' | 'zonen_ebenen' | 'routen_ebenen' | 'pirschwege' | 'revier_grenzen' | 'zaehlsitzungen' | 'beobachtungen' | 'abschuesse' | 'wildschaeden' | 'aufgaben' | 'aufgabenlisten' | 'begehungsscheine' | 'bewegungsjagden' | 'flaechen' | 'flaechen_ebenen';

// Spaltennamen je Tabelle: Ersteller und ggf. Abschluss
export const AUDIT_FELDER: Record<AuditTabelle, { von: string; label: string; abschluss?: { von: string; am: string; label: string } }> = {
  einrichtungen: { von: 'erstellt_von', label: 'Erstellt' },
  zonen: { von: 'erstellt_von', label: 'Erstellt' },
  zonen_ebenen: { von: 'erstellt_von', label: 'Erstellt' },
  flaechen: { von: 'erstellt_von', label: 'Importiert' },
  flaechen_ebenen: { von: 'erstellt_von', label: 'Importiert' },
  routen_ebenen: { von: 'erstellt_von', label: 'Erstellt' },
  pirschwege: { von: 'erstellt_von', label: 'Erstellt' },
  revier_grenzen: { von: 'erstellt_von', label: 'Erstellt' },
  zaehlsitzungen: { von: 'erstellt_von', label: 'Gestartet', abschluss: { von: 'abgeschlossen_von', am: 'abgeschlossen_am', label: 'Abgeschlossen' } },
  beobachtungen: { von: 'erfasst_von', label: 'Erfasst' },
  abschuesse: { von: 'erfasst_von', label: 'Erfasst' },
  wildschaeden: { von: 'erfasst_von', label: 'Gemeldet', abschluss: { von: 'erledigt_von', am: 'erledigt_am', label: 'Erledigt' } },
  aufgaben: { von: 'erstellt_von', label: 'Erstellt', abschluss: { von: 'erledigt_von', am: 'erledigt_am', label: 'Erledigt' } },
  aufgabenlisten: { von: 'erstellt_von', label: 'Erstellt', abschluss: { von: 'erledigt_von', am: 'erledigt_am', label: 'Erledigt' } },
  begehungsscheine: { von: 'ausgestellt_von', label: 'Ausgestellt' },
  bewegungsjagden: { von: 'erstellt_von', label: 'Angelegt', abschluss: { von: 'abgeschlossen_von', am: 'abgeschlossen_am', label: 'Abgeschlossen' } },
};
