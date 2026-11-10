-- 1. Individuelle Zonenebenen je Revier
create table public.zonen_ebenen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  farbe text,
  sortierung int not null default 0,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
create unique index zonen_ebenen_name_eindeutig on public.zonen_ebenen (revier_id, lower(trim(name)));
create trigger zonen_ebenen_aktualisiert before update on public.zonen_ebenen
  for each row execute function private.set_aktualisiert_am();
alter table public.zonen_ebenen enable row level security;
create policy zonen_ebenen_select on public.zonen_ebenen for select to authenticated using (private.ist_mitglied(revier_id));
create policy zonen_ebenen_insert on public.zonen_ebenen for insert to authenticated with check (private.ist_inhaber(revier_id));
create policy zonen_ebenen_update on public.zonen_ebenen for update to authenticated
  using (private.ist_inhaber(revier_id)) with check (private.ist_inhaber(revier_id));
create policy zonen_ebenen_delete on public.zonen_ebenen for delete to authenticated using (private.ist_inhaber(revier_id));

alter table public.zonen add column ebene_id uuid references public.zonen_ebenen(id) on delete set null;
create index zonen_ebene_id_idx on public.zonen(ebene_id);
alter table public.zaehlsitzungen add column ebene_id uuid references public.zonen_ebenen(id) on delete set null;
create index zaehlsitzungen_ebene_id_idx on public.zaehlsitzungen(ebene_id);

-- Ebene muss zum selben Revier gehören
create function private.zonen_ebene_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ebene_id is not null and not exists (
    select 1 from public.zonen_ebenen e where e.id = new.ebene_id and e.revier_id = new.revier_id
  ) then
    raise exception 'Die Zonenebene gehört nicht zu diesem Revier';
  end if;
  return new;
end;
$$;
create trigger zonen_ebene_pruefen before insert or update of ebene_id on public.zonen
  for each row execute function private.zonen_ebene_pruefen();
create trigger zaehlsitzungen_ebene_pruefen before insert or update of ebene_id on public.zaehlsitzungen
  for each row execute function private.zonen_ebene_pruefen();

-- 2. Eindeutige Namen (ohne Groß-/Kleinschreibung, nur aktive Einträge)
-- Bestehende Doppelungen vorher durch Nummerieren auflösen
with doppelt as (
  select id, row_number() over (partition by revier_id, lower(trim(name)) order by erstellt_am) as nr
  from public.zonen where geloescht_am is null
)
update public.zonen z set name = z.name || ' (' || d.nr || ')'
from doppelt d where d.id = z.id and d.nr > 1;

with doppelt as (
  select id, row_number() over (partition by revier_id, lower(trim(name)) order by erstellt_am) as nr
  from public.einrichtungen where geloescht_am is null and name is not null
)
update public.einrichtungen e set name = e.name || ' (' || d.nr || ')'
from doppelt d where d.id = e.id and d.nr > 1;

create unique index zonen_name_eindeutig on public.zonen (revier_id, lower(trim(name))) where geloescht_am is null;
create unique index einrichtungen_name_eindeutig on public.einrichtungen (revier_id, lower(trim(name)))
  where geloescht_am is null and name is not null;

-- 3. Zonenflächen werden auf die Reviergrenze zugeschnitten
drop function public.zone_geometrie_setzen(uuid, jsonb);
create function public.zone_geometrie_setzen(p_zone_id uuid, p_geojson jsonb)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  g extensions.geometry := private.flaeche_aus_geojson(p_geojson);
  v_revier uuid;
  v_grenze extensions.geometry;
begin
  select z.revier_id into v_revier from public.zonen z where z.id = p_zone_id;
  if v_revier is null then
    raise exception 'Zone nicht gefunden oder keine Berechtigung';
  end if;

  select gr.geom into v_grenze from public.revier_grenzen gr where gr.revier_id = v_revier;
  if v_grenze is not null then
    g := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_intersection(g, v_grenze)), 3);
    if g is null or extensions.st_isempty(g) or extensions.st_area(g::extensions.geography) < 1 then
      raise exception 'Die Zone liegt außerhalb der Reviergrenze';
    end if;
    g := extensions.st_multi(g);
  end if;

  update public.zonen set geom = g where id = p_zone_id;
  if not found then
    raise exception 'Zone nicht gefunden oder keine Berechtigung';
  end if;
  return round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 2);
end;
$$;
revoke all on function public.zone_geometrie_setzen(uuid, jsonb) from public, anon;
grant execute on function public.zone_geometrie_setzen(uuid, jsonb) to authenticated;

-- 4. Kartendaten um Ebenen erweitern
create or replace function public.karte_daten(p_revier_id uuid, p_tage int default 365)
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
          'farbe', coalesce(e.farbe, z.farbe),
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
$$;
