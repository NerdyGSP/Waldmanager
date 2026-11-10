do $$
declare d text; n text;
begin
  foreach n in array array['bj_laden','bj_mail_daten'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname=n;
    d := replace(d, '''uhrzeit'', b.uhrzeit,', '''uhrzeit'', b.uhrzeit, ''ende_uhrzeit'', b.ende_uhrzeit,');
    if position('ende_uhrzeit' in d) = 0 then raise exception 'replace failed %', n; end if;
    execute d;
  end loop;
end $$;
