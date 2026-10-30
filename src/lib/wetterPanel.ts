import SunCalc from 'suncalc';
import { mondphase } from './zeit';

export type Stunde = { zeit: string; temperatur: number; niederschlag: number; windKmh: number; boeen: number; bewoelkung: number };
export type WetterDetail = {
  temperatur: number;
  gefuehlt: number;
  windKmh: number;
  windRichtung: number;
  boeen: number;
  niederschlag: number;
  bewoelkung: number;
  stunden: Stunde[]; // heute und morgen
  stand: number;
};

const TTL_MS = 15 * 60 * 1000;

// Open-Meteo, lokal 15 Minuten zwischengespeichert (je Ort auf ~1 km gerundet)
export async function wetterDetail(lat: number, lon: number, erzwingen = false): Promise<WetterDetail | null> {
  const schluessel = `hegewerk.wetter.${lat.toFixed(2)}.${lon.toFixed(2)}`;
  try {
    const roh = localStorage.getItem(schluessel);
    if (roh && !erzwingen) {
      const c = JSON.parse(roh) as WetterDetail;
      if (Date.now() - c.stand < TTL_MS) return c;
    }
  } catch {
    /* kein Cache */
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      '&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover' +
      '&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover&forecast_days=2&timezone=Europe%2FBerlin';
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = (await r.json()) as {
      current: Record<string, number>;
      hourly: { time: string[]; temperature_2m: number[]; precipitation: number[]; wind_speed_10m: number[]; wind_gusts_10m: number[]; cloud_cover: number[] };
    };
    const h = j.hourly;
    const d: WetterDetail = {
      temperatur: j.current.temperature_2m!,
      gefuehlt: j.current.apparent_temperature!,
      windKmh: j.current.wind_speed_10m!,
      windRichtung: j.current.wind_direction_10m!,
      boeen: j.current.wind_gusts_10m!,
      niederschlag: j.current.precipitation!,
      bewoelkung: j.current.cloud_cover!,
      stunden: h.time.map((zeit, i) => ({
        zeit,
        temperatur: h.temperature_2m[i]!,
        niederschlag: h.precipitation[i]!,
        windKmh: h.wind_speed_10m[i]!,
        boeen: h.wind_gusts_10m[i]!,
        bewoelkung: h.cloud_cover[i]!,
      })),
      stand: Date.now(),
    };
    try {
      localStorage.setItem(schluessel, JSON.stringify(d));
    } catch {
      /* Speicher voll */
    }
    return d;
  } catch {
    // Offline: letzten Stand zeigen, auch wenn älter
    try {
      const roh = localStorage.getItem(schluessel);
      return roh ? (JSON.parse(roh) as WetterDetail) : null;
    } catch {
      return null;
    }
  }
}

export type SonneMond = {
  aufgang: Date | null;
  untergang: Date | null;
  buechsenlichtVon: Date | null; // Richtwert: 1,5 Std. vor Sonnenaufgang
  buechsenlichtBis: Date | null; // Richtwert: 1,5 Std. nach Sonnenuntergang
  mondAufgang: Date | null;
  mondUntergang: Date | null;
  mondphase: string;
  beleuchtung: number;
};

const gueltig = (d: Date | undefined | null): Date | null => (d && !Number.isNaN(d.getTime()) ? d : null);

// Lokal berechnet (suncalc) für einen Ort und Tag
export function sonneMond(lat: number, lon: number, tag: Date): SonneMond {
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
