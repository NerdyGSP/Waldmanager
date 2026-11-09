create table public.zaehlsitzung_routen (
  sitzung_id uuid not null references public.zaehlsitzungen(id) on delete cascade,
  route_id uuid not null references public.pirschwege(id) on delete cascade,
  revier_id uuid not null references public.reviere(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (sitzung_id, route_id)
);
create index zaehlsitzung_routen_route_idx on public.zaehlsitzung_routen (route_id);
alter table public.zaehlsitzung_routen enable row level security;
create policy zsr_select on public.zaehlsitzung_routen for select using (private.ist_mitglied(revier_id));
create policy zsr_insert on public.zaehlsitzung_routen for insert with check (private.ist_mitglied(revier_id));
create policy zsr_delete on public.zaehlsitzung_routen for delete using (private.ist_mitglied(revier_id));

-- Sitzung, Route und Revier müssen zusammenpassen; nur WTE-Routen
create or replace function private.zsr_pruefen() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.zaehlsitzungen z where z.id = new.sitzung_id and z.revier_id = new.revier_id)
     or not exists (select 1 from public.pirschwege p where p.id = new.route_id and p.revier_id = new.revier_id and p.typ = 'wte_route') then
    raise exception 'Route und Zählung passen nicht zusammen';
  end if;
  return new;
end $$;
create trigger zsr_pruefen before insert on public.zaehlsitzung_routen for each row execute function private.zsr_pruefen();

-- Bestand übernehmen
insert into public.zaehlsitzung_routen (sitzung_id, route_id, revier_id)
select p.zaehlsitzung_id, p.id, p.revier_id from public.pirschwege p
where p.zaehlsitzung_id is not null and p.typ = 'wte_route'
on conflict do nothing;

-- Neue WTE-Route mit Zählungsbezug (Zeichnen, GPS, Import) wird automatisch verknüpft
create or replace function private.route_zaehlung_verknuepfen() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.typ = 'wte_route' and new.zaehlsitzung_id is not null then
    insert into public.zaehlsitzung_routen (sitzung_id, route_id, revier_id) values (new.zaehlsitzung_id, new.id, new.revier_id) on conflict do nothing;
  end if;
  return null;
end $$;
create trigger zz_zsr_verknuepfen after insert or update of zaehlsitzung_id on public.pirschwege for each row execute function private.route_zaehlung_verknuepfen();

-- Flächenberechnung über die Verknüpfung
create or replace function public.sitzung_flaeche_berechnen(p_sitzung_id uuid, p_modus text default null, p_breite_m integer default null)
returns table(modus text, breite_m integer, strecke_km numeric, flaeche_ha numeric, routen integer)
language plpgsql stable set search_path = '' as $$
declare
  s record; m text; b integer;
  streifen extensions.geography; grenze extensions.geography; n integer; km numeric; ha numeric;
begin
  select * into s from public.zaehlsitzungen z where z.id = p_sitzung_id and z.geloescht_am is null;
  if not found then raise exception 'Zählung nicht gefunden'; end if;
  m := coalesce(p_modus, s.flaechenmodus);
  b := coalesce(p_breite_m, s.streifenbreite_m);
  if m = 'strecke' then
    select count(*), coalesce(sum(extensions.st_length(p.geom::extensions.geography)), 0) / 1000.0
      into n, km
      from public.pirschwege p join public.zaehlsitzung_routen r on r.route_id = p.id
      where r.sitzung_id = p_sitzung_id and p.typ = 'wte_route' and p.geloescht_am is null;
    if n = 0 then
      return query select m, b, 0::numeric, null::numeric, 0;
      return;
    end if;
    select extensions.st_union(extensions.st_buffer(p.geom::extensions.geography, b / 2.0)::extensions.geometry)::extensions.geography
      into streifen
      from public.pirschwege p join public.zaehlsitzung_routen r on r.route_id = p.id
      where r.sitzung_id = p_sitzung_id and p.typ = 'wte_route' and p.geloescht_am is null;
    select g.geom::extensions.geography into grenze from public.revier_grenzen g where g.revier_id = s.revier_id;
    if grenze is not null then
      streifen := extensions.st_intersection(streifen::extensions.geometry, grenze::extensions.geometry)::extensions.geography;
    end if;
    ha := round((coalesce(extensions.st_area(streifen), 0) / 10000)::numeric, 1);
    return query select m, b, round(km, 2), ha, n;
  else
    select round((coalesce(sum(extensions.st_area(z.geom::extensions.geography)), 0) / 10000)::numeric, 1) into ha
      from public.zonen z
      where z.revier_id = s.revier_id and z.geloescht_am is null and z.geom is not null
        and ((s.ebene_id is not null and z.ebene_id = s.ebene_id)
          or (s.ebene_id is null and z.id in (select zl.zone_id from public.zaehlungen zl where zl.sitzung_id = p_sitzung_id and zl.geloescht_am is null)));
    return query select m, b, null::numeric, ha, 0;
  end if;
end $$;
