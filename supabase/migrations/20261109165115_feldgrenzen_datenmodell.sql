create function private.frucht_norm(t text) returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(replace(replace(replace(replace(lower(coalesce(t, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), '\s+', ' ', 'g'))
$$;

create table public.flaechen_ebenen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  art text not null default 'schlaege' check (art in ('schlaege')),
  anbaujahr integer check (anbaujahr between 1990 and 2100),
  quelle text,
  farben jsonb not null default '{}'::jsonb,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  erstellt_von uuid references public.profiles(id) on delete set null,
  geaendert_von uuid references public.profiles(id) on delete set null
);
create index flaechen_ebenen_revier on public.flaechen_ebenen(revier_id);

create table public.flaechen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  ebene_id uuid not null references public.flaechen_ebenen(id) on delete cascade,
  name text not null default '',
  schlag_nr text,
  frucht_roh text,
  fruchtgruppe text not null default 'sonstige' check (fruchtgruppe ~ '^[a-z_]{1,30}$'),
  geom extensions.geometry(MultiPolygon, 4326) not null,
  flaeche_ha numeric(12,2) not null,
  flaeche_im_revier_ha numeric(12,2) not null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  erstellt_von uuid references public.profiles(id) on delete set null,
  geaendert_von uuid references public.profiles(id) on delete set null
);
create index flaechen_geom on public.flaechen using gist (geom);
create index flaechen_ebene on public.flaechen(ebene_id);
create index flaechen_revier on public.flaechen(revier_id);

create table public.frucht_zuordnungen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  roh_normalisiert text not null check (length(roh_normalisiert) between 1 and 200),
  fruchtgruppe text not null check (fruchtgruppe ~ '^[a-z_]{1,30}$'),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  erstellt_von uuid references public.profiles(id) on delete set null,
  geaendert_von uuid references public.profiles(id) on delete set null,
  unique (revier_id, roh_normalisiert)
);

do $$ declare t text; begin
  foreach t in array array['flaechen_ebenen','flaechen','frucht_zuordnungen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (private.ist_mitglied(revier_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check (private.ist_inhaber(revier_id))', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (private.ist_inhaber(revier_id)) with check (private.ist_inhaber(revier_id))', t||'_update', t);
    execute format('create policy %I on public.%I for delete using (private.ist_inhaber(revier_id))', t||'_delete', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.set_aktualisiert_am()', t||'_aktualisiert', t);
    execute format('create trigger zz_audit before insert or update on public.%I for each row execute function private.audit_setzen()', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Import in Paketen: prüft, schneidet NICHT zu (Randschläge bleiben ganz), berechnet Fläche gesamt und im Revier
create function public.flaechen_importieren(p_ebene uuid, p_objekte jsonb)
returns jsonb language plpgsql set search_path = '' as $f$
declare
  v_revier uuid; v_grenze extensions.geometry; o jsonb; g extensions.geometry; s extensions.geometry;
  v_ges numeric; v_rev numeric; n_ok int := 0; n_aus int := 0; n_bad int := 0; v_gruppe text;
begin
  select e.revier_id into v_revier from public.flaechen_ebenen e where e.id = p_ebene;
  if v_revier is null or not private.ist_inhaber(v_revier) then raise exception 'Ebene nicht gefunden oder keine Berechtigung'; end if;
  select gr.geom into v_grenze from public.revier_grenzen gr where gr.revier_id = v_revier;
  if v_grenze is null then raise exception 'Für den Import ist zuerst eine Reviergrenze nötig'; end if;
  if jsonb_typeof(p_objekte) <> 'array' or jsonb_array_length(p_objekte) > 500 then raise exception 'Ungültiges Paket'; end if;
  for o in select * from jsonb_array_elements(p_objekte) loop
    begin
      g := private.flaeche_aus_geojson(o -> 'geometry');
    exception when others then n_bad := n_bad + 1; continue;
    end;
    if not extensions.st_intersects(g, v_grenze) then n_aus := n_aus + 1; continue; end if;
    s := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_intersection(g, v_grenze)), 3);
    v_rev := case when s is null or extensions.st_isempty(s) then 0 else extensions.st_area(s::extensions.geography) / 10000 end;
    if v_rev < 0.0001 then n_aus := n_aus + 1; continue; end if;
    g := extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(extensions.st_simplifypreservetopology(g, 0.000005)), 3));
    if g is null or extensions.st_isempty(g) then n_bad := n_bad + 1; continue; end if;
    v_ges := extensions.st_area(g::extensions.geography) / 10000;
    v_gruppe := coalesce(nullif(o ->> 'fruchtgruppe', ''), 'sonstige');
    insert into public.flaechen (revier_id, ebene_id, name, schlag_nr, frucht_roh, fruchtgruppe, geom, flaeche_ha, flaeche_im_revier_ha)
    values (v_revier, p_ebene, left(coalesce(o ->> 'name', ''), 200), left(nullif(o ->> 'schlag_nr', ''), 60), left(nullif(o ->> 'frucht_roh', ''), 200), v_gruppe,
            g, round(v_ges, 2), round(least(v_rev, v_ges), 2));
    n_ok := n_ok + 1;
  end loop;
  return jsonb_build_object('importiert', n_ok, 'ausserhalb', n_aus, 'ungueltig', n_bad);
