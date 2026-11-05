import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { TablesInsert } from './database.types';
import { zaehlungGeaendert, type ZaehlZeile } from './zaehlEreignis';

// Offline-Warteschlange für Erfassungen im Feld.
// Datensätze tragen eine clientseitige UUID; das Senden ist per Upsert idempotent.
type Eintrag =
  | { tabelle: 'beobachtungen'; daten: TablesInsert<'beobachtungen'> & { id: string } }
  | { tabelle: 'zaehlungen'; daten: TablesInsert<'zaehlungen'> & { id: string } }
  | { tabelle: 'einrichtungen'; daten: { id: string; geom: string } } // Position einmessen/verschieben
  | { tabelle: 'zaehlsitzungen'; daten: TablesInsert<'zaehlsitzungen'> & { id: string }; routen?: string[] } // neue Zählung
  | { tabelle: 'zaehlsitzung_abschluss'; daten: { id: string; ende: string } } // Zählung abschließen
  | { tabelle: 'abschuesse'; daten: TablesInsert<'abschuesse'> & { id: string } }; // Abschuss, Fallwild, Fang (neu)

// Eindeutiger Schlüssel je Eintrag (Abschluss und Anlage einer Sitzung teilen sich die ID)
const schluessel = (e: Eintrag) => `${e.tabelle}:${e.daten.id}`;

const SCHLUESSEL = 'hegewerk.warteschlange';
const EREIGNIS = 'hegewerk:warteschlange';

function lesen(): Eintrag[] {
  try {
    return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '[]') as Eintrag[];
  } catch {
    return [];
  }
}

function schreiben(liste: Eintrag[]) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(liste));
  } catch {
    /* Speicher voll oder gesperrt */
  }
  window.dispatchEvent(new Event(EREIGNIS));
}

function istNetzfehler(fehler: unknown): boolean {
  const text = String((fehler as { message?: string })?.message ?? fehler);
  return !navigator.onLine || /failed to fetch|network|load failed|fetch/i.test(text);
}

async function senden(e: Eintrag): Promise<{ ok: boolean; netz: boolean; fehler?: string }> {
  try {
    let error: { message: string; code?: string } | null;
    switch (e.tabelle) {
      case 'beobachtungen':
        ({ error } = await supabase.from('beobachtungen').upsert(e.daten, { onConflict: 'id' }));
        break;
      case 'einrichtungen':
        ({ error } = await supabase.from('einrichtungen').update({ geom: e.daten.geom }).eq('id', e.daten.id));
        break;
      case 'zaehlungen':
        ({ error } = await supabase.from('zaehlungen').upsert(e.daten, { onConflict: 'id' }));
        break;
      case 'zaehlsitzungen': {
        // Bereits übertragene Zeilen werden übersprungen (wiederholtes Senden ist unschädlich)
        ({ error } = await supabase.from('zaehlsitzungen').upsert(e.daten, { onConflict: 'id', ignoreDuplicates: true }));
        if (!error && e.routen?.length) {
          ({ error } = await supabase
            .from('zaehlsitzung_routen')
            .upsert(e.routen.map((route_id) => ({ sitzung_id: e.daten.id, route_id, revier_id: e.daten.revier_id })), { onConflict: 'sitzung_id,route_id', ignoreDuplicates: true }));
        }
        break;
      }
      case 'zaehlsitzung_abschluss':
        ({ error } = await supabase.from('zaehlsitzungen').update({ status: 'abgeschlossen', ende: e.daten.ende }).eq('id', e.daten.id));
        break;
      case 'abschuesse':
        ({ error } = await supabase.from('abschuesse').upsert(e.daten, { onConflict: 'id', ignoreDuplicates: true }));
        break;
    }
    if (!error) return { ok: true, netz: false };
    // Abgelaufene Anmeldung ist kein fachlicher Fehler: Eintrag behalten, bis das Token erneuert ist
    const abgelaufen = /jwt|token|expired|not authenticated/i.test(error.message) || error.code === 'PGRST301';
    return { ok: false, netz: istNetzfehler(error) || abgelaufen, fehler: error.message };
  } catch (err) {
    return { ok: false, netz: true, fehler: String(err) };
  }
}

// Hängt der Eintrag von einer noch wartenden Zählung ab? Dann muss er hinter ihr in der Warteschlange bleiben.
function haengtVonWartenderSitzung(e: Eintrag): boolean {
  const sitzungId = e.tabelle === 'zaehlungen' ? e.daten.sitzung_id : e.tabelle === 'zaehlsitzung_abschluss' ? e.daten.id : null;
  return !!sitzungId && lesen().some((x) => x.tabelle === 'zaehlsitzungen' && x.daten.id === sitzungId);
}

