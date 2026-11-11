import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Enums } from './database.types';

export type Mitgliedschaft = {
  rolle: Enums<'betrieb_rolle'>;
  betrieb: {
    id: string;
    name: string;
    flaeche_ha: number | null;
    bundesland: string;
  };
};

export type NutzerKontext = {
  laedt: boolean;
  fehler: string | null;
  name: string;
  email: string;
  istMasteradmin: boolean;
  mitgliedschaften: Mitgliedschaft[];
  neuLaden: () => Promise<void>;
};

export function useNutzerKontext(userId: string): NutzerKontext {
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [istMasteradmin, setIstMasteradmin] = useState(false);
  const [mitgliedschaften, setMitgliedschaften] = useState<Mitgliedschaft[]>([]);

  const neuLaden = useCallback(async () => {
    setFehler(null);
    const [profil, master, mitglieder] = await Promise.all([
      supabase.from('profiles').select('name, email').eq('id', userId).maybeSingle(),
      supabase.from('masteradmins').select('user_id').eq('user_id', userId).maybeSingle(),
      supabase.from('betrieb_mitglieder').select('rolle, betriebe(id, name, flaeche_ha, bundesland)').eq('user_id', userId),
    ]);

    const ersterFehler = profil.error ?? master.error ?? mitglieder.error;
    if (ersterFehler) setFehler(ersterFehler.message);

    setName(profil.data?.name ?? '');
    setEmail(profil.data?.email ?? '');
    setIstMasteradmin(Boolean(master.data));
    setMitgliedschaften(
      (mitglieder.data ?? [])
        .filter((m) => m.betriebe)
        .map((m) => ({
          rolle: m.rolle,
          betrieb: {
            id: m.betriebe!.id,
            name: m.betriebe!.name,
            flaeche_ha: m.betriebe!.flaeche_ha,
            bundesland: m.betriebe!.bundesland,
          },
        }))
        .sort((a, b) => a.betrieb.name.localeCompare(b.betrieb.name, 'de')),
    );
    setLaedt(false);
  }, [userId]);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  return { laedt, fehler, name, email, istMasteradmin, mitgliedschaften, neuLaden };
}

const SPEICHER_SCHLUESSEL = 'waldmanager.aktuellerBetrieb';

export function gemerkterBetrieb(): string | null {
  try {
    return localStorage.getItem(SPEICHER_SCHLUESSEL);
  } catch {
    return null;
  }
}

export function betriebMerken(id: string) {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, id);
  } catch {
    /* Speicher nicht verfügbar – Auswahl gilt dann nur für diese Sitzung */
  }
}
