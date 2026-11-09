drop function if exists public.zone_geometrie_setzen(uuid, jsonb);
create or replace function public.zone_geometrie_setzen(p_zone_id uuid, p_geojson jsonb, p_zuschneiden boolean default true)
returns numeric
language plpgsql
set search_path to ''
as $function$
declare
  g extensions.geometry := private.flaeche_aus_geojson(p_geojson);
  v_revier uuid;
  v_grenze extensions.geometry;
begin
  select z.revier_id into v_revier from public.zonen z where z.id = p_zone_id;
  if v_revier is null then
    raise exception 'Zone nicht gefunden oder keine Berechtigung';
  end if;

  -- Zuschnitt auf die Reviergrenze nur bei manueller Anlage; Import übernimmt die Fläche unverändert
  if p_zuschneiden then
    select gr.geom into v_grenze from public.revier_grenzen gr where gr.revier_id = v_revier;
    if v_grenze is not null then
      g := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_intersection(g, v_grenze)), 3);
      if g is null or extensions.st_isempty(g) or extensions.st_area(g::extensions.geography) < 1 then
        raise exception 'Die Zone liegt außerhalb der Reviergrenze';
      end if;
      g := extensions.st_multi(g);
    end if;
  end if;

  update public.zonen set geom = g where id = p_zone_id;
  if not found then
    raise exception 'Zone nicht gefunden oder keine Berechtigung';
  end if;
  return round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 2);
end;
$function$;
grant execute on function public.zone_geometrie_setzen(uuid, jsonb, boolean) to authenticated;
revoke execute on function public.zone_geometrie_setzen(uuid, jsonb, boolean) from anon, public;
