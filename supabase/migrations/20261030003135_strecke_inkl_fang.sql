do $$
declare d text;
begin
  select pg_get_functiondef('public.quervergleich(uuid,date,date)'::regprocedure) into d;
  d := replace(d, 'and a.art = ''abschuss''', 'and (a.art = ''abschuss'' or (a.art = ''fang'' and a.fang_ergebnis = ''gefangen''))');
  execute d;
  select pg_get_functiondef('public.karte_daten(uuid,integer)'::regprocedure) into d;
  d := replace(d, 'a.art = ''abschuss'' and a.geloescht_am', '(a.art = ''abschuss'' or (a.art = ''fang'' and a.fang_ergebnis = ''gefangen'')) and a.geloescht_am');
  execute d;
end $$;
select (pg_get_functiondef('public.quervergleich(uuid,date,date)'::regprocedure) like '%a.art = ''fang''%') q, (pg_get_functiondef('public.karte_daten(uuid,integer)'::regprocedure) like '%a.art = ''fang''%') k;
