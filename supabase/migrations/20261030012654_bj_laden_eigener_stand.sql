do $$
declare d text;
begin
  d := pg_get_functiondef('public.bj_laden(uuid,text)'::regprocedure);
  d := replace(d, '''boecke'', boecke);', '''boecke'', boecke,
    ''stand'', (select jsonb_build_object(''id'', e.id, ''name'', e.name, ''typ'', e.typ, ''bemerkung'', e.bemerkung,
        ''lng'', extensions.st_x(e.geom), ''lat'', extensions.st_y(e.geom))
      from public.einrichtungen e where e.id = t.zugeordnete_einrichtung_id and e.revier_id = b.revier_id and e.geloescht_am is null));');
  execute d;
end $$;
select pg_get_functiondef('public.bj_laden(uuid,text)'::regprocedure) like '%''stand''%' as ok;
