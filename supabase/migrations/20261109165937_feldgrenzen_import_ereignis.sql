do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'flaechen_importieren';
  d := replace(d, '  return jsonb_build_object(''importiert'', n_ok,', '  if n_ok > 0 and not exists (select 1 from public.ereignisse x where x.revier_id = v_revier and x.typ = ''flaechen_import'' and x.ziel_id = p_ebene::text) then
    perform private.ereignis_schreiben(v_revier, ''flaechen_import'', ''import'', ''inhaber'',
      ''Feldgrenzen importiert: '' || (select e.name from public.flaechen_ebenen e where e.id = p_ebene), ''import'', p_ebene::text);
  end if;
  return jsonb_build_object(''importiert'', n_ok,');
  if position('flaechen_import' in d) = 0 then raise exception 'replace failed'; end if;
  execute d;
end $$;
