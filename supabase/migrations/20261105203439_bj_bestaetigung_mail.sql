alter table public.bewegungsjagden add column antwort_an text;
alter table public.bewegungsjagden add constraint bewegungsjagden_antwort_an_format check (antwort_an is null or antwort_an ~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$');
alter table public.bewegungsjagd_teilnehmer add column bestaetigung_gesendet_am timestamptz;

-- Daten für die Bestätigungs-Mail. Nur bei gültigem Code und Status zugesagt; die Empfängeradresse stammt
-- ausschließlich aus der DB. Wartezeit 10 Minuten zwischen zwei Mails (Missbrauchsschutz).
create or replace function public.bj_mail_daten(p_jagd uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare t public.bewegungsjagd_teilnehmer; b public.bewegungsjagden; revier text; inhaber_mail text; stand jsonb;
begin
  t := private.bj_teilnehmer(p_jagd, p_code);
  if t.id is null or t.status <> 'zugesagt' then return null; end if;
  select * into b from public.bewegungsjagden where id = p_jagd;
  if b.status <> 'offen' then return null; end if;
  if t.bestaetigung_gesendet_am is not null and t.bestaetigung_gesendet_am > now() - interval '10 minutes' then
    return jsonb_build_object('wartet', true);
  end if;
  update public.bewegungsjagd_teilnehmer set bestaetigung_gesendet_am = now() where id = t.id;
  select r.name into revier from public.reviere r where r.id = b.revier_id;
  select p.email into inhaber_mail from public.revier_mitglieder m join public.profiles p on p.id = m.user_id
    where m.revier_id = b.revier_id and m.rolle = 'inhaber' order by m.erstellt_am limit 1;
  select jsonb_build_object('name', e.name, 'bemerkung', e.bemerkung, 'lng', extensions.st_x(e.geom), 'lat', extensions.st_y(e.geom))
    into stand from public.einrichtungen e where e.id = t.zugeordnete_einrichtung_id and e.revier_id = b.revier_id and e.geloescht_am is null;
  return jsonb_build_object(
    'email', t.email, 'name', t.name, 'teilnehmer_id', t.id, 'code', t.einladungscode,
    'revier', revier, 'antwort_an', b.antwort_an, 'inhaber_email', inhaber_mail,
    'jagd', jsonb_build_object('id', b.id, 'titel', b.titel, 'art', b.art, 'datum', b.datum, 'uhrzeit', b.uhrzeit,
      'lng', b.treffpunkt_lng, 'lat', b.treffpunkt_lat, 'schuesseltreiben', b.schuesseltreiben,
      'schuesseltreiben_adresse', b.schuesseltreiben_adresse, 'anmeldung_pflicht', b.schuesseltreiben_anmeldung_pflicht,
      'hegebeitrag_aktiv', b.hegebeitrag_aktiv, 'hegebeitrag_betrag', b.hegebeitrag_betrag),
    'ich', jsonb_build_object('anschrift', t.anschrift, 'telefon', t.telefon, 'hund', t.hat_hund, 'horn', t.hat_hornblaeser,
      'auto', t.auto_vorhanden, 'plaetze', t.mitfahrplaetze, 'schuessel', t.schuesseltreiben_teilnahme),
    'stand', stand,
    'ansteller', (select jsonb_build_object('name', a.name, 'telefon', a.telefon) from public.bewegungsjagd_teilnehmer a where a.id = t.ansteller_id and a.aktiv),
    'jagdleitung', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'telefon', l.telefon, 'funktion', l.funktion) order by l.sortierung, l.erstellt_am), '[]'::jsonb)
      from public.bewegungsjagd_jagdleitung l where l.bewegungsjagd_id = b.id));
end $$;
revoke all on function public.bj_mail_daten(uuid, text) from public;
grant execute on function public.bj_mail_daten(uuid, text) to anon, authenticated, service_role;
