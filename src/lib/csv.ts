// CSV-Einlesen für historische Erfassungen (Excel-Export mit Semikolon, UTF-8 oder Windows-1252)

export function textAusDatei(puffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(puffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(puffer);
  }
  return text.replace(/^﻿/, '');
}

export function trennzeichenErkennen(text: string): string {
  const zeile = text.split(/\r?\n/).find((z) => z.trim()) ?? '';
  const zaehler = [';', '\t', ','].map((z) => [z, zeile.split(z).length - 1] as const);
  return zaehler.sort((a, b) => b[1] - a[1])[0]![1] > 0 ? zaehler.sort((a, b) => b[1] - a[1])[0]![0] : ';';
}

/** Einfacher RFC-4180-Parser: Anführungszeichen, doppelte Anführungszeichen, Zeilenumbrüche in Feldern */
export function csvLesen(text: string, trenner = trennzeichenErkennen(text)): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let inAnf = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inAnf) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else inAnf = false;
      } else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === trenner) {
      zeile.push(feld);
      feld = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld);
      feld = '';
      zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  if (feld !== '' || zeile.length) {
    zeile.push(feld);
    zeilen.push(zeile);
  }
  return zeilen.map((z) => z.map((f) => f.trim())).filter((z) => z.some((f) => f !== ''));
}

export function normalisieren(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export type Zeitangabe = { datum: string; stunde: number | null; minute: number | null };

export function datumLesen(roh: string): Zeitangabe | null {
  const s = roh.trim();
  let j: number, m: number, t: number, h: string | undefined, min: string | undefined;
  let treffer = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)(?:[ T,]+(\d{1,2})[:.](\d{2}))?/.exec(s);
  if (treffer) {
    t = Number(treffer[1]);
    m = Number(treffer[2]);
    j = Number(treffer[3]);
    if (treffer[3]!.length === 2) j += j < 50 ? 2000 : 1900;
    h = treffer[4];
    min = treffer[5];
  } else {
    treffer = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(s);
    if (!treffer) return null;
    j = Number(treffer[1]);
    m = Number(treffer[2]);
    t = Number(treffer[3]);
    h = treffer[4];
    min = treffer[5];
  }
  const pruefung = new Date(Date.UTC(j, m - 1, t));
  if (pruefung.getUTCFullYear() !== j || pruefung.getUTCMonth() !== m - 1 || pruefung.getUTCDate() !== t) return null;
  if (j < 1950 || j > new Date().getFullYear() + 1) return null;
  return {
    datum: `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`,
    stunde: h !== undefined ? Number(h) : null,
    minute: min !== undefined ? Number(min) : null,
  };
}

export function uhrzeitLesen(roh: string): { stunde: number; minute: number } | null {
  const t = /^(\d{1,2})[:.](\d{2})/.exec(roh.trim());
  if (!t || Number(t[1]) > 23 || Number(t[2]) > 59) return null;
  return { stunde: Number(t[1]), minute: Number(t[2]) };
}

export function geschlechtLesen(roh: string): 'maennlich' | 'weiblich' | 'unbekannt' {
  const n = normalisieren(roh);
  if (!n) return 'unbekannt';
  if (/^(m|maennlich|mannlich|maenl|bock|hirsch|keiler|ruede|rueden|hahn|rammler|dachsrueede|♂)$/.test(n) || roh.includes('♂')) return 'maennlich';
  if (/^(w|weiblich|weibl|f|geiss|geis|ricke|bache|ueberlaeufer|henne|haesin|huehnerin|kuh|tier|alttier|♀)$/.test(n) || roh.includes('♀')) return 'weiblich';
  return 'unbekannt';
}

export function zahlLesen(roh: string): number | null {
  const s = roh.trim().replace(/\s/g, '');
  if (!s) return null;
  const z = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(z) ? z : null;
}

const ALIASE: Record<string, string> = {
  reh: 'rehwild', rehe: 'rehwild', rot: 'rotwild', hirsch: 'rotwild', schwarz: 'schwarzwild', sau: 'schwarzwild', sauen: 'schwarzwild',
  wildschwein: 'schwarzwild', dam: 'damwild', sika: 'sikawild', muffel: 'muffelwild', hase: 'feldhase', hasen: 'feldhase',
  kaninchen: 'wildkaninchen', kanin: 'wildkaninchen', taube: 'ringeltaube', ente: 'stockente', enten: 'stockente',
  kraehe: 'rabenkraehe', krahe: 'rabenkraehe', waschbar: 'waschbaer', fuechse: 'fuchs', raubwild: 'sonstiges',
};

export function wildartFinden(roh: string, wildarten: Array<{ id: string; name: string }>): string | null {
  const n = normalisieren(roh);
  if (!n) return null;
  const direkt = wildarten.find((w) => normalisieren(w.name) === n || normalisieren(w.id) === n);
  if (direkt) return direkt.id;
  const alias = ALIASE[n];
  return alias && wildarten.some((w) => w.id === alias) ? alias : null;
}