// Speichert sofort, bei fehlender Verbindung landet der Eintrag in der Warteschlange.
export async function speichernOderMerken(e: Eintrag): Promise<'gespeichert' | 'gemerkt'> {
  const zeile = e.tabelle === 'zaehlungen' ? zeileVon(e.daten) : null;
  // Sofortige Anzeige (optimistisch), auch offline
  if (zeile) zaehlungGeaendert({ sitzungId: zeile.sitzung_id, zoneId: zeile.zone_id, quelle: 'lokal', zeile });
  if (navigator.onLine && !haengtVonWartenderSitzung(e)) {
    const r = await senden(e);
    if (r.ok) {
      if (zeile) zaehlungGeaendert({ sitzungId: zeile.sitzung_id, zoneId: zeile.zone_id, quelle: 'server', zeile });
      return 'gespeichert';
    }
    if (!r.netz) {
      // Fehlgeschlagen: Ansichten neu vom Server laden, damit der optimistische Wert verschwindet
      if (zeile) zaehlungGeaendert({ sitzungId: zeile.sitzung_id, zoneId: zeile.zone_id, quelle: 'server' });
      throw new Error(r.fehler ?? 'Speichern fehlgeschlagen');
    }
  }
  schreiben([...lesen().filter((x) => schluessel(x) !== schluessel(e)), e]);
  // Online, aber abhängig von einer wartenden Zählung: sofort in der richtigen Reihenfolge senden
  if (navigator.onLine) void warteschlangeAbarbeiten();
  return 'gemerkt';
}

function zeileVon(d: { id: string; sitzung_id?: string | null; zone_id?: string | null; anzahl?: number; wildart_id?: string; geschlecht?: string }): ZaehlZeile | null {
  return d.sitzung_id ? { id: d.id, sitzung_id: d.sitzung_id, zone_id: d.zone_id ?? null, anzahl: d.anzahl ?? 0, wildart_id: d.wildart_id, geschlecht: d.geschlecht } : null;
}

// Noch nicht übertragene Zählzeilen einer Sitzung (für die lokale Anzeige)
export function wartendeZaehlungen(sitzungId: string): ZaehlZeile[] {
  return lesen().flatMap((x) => {
    if (x.tabelle !== 'zaehlungen') return [];
    const z = zeileVon(x.daten);
    return z && z.sitzung_id === sitzungId ? [z] : [];
  });
}

// Noch nicht übertragene neue Zählungen eines Reviers (für die lokale Anzeige)
export function wartendeSitzungen(revierId: string): Array<{ daten: TablesInsert<'zaehlsitzungen'> & { id: string }; summe: number }> {
  const liste = lesen();
  return liste.flatMap((x) =>
    x.tabelle === 'zaehlsitzungen' && x.daten.revier_id === revierId
      ? [{ daten: x.daten, summe: liste.reduce((a, z) => (z.tabelle === 'zaehlungen' && z.daten.sitzung_id === x.daten.id ? a + (z.daten.anzahl ?? 0) : a), 0) }]
      : [],
  );
}

// Wartender Abschluss einer Zählung (Zeitpunkt) oder null
export function wartenderAbschluss(sitzungId: string): string | null {
  const x = lesen().find((e) => e.tabelle === 'zaehlsitzung_abschluss' && e.daten.id === sitzungId);
  return x && x.tabelle === 'zaehlsitzung_abschluss' ? x.daten.ende : null;
}

// Noch nicht übertragene neue Abschüsse/Fänge eines Reviers (für die lokale Anzeige)
export function wartendeAbschuesse(revierId: string): Array<TablesInsert<'abschuesse'> & { id: string }> {
  return lesen().flatMap((x) => (x.tabelle === 'abschuesse' && x.daten.revier_id === revierId ? [x.daten] : []));
}

let laeuft = false;

export async function warteschlangeAbarbeiten(): Promise<void> {
  if (laeuft || !navigator.onLine) return;
  laeuft = true;
  try {
    if (lesen().length === 0) return;
    // Erst die Sitzung erneuern (online), sonst scheitert das Senden mit abgelaufenem Token
    const { data: sitzung } = await supabase.auth.getSession();
    if (!sitzung.session) return;
    const rest: Eintrag[] = [];
    for (const e of lesen()) {
      const r = await senden(e);
      // Fachliche Fehler (z. B. Revier gelöscht) verwerfen, Netzfehler behalten
      if (!r.ok && r.netz) rest.push(e);
      // Übertragen: Ansichten laden den Serverwert neu und ersetzen den lokalen Wert
      if (e.tabelle === 'zaehlungen') {
        const z = zeileVon(e.daten);
        if (z && (r.ok || !r.netz)) zaehlungGeaendert({ sitzungId: z.sitzung_id, zoneId: z.zone_id, quelle: 'server' });
      }
    }
    schreiben(rest);
  } finally {
    laeuft = false;
  }
}

export function useWarteschlange(): number {
  const [anzahl, setAnzahl] = useState(lesen().length);
  useEffect(() => {
    const aktualisieren = () => setAnzahl(lesen().length);
    const online = () => void warteschlangeAbarbeiten();
    window.addEventListener(EREIGNIS, aktualisieren);
    window.addEventListener('online', online);
    const intervall = window.setInterval(online, 60000);
    void warteschlangeAbarbeiten();
    return () => {
      window.removeEventListener(EREIGNIS, aktualisieren);
      window.removeEventListener('online', online);
      window.clearInterval(intervall);
    };
  }, []);
  return anzahl;
}
