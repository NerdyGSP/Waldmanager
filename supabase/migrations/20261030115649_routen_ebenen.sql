create table public.routen_ebenen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  name text not null,
  farbe text,
  reihenfolge integer not null default 0,
  typ text not null check (typ in ('pirschweg','wte_route','treiberroute')),
  wte_aktiv boolean not null default false,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz,
  constraint routen_ebenen_wte_nur_wte check (not wte_aktiv or typ = 'wte_route')
);
create unique index routen_ebenen_name_eindeutig on public.routen_ebenen (revier_id, lower(trim(name))) where geloescht_am is null;
create index routen_ebenen_revier_idx on public.routen_ebenen (revier_id);
create trigger routen_ebenen_aktualisiert before update on public.routen_ebenen for each row execute function private.set_aktualisiert_am();
alter table public.routen_ebenen enable row level security;
create policy routen_ebenen_select on public.routen_ebenen for select using (private.ist_mitglied(revier_id));
create policy routen_ebenen_insert on public.routen_ebenen for insert with check (private.ist_inhaber(revier_id));
create policy routen_ebenen_update on public.routen_ebenen for update using (private.ist_inhaber(revier_id)) with check (private.ist_inhaber(revier_id));
create policy routen_ebenen_delete on public.routen_ebenen for delete using (private.ist_inhaber(revier_id));

alter table public.pirschwege add column ebene_id uuid references public.routen_ebenen(id) on delete set null;
alter table public.pirschwege add column farbe text;
create index pirschwege_ebene_id_idx on public.pirschwege (ebene_id);
create unique index pirschwege_name_eindeutig on public.pirschwege (revier_id, lower(trim(name))) where geloescht_am is null;

-- Eine Route gehört nur zu einer Ebene desselben Typs
create or replace function private.pirschweg_ebene_typ_pruefen() returns trigger language plpgsql set search_path = '' as $$
declare v_typ text; v_revier uuid;
begin
  if new.ebene_id is not null then
    select typ, revier_id into v_typ, v_revier from public.routen_ebenen where id = new.ebene_id;
    if v_typ is distinct from new.typ then
      raise exception 'Die Ebene nimmt nur Routen vom Typ % auf.', coalesce(v_typ, '?') using errcode = 'check_violation';
    end if;
    if v_revier is distinct from new.revier_id then
      raise exception 'Die Ebene gehört zu einem anderen Revier.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger pirschwege_ebene_typ before insert or update of ebene_id, typ on public.pirschwege for each row execute function private.pirschweg_ebene_typ_pruefen();

-- Ebene löschen: Routen bleiben ohne Ebene oder werden mit gelöscht
create or replace function public.routen_ebene_loeschen(p_ebene_id uuid, p_mit_routen boolean default false) returns integer
language plpgsql security invoker set search_path = '' as $$
declare v_revier uuid; v_n integer := 0;
begin
  select revier_id into v_revier from public.routen_ebenen where id = p_ebene_id and geloescht_am is null;
  if v_revier is null or not private.ist_inhaber(v_revier) then
    raise exception 'Ebene nicht gefunden oder keine Berechtigung.' using errcode = 'insufficient_privilege';
  end if;
  if p_mit_routen then
    update public.pirschwege set geloescht_am = now(), ebene_id = null where ebene_id = p_ebene_id and geloescht_am is null;
    get diagnostics v_n = row_count;
  else
    update public.pirschwege set ebene_id = null where ebene_id = p_ebene_id;
  end if;
  update public.routen_ebenen set geloescht_am = now() where id = p_ebene_id;
  return v_n;
end $$;
revoke all on function public.routen_ebene_loeschen(uuid, boolean) from public, anon;
grant execute on function public.routen_ebene_loeschen(uuid, boolean) to authenticated;

-- Vorhandene Pirschwege in eine Ebene „Pirschwege“ übernehmen
insert into public.routen_ebenen (revier_id, name, typ, reihenfolge)
select distinct revier_id, 'Pirschwege', 'pirschweg', 0 from public.pirschwege where typ = 'pirschweg' and geloescht_am is null
on conflict do nothing;
update public.pirschwege p set ebene_id = e.id from public.routen_ebenen e
 where p.typ = 'pirschweg' and p.geloescht_am is null and e.revier_id = p.revier_id and e.typ = 'pirschweg' and e.name = 'Pirschwege';

