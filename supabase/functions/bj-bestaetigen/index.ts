// Bestätigungs-Mail mit Kalendereintrag (.ics) nach einer Zusage. Öffentlich aufrufbar: Empfänger ist ausschließlich
// die in der Datenbank gespeicherte Adresse; bj_mail_daten prüft Code, Status und die 10-Minuten-Sperre.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ABSENDER_ADRESSE, BASIS, CORS, absender, codeAnzeige, esc, json, replyTo } from '../_shared/mail.ts';
import { erzeugeIcs } from '../_shared/ics.ts';

type Daten = {
  email: string; name: string; teilnehmer_id: string; code: string; revier: string | null; antwort_an: string | null; inhaber_email: string | null;
  jagd: { id: string; titel: string; art: string; datum: string; uhrzeit: string | null; lng: number | null; lat: number | null; schuesseltreiben: boolean; schuesseltreiben_adresse: string | null; anmeldung_pflicht: boolean; hegebeitrag_aktiv: boolean; hegebeitrag_betrag: number | null };
  ich: { anschrift: string | null; telefon: string | null; hund: boolean | null; horn: boolean | null; auto: boolean | null; plaetze: number | null; schuessel: boolean | null };
  stand: { name: string | null } | null;
  ansteller: { name: string; telefon: string | null } | null;
  jagdleitung: Array<{ name: string; telefon: string | null; funktion: string | null }>;
};

const base64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const key = Deno.env.get('BREVO_API_KEY');
  if (!key) return json({ fehler: 'BREVO_API_KEY ist nicht gesetzt.' }, 500);
  let jagdId: string;
  let code: string;
  try {
    const b = await req.json();
    jagdId = String(b.jagd_id);
    code = String(b.code);
  } catch {
    return json({ fehler: 'Ungültige Anfrage.' }, 400);
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data, error } = await supabase.rpc('bj_mail_daten', { p_jagd: jagdId, p_code: code });
  if (error) return json({ fehler: 'Daten konnten nicht gelesen werden.' }, 500);
  if (!data) return json({ fehler: 'Code ungültig oder keine Zusage.' }, 403);
  if ((data as { wartet?: boolean }).wartet) return json({ wartet: true });
  const d = data as Daten;
  const j = d.jagd;

  const datumKurz = new Date(j.datum + 'T12:00:00').toLocaleDateString('de-DE');
  const datumLang = new Date(j.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const zeit = j.uhrzeit ? `, ${String(j.uhrzeit).slice(0, 5)} Uhr` : '';
  const link = `${BASIS}/bj/${j.id}?code=${codeAnzeige(d.code)}`;
  const nav = j.lat != null && j.lng != null
    ? { apple: `https://maps.apple.com/?ll=${j.lat},${j.lng}&q=Treffpunkt`, google: `https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}` }
    : null;
  const tel = (t: string | null) => (t ? ` · ${esc(t)}` : '');
  const betrag = j.hegebeitrag_betrag != null ? Number(j.hegebeitrag_betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '';
  const ja = (b: boolean | null) => (b ? 'ja' : 'nein');
  const zeile = (l: string, w: string) => `<tr><td style="padding:3px 12px 3px 0;color:#666;vertical-align:top">${l}</td><td style="padding:3px 0">${w}</td></tr>`;
  const schuessel = j.schuesseltreiben ? (j.anmeldung_pflicht ? 'verpflichtend' : d.ich.schuessel ? 'ja' : 'nein') : null;

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c1f1a">
<h2 style="margin:0 0 4px">Zusage bestätigt</h2>
<p style="margin:0 0 16px;color:#555">${esc(j.titel)} · ${esc(j.art)}</p>
<p>Hallo ${esc(d.name)}, deine Zusage ist gespeichert.</p>
<h3 style="margin:16px 0 6px">Termin</h3>
<p style="margin:0">${esc(datumLang)}${esc(zeit)}</p>
${nav ? `<p style="margin:6px 0 0">Treffpunkt: <a href="${nav.apple}">Apple Karten</a> · <a href="${nav.google}">Google Maps</a></p>` : ''}
<p style="margin:6px 0 0;color:#555;font-size:13px">Der Kalendereintrag hängt als .ics-Datei an.</p>
<h3 style="margin:16px 0 6px">Dein Stand</h3>
<p style="margin:0">${d.stand ? esc(d.stand.name ?? 'Stand zugewiesen') : 'wird noch zugewiesen – du findest ihn über deinen Link'}</p>
<h3 style="margin:16px 0 6px">Deine Angaben</h3>
<table style="border-collapse:collapse">
${zeile('Name', esc(d.name))}${zeile('Anschrift', esc(d.ich.anschrift ?? '–'))}${zeile('Telefon', esc(d.ich.telefon ?? '–'))}${zeile('Hund', ja(d.ich.hund))}${zeile('Hornbläser', ja(d.ich.horn))}${zeile('Anreise', d.ich.auto ? `Auto, ${Number(d.ich.plaetze ?? 0)} freie Plätze` : 'ohne Auto')}${schuessel ? zeile('Schüsseltreiben', `${schuessel}${j.schuesseltreiben_adresse ? ` (${esc(j.schuesseltreiben_adresse)})` : ''}`) : ''}
</table>
${j.hegebeitrag_aktiv ? `<h3 style="margin:16px 0 6px">Hegebeitrag</h3><p style="margin:0">${esc(betrag)}</p>` : ''}
${d.ansteller || d.jagdleitung.length ? `<h3 style="margin:16px 0 6px">Ansprechpartner</h3>${d.ansteller ? `<p style="margin:0">Ansteller: ${esc(d.ansteller.name)}${tel(d.ansteller.telefon)}</p>` : ''}${d.jagdleitung.map((l) => `<p style="margin:0">${esc(l.funktion || 'Jagdleitung')}: ${esc(l.name)}${tel(l.telefon)}</p>`).join('')}` : ''}
<p style="margin:20px 0"><a href="${link}" style="display:inline-block;background:#2f5d3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Angaben ändern oder absagen</a></p>
</div>`;

  const beschreibung = [
    `Deine Seite: ${link}`,
    d.stand ? `Stand: ${d.stand.name ?? 'zugewiesen'}` : 'Stand: wird noch zugewiesen',
    ...d.jagdleitung.map((l) => `${l.funktion || 'Jagdleitung'}: ${l.name}${l.telefon ? ` (${l.telefon})` : ''}`),
  ].join('\n');
  const ics = erzeugeIcs({ uid: d.teilnehmer_id, titel: j.titel, datum: j.datum, uhrzeit: j.uhrzeit, lat: j.lat, lng: j.lng, beschreibung, url: link });

  const antwort = replyTo(d.antwort_an, d.inhaber_email);
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: absender(d.revier) ?? { name: 'Hegewerk', email: ABSENDER_ADRESSE },
        ...(antwort ? { replyTo: antwort } : {}),
        to: [{ email: d.email, name: d.name }],
        subject: `Zusage bestätigt: ${j.titel} am ${datumKurz}`,
        htmlContent: html,
        attachment: [{ name: 'bewegungsjagd.ics', content: base64(ics) }],
      }),
    });
    if (!r.ok) return json({ fehler: `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);
  } catch (e) {
    return json({ fehler: e instanceof Error ? e.message : 'Versand fehlgeschlagen' }, 502);
  }
  return json({ ok: true });
});
