// Erstellt einen Revier-Einladungscode und versendet ihn per Brevo (Secret BREVO_API_KEY).
// Die Berechtigung prüft die RPC einladung_erstellen mit dem JWT des Aufrufers (nur Inhaber/Masteradmin).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { BASIS, CORS, absender, esc, json } from '../_shared/mail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const key = Deno.env.get('BREVO_API_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  let b: { revier_id: string; rolle: string; email: string; tage: number };
  try {
    b = await req.json();
  } catch {
    return json({ fehler: 'Ungültige Anfrage.' }, 400);
  }
  const email = String(b.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ fehler: 'Ungültige E-Mail-Adresse.' }, 400);

  const { data: code, error } = await supabase.rpc('einladung_erstellen', {
    p_revier_id: b.revier_id,
    p_rolle: b.rolle,
    p_email: email,
    p_gueltig_tage: b.tage,
  });
  if (error || !code) return json({ fehler: error?.message ?? 'Einladung konnte nicht erstellt werden.' }, 403);

  const [{ data: revier }, { data: u }] = await Promise.all([
    supabase.from('reviere').select('name').eq('id', b.revier_id).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const { data: ich } = u?.user ? await supabase.from('profiles').select('name').eq('id', u.user.id).maybeSingle() : { data: null };
  const rolle = b.rolle === 'inhaber' ? 'Inhaber/Pächter' : 'Mitjäger';
  const gueltig = new Date(Date.now() + b.tage * 86400000).toLocaleDateString('de-DE');

  if (!key) return json({ code, mail: false, fehler: 'BREVO_API_KEY ist nicht gesetzt.' });
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c1f1a">
<h2 style="margin:0 0 8px">Einladung ins Revier ${esc(revier?.name ?? '')}</h2>
<p>${ich?.name ? `${esc(ich.name)} lädt dich` : 'Du bist'} als <b>${rolle}</b> in die Hegewerk-App ein.</p>
<p><a href="${BASIS}" style="display:inline-block;background:#2f5d3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Hegewerk öffnen</a></p>
<p>Registriere dich mit dieser E-Mail-Adresse, deinem Namen und diesem Code:<br><b style="letter-spacing:1px;font-size:18px">${code}</b><br><span style="color:#777;font-size:13px">Der Code ist einmal nutzbar und gilt bis ${gueltig}. Hast du bereits ein Konto, löst du ihn unter Reviermanagement ein.</span></p>
</div>`;
  let ok = false;
  let fehler: string | undefined;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: absender(revier?.name), to: [{ email }], subject: `Einladung ins Revier ${revier?.name ?? ''}`, htmlContent: html }),
    });
    ok = r.ok;
    if (!ok) fehler = `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`;
  } catch (e) {
    fehler = e instanceof Error ? e.message : 'Versand fehlgeschlagen';
  }
  return json({ code, mail: ok, fehler });
});
