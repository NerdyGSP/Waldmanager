-- Freigaben je Revier und Wildart (nur Zähl- und Abschussdaten, keine Koordinaten)
create table public.freigaben (
  revier_id uuid not null references public.reviere(id) on delete cascade,
  wildart_id text not null references public.wildarten(id),
  freigegeben_am timestamptz not null default now(),
  freigegeben_von uuid references public.profiles(id) on delete set null default auth.uid(),
  primary key (revier_id, wildart_id)
);
create index freigaben_wildart_id_idx on public.freigaben(wildart_id);
create index freigaben_freigegeben_von_idx on public.freigaben(freigegeben_von);
alter table public.freigaben enable row level security;

create policy freigaben_select on public.freigaben for select to authenticated
  using (private.ist_mitglied(revier_id));
create policy freigaben_insert on public.freigaben for insert to authenticated
  with check (private.ist_inhaber(revier_id));
create policy freigaben_delete on public.freigaben for delete to authenticated
  using (private.ist_inhaber(revier_id));

-- Quervergleich: eigenes Revier vs. freigebende Reviere im Hegering vs. Hegering-Durchschnitt
-- Gegenseitigkeit je Wildart: nur Wildarten, die das eigene Revier freigibt.
-- Zählwerte: nur abgeschlossene Sitzungen; je Sitzung Summe über Zonen.
-- Dichte je 100 ha im Durchschnitt flächengewichtet.
create function public.quervergleich(p_revier_id uuid, p_von date, p_bis date)
returns table (
  revier_id uuid,
  revier_name text,
  ist_eigenes boolean,
  ist_durchschnitt boolean,
  wildart_id text,
  wildart_name text,
  flaeche_ha numeric,
  zaehlsitzungen numeric,
  gezaehlt_max numeric,
  gezaehlt_schnitt numeric,
  abschuesse numeric,
  abschuesse_maennlich numeric,
  abschuesse_weiblich numeric,
  gezaehlt_max_je_100ha numeric,
  abschuesse_je_100ha numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hegering uuid;
begin
  if not private.ist_mitglied(p_revier_id) then
    raise exception 'Keine Berechtigung für dieses Revier';
  end if;
  if p_von is null or p_bis is null or p_von > p_bis then
    raise exception 'Ungültiger Zeitraum';
  end if;

  select r.hegering_id into v_hegering from public.reviere r where r.id = p_revier_id;

  return query
  with teilnehmer as (
    select f.revier_id, f.wildart_id
    from public.freigaben f
    join public.reviere r on r.id = f.revier_id
    where r.hegering_id = v_hegering
      and f.wildart_id in (select f2.wildart_id from public.freigaben f2 where f2.revier_id = p_revier_id)
  ),
  sitzungssummen as (
    select s.revier_id, z.wildart_id, s.id as sitzung_id, sum(z.anzahl)::numeric as summe
    from public.zaehlsitzungen s
    join public.zaehlungen z on z.sitzung_id = s.id
    join teilnehmer t on t.revier_id = s.revier_id and t.wildart_id = z.wildart_id
    where s.datum between p_von and p_bis
      and s.status = 'abgeschlossen'
      and s.geloescht_am is null
      and z.geloescht_am is null
    group by s.revier_id, z.wildart_id, s.id
  ),
  zaehl as (
    select ss.revier_id, ss.wildart_id,
           count(*)::numeric as n, max(ss.summe) as mx, avg(ss.summe) as av
    from sitzungssummen ss
    group by ss.revier_id, ss.wildart_id
  ),
  absch as (
    select a.revier_id, a.wildart_id,
           count(*)::numeric as n,
           (count(*) filter (where a.geschlecht = 'maennlich'))::numeric as m,
           (count(*) filter (where a.geschlecht = 'weiblich'))::numeric as w
    from public.abschuesse a
    join teilnehmer t on t.revier_id = a.revier_id and t.wildart_id = a.wildart_id
    where a.erlegt_am >= p_von::timestamptz
      and a.erlegt_am < (p_bis + 1)::timestamptz
      and a.geloescht_am is null
    group by a.revier_id, a.wildart_id
  ),
  einzel as (
    select t.revier_id, r.name as rname, (t.revier_id = p_revier_id) as eigen,
           t.wildart_id, w.name as wname, w.sortierung, r.flaeche_ha as fl,
           coalesce(z.n, 0) as sitz, coalesce(z.mx, 0) as gmax, coalesce(z.av, 0) as gavg,
           coalesce(a.n, 0) as ab, coalesce(a.m, 0) as abm, coalesce(a.w, 0) as abw
    from teilnehmer t
    join public.reviere r on r.id = t.revier_id
    join public.wildarten w on w.id = t.wildart_id
    left join zaehl z on z.revier_id = t.revier_id and z.wildart_id = t.wildart_id
    left join absch a on a.revier_id = t.revier_id and a.wildart_id = t.wildart_id
  ),
  ergebnis as (
    select e.revier_id, e.rname, e.eigen, false as durchschnitt, e.wildart_id, e.wname, e.sortierung,
           e.fl, e.sitz, e.gmax, round(e.gavg, 1) as gavg, e.ab, e.abm, e.abw,
           case when e.fl > 0 then round(e.gmax * 100 / e.fl, 2) end as gmax100,
           case when e.fl > 0 then round(e.ab * 100 / e.fl, 2) end as ab100
    from einzel e
    union all
    select null::uuid, 'Hegering-Durchschnitt', false, true, e.wildart_id, e.wname, e.sortierung,
           round(avg(e.fl), 2), round(avg(e.sitz), 1), round(avg(e.gmax), 1), round(avg(e.gavg), 1),
           round(avg(e.ab), 1), round(avg(e.abm), 1), round(avg(e.abw), 1),
           case when sum(e.fl) filter (where e.fl > 0) > 0
                then round(sum(e.gmax) filter (where e.fl > 0) * 100 / sum(e.fl) filter (where e.fl > 0), 2) end,
           case when sum(e.fl) filter (where e.fl > 0) > 0
                then round(sum(e.ab) filter (where e.fl > 0) * 100 / sum(e.fl) filter (where e.fl > 0), 2) end
    from einzel e
    group by e.wildart_id, e.wname, e.sortierung
  )
  select g.revier_id, g.rname, g.eigen, g.durchschnitt, g.wildart_id, g.wname,
         g.fl, g.sitz, g.gmax, g.gavg, g.ab, g.abm, g.abw, g.gmax100, g.ab100
  from ergebnis g
  order by g.sortierung, g.wname, g.durchschnitt desc, g.eigen desc, g.rname;
end;
$$;
revoke all on function public.quervergleich(uuid, date, date) from public, anon;
grant execute on function public.quervergleich(uuid, date, date) to authenticated;
