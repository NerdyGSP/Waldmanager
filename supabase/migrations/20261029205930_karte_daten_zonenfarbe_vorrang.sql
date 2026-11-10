
CREATE OR REPLACE FUNCTION public.karte_daten(p_revier_id uuid, p_tage integer DEFAULT 365)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'grenze', (
      select extensions.st_asgeojson(g.geom, 7)::jsonb
      from public.revier_grenzen g where g.revier_id = p_revier_id
    ),
    'ebenen', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'farbe', e.farbe) order by e.sortierung, e.name)
      from public.zonen_ebenen e where e.revier_id = p_revier_id
    ), '[]'::jsonb),
    'zonen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'id', z.id,
        'geometry', extensions.st_asgeojson(z.geom, 7)::jsonb,
        'properties', jsonb_build_object(
          'id', z.id, 'name', z.name,
          'farbe', coalesce(z.farbe, e.farbe),
          'ebene_id', coalesce(z.ebene_id::text, 'ohne'),
          'flaeche_ha', round((extensions.st_area(z.geom::extensions.geography) / 10000)::numeric, 1)
        )
      ) order by z.sortierung, z.name)
      from public.zonen z
      left join public.zonen_ebenen e on e.id = z.ebene_id
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
$function$;
