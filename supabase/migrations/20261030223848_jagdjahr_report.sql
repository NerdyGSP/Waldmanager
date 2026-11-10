create or replace function public.jagdjahr_report(p_revier_id uuid, p_von_jahr int, p_bis_jahr int)
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_strecke jsonb;
  v_zaehl jsonb;
  v_ha numeric;
begin
  if not public.ist_mitglied(p_revier_id) then
    raise exception 'Kein Zugriff auf dieses Revier' using errcode = '42501';
  end if;
  select flaeche_ha into v_ha from public.reviere where id = p_revier_id;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_strecke from (
    select jj, wildart_id, art,
           case when bewegungsjagd_id is null then 'revier' else 'bewegungsjagd' end as herkunft,
           geschlecht::text as geschlecht, altersklasse, count(*)::int as anzahl
    from (
      select a.*, (extract(year from (a.erlegt_am at time zone 'Europe/Berlin'))::int
                   - case when extract(month from (a.erlegt_am at time zone 'Europe/Berlin')) < 4 then 1 else 0 end) as jj
      from public.abschuesse a
      where a.revier_id = p_revier_id and a.geloescht_am is null and a.wildart_id is not null
        and (a.art in ('abschuss','fallwild') or (a.art = 'fang' and a.fang_ergebnis = 'gefangen'))
    ) x
    where jj between p_von_jahr and p_bis_jahr
    group by jj, wildart_id, art, 4, geschlecht, altersklasse
  ) s;

  select coalesce(jsonb_agg(to_jsonb(z)), '[]'::jsonb) into v_zaehl from (
    with sj as (
      select s.id, s.flaechenmodus, s.flaeche_ha,
             (extract(year from s.datum)::int - case when extract(month from s.datum) < 4 then 1 else 0 end) as jj
      from public.zaehlsitzungen s
      where s.revier_id = p_revier_id and s.geloescht_am is null and s.status = 'abgeschlossen'
    ), sjj as (select * from sj where jj between p_von_jahr and p_bis_jahr),
    summe as (
      select z.sitzung_id, z.wildart_id, sum(z.anzahl)::int as n
      from public.zaehlungen z join sjj on sjj.id = z.sitzung_id
      where z.geloescht_am is null and z.revier_id = p_revier_id
      group by 1, 2
    ), arten as (select distinct wildart_id from summe),
    raster as (
      select sjj.id, sjj.jj, sjj.flaechenmodus, sjj.flaeche_ha, a.wildart_id, coalesce(m.n, 0) as n
      from sjj cross join arten a
      left join summe m on m.sitzung_id = sjj.id and m.wildart_id = a.wildart_id
    )
    select jj, wildart_id,
           count(*)::int as sitzungen,
           max(n)::int as maximum,
           round(avg(n), 1) as schnitt,
           coalesce(sum(flaeche_ha) filter (where flaeche_ha > 0), 0) as flaeche_ha,
           case when sum(flaeche_ha) filter (where flaeche_ha > 0) > 0
                then round(sum(n) filter (where flaeche_ha > 0) / sum(flaeche_ha) filter (where flaeche_ha > 0) * 100, 2) end as je100,
           coalesce(jsonb_agg(distinct flaechenmodus) filter (where flaechenmodus is not null), '[]'::jsonb) as modi
    from raster
    group by jj, wildart_id
    order by jj, wildart_id
  ) z;

  return jsonb_build_object('revier_ha', v_ha, 'strecke', v_strecke, 'zaehlung', v_zaehl);
end $$;
revoke all on function public.jagdjahr_report(uuid,int,int) from public, anon;
grant execute on function public.jagdjahr_report(uuid,int,int) to authenticated;
