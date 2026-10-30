import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { TablesInsert } from './database.types';

// Offline-Warteschlange für Erfassungen im Feld.
// Datensätze tragen eine clientseitige UUID; das Senden ist per Upsert idempotent.
type Eintrag =
  | { tabelle: 'beobachtungen'; daten: TablesInsert<'beobachtungen'> & { id: string } }
  | { tabelle: 'zaehlungen'; daten: TablesInsert<'zaehlungen'> & { id: string } }
  | { tabelle: 'einrichtungen'; daten: { id: string; geom: string } }; // Position einmessen/verschieben

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
    const { error } =
      e.tabelle === 'beobachtungen'
        ? await supabase.from('beobachtungen').upsert(e.daten, { onConflict: 'id' })
        : e.tabelle === 'einrichtungen'
          ? await supabase.from('einrichtungen').update({ geom: e.daten.geom }).eq('id', e.daten.id)
          : await supabase.from('zaehlungen').upsert(e.daten, { onConflict: 'id' });
    if (!error) return { ok: true, netz: false };
    return { ok: false, netz: istNetzfehler(error), fehler: error.message };
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
  schreiben([...lesen().filter((x) => x.daten.id !== e.daten.id), e]);
  return 'gemerkt';
}

let laeuft = false;

export async function warteschlangeAbarbeiten(): Promise<void> {
  if (laeuft || !navigator.onLine) return;
  laeuft = true;
  try {
    const rest: Eintrag[] = [];
    for (const e of lesen()) {
      const r = await senden(e);
      // Fachliche Fehler (z. B. Revier gelöscht) verwerfen, Netzfehler behalten
      if (!r.ok && r.netz) rest.push(e);
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
