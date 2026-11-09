do $mig$
declare d text; d0 text;
begin
  select pg_get_functiondef('public.quervergleich(uuid,date,date)'::regprocedure) into d;
  d0 := d;
  d := replace(d, 'abschuesse_je_100ha numeric)', 'abschuesse_je_100ha numeric, strecke_zaehlungen numeric)');
  d := replace(d, 'sum(z.anzahl)::numeric as summe', 'sum(z.anzahl)::numeric as summe, bool_or(s.flaechenmodus = ''strecke'') as ist_strecke');
  d := replace(d, 'max(ss.summe) as mx, avg(ss.summe) as av', 'max(ss.summe) as mx, avg(ss.summe) as av, (count(*) filter (where ss.ist_strecke))::numeric as ns');
  d := replace(d, 'coalesce(z.n, 0) as sitz,', 'coalesce(z.n, 0) as sitz, coalesce(z.ns, 0) as nstr,');
  d := replace(d, E'round(e.ab * 100 / e.fl, 2) end as ab100\n    from einzel e\n    union all', E'round(e.ab * 100 / e.fl, 2) end as ab100, e.nstr as nstr\n    from einzel e\n    union all');
  d := replace(d, E'sum(e.fl) filter (where e.fl > 0), 2) end\n    from einzel e\n    group by', E'sum(e.fl) filter (where e.fl > 0), 2) end, null::numeric\n    from einzel e\n    group by');
  d := replace(d, 'g.gmax100, g.ab100', 'g.gmax100, g.ab100, g.nstr');
  if (length(d) - length(d0)) < 200 then raise exception 'Ersetzungen unvollständig (%)', length(d) - length(d0); end if;
  drop function public.quervergleich(uuid,date,date);
  execute d;
  revoke all on function public.quervergleich(uuid,date,date) from public, anon;
  grant execute on function public.quervergleich(uuid,date,date) to authenticated;
end $mig$;
