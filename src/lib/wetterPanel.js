import SunCalc from 'suncalc';
import { mondphase } from './zeit';
const TTL_MS = 15 * 60 * 1000;
// Open-Meteo, lokal 15 Minuten zwischengespeichert (je Ort auf ~1 km gerundet)
export async function wetterDetail(lat, lon, erzwingen = false) {
    const schluessel = `hegewerk.wetter.${lat.toFixed(2)}.${lon.toFixed(2)}`;
    try {
        const roh = localStorage.getItem(schluessel);
        if (roh && !erzwingen) {
            const c = JSON.parse(roh);
            if (Date.now() - c.stand < TTL_MS)
                return c;
        }
    }
    catch {
        /* kein Cache */
    }
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
            '&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover' +
            '&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover&forecast_days=2&timezone=Europe%2FBerlin';
        const r = await fetch(url);
        if (!r.ok)
            throw new Error('HTTP ' + r.status);
        const j = (await r.json());
        const h = j.hourly;
        const d = {
            temperatur: j.current.temperature_2m,
            gefuehlt: j.current.apparent_temperature,
            windKmh: j.current.wind_speed_10m,
            windRichtung: j.current.wind_direction_10m,
            boeen: j.current.wind_gusts_10m,
            niederschlag: j.current.precipitation,
            bewoelkung: j.current.cloud_cover,
            stunden: h.time.map((zeit, i) => ({
                zeit,
                temperatur: h.temperature_2m[i],
                niederschlag: h.precipitation[i],
                windKmh: h.wind_speed_10m[i],
                boeen: h.wind_gusts_10m[i],
                bewoelkung: h.cloud_cover[i],
            })),
            stand: Date.now(),
        };
        try {
            localStorage.setItem(schluessel, JSON.stringify(d));
        }
        catch {
            /* Speicher voll */
        }
        return d;
    }
    catch {
        // Offline: letzten Stand zeigen, auch wenn älter
        try {
            const roh = localStorage.getItem(schluessel);
            return roh ? JSON.parse(roh) : null;
        }
        catch {
            return null;
        }
    }
}
const gueltig = (d) => (d && !Number.isNaN(d.getTime()) ? d : null);
// Lokal berechnet (suncalc) für einen Ort und Tag
export function sonneMond(lat, lon, tag) {
    const mittag = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 12);
    const s = SunCalc.getTimes(mittag, lat, lon);
    const m = SunCalc.getMoonTimes(mittag, lat, lon);
    const mp = mondphase(mittag);
    return {
        aufgang: gueltig(s.sunrise),
        untergang: gueltig(s.sunset),
        buechsenlichtVon: gueltig(s.sunrise) && new Date(s.sunrise.getTime() - 90 * 60000),
        buechsenlichtBis: gueltig(s.sunset) && new Date(s.sunset.getTime() + 90 * 60000),
        mondAufgang: gueltig(m.rise),
        mondUntergang: gueltig(m.set),
        mondphase: mp.name,
        beleuchtung: Math.round(SunCalc.getMoonIllumination(mittag).fraction * 100),
    };
}
