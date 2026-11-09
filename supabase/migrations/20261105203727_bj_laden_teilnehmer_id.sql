do $$
declare d text;
begin
  select pg_get_functiondef('public.bj_laden(uuid,text)'::regprocedure) into d;
  d := replace(d, $q$'ich', jsonb_build_object('name', t.name,$q$, $q$'ich', jsonb_build_object('id', t.id, 'name', t.name,$q$);
  if d not like '%''id'', t.id, ''name'', t.name%' then raise exception 'Ersetzung fehlgeschlagen'; end if;
  execute d;
end $$;
