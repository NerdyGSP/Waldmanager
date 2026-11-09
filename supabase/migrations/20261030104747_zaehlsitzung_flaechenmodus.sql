alter table public.zaehlsitzungen
  add column flaechenmodus text not null default 'zonen' check (flaechenmodus in ('strecke','zonen')),
  add column streifenbreite_m integer not null default 400 check (streifenbreite_m between 20 and 2000),
  add column strecke_km numeric,
  add column flaeche_ha numeric;

-- Berechnung der gezählten Fläche einer Sitzung (ohne Speichern)
create or replace function public.sitzung_flaeche_berechnen(p_sitzung_id uuid, p_modus text default null, p_breite_m integer default null)
returns table(modus text, breite_m integer, strecke_km numeric, flaeche_ha numeric, routen integer)
language plpgsql stable security invoker set search_path = ''
as $$
declare
  s record;
  m text;
  b integer;
  streifen extensions.geography;
  grenze extensions.geography;
  n integer;
  km numeric;
  ha numeric;
begin
  select * into s from public.zaehlsitzungen z where z.id = p_sitzung_id and z.geloescht_am is null;
  if not found then raise exception 'Zählung nicht gefunden'; end if;
  m := coalesce(p_modus, s.flaechenmodus);
  b := coalesce(p_breite_m, s.streifenbreite_m);
  if m = 'strecke' then
    select count(*), coalesce(sum(extensions.st_length(p.geom::extensions.geography)), 0) / 1000.0
      into n, km
      from public.pirschwege p
      where p.zaehlsitzung_id = p_sitzung_id and p.typ = 'wte_route' and p.geloescht_am is null;
    if n = 0 then
      return query select m, b, 0::numeric, null::numeric, 0;
      return;
    end if;
    -- Alle Routen zu einem Streifen puffern und vereinigen (Doppelbefahrung zählt nicht doppelt)
    select extensions.st_union(extensions.st_buffer(p.geom::extensions.geography, b / 2.0)::extensions.geometry)::extensions.geography
      into streifen
      from public.pirschwege p
      where p.zaehlsitzung_id = p_sitzung_id and p.typ = 'wte_route' and p.geloescht_am is null;
    select g.geom::extensions.geography into grenze from public.revier_grenzen g where g.revier_id = s.revier_id;
    if grenze is not null then
      streifen := extensions.st_intersection(streifen::extensions.geometry, grenze::extensions.geometry)::extensions.geography;
    end if;
    ha := round((coalesce(extensions.st_area(streifen), 0) / 10000)::numeric, 1);
    return query select m, b, round(km, 2), ha, n;
  else
    -- Zonenfläche: Zonen der Zonenebene der Zählung, sonst alle Zonen mit Zählwerten
    select round((coalesce(sum(extensions.st_area(z.geom::extensions.geography)), 0) / 10000)::numeric, 1) into ha
      from public.zonen z
      where z.revier_id = s.revier_id and z.geloescht_am is null and z.geom is not null
        and ((s.ebene_id is not null and z.ebene_id = s.ebene_id)
          or (s.ebene_id is null and z.id in (select zl.zone_id from public.zaehlungen zl where zl.sitzung_id = p_sitzung_id and zl.geloescht_am is null)));
    return query select m, b, null::numeric, ha, 0;
  end if;
end;
$$;

-- Fläche beim Abschluss festschreiben (nur wenn die Zählung auf „abgeschlossen“ wechselt oder Modus/Breite sich ändern)
create or replace function public.zaehlsitzung_flaeche_festschreiben()
returns trigger language plpgsql set search_path = '' as $$
declare r record;
begin
  if new.status = 'abgeschlossen' and (tg_op = 'INSERT' or old.status is distinct from 'abgeschlossen' or old.flaechenmodus is distinct from new.flaechenmodus or old.streifenbreite_m is distinct from new.streifenbreite_m) then
    if tg_op = 'INSERT' then
      -- beim Import: Zonenfläche wird nach dem Anlegen der Zählwerte über die RPC gesetzt
      return new;
    end if;
    select * into r from public.sitzung_flaeche_berechnen(new.id, new.flaechenmodus, new.streifenbreite_m);
    if new.flaechenmodus = 'strecke' and (r.routen is null or r.routen = 0) then
      raise exception 'Im Modus „Strecke × Breite“ fehlt eine WTE-Route für diese Zählung.' using errcode = 'P0001';
    end if;
    new.strecke_km := r.strecke_km;
    new.flaeche_ha := r.flaeche_ha;
  end if;
  return new;
end;
$$;
create trigger zaehlsitzungen_flaeche before update on public.zaehlsitzungen
  for each row execute function public.zaehlsitzung_flaeche_festschreiben();

-- Festschreiben für importierte bzw. bestehende Zählungen manuell anstoßen
create or replace function public.zaehlsitzung_flaeche_setzen(p_sitzung_id uuid)
returns numeric language plpgsql security invoker set search_path = '' as $$
declare r record; s record;
begin
  select * into s from public.zaehlsitzungen where id = p_sitzung_id and geloescht_am is null;
  if not found then raise exception 'Zählung nicht gefunden'; end if;
  select * into r from public.sitzung_flaeche_berechnen(p_sitzung_id, s.flaechenmodus, s.streifenbreite_m);
  if s.flaechenmodus = 'strecke' and r.routen = 0 then raise exception 'Im Modus „Strecke × Breite“ fehlt eine WTE-Route für diese Zählung.'; end if;
  update public.zaehlsitzungen set strecke_km = r.strecke_km, flaeche_ha = r.flaeche_ha where id = p_sitzung_id;
  return r.flaeche_ha;
end;
$$;

-- Bestehende abgeschlossene Zählungen: Zonenfläche festschreiben
update public.zaehlsitzungen s set flaeche_ha = (select f.flaeche_ha from public.sitzung_flaeche_berechnen(s.id, 'zonen', 400) f)
 where s.status = 'abgeschlossen' and s.geloescht_am is null;
