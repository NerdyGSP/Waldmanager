// Jagdjahr: 1. April bis 31. März
export type Jagdjahr = { start: number; von: string; bis: string; label: string };

export function jagdjahr(startJahr: number): Jagdjahr {
  return {
    start: startJahr,
    von: `${startJahr}-04-01`,
    bis: `${startJahr + 1}-03-31`,
    label: `${startJahr}/${String(startJahr + 1).slice(2)}`,
  };
}

export function aktuellesJagdjahr(datum = new Date()): Jagdjahr {
  const jahr = datum.getMonth() >= 3 ? datum.getFullYear() : datum.getFullYear() - 1;
  return jagdjahr(jahr);
}

export function letzteJagdjahre(anzahl = 6): Jagdjahr[] {
  const aktuell = aktuellesJagdjahr().start;
  return Array.from({ length: anzahl }, (_, i) => jagdjahr(aktuell - i));
}

export function heuteISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Für <input type="datetime-local">
export function lokalDatumZeit(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function datumDE(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function datumZeitDE(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Mondphase (Näherung über synodischen Monat, Referenz-Neumond 6.1.2000 18:14 UTC)
export function mondphase(datum = new Date()): { name: string; beleuchtung: number } {
  const synodisch = 29.530588853;
  const referenz = Date.UTC(2000, 0, 6, 18, 14);
  const alter = ((((datum.getTime() - referenz) / 86400000) % synodisch) + synodisch) % synodisch;
  const beleuchtung = Math.round(((1 - Math.cos((2 * Math.PI * alter) / synodisch)) / 2) * 100);
  const namen = [
    'Neumond',
    'zunehmende Sichel',
    'erstes Viertel',
    'zunehmender Mond',
    'Vollmond',
    'abnehmender Mond',
    'letztes Viertel',
    'abnehmende Sichel',
  ];
  const index = Math.floor(((alter + synodisch / 16) % synodisch) / (synodisch / 8));
  return { name: namen[index] ?? 'Neumond', beleuchtung };
}
