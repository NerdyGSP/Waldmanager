do $$ declare d text; begin
select pg_get_functiondef('public.jagdjahr_report(uuid,int,int)'::regprocedure) into d;
d := replace(d, 'public.ist_mitglied', 'private.ist_mitglied');
execute d; end $$;
