-- Paket 2: Flurstücke in den Kartendaten und Löschen aller Flurstücke vor einem erneuten Import
create or replace function public.karte_daten(p_betrieb_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_grenze extensions.geometry; v_bestaende jsonb; v_flurstuecke jsonb;
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
  select coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature', 'id', f.id,
      'geometry', extensions.st_asgeojson(f.geom, 7)::jsonb,
      'properties', jsonb_build_object(
        'id', f.id, 'gemarkung', f.gemarkung, 'flur', f.flur, 'nummer', f.nummer,
        'bezeichnung', f.bezeichnung, 'flaeche_ha', f.flaeche_ha, 'flaeche_amtlich_ha', f.flaeche_amtlich_ha))
      order by f.gemarkung, f.flur, f.nummer), '[]'::jsonb)
    into v_flurstuecke
    from public.flurstuecke f
    where f.betrieb_id = p_betrieb_id;
  return jsonb_build_object(
    'grenze', case when v_grenze is null then null else extensions.st_asgeojson(v_grenze, 7)::jsonb end,
    'bestaende', v_bestaende,
    'flurstuecke', v_flurstuecke,
    'mitte', case when v_grenze is null then null else extensions.st_asgeojson(extensions.st_pointonsurface(v_grenze), 6)::jsonb end);
end $$;

-- Alle Flurstücke eines Betriebs entfernen (nur Inhaber); liefert die Anzahl
create function public.flurstuecke_loeschen(p_betrieb_id uuid) returns integer
language plpgsql set search_path = '' as $$
declare n integer;
begin
  if not private.ist_inhaber(p_betrieb_id) then raise exception 'Keine Berechtigung'; end if;
  delete from public.flurstuecke where betrieb_id = p_betrieb_id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.flurstuecke_loeschen(uuid) from public, anon;
grant execute on function public.flurstuecke_loeschen(uuid) to authenticated;
