// Minimaler iCalendar-Generator (RFC 5545) für den Jagdtermin. Eine Kopie liegt in src/lib/ics.ts.
export type IcsTermin = {
  uid: string;
  titel: string;
  datum: string; // YYYY-MM-DD
  uhrzeit?: string | null; // HH:MM[:SS] (Europe/Berlin)
  lat?: number | null;
  lng?: number | null;
  beschreibung?: string;
  url?: string;
  dauerStunden?: number;
};

const escText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const p2 = (n: number) => String(n).padStart(2, '0');

/** Zeilen länger als 75 Oktette falten (Fortsetzung mit Leerzeichen) */
function falten(zeile: string): string {
  const enc = new TextEncoder();
  if (enc.encode(zeile).length <= 75) return zeile;
  const teile: string[] = [];
  let aktuell = '';
  let bytes = 0;
  let grenze = 75;
  for (const ch of zeile) {
    const n = enc.encode(ch).length;
    if (bytes + n > grenze) {
      teile.push(aktuell);
      aktuell = '';
      bytes = 0;
      grenze = 74;
    }
    aktuell += ch;
    bytes += n;
  }
  teile.push(aktuell);
  return teile.join('\r\n ');
}

const lokal = (d: Date) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00`;

export function erzeugeIcs(t: IcsTermin, jetzt: Date = new Date()): string {
  const [y, m, d] = t.datum.split('-').map(Number) as [number, number, number];
  const stamp = `${jetzt.getUTCFullYear()}${p2(jetzt.getUTCMonth() + 1)}${p2(jetzt.getUTCDate())}T${p2(jetzt.getUTCHours())}${p2(jetzt.getUTCMinutes())}${p2(jetzt.getUTCSeconds())}Z`;
  const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hegewerk//Bewegungsjagd//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  zeilen.push(
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${t.uid}@hegewerk.app`,
    `DTSTAMP:${stamp}`,
  );
  const zeit = t.uhrzeit?.match(/^(\d{1,2}):(\d{2})/);
  if (zeit) {
    const start = new Date(Date.UTC(y, m - 1, d, Number(zeit[1]), Number(zeit[2])));
    const ende = new Date(start.getTime() + (t.dauerStunden ?? 4) * 3600000);
    zeilen.push(`DTSTART;TZID=Europe/Berlin:${lokal(start)}`, `DTEND;TZID=Europe/Berlin:${lokal(ende)}`);
  } else {
    const tag = (dt: Date) => `${dt.getUTCFullYear()}${p2(dt.getUTCMonth() + 1)}${p2(dt.getUTCDate())}`;
    zeilen.push(`DTSTART;VALUE=DATE:${tag(new Date(Date.UTC(y, m - 1, d)))}`, `DTEND;VALUE=DATE:${tag(new Date(Date.UTC(y, m - 1, d + 1)))}`);
  }
  zeilen.push(`SUMMARY:${escText(t.titel)}`);
  if (t.lat != null && t.lng != null) {
    zeilen.push(`LOCATION:${escText(`Treffpunkt (${t.lat.toFixed(5)}, ${t.lng.toFixed(5)})`)}`, `GEO:${t.lat.toFixed(6)};${t.lng.toFixed(6)}`);
  }
  if (t.beschreibung) zeilen.push(`DESCRIPTION:${escText(t.beschreibung)}`);
  if (t.url) zeilen.push(`URL:${t.url}`);
  zeilen.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(`Morgen: ${t.titel}`)}`, 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
  return zeilen.map(falten).join('\r\n') + '\r\n';
}
