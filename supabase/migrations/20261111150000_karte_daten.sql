-- Kartendaten eines Forstbetriebs in einem Aufruf: Grenze, Bestände (mit Fläche), Mittelpunkt
create function public.karte_daten(p_betrieb_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_grenze extensions.geometry; v_bestaende jsonb;
begin
  if not private.ist_mitglied(p_betrieb_id) then raise exception 'Keine Berechtigung'; end if;
  select g.geom into v_grenze from public.betrieb_grenzen g where g.betrieb_id = p_betrieb_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature', 'id', b.id,
      'geometry', extensions.st_asgeojson(b.geom, 7)::jsonb,
      'properties', jsonb_build_object(
        'id', b.id, 'name', b.name, 'abteilung', b.abteilung, 'bestandestyp', b.bestandestyp,
        'baumarten', b.baumarten, 'pflanzjahr', b.pflanzjahr, 'vorrat_vfm_ha', b.vorrat_vfm_ha,
        'farbe', b.farbe,
        'flaeche_ha', round((extensions.st_area(b.geom::extensions.geography) / 10000)::numeric, 2)))
      order by b.sortierung, b.name), '[]'::jsonb)
    into v_bestaende
    from public.bestaende b
    where b.betrieb_id = p_betrieb_id and b.geloescht_am is null and b.geom is not null;
  return jsonb_build_object(
    'grenze', case when v_grenze is null then null else extensions.st_asgeojson(v_grenze, 7)::jsonb end,
    'bestaende', v_bestaende,
    'mitte', case when v_grenze is null then null else extensions.st_asgeojson(extensions.st_pointonsurface(v_grenze), 6)::jsonb end);
end $$;

revoke all on function public.karte_daten(uuid) from public, anon;
grant execute on function public.karte_daten(uuid) to authenticated;
