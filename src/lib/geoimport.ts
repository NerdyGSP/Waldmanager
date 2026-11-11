// Einlesen und Prüfen von Geodaten (Shapefile als ZIP, GeoPackage)
// Alles läuft im Browser; die Datei verlässt das Gerät erst nach der Bestätigung im Importdialog.
import type { Feature, Geometry, Position } from 'geojson';
import proj4 from 'proj4';

export type Pruefschritt = { text: string; status: 'ok' | 'warnung' | 'fehler' };
export type Flaechenart = 'Point' | 'LineString' | 'Polygon';
export type GeoFeature = Feature<Geometry, Record<string, unknown>>;
export type GeoSchicht = {
  name: string;
  features: GeoFeature[];
  felder: string[];
  geometrietypen: Record<string, number>;
  verworfen: number;
};
export type Einlesung = {
  dateiname: string;
  format: 'Shapefile' | 'GeoPackage' | 'GeoJSON';
  schichten: GeoSchicht[];
  pruefung: Pruefschritt[];
};

export class GeoImportFehler extends Error {
  pruefung: Pruefschritt[];
  constructor(meldung: string, pruefung: Pruefschritt[]) {
    super(meldung);
    this.pruefung = pruefung;
  }
}

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_ENTPACKT = 400 * 1024 * 1024;
const MAX_FEATURES = 50000;

// Koordinatensysteme, die bei Geodaten in Niedersachsen üblich sind
const EPSG: Record<number, string> = {
  25832: '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  25833: '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  4647: '+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=32500000 +y_0=0 +ellps=GRS80 +units=m +no_defs',
  31466: '+proj=tmerc +lat_0=0 +lon_0=6 +k=1 +x_0=2500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs',
  31467: '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs',
  31468: '+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=4500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs',
  3857: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
};
const WGS84_GLEICH = new Set([4326, 4258, 4979, 4937]); // geografisch, für Betriebsdaten gleichwertig

const ok = (text: string): Pruefschritt => ({ text, status: 'ok' });
const warn = (text: string): Pruefschritt => ({ text, status: 'warnung' });
const fehl = (text: string): Pruefschritt => ({ text, status: 'fehler' });

// ---------- Einstieg ----------

export async function geodatenLesen(datei: File): Promise<Einlesung> {
  const pruefung: Pruefschritt[] = [];
  if (datei.size === 0) throw new GeoImportFehler('Die Datei ist leer.', [fehl('Datei ist leer (0 Bytes)')]);
  if (datei.size > MAX_BYTES) {
    throw new GeoImportFehler('Die Datei ist zu groß.', [fehl(`Datei ist ${(datei.size / 1048576).toFixed(0)} MB groß (Maximum 100 MB)`)]);
  }
  let puffer: ArrayBuffer;
  try {
    puffer = await datei.arrayBuffer();
  } catch {
    throw new GeoImportFehler('Die Datei konnte nicht gelesen werden.', [fehl('Datei lässt sich nicht lesen (Zugriff verweigert oder Datei verändert)')]);
  }
  const bytes = new Uint8Array(puffer);
  pruefung.push(ok(`Datei lesbar (${(datei.size / 1024).toLocaleString('de-DE', { maximumFractionDigits: 0 })} KB)`));

  const endung = datei.name.toLowerCase().split('.').pop() ?? '';
  const istZip = bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5);
  const istSqlite = new TextDecoder().decode(bytes.subarray(0, 15)) === 'SQLite format 3';

  if (istZip) {
    if (endung !== 'zip') pruefung.push(warn(`Dateiendung „.${endung}“ passt nicht zum Inhalt (ZIP-Archiv)`));
    return shapefileLesen(datei.name, puffer, pruefung);
  }
  if (istSqlite) {
    if (endung !== 'gpkg') pruefung.push(warn(`Dateiendung „.${endung}“ passt nicht zum Inhalt (SQLite/GeoPackage)`));
    return geopackageLesen(datei.name, bytes, pruefung);
  }
  const kopf = new TextDecoder().decode(bytes.subarray(0, 200)).replace(/^\uFEFF/, '').trimStart();
  if (endung === 'geojson' || endung === 'json' || kopf.startsWith('{')) return geojsonLesen(datei.name, bytes, pruefung);
  if (endung === 'shp' || endung === 'dbf') {
    throw new GeoImportFehler('Bitte das Shapefile als ZIP-Archiv mit allen Teildateien hochladen.', [
      ...pruefung,
      fehl('Einzelne .shp-/.dbf-Datei: ein Shapefile besteht aus mehreren Dateien (.shp, .dbf, .shx, .prj) – bitte als .zip bündeln'),
    ]);
  }
  throw new GeoImportFehler('Dateityp nicht erkannt.', [
    ...pruefung,
    fehl('Weder ZIP-Archiv (Shapefile) noch GeoPackage erkannt – die Datei ist beschädigt oder hat ein anderes Format'),
  ]);
}

