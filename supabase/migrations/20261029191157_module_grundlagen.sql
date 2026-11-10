-- Altersklassen je Wildart (Auswahl in Abschuss, Zählung, Einzelerfassung)
alter table public.wildarten add column altersklassen text[] not null default '{}';

update public.wildarten set altersklassen = array['Kitz', 'Jährling/Schmalreh', 'mehrjährig'] where id = 'rehwild';
update public.wildarten set altersklassen = array['Kalb', 'Spießer/Schmaltier', 'mehrjährig'] where id in ('rotwild', 'damwild', 'sikawild');
update public.wildarten set altersklassen = array['Lamm', 'Jährling/Schmalschaf', 'mehrjährig'] where id = 'muffelwild';
update public.wildarten set altersklassen = array['Frischling', 'Überläufer', 'mehrjährig'] where id = 'schwarzwild';
update public.wildarten set altersklassen = array['Jungtier', 'adult'] where id in ('fuchs', 'dachs', 'waschbaer', 'marderhund', 'feldhase');

-- Karte: alle Geodaten eines Reviers als GeoJSON (RLS greift, da security invoker)
create function public.karte_daten(p_revier_id uuid, p_tage int default 365)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'grenze', (
      select extensions.st_asgeojson(g.geom, 7)::jsonb
      from public.revier_grenzen g where g.revier_id = p_revier_id
    ),
    'zonen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'id', z.id,
        'geometry', extensions.st_asgeojson(z.geom, 7)::jsonb,
        'properties', jsonb_build_object('id', z.id, 'name', z.name, 'farbe', z.farbe)
      ) order by z.sortierung, z.name)
      from public.zonen z
      where z.revier_id = p_revier_id and z.geloescht_am is null and z.geom is not null
    ), '[]'::jsonb),
    'einrichtungen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'id', e.id,
        'geometry', extensions.st_asgeojson(e.geom, 7)::jsonb,
        'properties', jsonb_build_object('id', e.id, 'typ', e.typ, 'name', e.name, 'zustand', e.zustand, 'bemerkung', e.bemerkung)
      ))
      from public.einrichtungen e
      where e.revier_id = p_revier_id and e.geloescht_am is null
    ), '[]'::jsonb),
    'pirschwege', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'id', p.id,
        'geometry', extensions.st_asgeojson(p.geom, 7)::jsonb,
        'properties', jsonb_build_object(
          'id', p.id, 'name', p.name, 'bemerkung', p.bemerkung,
          'laenge_m', round(extensions.st_length(p.geom::extensions.geography))::int
        )
      ))
      from public.pirschwege p
      where p.revier_id = p_revier_id and p.geloescht_am is null
    ), '[]'::jsonb),
    'beobachtungen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'geometry', extensions.st_asgeojson(b.geom, 7)::jsonb,
        'properties', jsonb_build_object('wildart_id', b.wildart_id, 'anzahl', b.anzahl, 'zeitpunkt', b.zeitpunkt)
      ))
      from public.beobachtungen b
      where b.revier_id = p_revier_id and b.geloescht_am is null and b.geom is not null
        and b.zeitpunkt > now() - make_interval(days => p_tage)
    ), '[]'::jsonb),
    'abschuesse', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'geometry', extensions.st_asgeojson(a.geom, 7)::jsonb,
        'properties', jsonb_build_object('wildart_id', a.wildart_id, 'geschlecht', a.geschlecht, 'erlegt_am', a.erlegt_am)
      ))
      from public.abschuesse a
      where a.revier_id = p_revier_id and a.geloescht_am is null and a.geom is not null
        and a.erlegt_am > now() - make_interval(days => p_tage)
    ), '[]'::jsonb)
  )
  where private.ist_mitglied(p_revier_id);
$$;
revoke all on function public.karte_daten(uuid, int) from public, anon;
grant execute on function public.karte_daten(uuid, int) to authenticated;

-- Hilfsfunktion: GeoJSON-Fläche in gültiges 2D-MultiPolygon (WGS84) umwandeln
create function private.flaeche_aus_geojson(p_geojson jsonb)
returns extensions.geometry
language plpgsql
immutable
set search_path = ''
as $$
declare
  g extensions.geometry;
begin
  g := extensions.st_force2d(extensions.st_geomfromgeojson(p_geojson::text));
  if extensions.st_srid(g) = 0 then
    g := extensions.st_setsrid(g, 4326);
  end if;
  g := extensions.st_collectionextract(extensions.st_makevalid(g), 3);
  if extensions.st_isempty(g) then
    raise exception 'Die Geometrie enthält keine Fläche';
  end if;
  return extensions.st_multi(g);
end;
$$;

-- Reviergrenze setzen (nur Inhaber per RLS); Fläche in ha wird übernommen
create function public.grenze_setzen(p_revier_id uuid, p_geojson jsonb)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  g extensions.geometry := private.flaeche_aus_geojson(p_geojson);
  v_ha numeric := round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 2);
begin
  if not private.ist_inhaber(p_revier_id) then
    raise exception 'Nur der Revierinhaber kann die Reviergrenze ändern';
  end if;
  insert into public.revier_grenzen (revier_id, geom) values (p_revier_id, g)
  on conflict (revier_id) do update set geom = excluded.geom;
  update public.reviere set flaeche_ha = v_ha where id = p_revier_id;
  return v_ha;
end;
$$;
revoke all on function public.grenze_setzen(uuid, jsonb) from public, anon;
grant execute on function public.grenze_setzen(uuid, jsonb) to authenticated;

-- Zonen-Geometrie setzen
create function public.zone_geometrie_setzen(p_zone_id uuid, p_geojson jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.zonen set geom = private.flaeche_aus_geojson(p_geojson) where id = p_zone_id;
  if not found then
    raise exception 'Zone nicht gefunden oder keine Berechtigung';
  end if;
end;
$$;
revoke all on function public.zone_geometrie_setzen(uuid, jsonb) from public, anon;
grant execute on function public.zone_geometrie_setzen(uuid, jsonb) to authenticated;

grant execute on function private.flaeche_aus_geojson(jsonb) to authenticated;

-- Zone automatisch aus Position bestimmen (für Einzelerfassung/Abschuss)
create function public.zone_an_position(p_revier_id uuid, p_lon double precision, p_lat double precision)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select z.id from public.zonen z
  where z.revier_id = p_revier_id and z.geloescht_am is null and z.geom is not null
    and extensions.st_intersects(z.geom, extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326))
  order by extensions.st_area(z.geom) limit 1;
$$;
revoke all on function public.zone_an_position(uuid, double precision, double precision) from public, anon;
grant execute on function public.zone_an_position(uuid, double precision, double precision) to authenticated;
