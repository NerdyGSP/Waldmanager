export class GpsFehler extends Error {
}
export const MAX_BYTES = 100 * 1024 * 1024;
// Dateityp an den Kennbytes erkennen, nicht an der Endung
export function dateityp(b) {
    if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4)
        return 'zip';
    if (b.length >= 14 && String.fromCharCode(b[8], b[9], b[10], b[11]) === '.FIT')
        return 'fit';
    let i = 0;
    if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf)
        i = 3;
    while (i < Math.min(b.length, 64) && (b[i] === 0x20 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09))
        i++;
    if (b[i] === 0x3c)
        return 'xml'; // „<“
    return null;
}
const lokal = (e) => e.localName.toLowerCase();
const kinder = (e, name) => Array.from(e.children).filter((c) => lokal(c) === name);
const alle = (e, name) => Array.from(e.getElementsByTagName('*')).filter((c) => lokal(c) === name);
const text = (e) => (e?.textContent ?? '').trim();
const zeit = (s) => {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
};
function xmlLesen(inhalt) {
    const doc = new DOMParser().parseFromString(inhalt, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length)
        throw new GpsFehler('Die Datei ist kein gültiges XML (GPX/KML).');
    return doc;
}
export function gpxLesen(inhalt) {
    const doc = xmlLesen(inhalt);
    if (lokal(doc.documentElement) !== 'gpx')
        throw new GpsFehler('Die XML-Datei ist keine GPX-Datei.');
    const tracks = [];
    let sensor = false;
    for (const [i, trk] of kinder(doc.documentElement, 'trk').entries()) {
        const segmente = [];
        for (const seg of kinder(trk, 'trkseg')) {
            const pkt = [];
            for (const p of kinder(seg, 'trkpt')) {
                pkt.push({ lat: parseFloat(p.getAttribute('lat') ?? ''), lng: parseFloat(p.getAttribute('lon') ?? ''), t: zeit(text(kinder(p, 'time')[0])) });
                if (!sensor && alle(p, 'extensions').length)
                    sensor = true;
            }
            segmente.push(pkt);
        }
        tracks.push({ name: text(kinder(trk, 'name')[0]) || `Track ${i + 1}`, segmente });
    }
    // Routen (rte) wie Tracks behandeln
    for (const [i, rte] of kinder(doc.documentElement, 'rte').entries()) {
        const pkt = kinder(rte, 'rtept').map((p) => ({ lat: parseFloat(p.getAttribute('lat') ?? ''), lng: parseFloat(p.getAttribute('lon') ?? ''), t: null }));
        tracks.push({ name: text(kinder(rte, 'name')[0]) || `Route ${i + 1}`, segmente: [pkt] });
    }
    return { format: 'GPX', tracks, wegpunkte: kinder(doc.documentElement, 'wpt').length, sensordaten: sensor };
}
export function kmlLesen(inhalt, format = 'KML') {
    const doc = xmlLesen(inhalt);
    if (lokal(doc.documentElement) !== 'kml')
        throw new GpsFehler('Die XML-Datei ist keine KML-Datei.');
    const tracks = [];
    let wegpunkte = 0;
    let sensor = false;
    const koord = (s) => s
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => {
        const [lng, lat] = t.split(',');
        return { lng: parseFloat(lng ?? ''), lat: parseFloat(lat ?? ''), t: null };
    });
    for (const pm of alle(doc, 'placemark')) {
        const name = text(kinder(pm, 'name')[0]);
        const segmente = [];
        for (const ls of alle(pm, 'linestring'))
            segmente.push(koord(text(kinder(ls, 'coordinates')[0])));
        for (const tr of alle(pm, 'track')) {
            // gx:Track: <when> und <gx:coord lng lat alt> wechseln sich ab
            const whens = kinder(tr, 'when').map((w) => zeit(text(w)));
            const coords = kinder(tr, 'coord').map((c) => c.textContent.trim().split(/\s+/));
            segmente.push(coords.map((c, i) => ({ lng: parseFloat(c[0] ?? ''), lat: parseFloat(c[1] ?? ''), t: whens[i] ?? null })));
            if (alle(tr, 'extendeddata').length)
                sensor = true;
        }
        if (segmente.length)
            tracks.push({ name: name || `Track ${tracks.length + 1}`, segmente });
        else if (alle(pm, 'point').length)
            wegpunkte++;
    }
    return { format, tracks, wegpunkte, sensordaten: sensor };
}
// FIT: Binärformat von Garmin & Co. Gelesen werden nur Record-Messages (Position und Zeit), alles andere wird übersprungen.
export function fitLesen(daten) {
    const dv = new DataView(daten.buffer, daten.byteOffset, daten.byteLength);
    const kopfLaenge = daten[0];
    if (kopfLaenge < 12 || daten.length < kopfLaenge + 2)
        throw new GpsFehler('Die FIT-Datei ist unvollständig.');
    const datenLaenge = dv.getUint32(4, true);
    const ende = Math.min(daten.length - 2, kopfLaenge + datenLaenge);
    const defs = new Map();
    const punkte = [];
    const FIT_EPOCHE = Date.UTC(1989, 11, 31);
    let pos = kopfLaenge;
    let letzteZeit = 0;
    let sensor = false;
    let wegpunkte = 0;
    const SEMI = 180 / 2 ** 31;
    while (pos < ende) {
        const kopf = daten[pos++];
        if (kopf & 0x80) {
            // komprimierter Zeitstempel: Datenmessage
            const lokalTyp = (kopf >> 5) & 0x03;
            const def = defs.get(lokalTyp);
            if (!def)
                throw new GpsFehler('Die FIT-Datei ist beschädigt (fehlende Definition).');
            const off = kopf & 0x1f;
            letzteZeit = (letzteZeit & ~0x1f) + off + (off < (letzteZeit & 0x1f) ? 0x20 : 0);
            pos += def.gesamt;
            continue;
        }
        const lokalTyp = kopf & 0x0f;
        if (kopf & 0x40) {
            // Definition
            pos++; // reserviert
            const gross = daten[pos++] === 1;
            const global = dv.getUint16(pos, !gross);
            pos += 2;
            const n = daten[pos++];
            const felder = [];
            let gesamt = 0;
            for (let i = 0; i < n; i++) {
                felder.push({ nr: daten[pos], groesse: daten[pos + 1], typ: daten[pos + 2] });
                gesamt += daten[pos + 1];
                pos += 3;
            }
            let devBytes = 0;
            if (kopf & 0x20) {
                const nd = daten[pos++];
                for (let i = 0; i < nd; i++) {
                    devBytes += daten[pos + 1];
                    pos += 3;
                }
            }
            defs.set(lokalTyp, { gross, global, felder, devBytes, gesamt: gesamt + devBytes });
            continue;
        }
        const def = defs.get(lokalTyp);
        if (!def)
            throw new GpsFehler('Die FIT-Datei ist beschädigt (fehlende Definition).');
        if (pos + def.gesamt > ende + 2)
            throw new GpsFehler('Die FIT-Datei ist abgeschnitten.');
        if (def.global === 20) {
            let lat = null;
            let lng = null;
            let t = null;
            let o = pos;
            for (const f of def.felder) {
                if (f.groesse === 4) {
                    if (f.nr === 0) {
                        const v = dv.getInt32(o, !def.gross);
                        if (v !== 0x7fffffff)
                            lat = v * SEMI;
                    }
                    else if (f.nr === 1) {
                        const v = dv.getInt32(o, !def.gross);
                        if (v !== 0x7fffffff)
                            lng = v * SEMI;
                    }
                    else if (f.nr === 253) {
                        const v = dv.getUint32(o, !def.gross);
                        if (v !== 0xffffffff) {
                            t = FIT_EPOCHE + v * 1000;
                            letzteZeit = v;
                        }
                    }
                }
                else if (f.nr === 3 || f.nr === 4 || f.nr === 6 /* Puls, Kadenz, Geschwindigkeit */ || f.nr === 13 /* Temperatur */) {
                    sensor = true;
                }
                o += f.groesse;
            }
            if (lat !== null && lng !== null)
                punkte.push({ lat, lng, t });
        }
        else if (def.global === 19 || def.global === 21) {
            // lap/event: ignoriert
        }
        else if (def.global === 29) {
            wegpunkte++; // Waypoint-ähnliche Daten (Course Points = 32 ignoriert)
        }
        pos += def.gesamt;
    }
    return { format: 'FIT', tracks: punkte.length ? [{ name: 'Aktivität', segmente: [punkte] }] : [], wegpunkte, sensordaten: sensor };
}
export async function gpsParsen(datei) {
    if (datei.size > MAX_BYTES)
        throw new GpsFehler(`Die Datei ist ${(datei.size / 1048576).toFixed(0)} MB groß (Maximum 100 MB).`);
    if (datei.size === 0)
        throw new GpsFehler('Die Datei ist leer.');
    const bytes = new Uint8Array(await datei.arrayBuffer());
    const art = dateityp(bytes);
    if (art === 'fit')
        return fitLesen(bytes);
    if (art === 'zip') {
        const { iter } = await import('but-unzip');
        let kml = null;
        let gesamt = 0;
        for (const e of iter(bytes)) {
            if (e.filename.endsWith('/') || !e.filename.toLowerCase().endsWith('.kml'))
                continue;
            const roh = await e.read();
            gesamt += roh.length;
            if (gesamt > MAX_BYTES)
                throw new GpsFehler('Das Archiv ist entpackt unplausibel groß.');
            if (kml === null || e.filename.toLowerCase().endsWith('doc.kml'))
                kml = new TextDecoder().decode(roh);
        }
        if (kml === null)
            throw new GpsFehler('Im KMZ-Archiv wurde keine KML-Datei (doc.kml) gefunden.');
        return kmlLesen(kml, 'KMZ');
    }
    if (art === 'xml') {
        const inhalt = new TextDecoder().decode(bytes);
        const wurzel = /<\s*([A-Za-z0-9_:.-]+)/.exec(inhalt.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, ''));
        const n = (wurzel?.[1] ?? '').toLowerCase().split(':').pop();
        if (n === 'gpx')
            return gpxLesen(inhalt);
        if (n === 'kml')
            return kmlLesen(inhalt);
        throw new GpsFehler('Die XML-Datei ist weder GPX noch KML.');
    }
    throw new GpsFehler('Unbekanntes Dateiformat. Unterstützt werden GPX, KML, KMZ und FIT.');
}