// ---------- GeoJSON (WGS84 nach RFC 7946) ----------

function geojsonLesen(dateiname: string, bytes: Uint8Array, pruefung: Pruefschritt[]): Einlesung {
  let json: { type?: string; features?: unknown; crs?: { properties?: { name?: string } }; geometry?: unknown };
  try {
    json = JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ''));
  } catch {
    throw new GeoImportFehler('Die GeoJSON-Datei ist fehlerhaft.', [...pruefung, fehl('Kein gültiges JSON – Datei beschädigt oder abgeschnitten?')]);
  }
  const crs = json.crs?.properties?.name ?? '';
  const epsg = Number(crs.match(/(?:EPSG[:/]+|EPSG::)(\d{4,5})/i)?.[1] ?? 4326);
  if (!/CRS84/i.test(crs) && !WGS84_GLEICH.has(epsg)) {
    throw new GeoImportFehler('Das Koordinatensystem wird nicht unterstützt.', [
      ...pruefung,
      fehl(`GeoJSON im Koordinatensystem EPSG:${epsg} – bitte als WGS84 (EPSG:4326) exportieren oder Shapefile/GeoPackage verwenden`),
    ]);
  }
  const roh: Feature<Geometry | null, Record<string, unknown> | null>[] =
    json.type === 'FeatureCollection' && Array.isArray(json.features)
      ? (json.features as Feature<Geometry | null, Record<string, unknown> | null>[]).filter((f) => f && f.type === 'Feature')
      : json.type === 'Feature'
        ? [json as unknown as Feature<Geometry | null, Record<string, unknown> | null>]
        : [];
  if (!roh.length) throw new GeoImportFehler('Keine Objekte gefunden.', [...pruefung, fehl('Keine Features in der GeoJSON-Datei (erwartet: FeatureCollection)')]);
  if (roh.length > MAX_FEATURES) {
    throw new GeoImportFehler('Zu viele Objekte.', [...pruefung, fehl(`${roh.length.toLocaleString('de-DE')} Objekte – Maximum ${MAX_FEATURES.toLocaleString('de-DE')} je Datei`)]);
  }
  pruefung.push(ok('GeoJSON gelesen (WGS84)'));
  const schicht = schichtBauen(dateiname.replace(/\.[^.]+$/, ''), roh, '', pruefung, null);
  return abschliessen(dateiname, 'GeoJSON', schicht ? [schicht] : [], pruefung);
}

// ---------- Shapefile ----------

type ShapeSatz = { name: string; shp?: Uint8Array; dbf?: Uint8Array; shx?: Uint8Array; cpg?: Uint8Array; prj?: string };

