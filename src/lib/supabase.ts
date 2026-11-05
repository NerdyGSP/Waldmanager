import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { cachingFetch } from './offlineCache';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const konfigurationFehlt = !url || !key;

export const supabase = createClient<Database>(
  url ?? 'https://invalid.local',
  key ?? 'invalid',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { fetch: cachingFetch },
  },
);

// Offline: die gespeicherte Sitzung sofort verwenden. Sonst versucht supabase-js bei abgelaufenem Token
// minutenlang, es ohne Netz zu erneuern, und jede Abfrage wartet darauf.
const sessionOriginal = supabase.auth.getSession.bind(supabase.auth);
export function gespeicherteSitzung() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const s = JSON.parse(localStorage.getItem(k) ?? 'null');
        if (s?.user && s?.access_token) return s as import('@supabase/supabase-js').Session;
      }
    }
  } catch {
    /* ignorieren */
  }
  return null;
}
supabase.auth.getSession = (async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const s = gespeicherteSitzung();
    if (s) return { data: { session: s }, error: null };
  }
  return sessionOriginal();
}) as typeof supabase.auth.getSession;
