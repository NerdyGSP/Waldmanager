alter table public.bewegungsjagd_teilnehmer add column telefon text;

drop function public.bj_antworten(uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean);
create function public.bj_antworten(p_jagd uuid, p_code text, p_name text, p_anschrift text, p_zusage boolean, p_hund boolean, p_hornblaeser boolean, p_auto boolean, p_plaetze integer, p_schuesseltreiben boolean, p_telefon text default null)
returns boolean language plpgsql security definer set search_path to '' as $$
declare t public.bewegungsjagd_teilnehmer;
begin
  t := private.bj_teilnehmer(p_jagd, p_code);
  if t.id is null or (select status from public.bewegungsjagden where id = p_jagd) <> 'offen' then return false; end if;
  update public.bewegungsjagd_teilnehmer set
    name = coalesce(nullif(btrim(p_name), ''), name), anschrift = nullif(btrim(p_anschrift), ''),
    telefon = nullif(left(btrim(coalesce(p_telefon, '')), 40), ''),
    status = case when p_zusage then 'zugesagt' else 'abgesagt' end,
    hat_hund = p_hund, hat_hornblaeser = p_hornblaeser, auto_vorhanden = p_auto,
    mitfahrplaetze = case when p_auto then least(greatest(coalesce(p_plaetze, 0), 0), 20) else null end,
    schuesseltreiben_teilnahme = p_schuesseltreiben, antwort_am = now()
  where id = t.id;
  return true;
end $$;
grant execute on function public.bj_antworten(uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean, text) to anon, authenticated;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.bj_laden(uuid,text)'::regprocedure);
  d := replace(d, '''anschrift'', t.anschrift,', '''anschrift'', t.anschrift, ''telefon'', t.telefon,');
  if d not like '%''telefon''%' then raise exception 'bj_laden-Patch nicht angewendet'; end if;
  execute d;
end $$;