async function shapefileLesen(dateiname: string, puffer: ArrayBuffer, pruefung: Pruefschritt[]): Promise<Einlesung> {
  // Ohne Dateiende-Verzeichnis (End of Central Directory) ist das Archiv abgeschnitten
  const roh = new Uint8Array(puffer);
  let eocd = -1;
  for (let i = roh.length - 22; i >= Math.max(0, roh.length - 22 - 65535); i--) {
    if (roh[i] === 0x50 && roh[i + 1] === 0x4b && roh[i + 2] === 0x05 && roh[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new GeoImportFehler('Das ZIP-Archiv ist beschädigt.', [
      ...pruefung,
      fehl('ZIP-Archiv ist unvollständig (Dateiende fehlt) – Download oder Kopie abgebrochen?'),
    ]);
  }
  const anzahlEintraege = roh[eocd + 10]! | (roh[eocd + 11]! << 8);
  if (anzahlEintraege === 0 || anzahlEintraege > 5000) {
    throw new GeoImportFehler('Das ZIP-Archiv ist beschädigt.', [...pruefung, fehl(`ZIP-Archiv enthält ${anzahlEintraege} Einträge – unplausibel`)]);
  }
  const { iter } = await import('but-unzip');
  const saetze = new Map<string, ShapeSatz>();
  let gesamt = 0;
  let eintraege = 0;
  try {
    for (const e of iter(new Uint8Array(puffer))) {
      eintraege++;
      if (e.filename.endsWith('/') || e.filename.includes('__MACOSX/') || e.filename.split('/').pop()!.startsWith('._')) continue;
      const teile = e.filename.split('.');
      const endung = teile.pop()!.toLowerCase();
      if (!['shp', 'dbf', 'shx', 'prj', 'cpg'].includes(endung)) continue;
      const bytes = await e.read();
      gesamt += bytes.length;
      if (gesamt > MAX_ENTPACKT) throw new Error('Archiv entpackt unplausibel groß');
      const name = teile.join('.');
      const satz: ShapeSatz = saetze.get(name) ?? { name };
      if (endung === 'prj') satz.prj = new TextDecoder().decode(bytes);
      else (satz as Record<string, unknown>)[endung] = bytes;
      saetze.set(name, satz);
    }
  } catch (err) {
    throw new GeoImportFehler('Das ZIP-Archiv ist beschädigt.', [
      ...pruefung,
      fehl(`ZIP-Archiv lässt sich nicht vollständig entpacken (${err instanceof Error ? err.message : 'unbekannter Fehler'})`),
    ]);
  }
  if (eintraege === 0) throw new GeoImportFehler('Das ZIP-Archiv ist leer.', [...pruefung, fehl('ZIP-Archiv enthält keine Dateien')]);
  pruefung.push(ok(`ZIP-Archiv vollständig entpackbar (${eintraege} Einträge)`));

  const brauchbar = [...saetze.values()].filter((s) => s.shp);
  if (!brauchbar.length) {
    throw new GeoImportFehler('Im Archiv fehlt die .shp-Datei.', [...pruefung, fehl('Keine .shp-Datei im Archiv gefunden')]);
  }

  const { default: shp } = await import('shpjs');
  const schichten: GeoSchicht[] = [];
  for (const s of brauchbar) {
    const praefix = brauchbar.length > 1 ? `${s.name}: ` : '';
    const shpPruefung = shapeKopfPruefen(s, praefix);
    pruefung.push(...shpPruefung);
    if (shpPruefung.some((p) => p.status === 'fehler')) continue;
    try {
      const erg = await shp({ shp: s.shp!, dbf: s.dbf, cpg: s.cpg, prj: s.prj });
      const sammlung = Array.isArray(erg) ? erg[0]! : erg;
      const rohe = (sammlung.features ?? []) as Feature<Geometry | null, Record<string, unknown> | null>[];
      const schicht = schichtBauen(s.name, rohe, praefix, pruefung, s.prj ? null : 4326);
      if (schicht) {
        if (!s.prj) {
          const aussen = schicht.features.some((f) => koordinaten(f.geometry).some((p) => Math.abs(p[0]!) > 180 || Math.abs(p[1]!) > 90));
          if (aussen) {
            pruefung.push(fehl(`${praefix}Keine .prj-Datei und Koordinaten sind keine Längen-/Breitengrade – bitte mit .prj-Datei exportieren`));
            continue;
          }
        }
        schichten.push(schicht);
      }
    } catch (err) {
      pruefung.push(fehl(`${praefix}Shapefile ist beschädigt oder nicht lesbar (${err instanceof Error ? err.message : 'unbekannter Fehler'})`));
    }
  }
  return abschliessen(dateiname, 'Shapefile', schichten, pruefung);
}

function shapeKopfPruefen(s: ShapeSatz, praefix: string): Pruefschritt[] {
  const aus: Pruefschritt[] = [];
  const shp = s.shp!;
  if (shp.length < 100) return [fehl(`${praefix}.shp-Datei ist kürzer als der Dateikopf (100 Bytes) – abgeschnitten`)];
  const v = new DataView(shp.buffer, shp.byteOffset, shp.byteLength);
  if (v.getInt32(0, false) !== 9994) return [fehl(`${praefix}.shp-Datei hat keine gültige Kennung – beschädigt oder kein Shapefile`)];
  if (v.getInt32(28, true) !== 1000) aus.push(warn(`${praefix}Ungewöhnliche Shapefile-Version`));
  const soll = v.getInt32(24, false) * 2;
  if (shp.length < soll) return [fehl(`${praefix}.shp-Datei ist unvollständig (${shp.length} von ${soll} Bytes) – Download oder Kopie abgebrochen?`)];
  if (shp.length > soll) aus.push(warn(`${praefix}.shp-Datei enthält ${shp.length - soll} Bytes nach dem erwarteten Ende`));
  aus.push(ok(`${praefix}.shp-Kopf und Dateilänge stimmen`));

  if (!s.dbf) {
    aus.push(warn(`${praefix}Keine .dbf-Datei – Namen und Attribute fehlen`));
  } else if (s.dbf.length < 32) {
    aus.push(fehl(`${praefix}.dbf-Datei ist zu kurz – beschädigt`));
  } else {
    const d = new DataView(s.dbf.buffer, s.dbf.byteOffset, s.dbf.byteLength);
    const saetze = d.getUint32(4, true);
    const kopf = d.getUint16(8, true);
    const laenge = d.getUint16(10, true);
    const erwartet = kopf + saetze * laenge;
    if (s.dbf.length < erwartet) aus.push(fehl(`${praefix}.dbf-Attributtabelle ist unvollständig (${s.dbf.length} von ${erwartet} Bytes)`));
    else aus.push(ok(`${praefix}Attributtabelle (.dbf) vollständig · ${saetze.toLocaleString('de-DE')} Datensätze`));
  }
  if (!s.shx) aus.push(warn(`${praefix}Keine .shx-Indexdatei (für den Import nicht nötig)`));
  if (!s.prj) aus.push(warn(`${praefix}Keine .prj-Datei – Koordinaten werden als Längen-/Breitengrad (WGS84) gelesen`));
  else aus.push(ok(`${praefix}Koordinatensystem (.prj) vorhanden – wird nach WGS84 umgerechnet`));
  return aus;
}

// ---------- GeoPackage ----------

async function geopackageLesen(dateiname: string, bytes: Uint8Array, pruefung: Pruefschritt[]): Promise<Einlesung> {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  let db: InstanceType<typeof SQL.Database>;
  try {
    db = new SQL.Database(bytes);
  } catch (err) {
    throw new GeoImportFehler('Das GeoPackage ist beschädigt.', [
      ...pruefung,
      fehl(`SQLite-Datenbank lässt sich nicht öffnen (${err instanceof Error ? err.message : 'unbekannter Fehler'})`),
    ]);
  }
  try {
    const abfrage = (sql: string) => db.exec(sql)[0]?.values ?? [];
    try {
      const qc = abfrage('PRAGMA quick_check')[0]?.[0];
      if (qc !== 'ok') throw new Error(String(qc ?? 'keine Antwort'));
      pruefung.push(ok('Datenbank-Integritätsprüfung bestanden'));
    } catch (err) {
      throw new GeoImportFehler('Das GeoPackage ist beschädigt.', [
        ...pruefung,
        fehl(`Integritätsprüfung der Datenbank fehlgeschlagen (${err instanceof Error ? err.message : 'unbekannter Fehler'})`),
      ]);
    }
    const appId = Number(abfrage('PRAGMA application_id')[0]?.[0] ?? 0);
    if (![0x47504b47, 0x47503130, 0x47503131].includes(appId)) {
      pruefung.push(warn('Kennung „GPKG“ im Dateikopf fehlt (reine SQLite-Datei?) – es wird trotzdem nach GeoPackage-Tabellen gesucht'));
    } else pruefung.push(ok('GeoPackage-Kennung im Dateikopf vorhanden'));

    const tabellen = new Set(abfrage("select name from sqlite_master where type='table'").map((r) => String(r[0])));
    for (const t of ['gpkg_contents', 'gpkg_geometry_columns', 'gpkg_spatial_ref_sys']) {
      if (!tabellen.has(t)) {
        throw new GeoImportFehler('Das ist kein gültiges GeoPackage.', [...pruefung, fehl(`Pflichttabelle „${t}“ fehlt – Datei unvollständig oder kein GeoPackage`)]);
      }
    }
    pruefung.push(ok('GeoPackage-Struktur vollständig'));

    const spalten = abfrage(
      `select c.table_name, g.column_name, g.srs_id from gpkg_contents c join gpkg_geometry_columns g on g.table_name = c.table_name where c.data_type = 'features' order by c.table_name`,
    ) as [string, string, number][];
    if (!spalten.length) {
      throw new GeoImportFehler('Keine Vektorebenen gefunden.', [...pruefung, fehl('Das GeoPackage enthält keine Ebenen mit Vektordaten (nur Raster oder Attribute)')]);
    }

    const schichten: GeoSchicht[] = [];
    for (const [tabelle, geoSpalte, srsId] of spalten) {
      const praefix = spalten.length > 1 ? `${tabelle}: ` : '';
      const transform = koordinatenSystem(db, Number(srsId), praefix, pruefung);
      if (!transform) continue;
      const roh: Feature<Geometry | null, Record<string, unknown>>[] = [];
      let defekt = 0;
      try {
        const stmt = db.prepare(`select * from "${tabelle.replaceAll('"', '""')}" limit ${MAX_FEATURES + 1}`);
        while (stmt.step()) {
          const zeile = stmt.getAsObject() as Record<string, unknown>;
          const blob = zeile[geoSpalte];
          const props: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(zeile)) if (k !== geoSpalte && !(v instanceof Uint8Array)) props[k] = v;
          if (!(blob instanceof Uint8Array) || blob.length === 0) {
            roh.push({ type: 'Feature', geometry: null, properties: props });
            continue;
          }
          try {
            roh.push({ type: 'Feature', geometry: gpkgGeometrie(blob, transform), properties: props });
          } catch {
            defekt++;
          }
        }
        stmt.free();
      } catch (err) {
        pruefung.push(fehl(`${praefix}Tabelle lässt sich nicht vollständig lesen (${err instanceof Error ? err.message : 'unbekannter Fehler'}) – Datei beschädigt?`));
        continue;
      }
      if (roh.length > MAX_FEATURES) {
        pruefung.push(fehl(`${praefix}Mehr als ${MAX_FEATURES.toLocaleString('de-DE')} Objekte – bitte Datei verkleinern`));
        continue;
      }
      if (defekt) pruefung.push(warn(`${praefix}${defekt} Objekte mit beschädigter Geometrie werden ausgelassen`));
      const schicht = schichtBauen(tabelle, roh, praefix, pruefung, null);
      if (schicht) {
        schicht.verworfen += defekt;
        schichten.push(schicht);
      }
    }
    return abschliessen(dateiname, 'GeoPackage', schichten, pruefung);
  } finally {
    db.close();
  }
}

function koordinatenSystem(
  db: { exec: (s: string) => { values: unknown[][] }[] },
  srsId: number,
  praefix: string,
  pruefung: Pruefschritt[],
): { fn: (p: Position) => Position; id: number } | null {
  const zeile = db.exec(`select organization, organization_coordsys_id, definition from gpkg_spatial_ref_sys where srs_id = ${Number(srsId)}`)[0]?.values[0];
  const org = String(zeile?.[0] ?? '').toUpperCase();
  const code = Number(zeile?.[1] ?? srsId);
  const definition = String(zeile?.[2] ?? '');
  const epsg = org === 'EPSG' || org === 'NONE' || !org ? code : srsId;
  if (WGS84_GLEICH.has(epsg) || srsId === 4326) {
    pruefung.push(ok(`${praefix}Koordinatensystem WGS84 (EPSG:${epsg})`));
    return { fn: (p) => p, id: epsg };
  }
  const def = EPSG[epsg] ?? (definition && definition !== 'undefined' ? definition : '');
  if (!def) {
    pruefung.push(fehl(`${praefix}Koordinatensystem (SRS ${srsId}) ist unbekannt – bitte in WGS84 oder ETRS89/UTM 32N speichern`));
    return null;
  }
  try {
    const umrechner = proj4(def, 'EPSG:4326');
    const test = umrechner.forward([0, 0]);
    void test;
    pruefung.push(ok(`${praefix}Koordinatensystem EPSG:${epsg} wird nach WGS84 umgerechnet`));
    return { fn: (p) => umrechner.forward([p[0]!, p[1]!]) as Position, id: epsg };
  } catch {
    pruefung.push(fehl(`${praefix}Koordinatensystem EPSG:${epsg} wird nicht unterstützt`));
    return null;
  }
}

// ---------- GeoPackage-Geometrie (Header + WKB) ----------

class Leser {
  pos: number;
  constructor(
    private v: DataView,
    start: number,
  ) {
    this.pos = start;
  }
  private pruefe(n: number) {
    if (this.pos + n > this.v.byteLength) throw new Error('Geometrie abgeschnitten');
  }
  byte() {
    this.pruefe(1);
    return this.v.getUint8(this.pos++);
  }
  u32(le: boolean) {
    this.pruefe(4);
    const w = this.v.getUint32(this.pos, le);
    this.pos += 4;
    return w;
  }
  f64(le: boolean) {
    this.pruefe(8);
    const w = this.v.getFloat64(this.pos, le);
    this.pos += 8;
    return w;
  }
  rest() {
    return this.v.byteLength - this.pos;
  }
}

function gpkgGeometrie(blob: Uint8Array, t: { fn: (p: Position) => Position }): Geometry | null {
  if (blob.length < 8 || blob[0] !== 0x47 || blob[1] !== 0x50) throw new Error('Keine GeoPackage-Geometrie');
  const flags = blob[3]!;
  if ((flags >> 4) & 1) return null; // leere Geometrie
  const envelope = [0, 32, 48, 48, 64][(flags >> 1) & 7];
  if (envelope === undefined) throw new Error('Ungültiger Envelope');
  const v = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const r = new Leser(v, 8 + envelope);
  const g = wkb(r, t.fn);
  return g;
}

function wkb(r: Leser, fn: (p: Position) => Position, tiefe = 0): Geometry {
  if (tiefe > 4) throw new Error('Zu tief verschachtelt');
  const le = r.byte() === 1;
  let typ = r.u32(le);
  let z = false;
  let m = false;
  if (typ & 0x80000000) z = true;
  if (typ & 0x40000000) m = true;
  typ &= 0x0fffffff;
  if (typ >= 3000) {
    z = true;
    m = true;
    typ -= 3000;
  } else if (typ >= 2000) {
    m = true;
    typ -= 2000;
  } else if (typ >= 1000) {
    z = true;
    typ -= 1000;
  }
  const punkt = (): Position => {
    const x = r.f64(le);
    const y = r.f64(le);
    if (z) r.f64(le);
    if (m) r.f64(le);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Ungültige Koordinate');
    return fn([x, y]);
  };
  const anzahl = () => {
    const n = r.u32(le);
    if (n > r.rest()) throw new Error('Ungültige Punktanzahl');
    return n;
  };
  const punkte = () => Array.from({ length: anzahl() }, punkt);
  switch (typ) {
    case 1:
      return { type: 'Point', coordinates: punkt() };
    case 2:
      return { type: 'LineString', coordinates: punkte() };
    case 3:
      return { type: 'Polygon', coordinates: Array.from({ length: anzahl() }, punkte) };
    case 4:
    case 5:
    case 6:
    case 7: {
      const n = anzahl();
      const teile = Array.from({ length: n }, () => wkb(r, fn, tiefe + 1));
      if (typ === 7) return { type: 'GeometryCollection', geometries: teile };
      if (typ === 4) return { type: 'MultiPoint', coordinates: teile.map((x) => (x as { coordinates: Position }).coordinates) };
      if (typ === 5) return { type: 'MultiLineString', coordinates: teile.map((x) => (x as { coordinates: Position[] }).coordinates) };
      return { type: 'MultiPolygon', coordinates: teile.map((x) => (x as { coordinates: Position[][] }).coordinates) };
    }
    default:
      throw new Error(`Geometrietyp ${typ} nicht unterstützt`);
  }
}

// ---------- gemeinsame Prüfung und Aufbereitung ----------

function schichtBauen(
  name: string,
  roh: Feature<Geometry | null, Record<string, unknown> | null>[],
  praefix: string,
  pruefung: Pruefschritt[],
  _standardSrs: number | null,
): GeoSchicht | null {
  void _standardSrs;
  const features: GeoFeature[] = [];
  const typen: Record<string, number> = {};
  let verworfen = 0;
  let unplausibel = 0;
  for (const f of roh) {
    const g = f.geometry ? bereinigen(f.geometry) : null;
    if (!g) {
      verworfen++;
      continue;
    }
    if (koordinaten(g).some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
      unplausibel++;
      continue;
    }
    typen[g.type] = (typen[g.type] ?? 0) + 1;
    features.push({ type: 'Feature', geometry: g, properties: f.properties ?? {} });
  }
  if (!features.length) {
    pruefung.push(fehl(`${praefix}Keine verwertbaren Objekte (${roh.length} Datensätze, alle leer oder ungültig)`));
    return null;
  }
  const alle = features.flatMap((f) => koordinaten(f.geometry));
  const aussen = alle.filter((p) => Math.abs(p[0]!) > 180 || Math.abs(p[1]!) > 90).length;
  if (aussen) {
    pruefung.push(fehl(`${praefix}Koordinaten liegen außerhalb des gültigen Bereichs – Koordinatensystem falsch oder Datei beschädigt`));
    return null;
  }
  const lon = alle.map((p) => p[0]!);
  const lat = alle.map((p) => p[1]!);
  const inD = Math.min(...lon) > 5.5 && Math.max(...lon) < 15.6 && Math.min(...lat) > 47 && Math.max(...lat) < 55.2;
  pruefung.push(ok(`${praefix}${features.length.toLocaleString('de-DE')} Objekte mit gültiger Geometrie`));
  if (verworfen) pruefung.push(warn(`${praefix}${verworfen} Datensätze ohne Geometrie werden ausgelassen`));
  if (unplausibel) pruefung.push(warn(`${praefix}${unplausibel} Objekte mit ungültigen Koordinaten werden ausgelassen`));
  if (!inD) pruefung.push(warn(`${praefix}Die Daten liegen außerhalb Deutschlands – bitte prüfen, ob das Koordinatensystem stimmt`));
  const felder = [...new Set(features.flatMap((f) => Object.keys(f.properties ?? {})))];
  return { name, features, felder, geometrietypen: typen, verworfen: verworfen + unplausibel };
}

// Z/M entfernen, Ringe schließen, Entartetes verwerfen; Collections auflösen
function bereinigen(g: Geometry): Geometry | null {
  const zwei = (p: Position): Position => [p[0]!, p[1]!];
  switch (g.type) {
    case 'Point':
      return g.coordinates.length >= 2 ? { type: 'Point', coordinates: zwei(g.coordinates) } : null;
    case 'MultiPoint': {
      const pts = g.coordinates.map(zwei);
      return pts.length ? { type: 'MultiPoint', coordinates: pts } : null;
    }
    case 'LineString': {
      const l = g.coordinates.map(zwei);
      return l.length >= 2 ? { type: 'LineString', coordinates: l } : null;
    }
    case 'MultiLineString': {
      const ls = g.coordinates.map((l) => l.map(zwei)).filter((l) => l.length >= 2);
      return ls.length ? { type: 'MultiLineString', coordinates: ls } : null;
    }
    case 'Polygon': {
      const ringe = ringeBereinigen(g.coordinates);
      return ringe ? { type: 'Polygon', coordinates: ringe } : null;
    }
    case 'MultiPolygon': {
      const ps = g.coordinates.map(ringeBereinigen).filter((p): p is Position[][] => !!p);
      return ps.length ? { type: 'MultiPolygon', coordinates: ps } : null;
    }
    case 'GeometryCollection': {
      const teile = g.geometries.map(bereinigen).filter((x): x is Geometry => !!x);
      const polys = teile.filter((t) => t.type === 'Polygon' || t.type === 'MultiPolygon');
      if (polys.length === teile.length && polys.length) {
        return {
          type: 'MultiPolygon',
          coordinates: polys.flatMap((t) => (t.type === 'Polygon' ? [t.coordinates] : t.type === 'MultiPolygon' ? t.coordinates : [])),
        };
      }
      return teile[0] ?? null;
    }
  }
}

function ringeBereinigen(ringe: Position[][]): Position[][] | null {
  const aus: Position[][] = [];
  for (const [i, ring] of ringe.entries()) {
    let r = ring.map((p) => [p[0]!, p[1]!] as Position);
    if (r.length >= 3) {
      const a = r[0]!;
      const e = r[r.length - 1]!;
      if (a[0] !== e[0] || a[1] !== e[1]) r = [...r, a];
    }
    if (r.length < 4 || flaecheRing(r) === 0) {
      if (i === 0) return null; // Außenring unbrauchbar
      continue;
    }
    aus.push(r);
  }
  return aus.length ? aus : null;
}

function flaecheRing(r: Position[]): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i]![0]! * r[i + 1]![1]! - r[i + 1]![0]! * r[i]![1]!;
  return s / 2;
}

