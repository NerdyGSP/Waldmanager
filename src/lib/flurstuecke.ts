// Zuordnung der Attribute aus ALKIS-, Shapefile- oder GeoPackage-Exporten zu Flurstücken.
// Typische ALKIS-Felder: gemarkung/gemaschl, flur/flurnr, flstnrzae/flstnrnen bzw. zaehler/nenner, flstkennz, amtlflsfl (m²).

export type FeldZuordnung = {
  gemarkung: string;
  flur: string;
  /** Flurstücksnummer am Stück („41/1“) oder Zähler */
  nummer: string;
  /** Nenner, wenn die Nummer in zwei Feldern steht */
  nenner: string;
  flaeche: string;
  /** Einheit des Flächenfelds */
  flaecheEinheit: 'm2' | 'ha';
};

export type FlurstueckWerte = {
  gemarkung: string | null;
  flur: string | null;
  nummer: string | null;
  bezeichnung: string;
  flaeche_amtlich_ha: number | null;
};

const MUSTER: Record<Exclude<keyof FeldZuordnung, 'flaecheEinheit'>, RegExp[]> = {
  gemarkung: [/^gemarkung$/i, /^gemarkungsname$/i, /^gmkname$/i, /^gemaschl$/i, /^gemarkung/i, /^gmk/i],
  flur: [/^flur$/i, /^flurnr$/i, /^flurnummer$/i, /^flur_?nr$/i, /^flur/i],
  nummer: [/^flstnr$/i, /^flurstueck$/i, /^flurstück$/i, /^flstnrzae$/i, /^zaehler$/i, /^zähler$/i, /^flst/i, /^nummer$/i, /^nr$/i],
  nenner: [/^flstnrnen$/i, /^nenner$/i],
  flaeche: [/^amtlflsfl$/i, /^amtl_?flaeche$/i, /^flaeche$/i, /^fläche$/i, /^area$/i, /^shape_area$/i, /^fl(ae|ä)che/i],
};

/** Rät die Feldzuordnung aus den Feldnamen einer Schicht */
export function zuordnungRaten(felder: string[]): FeldZuordnung {
  const finde = (liste: RegExp[]) => {
    for (const re of liste) {
      const f = felder.find((x) => re.test(x));
      if (f) return f;
    }
    return '';
  };
  const nummer = finde(MUSTER.nummer);
  const nenner = finde(MUSTER.nenner);
  const flaeche = finde(MUSTER.flaeche);
  return {
    gemarkung: finde(MUSTER.gemarkung),
    flur: finde(MUSTER.flur),
    nummer,
    // Nenner nur, wenn die Nummer nicht schon das Nennerfeld ist
    nenner: nenner && nenner !== nummer ? nenner : '',
    flaeche,
    // ALKIS liefert die amtliche Fläche in m²; ein Feld „ha“ im Namen deutet auf Hektar
    flaecheEinheit: /ha$|_ha|hektar/i.test(flaeche) ? 'ha' : 'm2',
  };
}

const text = (props: Record<string, unknown> | null | undefined, feld: string): string => {
  if (!feld) return '';
  const v = props?.[feld];
  return v === null || v === undefined ? '' : String(v).trim();
};

/** Zahl aus deutscher oder englischer Schreibweise („1.234,5“, „1234.5“) */
export function zahlLesen(wert: string): number | null {
  const s = wert.trim();
  if (!s) return null;
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Nummer aus Zähler und Nenner zusammensetzen; führende Nullen weg („0041“ → „41“) */
export function nummerBilden(zaehler: string, nenner: string): string | null {
  const z = zaehler.replace(/^0+(?=\d)/, '');
  const n = nenner.replace(/^0+(?=\d)/, '');
  if (!z) return null;
  if (z.includes('/')) return z;
  return n && n !== '0' ? `${z}/${n}` : z;
}

/** Übersetzt die Attribute eines Objekts anhand der Zuordnung */
export function werteAus(props: Record<string, unknown> | null | undefined, z: FeldZuordnung): FlurstueckWerte {
  const gemarkung = text(props, z.gemarkung) || null;
  const flur = text(props, z.flur).replace(/^0+(?=\d)/, '') || null;
  const nummer = nummerBilden(text(props, z.nummer), text(props, z.nenner));
  const roh = zahlLesen(text(props, z.flaeche));
  const flaeche_amtlich_ha = roh === null || roh <= 0 ? null : Math.round((z.flaecheEinheit === 'm2' ? roh / 10000 : roh) * 10000) / 10000;
  return { gemarkung, flur, nummer, bezeichnung: flurstueckText({ gemarkung, flur, nummer }), flaeche_amtlich_ha };
}

/** Anzeige wie „Lindenhang · Flur 3 · 41/1“ */
export function flurstueckText(f: { gemarkung: string | null; flur: string | null; nummer: string | null }): string {
  return [f.gemarkung, f.flur ? `Flur ${f.flur}` : null, f.nummer].filter(Boolean).join(' · ');
}

/** Teilt eine Liste in Pakete fester Größe (Upload in mehreren Aufrufen) */
export function pakete<T>(liste: T[], groesse: number): T[][] {
  return Array.from({ length: Math.ceil(liste.length / groesse) }, (_, i) => liste.slice(i * groesse, i * groesse + groesse));
}
