create or replace function private.ev_einrichtung() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text := coalesce(new.name, private.einr_label(new.typ::text));
begin
  if tg_op = 'INSERT' then
    perform private.ereignis_schreiben(new.revier_id, 'einrichtung_neu', 'einrichtungen', 'alle', 'Neue Einrichtung: ' || v_name, 'einrichtung', new.id::text, 'Einrichtungen');
  elsif old.geloescht_am is null and new.geloescht_am is not null then
    perform private.ereignis_schreiben(new.revier_id, 'einrichtung_geloescht', 'einrichtungen', 'alle', 'Einrichtung gelöscht: ' || v_name, null, null);
  elsif new.geloescht_am is null and extensions.st_asewkb(new.geom) is distinct from extensions.st_asewkb(old.geom) then
    perform private.ereignis_schreiben(new.revier_id, 'einrichtung_verschoben', 'einrichtungen', 'alle', 'Einrichtung verschoben: ' || v_name, 'einrichtung', new.id::text);
  end if;
  return null;
end $$;

create or replace function private.ev_zone() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.geloescht_am is null and new.geom is not null and (tg_op = 'INSERT' or old.geom is null or extensions.st_asewkb(old.geom) is distinct from extensions.st_asewkb(new.geom)) then
    perform private.ereignis_schreiben(new.revier_id, 'zone_geaendert', 'karte', 'inhaber',
      case when tg_op = 'INSERT' or old.geom is null then 'Zone angelegt: ' else 'Zone ersetzt: ' end || new.name, 'zone', new.id::text, 'Zonen');
  end if;
  return null;
end $$;

create or replace function private.ev_grenze() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or extensions.st_asewkb(old.geom) is distinct from extensions.st_asewkb(new.geom) then
    perform private.ereignis_schreiben(new.revier_id, 'grenze_geaendert', 'karte', 'inhaber',
      case when tg_op = 'INSERT' then 'Reviergrenze angelegt' else 'Reviergrenze ersetzt' end, 'karte', null);
  end if;
  return null;
end $$;