end $f$;

create function public.felder_laden(p_revier uuid, p_ebene uuid default null)
returns jsonb language plpgsql stable set search_path = '' as $f$
declare v_ebene uuid := p_ebene; v_ebenen jsonb; v_fc jsonb;
begin
  if not private.ist_mitglied(p_revier) then raise exception 'Keine Berechtigung'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'anbaujahr', e.anbaujahr, 'quelle', e.quelle, 'farben', e.farben,
      'erstellt_am', e.erstellt_am, 'anzahl', c.n, 'hektar', c.ha) order by e.anbaujahr desc nulls last, e.erstellt_am desc), '[]'::jsonb)
    into v_ebenen
    from public.flaechen_ebenen e
    left join lateral (select count(*) n, coalesce(sum(f.flaeche_ha), 0) ha from public.flaechen f where f.ebene_id = e.id) c on true
    where e.revier_id = p_revier;
  if v_ebene is null then
    select e.id into v_ebene from public.flaechen_ebenen e where e.revier_id = p_revier order by e.anbaujahr desc nulls last, e.erstellt_am desc limit 1;
  end if;
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object('type', 'Feature', 'id', f.id,
      'geometry', extensions.st_asgeojson(f.geom, 6)::jsonb,
      'properties', jsonb_build_object('id', f.id, 'ebene_id', f.ebene_id, 'name', f.name, 'schlag_nr', f.schlag_nr, 'frucht_roh', f.frucht_roh,
        'fruchtgruppe', f.fruchtgruppe, 'flaeche_ha', f.flaeche_ha, 'flaeche_im_revier_ha', f.flaeche_im_revier_ha))), '[]'::jsonb))
    into v_fc from public.flaechen f where f.ebene_id = v_ebene and f.revier_id = p_revier;
  return jsonb_build_object('ebenen', v_ebenen, 'ebene_id', v_ebene, 'flaechen', v_fc);
end $f$;

create function public.feld_fruchtgruppe_setzen(p_flaeche uuid, p_gruppe text, p_alle boolean default false)
returns integer language plpgsql set search_path = '' as $f$
declare f public.flaechen; n int := 0;
begin
  if p_gruppe !~ '^[a-z_]{1,30}$' then raise exception 'Ungültige Fruchtgruppe'; end if;
  select * into f from public.flaechen where id = p_flaeche;
  if f.id is null or not private.ist_inhaber(f.revier_id) then raise exception 'Schlag nicht gefunden oder keine Berechtigung'; end if;
  if p_alle and nullif(private.frucht_norm(f.frucht_roh), '') is not null then
    update public.flaechen set fruchtgruppe = p_gruppe
      where revier_id = f.revier_id and ebene_id = f.ebene_id and private.frucht_norm(frucht_roh) = private.frucht_norm(f.frucht_roh);
    get diagnostics n = row_count;
    insert into public.frucht_zuordnungen (revier_id, roh_normalisiert, fruchtgruppe)
      values (f.revier_id, private.frucht_norm(f.frucht_roh), p_gruppe)
      on conflict (revier_id, roh_normalisiert) do update set fruchtgruppe = excluded.fruchtgruppe;
  else
    update public.flaechen set fruchtgruppe = p_gruppe where id = p_flaeche;
    n := 1;
  end if;
  return n;
end $f$;

grant execute on function public.flaechen_importieren(uuid, jsonb), public.felder_laden(uuid, uuid), public.feld_fruchtgruppe_setzen(uuid, text, boolean) to authenticated;
revoke execute on function public.flaechen_importieren(uuid, jsonb), public.felder_laden(uuid, uuid), public.feld_fruchtgruppe_setzen(uuid, text, boolean) from anon, public;
