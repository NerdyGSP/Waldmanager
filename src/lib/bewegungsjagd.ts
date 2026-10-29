import { csvLesen, textAusDatei } from './csv';

export const JAGDARTEN = ['Drückjagd', 'Treibjagd', 'Ansitzdrückjagd', 'Sonstige'] as const;

// Code wird als 8 Zeichen gespeichert und als XXXX-XXXX angezeigt
export function codeAnzeigen(code: string): string {
  const c = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4, 8)}` : c;
}

export function emailGueltig(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export type TeilnehmerEntwurf = { key: string; name: string; email: string; aktiv: boolean };

let zaehler = 0;
export function neuerEntwurf(name: string, email: string): TeilnehmerEntwurf {
  return { key: `t${Date.now()}-${zaehler++}`, name: name.trim(), email: email.trim(), aktiv: true };
}

// CSV „Name;E-Mail“ (Trennzeichen automatisch, Kopfzeile wird erkannt)
export function teilnehmerCsv(puffer: ArrayBuffer): TeilnehmerEntwurf[] {
  const zeilen = csvLesen(textAusDatei(puffer));
  const erste = zeilen[0]?.map((f) => f.toLowerCase()) ?? [];
  const mitKopf = erste.some((f) => f.includes('mail')) || (erste[0] === 'name' && !erste.some((f) => f.includes('@')));
  return (mitKopf ? zeilen.slice(1) : zeilen)
    .filter((z) => z[0] || z[1])
    .map((z) => {
      // Reihenfolge tolerant: steht die Adresse vorn, wird getauscht
      const [a = '', b = ''] = z;
      return a.includes('@') && !b.includes('@') ? neuerEntwurf(b, a) : neuerEntwurf(a, b);
    });
}

export function navigationsLinks(lat: number, lng: number) {
  return {
    apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  };
}

export type BjLadeErgebnis = {
  jagd: {
    id: string;
    titel: string;
    art: string;
    datum: string;
    uhrzeit: string | null;
    lng: number | null;
    lat: number | null;
    schuesseltreiben: boolean;
    schuesseltreiben_adresse: string | null;
    anmeldung_pflicht: boolean;
    hegebeitrag_aktiv: boolean;
    hegebeitrag_betrag: number | null;
    einladungstext: string | null;
    status: string;
  };
  ich: {
    name: string;
    anschrift: string | null;
    status: string;
    hat_hund: boolean | null;
    hat_hornblaeser: boolean | null;
    auto_vorhanden: boolean | null;
    mitfahrplaetze: number | null;
    schuesseltreiben_teilnahme: boolean | null;
    einrichtung_id: string | null;
  };
  boecke: Array<{ id: string; name: string | null; lng: number; lat: number }>;
};
