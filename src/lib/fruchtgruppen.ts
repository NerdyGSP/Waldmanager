// Fruchtgruppen für Schläge (Feldgrenzen): Katalog, Standardfarben und Erkennung aus Text oder NC-Code.
// Der Katalog liegt bewusst im Code und nicht in der Datenbank; gespeichert wird nur der `schluessel`.

export type Fruchtgruppe = {
  schluessel: string;
  name: string;
  farbe: string;
  /** NC-Codes (Nutzungscodes der Agrarförderung), einzeln oder als Bereich [von, bis] */
  codes: Array<number | [number, number]>;
  /** Textbausteine, bereits normalisiert (siehe `normalisieren`); kurze Kürzel (≤ 3 Zeichen) gelten nur als ganzes Wort */
  woerter: string[];
};

export const SONSTIGE = 'sonstige';

// Reihenfolge = Priorität beim Textabgleich: Spezifisches vor Allgemeinem
export const FRUCHTGRUPPEN: Fruchtgruppe[] = [
  { schluessel: 'weizen', name: 'Weizen', farbe: '#F2C230', codes: [115, 116, 112, 113], woerter: ['weizen', 'ww', 'sw'] },
  { schluessel: 'gerste', name: 'Gerste', farbe: '#E8892B', codes: [131, 132], woerter: ['gerste'] },
  { schluessel: 'roggen', name: 'Roggen / Triticale', farbe: '#B8743A', codes: [121, 156, 157], woerter: ['roggen', 'triticale'] },
  { schluessel: 'hafer', name: 'Hafer / sonst. Getreide', farbe: '#D9CBA0', codes: [142, 143], woerter: ['hafer', 'dinkel'] },
  { schluessel: 'mais', name: 'Mais', farbe: '#2F7D32', codes: [171, 411], woerter: ['mais', 'silomais'] },
  { schluessel: 'raps', name: 'Raps', farbe: '#C5D93A', codes: [311], woerter: ['raps', 'ruebsen'] },
  { schluessel: 'rueben', name: 'Rüben', farbe: '#A64D9B', codes: [603], woerter: ['ruebe', 'zuckerruebe'] },
  { schluessel: 'kartoffeln', name: 'Kartoffeln', farbe: '#7B5B3F', codes: [601, 602], woerter: ['kartoffel'] },
  { schluessel: 'huelsenfruechte', name: 'Hülsenfrüchte', farbe: '#2AA6A0', codes: [210, 213, 220], woerter: ['erbse', 'bohne', 'lupine', 'soja'] },
  { schluessel: 'gruenland', name: 'Grünland / Feldfutter', farbe: '#8FD18A', codes: [[451, 454], [422, 424]], woerter: ['wiese', 'weide', 'gruenland', 'kleegras', 'luzerne', 'ackergras', 'feldgras'] },
  { schluessel: 'brache', name: 'Brache / Zwischenfrucht', farbe: '#C9D6E3', codes: [591, 549, 575], woerter: ['brache', 'zwischenfrucht', 'phacelia', 'senf', 'blueh', 'stilllegung'] },
  { schluessel: 'sonderkulturen', name: 'Gemüse / Obst / Sonderkulturen', farbe: '#E36A8F', codes: [], woerter: ['gemuese', 'spargel', 'erdbeere', 'obst', 'hopfen', 'kohl', 'zwiebel', 'moehre'] },
  { schluessel: 'wald', name: 'Wald / Gehölz', farbe: '#5C7F6A', codes: [], woerter: ['wald', 'gehoelz', 'kup'] },
  { schluessel: SONSTIGE, name: 'Sonstige / unbekannt', farbe: '#9AA3A0', codes: [], woerter: [] },
];

export const fruchtgruppe = (schluessel: string): Fruchtgruppe =>
  FRUCHTGRUPPEN.find((g) => g.schluessel === schluessel) ?? FRUCHTGRUPPEN[FRUCHTGRUPPEN.length - 1]!;

/** Kleinbuchstaben, ä→ae usw., Leerraum zusammengezogen – identisch zu `private.frucht_norm` in der Datenbank */
export const normalisieren = (t: unknown): string =>
  String(t ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();

function codeGruppe(code: number): string | null {
  for (const g of FRUCHTGRUPPEN) {
    for (const c of g.codes) {
      if (Array.isArray(c) ? code >= c[0] && code <= c[1] : code === c) return g.schluessel;
    }
  }
  return null;
}

export type Erkennung = { gruppe: string; quelle: 'gemerkt' | 'code' | 'text' | 'unbekannt' };

/** Reihenfolge: gemerkte Zuordnung, NC-Code, Textabgleich; sonst „Sonstige“ */
export function fruchtErkennen(roh: unknown, gemerkt?: ReadonlyMap<string, string>): Erkennung {
  const norm = normalisieren(roh);
  if (!norm) return { gruppe: SONSTIGE, quelle: 'unbekannt' };
  const m = gemerkt?.get(norm);
  if (m) return { gruppe: m, quelle: 'gemerkt' };
  const code = norm.match(/^(\d{3})(?!\d)/) ?? norm.match(/(?:^|[\s(\[-])(\d{3})(?:$|[\s)\]-])/);
  if (code) {
    const g = codeGruppe(Number(code[1]));
    if (g) return { gruppe: g, quelle: 'code' };
  }
  const worte = norm.split(/[^a-z0-9]+/).filter(Boolean);
  for (const g of FRUCHTGRUPPEN) {
    for (const w of g.woerter) {
      if (w.length <= 3 ? worte.includes(w) : norm.includes(w)) return { gruppe: g.schluessel, quelle: 'text' };
    }
  }
  return { gruppe: SONSTIGE, quelle: 'unbekannt' };
}