-- karte_daten: Routenebenen, Ebene, Farbe, Länge, Jagd offen
create or replace function public.karte_daten(p_revier_id uuid, p_tage integer default 365) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'grenze', (select extensions.st_asgeojson(g.geom, 7)::jsonb from public.revier_grenzen g where g.revier_id = p_revier_id),
    'mitte', (select extensions.st_asgeojson(extensions.st_pointonsurface(g.geom), 6)::jsonb from public.revier_grenzen g where g.revier_id = p_revier_id),
    'ebenen', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'farbe', e.farbe, 'wte_aktiv', e.wte_aktiv) order by e.sortierung, e.name) from public.zonen_ebenen e where e.revier_id = p_revier_id), '[]'::jsonb),
    'routen_ebenen', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'farbe', e.farbe, 'typ', e.typ, 'wte_aktiv', e.wte_aktiv) order by e.reihenfolge, e.name) from public.routen_ebenen e where e.revier_id = p_revier_id and e.geloescht_am is null), '[]'::jsonb),
    'zonen', coalesce((
      select jsonb_agg(jsonb_build_object('type', 'Feature', 'id', z.id, 'geometry', extensions.st_asgeojson(z.geom, 7)::jsonb,
        'properties', jsonb_build_object('id', z.id, 'name', z.name, 'farbe', coalesce(z.farbe, e.farbe), 'ebene_id', coalesce(z.ebene_id::text, 'ohne'),
          'flaeche_ha', round((extensions.st_area(z.geom::extensions.geography) / 10000)::numeric, 1))) order by z.sortierung, z.name)
      from public.zonen z left join public.zonen_ebenen e on e.id = z.ebene_id
      where z.revier_id = p_revier_id and z.geloescht_am is null and z.geom is not null), '[]'::jsonb),
    'einrichtungen', coalesce((
      select jsonb_agg(jsonb_build_object('type', 'Feature', 'id', e.id, 'geometry', extensions.st_asgeojson(e.geom, 7)::jsonb,
        'properties', jsonb_build_object('id', e.id, 'typ', e.typ, 'name', e.name, 'zustand', e.zustand, 'bemerkung', e.bemerkung)))
      from public.einrichtungen e where e.revier_id = p_revier_id and e.geloescht_am is null), '[]'::jsonb),
    'pirschwege', coalesce((
      select jsonb_agg(jsonb_build_object('type', 'Feature', 'id', p.id, 'geometry', extensions.st_asgeojson(p.geom, 7)::jsonb,
        'properties', jsonb_build_object('id', p.id, 'name', p.name, 'bemerkung', p.bemerkung, 'laenge_m', round(extensions.st_length(p.geom::extensions.geography))::int, 'typ', p.typ,
          'bewegungsjagd_id', p.bewegungsjagd_id, 'zaehlsitzung_id', p.zaehlsitzung_id, 'ebene_id', p.ebene_id,
          'farbe', coalesce(p.farbe, re.farbe),
          'jagd_offen', case when p.bewegungsjagd_id is null then null else coalesce((select j.status = 'offen' from public.bewegungsjagden j where j.id = p.bewegungsjagd_id), false) end)))
      from public.pirschwege p left join public.routen_ebenen re on re.id = p.ebene_id
      where p.revier_id = p_revier_id and p.geloescht_am is null), '[]'::jsonb),
    'beobachtungen', coalesce((
      select jsonb_agg(jsonb_build_object('type', 'Feature', 'geometry', extensions.st_asgeojson(b.geom, 7)::jsonb,
        'properties', jsonb_build_object('wildart_id', b.wildart_id, 'anzahl', b.anzahl, 'zeitpunkt', b.zeitpunkt, 'geschlecht', b.geschlecht)))
      from public.beobachtungen b
      where b.revier_id = p_revier_id and b.geloescht_am is null and b.geom is not null and b.zeitpunkt > now() - make_interval(days => p_tage)), '[]'::jsonb),
    'abschuesse', coalesce((
      select jsonb_agg(jsonb_build_object('type', 'Feature', 'geometry', extensions.st_asgeojson(a.geom, 7)::jsonb,
        'properties', jsonb_build_object('wildart_id', a.wildart_id, 'geschlecht', a.geschlecht, 'erlegt_am', a.erlegt_am, 'zeitpunkt', a.erlegt_am)))
      from public.abschuesse a
      where a.revier_id = p_revier_id and (a.art = 'abschuss' or (a.art = 'fang' and a.fang_ergebnis = 'gefangen')) and a.geloescht_am is null and a.geom is not null and a.erlegt_am > now() - make_interval(days => p_tage)), '[]'::jsonb),
    'zaehlungen', coalesce((
      select jsonb_agg(jsonb_build_object('type', 'Feature', 'geometry', extensions.st_asgeojson(extensions.st_pointonsurface(z.geom), 7)::jsonb,
        'properties', jsonb_build_object('wildart_id', c.wildart_id, 'anzahl', c.anzahl, 'zeitpunkt', c.erstellt_am, 'geschlecht', c.geschlecht)))
      from public.zaehlungen c join public.zonen z on z.id = c.zone_id
      where c.revier_id = p_revier_id and c.geloescht_am is null and z.geom is not null and c.erstellt_am > now() - make_interval(days => p_tage)), '[]'::jsonb)
  )
  where private.ist_mitglied(p_revier_id);
$$;
