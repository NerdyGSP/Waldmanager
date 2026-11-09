create or replace function public.zonen_flaechen(p_revier_id uuid)
returns table(zone_id uuid, flaeche_ha numeric)
language sql stable security invoker set search_path = ''
as $$
  select z.id, round((extensions.st_area(z.geom::extensions.geography) / 10000)::numeric, 1)
  from public.zonen z
  where z.revier_id = p_revier_id and z.geloescht_am is null and z.geom is not null
$$;
revoke execute on function public.zonen_flaechen(uuid) from public, anon;
grant execute on function public.zonen_flaechen(uuid) to authenticated;