export function koordinaten(g: Geometry | null | undefined): Position[] {
  if (!g) return [];
  switch (g.type) {
    case 'Point':
      return [g.coordinates];
    case 'LineString':
    case 'MultiPoint':
      return g.coordinates;
    case 'Polygon':
    case 'MultiLineString':
      return g.coordinates.flat();
    case 'MultiPolygon':
      return g.coordinates.flat(2);
    case 'GeometryCollection':
      return g.geometries.flatMap(koordinaten);
  }
}

function abschliessen(dateiname: string, format: Einlesung['format'], schichten: GeoSchicht[], pruefung: Pruefschritt[]): Einlesung {
  if (!schichten.length) {
    const hatFehler = pruefung.some((p) => p.status === 'fehler');
    throw new GeoImportFehler(hatFehler ? 'Die Datei ist fehlerhaft und kann nicht importiert werden.' : 'Keine verwertbaren Geodaten gefunden.', [
      ...pruefung,
      ...(hatFehler ? [] : [fehl('Keine Ebene mit verwertbaren Objekten')]),
    ]);
  }
  return { dateiname, format, schichten, pruefung };
}

// ---------- Hilfen für den Dialog ----------

export type Ziel = 'grenze' | 'zonen' | 'einrichtungen' | 'pirschwege' | 'treiberrouten' | 'wte_routen' | 'felder';
const ZIEL_ART: Record<Ziel, Flaechenart> = { grenze: 'Polygon', zonen: 'Polygon', einrichtungen: 'Point', pirschwege: 'LineString', treiberrouten: 'LineString', wte_routen: 'LineString', felder: 'Polygon' };

export const artVon = (g: Geometry): Flaechenart => (g.type.endsWith('Polygon') ? 'Polygon' : g.type.endsWith('LineString') ? 'LineString' : 'Point');

// Objekte der Schicht, die zum gewählten Ziel passen
export function passendeObjekte(schicht: GeoSchicht, ziel: Ziel): GeoFeature[] {
  return schicht.features.filter((f) => artVon(f.geometry) === ZIEL_ART[ziel]);
}

export function einzelteile(f: GeoFeature, ziel: Ziel): Geometry[] {
  const g = f.geometry;
  if (ziel === 'einrichtungen' && g.type === 'MultiPoint') return g.coordinates.map((c) => ({ type: 'Point', coordinates: c }) as Geometry);
  if ((ziel === 'pirschwege' || ziel === 'treiberrouten' || ziel === 'wte_routen') && g.type === 'MultiLineString') return g.coordinates.map((c) => ({ type: 'LineString', coordinates: c }) as Geometry);
  return [g];
}
