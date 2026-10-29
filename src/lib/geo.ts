export type Position = { lon: number; lat: number; genauigkeit: number };

// Aktuelle GPS-Position; null, wenn nicht verfügbar oder abgelehnt
export function aktuellePosition(timeoutMs = 10000): Promise<Position | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lon: p.coords.longitude, lat: p.coords.latitude, genauigkeit: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

// PostGIS akzeptiert EWKT direkt als Spaltenwert
export function punktEWKT(lon: number, lat: number): string {
  return `SRID=4326;POINT(${lon.toFixed(7)} ${lat.toFixed(7)})`;
}

export function linieEWKT(punkte: Array<[number, number]>): string {
  return `SRID=4326;LINESTRING(${punkte.map(([x, y]) => `${x.toFixed(7)} ${y.toFixed(7)}`).join(', ')})`;
}

export type Wetter = {
  temperatur: number;
  windKmh: number;
  windRichtung: number;
  bewoelkung: number;
  niederschlag: number;
};

// Aktuelles Wetter von Open-Meteo (frei, ohne Schlüssel)
export async function aktuellesWetter(lat: number, lon: number): Promise<Wetter | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      '&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation&timezone=Europe%2FBerlin';
    const antwort = await fetch(url);
    if (!antwort.ok) return null;
    const json = (await antwort.json()) as {
      current?: {
        temperature_2m: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        cloud_cover: number;
        precipitation: number;
      };
    };
    const c = json.current;
    if (!c) return null;
    return {
      temperatur: c.temperature_2m,
      windKmh: c.wind_speed_10m,
      windRichtung: c.wind_direction_10m,
      bewoelkung: c.cloud_cover,
      niederschlag: c.precipitation,
    };
  } catch {
    return null;
  }
}

export function himmelsrichtung(grad: number): string {
  const namen = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return namen[Math.round((((grad % 360) + 360) % 360) / 45) % 8] ?? 'N';
}

export function wetterText(w: Wetter): string {
  return `${Math.round(w.temperatur)} °C · Wind ${Math.round(w.windKmh)} km/h aus ${himmelsrichtung(w.windRichtung)} · Bewölkung ${w.bewoelkung} %`;
}
