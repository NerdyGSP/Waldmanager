alter table public.pirschwege
  add column typ text not null default 'pirschweg' check (typ in ('pirschweg', 'treiberroute', 'wte_route')),
  add column bewegungsjagd_id uuid references public.bewegungsjagden(id) on delete set null,
  add column zaehlsitzung_id uuid references public.zaehlsitzungen(id) on delete set null,
  add column erstellt_von uuid default auth.uid();

create index pirschwege_typ_idx on public.pirschwege(revier_id, typ) where geloescht_am is null;

drop policy pirschwege_insert on public.pirschwege;
drop policy pirschwege_update on public.pirschwege;
drop policy pirschwege_delete on public.pirschwege;
create policy pirschwege_insert on public.pirschwege for insert to authenticated
  with check (private.ist_inhaber(revier_id) or (typ in ('pirschweg', 'wte_route') and private.ist_mitglied(revier_id)));
create policy pirschwege_update on public.pirschwege for update to authenticated
  using (private.ist_inhaber(revier_id) or (typ in ('pirschweg', 'wte_route') and erstellt_von = (select auth.uid())))
  with check (private.ist_inhaber(revier_id) or (typ in ('pirschweg', 'wte_route') and erstellt_von = (select auth.uid())));
create policy pirschwege_delete on public.pirschwege for delete to authenticated
  using (private.ist_inhaber(revier_id) or (typ in ('pirschweg', 'wte_route') and erstellt_von = (select auth.uid())));

do $$
declare d text;
begin
  d := pg_get_functiondef('public.karte_daten(uuid,integer)'::regprocedure);
  d := replace(d, '''laenge_m'', round(extensions.st_length(p.geom::extensions.geography))::int)',
                  '''laenge_m'', round(extensions.st_length(p.geom::extensions.geography))::int, ''typ'', p.typ, ''bewegungsjagd_id'', p.bewegungsjagd_id, ''zaehlsitzung_id'', p.zaehlsitzung_id)');
  if position('''zaehlsitzung_id'', p.zaehlsitzung_id' in d) = 0 then raise exception 'Patch von karte_daten fehlgeschlagen'; end if;
  execute d;
end $$;
