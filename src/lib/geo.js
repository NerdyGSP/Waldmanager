// Aktuelle GPS-Position; null, wenn nicht verfügbar oder abgelehnt
export function aktuellePosition(timeoutMs = 10000) {
    return new Promise((resolve) => {
        if (!('geolocation' in navigator)) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition((p) => resolve({ lon: p.coords.longitude, lat: p.coords.latitude, genauigkeit: Math.round(p.coords.accuracy) }), () => resolve(null), { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 });
    });
}
// PostGIS akzeptiert EWKT direkt als Spaltenwert
export function punktEWKT(lon, lat) {
    return `SRID=4326;POINT(${lon.toFixed(7)} ${lat.toFixed(7)})`;
}
export function linieEWKT(punkte) {
    return `SRID=4326;LINESTRING(${punkte.map(([x, y]) => `${x.toFixed(7)} ${y.toFixed(7)}`).join(', ')})`;
}
// Aktuelles Wetter von Open-Meteo (frei, ohne Schlüssel)
export async function aktuellesWetter(lat, lon) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
            '&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation&timezone=Europe%2FBerlin';
        const antwort = await fetch(url);
        if (!antwort.ok)
            return null;
        const json = (await antwort.json());
        const c = json.current;
        if (!c)
            return null;
        return {
            temperatur: c.temperature_2m,
            windKmh: c.wind_speed_10m,
            windRichtung: c.wind_direction_10m,
            bewoelkung: c.cloud_cover,
            niederschlag: c.precipitation,
        };
    }
    catch {
        return null;
    }
}
export function himmelsrichtung(grad) {
    const namen = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    return namen[Math.round((((grad % 360) + 360) % 360) / 45) % 8] ?? 'N';
}
// Teilweise ausgefüllte Wetterdaten (z. B. nachgetragen) werden ohne leere Angaben ausgegeben
export function wetterText(w) {
    const teile = [];
    if (w.beschreibung)
        teile.push(w.beschreibung);
    if (typeof w.temperatur === 'number')
        teile.push(`${Math.round(w.temperatur)} °C`);
    if (typeof w.windKmh === 'number') {
        teile.push(`Wind ${Math.round(w.windKmh)} km/h${typeof w.windRichtung === 'number' ? ` aus ${himmelsrichtung(w.windRichtung)}` : ''}`);
    }
    else if (typeof w.windRichtung === 'number') {
        teile.push(`Wind aus ${himmelsrichtung(w.windRichtung)}`);
    }
    if (typeof w.niederschlag === 'number' && w.niederschlag > 0)
        teile.push(`Niederschlag ${w.niederschlag.toLocaleString('de-DE')} mm`);
    if (typeof w.bewoelkung === 'number')
        teile.push(`Bewölkung ${w.bewoelkung} %`);
    return teile.join(' · ');
}
