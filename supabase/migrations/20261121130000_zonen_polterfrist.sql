-- Zonen im Bestand und einstellbare Frist je Polter (mit Benjamin am 21.11.2026 abgestimmt)

-- ---------------------------------------------------------------------
-- Polter: Frist je Polter (Tage bis „überfällig“)
-- ---------------------------------------------------------------------
alter table public.polter add column frist_tage integer not null default 28 check (frist_tage between 1 and 365);

create or replace function public.polter_laden(p_betrieb_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature', 'id', p.id,
    'geometry', extensions.st_asgeojson(p.geom, 6)::jsonb,
    'properties', jsonb_build_object('id', p.id, 'baumart', p.baumart, 'stueck', p.stueck, 'menge_fm', p.menge_fm,
      'bestand_id', p.bestand_id, 'status', p.status, 'abgelegt_am', p.abgelegt_am, 'abgefahren_am', p.abgefahren_am,
      'frist_tage', p.frist_tage, 'notiz', p.notiz, 'erfasst_von', p.erfasst_von))
    order by p.abgelegt_am), '[]'::jsonb))
  from public.polter p
  where p.betrieb_id = p_betrieb_id and p.geloescht_am is null;
$$;

-- ---------------------------------------------------------------------
-- Zonen: Teilflächen eines Bestands mit eigenem Baumarten-Mix und Pflanzjahr
-- (z. B. unterschiedliche Wuchsstadien nach Kyrill). Geometrie liegt immer im Bestand.
-- ---------------------------------------------------------------------
create table public.bestand_zonen (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  bestand_id uuid not null references public.bestaende(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  baumarten jsonb not null default '[]'::jsonb check (jsonb_typeof(baumarten) = 'array'),   -- [{"art":"Fi","anteil":80}, …]
  pflanzjahr integer check (pflanzjahr between 1700 and 2100),
  bemerkung text,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  erstellt_von uuid references public.profiles(id) on delete set null,
  geaendert_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index bestand_zonen_bestand_idx on public.bestand_zonen (bestand_id);
create index bestand_zonen_betrieb_idx on public.bestand_zonen (betrieb_id);
create index bestand_zonen_geom_idx on public.bestand_zonen using gist (geom);
create unique index bestand_zonen_name_eindeutig on public.bestand_zonen (bestand_id, lower(btrim(name))) where geloescht_am is null;

-- Maßnahmen können einer Zone gelten (z. B. Durchforstung nur im oberen Teil)
alter table public.massnahmen add column zone_id uuid references public.bestand_zonen(id) on delete set null;
create index massnahmen_zone_idx on public.massnahmen (zone_id) where zone_id is not null;

-- Bezugsprüfung um Zonen erweitert: Zone gehört zum Betrieb und zum Bestand; Bestand wird aus der Zone ergänzt
create or replace function private.bezug_pruefen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_zone_bestand uuid;
begin
  -- verschachtelt, weil PL/pgSQL Bedingungen nicht abkürzt und zone_id nur bei Maßnahmen existiert
  if tg_table_name = 'massnahmen' then
    if new.zone_id is not null then
      select z.bestand_id into v_zone_bestand from public.bestand_zonen z
      where z.id = new.zone_id and z.betrieb_id = new.betrieb_id;
      if v_zone_bestand is null then raise exception 'Die Zone gehört nicht zu diesem Forstbetrieb'; end if;
      if new.bestand_id is null then new.bestand_id := v_zone_bestand;
      elsif new.bestand_id <> v_zone_bestand then raise exception 'Die Zone gehört nicht zu diesem Bestand';
      end if;
    end if;
  end if;
  if new.bestand_id is not null
     and not exists (select 1 from public.bestaende b where b.id = new.bestand_id and b.betrieb_id = new.betrieb_id) then
    raise exception 'Der Bestand gehört nicht zu diesem Forstbetrieb';
  end if;
  if tg_table_name = 'massnahmen' then
    if new.zugewiesen_an is not null
       and not exists (select 1 from public.betrieb_mitglieder m where m.user_id = new.zugewiesen_an and m.betrieb_id = new.betrieb_id) then
      raise exception 'Maßnahmen können nur Mitgliedern des Forstbetriebs zugewiesen werden';
    end if;
  end if;
  return new;
end $$;

create trigger bestand_zonen_aktualisiert before update on public.bestand_zonen for each row execute function private.set_aktualisiert_am();
create trigger bestand_zonen_bezug before insert or update on public.bestand_zonen for each row execute function private.bezug_pruefen();
create trigger zz_audit before insert or update on public.bestand_zonen for each row execute function private.audit_setzen();

-- RLS wie bei Beständen: Mitglieder lesen, Inhaber schreiben
alter table public.bestand_zonen enable row level security;
create policy bestand_zonen_select on public.bestand_zonen for select to authenticated using (private.ist_mitglied(betrieb_id));
create policy bestand_zonen_insert on public.bestand_zonen for insert to authenticated with check (private.ist_inhaber(betrieb_id));
create policy bestand_zonen_update on public.bestand_zonen for update to authenticated using (private.ist_inhaber(betrieb_id)) with check (private.ist_inhaber(betrieb_id));
create policy bestand_zonen_delete on public.bestand_zonen for delete to authenticated using (private.ist_inhaber(betrieb_id));

revoke all on public.bestand_zonen from anon;
grant select, insert, update, delete on public.bestand_zonen to authenticated;

-- Zone anlegen (p_zone_id null) oder Fläche ändern; die Fläche wird auf den Bestand zugeschnitten.
-- Liefert id und Fläche in ha. Läuft mit den Rechten des Aufrufers (RLS: nur Inhaber).
create function public.zone_speichern(p_bestand_id uuid, p_zone_id uuid, p_name text, p_geojson jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  g extensions.geometry := private.flaeche_aus_geojson(p_geojson);
  v_betrieb uuid; v_bestand_geom extensions.geometry; v_id uuid;
begin
  select b.betrieb_id, b.geom into v_betrieb, v_bestand_geom from public.bestaende b
  where b.id = p_bestand_id and b.geloescht_am is null;
  if v_betrieb is null then raise exception 'Bestand nicht gefunden oder keine Berechtigung'; end if;
  if not private.ist_inhaber(v_betrieb) then raise exception 'Keine Berechtigung'; end if;
  if v_bestand_geom is null then raise exception 'Der Bestand hat noch keine Fläche'; end if;
  g := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_intersection(g, v_bestand_geom)), 3);
  if g is null or extensions.st_isempty(g) or extensions.st_area(g::extensions.geography) < 1 then
    raise exception 'Die Zone liegt außerhalb des Bestands';
  end if;
  g := extensions.st_multi(g);
  if p_zone_id is null then
    insert into public.bestand_zonen (betrieb_id, bestand_id, name, geom)
    values (v_betrieb, p_bestand_id, btrim(p_name), g) returning id into v_id;
  else
    update public.bestand_zonen set geom = g where id = p_zone_id and bestand_id = p_bestand_id and geloescht_am is null
    returning id into v_id;
    if v_id is null then raise exception 'Zone nicht gefunden oder keine Berechtigung'; end if;
  end if;
  return jsonb_build_object('id', v_id, 'flaeche_ha', round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 2));
