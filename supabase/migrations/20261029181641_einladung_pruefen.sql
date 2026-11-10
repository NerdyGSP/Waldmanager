-- Vorab-Prüfung eines Einladungscodes für das Registrierungsformular (auch ohne Login)
create function public.einladung_pruefen(p_code text)
returns table (gueltig boolean, revier_name text, rolle text)
language sql
stable
security definer
set search_path = ''
as $$
  select true, r.name, e.rolle
  from public.einladungen e
  left join public.reviere r on r.id = e.revier_id
  where e.code = private.code_normalisieren(p_code)
    and e.eingeloest_am is null
    and e.gueltig_bis > now()
  union all
  select false, null::text, null::text
  where not exists (
    select 1 from public.einladungen e
    where e.code = private.code_normalisieren(p_code)
      and e.eingeloest_am is null
      and e.gueltig_bis > now()
  );
$$;
revoke all on function public.einladung_pruefen(text) from public;
grant execute on function public.einladung_pruefen(text) to anon, authenticated;
grant execute on function private.code_normalisieren(text) to anon, authenticated;
grant usage on schema private to anon;
