// Versendet die Einladungs-E-Mails einer Bewegungsjagd über Brevo (Secret BREVO_API_KEY).
// Aufruf nur durch Revierinhaber: Die Daten werden mit dem JWT des Aufrufers gelesen (RLS).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ABSENDER = { name: 'Hegewerk', email: 'noreply@hegewerk.app' };
const BASIS = 'https://hegewerk.app';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const key = Deno.env.get('BREVO_API_KEY');
  if (!key) return json({ fehler: 'BREVO_API_KEY ist nicht gesetzt.' }, 500);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  let jagdId: string;
  try {
    ({ jagd_id: jagdId } = await req.json());
  } catch {
    return json({ fehler: 'Ungültige Anfrage.' }, 400);
  }
  const { data: jagd } = await supabase.from('bewegungsjagden').select('*').eq('id', jagdId).is('geloescht_am', null).maybeSingle();
  if (!jagd) return json({ fehler: 'Bewegungsjagd nicht gefunden oder keine Berechtigung.' }, 403);
  const { data: teilnehmer } = await supabase.from('bewegungsjagd_teilnehmer').select('*').eq('bewegungsjagd_id', jagdId).eq('aktiv', true);

  const datum = new Date(jagd.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const zeit = jagd.uhrzeit ? ` um ${String(jagd.uhrzeit).slice(0, 5)} Uhr` : '';
  const ergebnisse: Array<{ id: string; ok: boolean; fehler?: string }> = [];

  for (const t of teilnehmer ?? []) {
    const code = `${t.einladungscode.slice(0, 4)}-${t.einladungscode.slice(4)}`;
    const link = `${BASIS}/bj/${jagd.id}?code=${code}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c1f1a">
<h2 style="margin:0 0 8px">${esc(jagd.titel)}</h2>
<p style="margin:0 0 16px;color:#555">${esc(jagd.art)} · ${esc(datum)}${zeit}</p>
<p>Hallo ${esc(t.name)},</p>
${jagd.einladungstext ? `<p style="white-space:pre-line">${esc(jagd.einladungstext)}</p>` : '<p>du bist zu einer Bewegungsjagd eingeladen.</p>'}
<p><a href="${link}" style="display:inline-block;background:#2f5d3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Zu- oder Absagen</a></p>
<p>Dein Einladungscode: <b style="letter-spacing:1px">${code}</b><br><span style="color:#777;font-size:13px">Der Code gilt bis zum Jagdtag.</span></p>
</div>`;
    let ok = false;
    let fehler: string | undefined;
    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: ABSENDER,
          to: [{ email: t.email, name: t.name }],
          subject: `Einladung: ${jagd.titel} am ${new Date(jagd.datum + 'T12:00:00').toLocaleDateString('de-DE')}`,
          htmlContent: html,
        }),
      });
      ok = r.ok;
      if (!ok) fehler = `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`;
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Versand fehlgeschlagen';
    }
    await supabase
      .from('bewegungsjagd_teilnehmer')
      .update({ mail_status: ok ? 'gesendet' : 'fehler', mail_gesendet_am: ok ? new Date().toISOString() : null, mail_fehler: fehler ?? null })
      .eq('id', t.id);
    ergebnisse.push({ id: t.id, ok, fehler });
  }
  return json({ ergebnisse });
});
