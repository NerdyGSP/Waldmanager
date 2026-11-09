do $$
declare d text;
begin
  d := pg_get_functiondef('public.karte_daten(uuid,integer)'::regprocedure);
  d := replace(d, '''ebenen'', coalesce((', '''mitte'', (select extensions.st_asgeojson(extensions.st_pointonsurface(g.geom), 6)::jsonb from public.revier_grenzen g where g.revier_id = p_revier_id),
    ''ebenen'', coalesce((');
  if d not like '%''mitte''%' then raise exception 'Patch nicht angewendet'; end if;
  execute d;
end $$;
