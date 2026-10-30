import { himmelsrichtung } from './geo';
import { mondphase } from './zeit';
export const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
export const leereSitzungsdaten = (datum) => ({
    datum,
    start: '',
    ende: '',
    wetter: '',
    windRichtung: '',
    windKmh: '',
    temperatur: '',
    niederschlag: '',
    bewoelkung: '',
    mond: '',
    bemerkung: '',
});
export function mondText(datum, zeit) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum))
        return '';
    const m = mondphase(new Date(`${datum}T${/^\d{2}:\d{2}$/.test(zeit) ? zeit : '20:00'}:00`));
    return `${m.name} (${m.beleuchtung} %)`;
}
const zahl = (t) => {
    const n = Number(t.trim().replace(',', '.'));
    return t.trim() !== '' && Number.isFinite(n) ? n : null;
};
// Zeitangabe als lokale Uhrzeit in einen ISO-Zeitstempel umwandeln
const zeitstempel = (datum, hhmm) => (/^\d{2}:\d{2}$/.test(hhmm) ? new Date(`${datum}T${hhmm}:00`).toISOString() : null);
export function alsSitzungsZeile(d) {
    const wetter = {};
    if (d.wetter.trim())
        wetter.beschreibung = d.wetter.trim();
    const t = zahl(d.temperatur);
    if (t !== null)
        wetter.temperatur = t;
    const w = zahl(d.windKmh);
    if (w !== null)
        wetter.windKmh = w;
    const r = RICHTUNGEN.indexOf(d.windRichtung);
    if (r >= 0)
        wetter.windRichtung = r * 45;
    const n = zahl(d.niederschlag);
    if (n !== null)
        wetter.niederschlag = n;
    const b = zahl(d.bewoelkung);
    if (b !== null)
        wetter.bewoelkung = b;
    return {
        datum: d.datum,
        beginn: zeitstempel(d.datum, d.start),
        ende: zeitstempel(d.datum, d.ende),
        wetter: (Object.keys(wetter).length ? wetter : null),
        mondphase: d.mond.trim() || null,
        bemerkung: d.bemerkung.trim() || null,
    };
}
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '');
export function vonSitzungsZeile(s) {
    const w = (s.wetter && typeof s.wetter === 'object' && !Array.isArray(s.wetter) ? s.wetter : {});
    const text = (n) => (typeof n === 'number' ? String(n) : '');
    return {
        datum: s.datum,
        start: hhmm(s.beginn),
        ende: hhmm(s.ende),
        wetter: w.beschreibung ?? '',
        windRichtung: typeof w.windRichtung === 'number' ? himmelsrichtung(w.windRichtung) : '',
        windKmh: text(w.windKmh),
        temperatur: text(w.temperatur),
        niederschlag: text(w.niederschlag),
        bewoelkung: text(w.bewoelkung),
        mond: s.mondphase ?? '',
        bemerkung: s.bemerkung ?? '',
    };
}
const WMO = {
    0: 'klar', 1: 'überwiegend klar', 2: 'wolkig', 3: 'bedeckt', 45: 'Nebel', 48: 'Reifnebel',
    51: 'leichter Nieselregen', 53: 'Nieselregen', 55: 'starker Nieselregen', 56: 'gefrierender Nieselregen', 57: 'gefrierender Nieselregen',
    61: 'leichter Regen', 63: 'Regen', 65: 'starker Regen', 66: 'gefrierender Regen', 67: 'gefrierender Regen',
    71: 'leichter Schneefall', 73: 'Schneefall', 75: 'starker Schneefall', 77: 'Schneegriesel',
    80: 'leichte Schauer', 81: 'Schauer', 82: 'starke Schauer', 85: 'Schneeschauer', 86: 'starke Schneeschauer',
    95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel',
};
// Open-Meteo: Archiv für zurückliegende Tage, für die letzten Tage (Archiv hinkt hinterher) die Vorhersage-Schnittstelle mit Vergangenheit
export async function wetterFuerZeitpunkt(lat, lon, datum, zeit) {
    try {
        const tage = (Date.now() - new Date(`${datum}T12:00:00`).getTime()) / 86400000;
        if (tage < -1)
            return null; // Zukunft: keine Messwerte
        const basis = tage > 6 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
        const url = `${basis}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${datum}&end_date=${datum}` +
            '&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code&timezone=Europe%2FBerlin';
        const r = await fetch(url);
        if (!r.ok)
            return null;
        const j = (await r.json());
        const h = j.hourly;
        if (!h)
            return null;
        const stunde = Math.min(23, Math.max(0, /^\d{2}:/.test(zeit) ? Number(zeit.slice(0, 2)) : 12));
        const wert = (k) => h[k]?.[stunde] ?? null;
        const t = wert('temperature_2m');
        if (t === null)
            return null;
        const dir = wert('wind_direction_10m');
        const code = wert('weather_code');
        const rund = (n, st = 0) => (n === null ? '' : String(Math.round(n * 10 ** st) / 10 ** st));
        return {
            wetter: code !== null ? (WMO[code] ?? '') : '',
            windRichtung: dir === null ? '' : himmelsrichtung(dir),
            windKmh: rund(wert('wind_speed_10m')),
            temperatur: rund(t, 1),
            niederschlag: rund(wert('precipitation'), 1),
            bewoelkung: rund(wert('cloud_cover')),
        };
    }
    catch {
        return null;
    }
}
