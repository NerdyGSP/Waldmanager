import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { TablesInsert } from './database.types';
import { fotosHochladen } from './fotos';

// Offline-Warteschlange für Erfassungen im Wald.
// Datensätze tragen eine clientseitige UUID; das Senden ist per Upsert idempotent.
type Eintrag = { tabelle: 'funde'; daten: TablesInsert<'funde'> & { id: string } }; // Fundmeldung (Käferbaum, Windwurf …)

const schluessel = (e: Eintrag) => `${e.tabelle}:${e.daten.id}`;

const SCHLUESSEL = 'waldmanager.warteschlange';
const EREIGNIS = 'waldmanager:warteschlange';

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
    const { error } = await supabase.from('funde').upsert(e.daten, { onConflict: 'id', ignoreDuplicates: true });
    if (!error) return { ok: true, netz: false };
    // Abgelaufene Anmeldung ist kein fachlicher Fehler: Eintrag behalten, bis das Token erneuert ist
    const abgelaufen = /jwt|token|expired|not authenticated/i.test(error.message) || error.code === 'PGRST301';
    return { ok: false, netz: istNetzfehler(error) || abgelaufen, fehler: error.message };
  } catch (err) {
    return { ok: false, netz: true, fehler: String(err) };
  }
}

// Speichert sofort, bei fehlender Verbindung landet der Eintrag in der Warteschlange.
export async function speichernOderMerken(e: Eintrag): Promise<'gespeichert' | 'gemerkt'> {
  if (navigator.onLine) {
    const r = await senden(e);
    if (r.ok) return 'gespeichert';
    if (!r.netz) throw new Error(r.fehler ?? 'Speichern fehlgeschlagen');
  }
  schreiben([...lesen().filter((x) => schluessel(x) !== schluessel(e)), e]);
  return 'gemerkt';
}

// Noch nicht übertragene Funde eines Betriebs (für die lokale Anzeige)
export function wartendeFunde(betriebId: string): Array<TablesInsert<'funde'> & { id: string }> {
  return lesen().flatMap((x) => (x.tabelle === 'funde' && x.daten.betrieb_id === betriebId ? [x.daten] : []));
}

let laeuft = false;

export async function warteschlangeAbarbeiten(): Promise<void> {
  if (laeuft || !navigator.onLine) return;
  laeuft = true;
  try {
    if (lesen().length === 0) {
      await fotosHochladen();
      return;
    }
    // Erst die Sitzung erneuern (online), sonst scheitert das Senden mit abgelaufenem Token
    const { data: sitzung } = await supabase.auth.getSession();
    if (!sitzung.session) return;
    const rest: Eintrag[] = [];
    for (const e of lesen()) {
      const r = await senden(e);
      // Fachliche Fehler (z. B. Betrieb gelöscht) verwerfen, Netzfehler behalten
      if (!r.ok && r.netz) rest.push(e);
    }
    schreiben(rest);
    // Fotos erst nach den Funden, damit der Pfad am Fund eingetragen werden kann
    await fotosHochladen();
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
