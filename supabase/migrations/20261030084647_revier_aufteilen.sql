-- Teilt eine Fläche (UTM 32N, EPSG:25832) in k flächengleiche Teile: rekursive Halbierung entlang der längeren
-- Achse, der Schnitt wird per Bisektion auf die Zielfläche gesetzt. gs ist eine vereinfachte Kopie nur für die Suche.
create or replace function private.flaeche_teilen(g extensions.geometry, gs extensions.geometry, k integer)
returns setof extensions.geometry
language plpgsql immutable set search_path = ''
as $$
declare
  k1 integer; frac float8; total float8; a float8; lo float8; hi float8; c float8; breit boolean; i integer;
  xmin float8; xmax float8; ymin float8; ymax float8; box extensions.geometry;
  g1 extensions.geometry; g2 extensions.geometry; s1 extensions.geometry; s2 extensions.geometry;
begin
  if k <= 1 then
    return next g;
    return;
  end if;
  k1 := k / 2;
  frac := k1::float8 / k;
  total := extensions.st_area(gs);
  xmin := extensions.st_xmin(gs); xmax := extensions.st_xmax(gs);
  ymin := extensions.st_ymin(gs); ymax := extensions.st_ymax(gs);
  breit := (xmax - xmin) >= (ymax - ymin);
  lo := case when breit then xmin else ymin end;
  hi := case when breit then xmax else ymax end;
  for i in 1..34 loop
    c := (lo + hi) / 2;
    -- erster Teil: bei breitem Revier der westliche, sonst der nördliche
    box := case when breit then extensions.st_makeenvelope(xmin - 10, ymin - 10, c, ymax + 10, 25832)
                else extensions.st_makeenvelope(xmin - 10, c, xmax + 10, ymax + 10, 25832) end;
    a := extensions.st_area(extensions.st_intersection(gs, box));
    if breit then
      if a < frac * total then lo := c; else hi := c; end if;
    else
      if a < frac * total then hi := c; else lo := c; end if;
    end if;
  end loop;
  c := (lo + hi) / 2;
  box := case when breit then extensions.st_makeenvelope(xmin - 10, ymin - 10, c, ymax + 10, 25832)
              else extensions.st_makeenvelope(xmin - 10, c, xmax + 10, ymax + 10, 25832) end;
  g1 := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_intersection(g, box)), 3);
  g2 := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_difference(g, box)), 3);
  s1 := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_intersection(gs, box)), 3);
  s2 := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_difference(gs, box)), 3);
  return query select f from private.flaeche_teilen(g1, s1, k1) f;
  return query select f from private.flaeche_teilen(g2, s2, k - k1) f;
end $$;

create or replace function public.revier_aufteilen_vorschau(p_revier_id uuid, p_anzahl integer)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare grenze extensions.geometry; g extensions.geometry; gs extensions.geometry;
begin
  if not private.ist_inhaber(p_revier_id) then raise exception 'Nur der Inhaber darf das Revier aufteilen'; end if;
  if p_anzahl is null or p_anzahl < 2 or p_anzahl > 30 then raise exception 'Die Zahl der Zonen muss zwischen 2 und 30 liegen'; end if;
  select gr.geom into grenze from public.revier_grenzen gr where gr.revier_id = p_revier_id;
  if grenze is null then raise exception 'Für dieses Revier ist noch keine Reviergrenze hinterlegt'; end if;
  g := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_transform(grenze, 25832)), 3);
  gs := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_simplifypreservetopology(g, 3)), 3);
  return (
    select jsonb_build_object('type', 'FeatureCollection', 'features', jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'geometry', extensions.st_asgeojson(extensions.st_transform(extensions.st_multi(t.geom), 4326), 6)::jsonb,
      'properties', jsonb_build_object('nr', t.nr, 'flaeche_ha', round((extensions.st_area(extensions.st_transform(t.geom, 4326)::extensions.geography) / 10000)::numeric, 1))
    ) order by t.nr))
    from private.flaeche_teilen(g, gs, p_anzahl) with ordinality as t(geom, nr)
  );
end $$;

create or replace function public.revier_aufteilen(p_revier_id uuid, p_anzahl integer, p_name text default null)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  grenze extensions.geometry; g extensions.geometry; gs extensions.geometry;
  v_ebene uuid; v_name text; n integer;
  farben text[] := array['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#1f78b4'];
begin
  if not private.ist_inhaber(p_revier_id) then raise exception 'Nur der Inhaber darf das Revier aufteilen'; end if;
  if p_anzahl is null or p_anzahl < 2 or p_anzahl > 30 then raise exception 'Die Zahl der Zonen muss zwischen 2 und 30 liegen'; end if;
  select gr.geom into grenze from public.revier_grenzen gr where gr.revier_id = p_revier_id;
  if grenze is null then raise exception 'Für dieses Revier ist noch keine Reviergrenze hinterlegt'; end if;
  v_name := coalesce(nullif(trim(p_name), ''), 'Raster ' || p_anzahl || ' Zonen');
  select count(*) into n from public.zonen_ebenen e where e.revier_id = p_revier_id and (e.name = v_name or e.name like v_name || ' (%)');
  if n > 0 then v_name := v_name || ' (' || (n + 1) || ')'; end if;
  g := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_transform(grenze, 25832)), 3);
  gs := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_simplifypreservetopology(g, 3)), 3);
  insert into public.zonen_ebenen (revier_id, name, sortierung)
    values (p_revier_id, v_name, coalesce((select max(sortierung) + 1 from public.zonen_ebenen where revier_id = p_revier_id), 0))
    returning id into v_ebene;
  insert into public.zonen (revier_id, ebene_id, name, farbe, sortierung, geom)
    select p_revier_id, v_ebene, 'Zone ' || t.nr, farben[((t.nr - 1) % 8)::integer + 1], t.nr::integer,
           extensions.st_multi(extensions.st_transform(t.geom, 4326))
    from private.flaeche_teilen(g, gs, p_anzahl) with ordinality as t(geom, nr);
  return v_ebene;
end $$;

revoke execute on function public.revier_aufteilen_vorschau(uuid, integer) from public, anon;
revoke execute on function public.revier_aufteilen(uuid, integer, text) from public, anon;
grant execute on function public.revier_aufteilen_vorschau(uuid, integer) to authenticated;
grant execute on function public.revier_aufteilen(uuid, integer, text) to authenticated;