end $$;

revoke all on function public.zone_speichern(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.zone_speichern(uuid, uuid, text, jsonb) to authenticated;

-- Kartendaten um Zonen erweitert. Durchforstungsjahre: erledigte Maßnahmen „Durchforstung“ der Zone,
-- Jahr aus dem Termin (so lassen sich frühere Durchforstungen nachtragen), sonst aus dem Erledigt-Datum.
create or replace function public.karte_daten(p_betrieb_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_grenze extensions.geometry; v_bestaende jsonb; v_flurstuecke jsonb; v_zonen jsonb;
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
  select coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature', 'id', z.id,
      'geometry', extensions.st_asgeojson(z.geom, 7)::jsonb,
      'properties', jsonb_build_object(
        'id', z.id, 'bestand_id', z.bestand_id, 'name', z.name, 'baumarten', z.baumarten, 'pflanzjahr', z.pflanzjahr,
        'bemerkung', z.bemerkung,
        'flaeche_ha', round((extensions.st_area(z.geom::extensions.geography) / 10000)::numeric, 2),
        'durchforstungen', coalesce((
          select jsonb_agg(distinct extract(year from coalesce(m.faellig_am::timestamptz, m.erledigt_am))::int)
          from public.massnahmen m
          where m.zone_id = z.id and m.typ = 'durchforstung' and m.status = 'erledigt' and m.geloescht_am is null), '[]'::jsonb)))
      order by z.name), '[]'::jsonb)
    into v_zonen
    from public.bestand_zonen z
    join public.bestaende b on b.id = z.bestand_id and b.geloescht_am is null
    where z.betrieb_id = p_betrieb_id and z.geloescht_am is null;
  return jsonb_build_object(
    'grenze', case when v_grenze is null then null else extensions.st_asgeojson(v_grenze, 7)::jsonb end,
    'bestaende', v_bestaende,
    'flurstuecke', v_flurstuecke,
    'zonen', v_zonen,
    'mitte', case when v_grenze is null then null else extensions.st_asgeojson(extensions.st_pointonsurface(v_grenze), 6)::jsonb end);
end $$;
