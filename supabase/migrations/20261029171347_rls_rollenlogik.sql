-- Hilfsfunktionen (security definer, nicht über die API exponiert)
create function private.ist_masteradmin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.masteradmins m where m.user_id = (select auth.uid()));
$$;

create function private.ist_mitglied(p_revier_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.revier_mitglieder rm
    where rm.revier_id = p_revier_id and rm.user_id = (select auth.uid())
  );
$$;

create function private.ist_inhaber(p_revier_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.revier_mitglieder rm
    where rm.revier_id = p_revier_id and rm.user_id = (select auth.uid()) and rm.rolle = 'inhaber'
  );
$$;

create function private.teilt_revier_mit(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.revier_mitglieder a
    join public.revier_mitglieder b on b.revier_id = a.revier_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user_id
  );
$$;

revoke all on function private.ist_masteradmin() from public;
revoke all on function private.ist_mitglied(uuid) from public;
revoke all on function private.ist_inhaber(uuid) from public;
revoke all on function private.teilt_revier_mit(uuid) from public;
grant execute on function private.ist_masteradmin() to authenticated;
grant execute on function private.ist_mitglied(uuid) to authenticated;
grant execute on function private.ist_inhaber(uuid) to authenticated;
grant execute on function private.teilt_revier_mit(uuid) to authenticated;

-- Hegeringe
create policy hegeringe_select on public.hegeringe for select to authenticated
  using (
    (select private.ist_masteradmin())
    or exists (
      select 1 from public.reviere r
      join public.revier_mitglieder rm on rm.revier_id = r.id
      where r.hegering_id = hegeringe.id and rm.user_id = (select auth.uid())
    )
  );
create policy hegeringe_insert on public.hegeringe for insert to authenticated
  with check ((select private.ist_masteradmin()));
create policy hegeringe_update on public.hegeringe for update to authenticated
  using ((select private.ist_masteradmin())) with check ((select private.ist_masteradmin()));
create policy hegeringe_delete on public.hegeringe for delete to authenticated
  using ((select private.ist_masteradmin()));

-- Profile: eigenes, gemeinsame Reviere, Masteradmin; nur Name änderbar
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.ist_masteradmin())
    or private.teilt_revier_mit(id)
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (name) on public.profiles to authenticated;

-- Masteradmins: nur eigener Eintrag lesbar (für UI-Steuerung)
create policy masteradmins_select on public.masteradmins for select to authenticated
  using (user_id = (select auth.uid()));

-- Reviere
create policy reviere_select on public.reviere for select to authenticated
  using ((select private.ist_masteradmin()) or private.ist_mitglied(id));
create policy reviere_insert on public.reviere for insert to authenticated
  with check ((select private.ist_masteradmin()));
create policy reviere_update on public.reviere for update to authenticated
  using ((select private.ist_masteradmin()) or private.ist_inhaber(id))
  with check ((select private.ist_masteradmin()) or private.ist_inhaber(id));
create policy reviere_delete on public.reviere for delete to authenticated
  using ((select private.ist_masteradmin()));

-- Hegering-Zuordnung nur durch Masteradmin änderbar
create function private.hegering_wechsel_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.hegering_id is distinct from old.hegering_id
     and (select auth.uid()) is not null
     and not private.ist_masteradmin() then
    raise exception 'Nur der Masteradmin kann die Hegering-Zuordnung ändern';
  end if;
  return new;
end;
$$;
create trigger reviere_hegering_pruefen before update on public.reviere
  for each row execute function private.hegering_wechsel_pruefen();

-- Mitgliedschaften (Anlage nur über Einladungsfunktionen)
create policy mitglieder_select on public.revier_mitglieder for select to authenticated
  using ((select private.ist_masteradmin()) or private.ist_mitglied(revier_id));
create policy mitglieder_update on public.revier_mitglieder for update to authenticated
  using ((select private.ist_masteradmin()) or private.ist_inhaber(revier_id))
  with check ((select private.ist_masteradmin()) or private.ist_inhaber(revier_id));
create policy mitglieder_delete on public.revier_mitglieder for delete to authenticated
  using (
    (select private.ist_masteradmin())
    or private.ist_inhaber(revier_id)
    or user_id = (select auth.uid())
  );

-- Letzten Inhaber eines Reviers schützen
create function private.letzten_inhaber_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.rolle = 'inhaber'
     and (tg_op = 'DELETE' or new.rolle <> 'inhaber')
     and (select auth.uid()) is not null
     and not private.ist_masteradmin()
     and exists (select 1 from public.reviere r where r.id = old.revier_id)
     and not exists (
       select 1 from public.revier_mitglieder rm
       where rm.revier_id = old.revier_id and rm.rolle = 'inhaber' and rm.user_id <> old.user_id
     ) then
    raise exception 'Ein Revier braucht mindestens einen Revierinhaber/-pächter';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger mitglieder_inhaber_schuetzen before update or delete on public.revier_mitglieder
  for each row execute function private.letzten_inhaber_schuetzen();

-- Einladungen (Anlage nur über Funktion)
create policy einladungen_select on public.einladungen for select to authenticated
  using (
    (select private.ist_masteradmin())
    or (revier_id is not null and private.ist_inhaber(revier_id))
  );
create policy einladungen_delete on public.einladungen for delete to authenticated
  using (
    (select private.ist_masteradmin())
    or (revier_id is not null and private.ist_inhaber(revier_id))
  );

-- Wildarten: lesbar für alle angemeldeten, pflegbar durch Masteradmin
create policy wildarten_select on public.wildarten for select to authenticated using (true);
create policy wildarten_insert on public.wildarten for insert to authenticated
  with check ((select private.ist_masteradmin()));
create policy wildarten_update on public.wildarten for update to authenticated
  using ((select private.ist_masteradmin())) with check ((select private.ist_masteradmin()));

-- Verwaltungsdaten: lesen = Mitglieder, schreiben = Inhaber
do $$
declare t text;
begin
  foreach t in array array['revier_grenzen', 'zonen', 'einrichtungen', 'pirschwege'] loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated using (private.ist_mitglied(revier_id))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated with check (private.ist_inhaber(revier_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated using (private.ist_inhaber(revier_id)) with check (private.ist_inhaber(revier_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated using (private.ist_inhaber(revier_id))', t);
  end loop;
end;
$$;

-- Erfassungsdaten: lesen/schreiben = Mitglieder, löschen = Inhaber oder Ersteller
create policy zaehlsitzungen_select on public.zaehlsitzungen for select to authenticated
  using (private.ist_mitglied(revier_id));
create policy zaehlsitzungen_insert on public.zaehlsitzungen for insert to authenticated
  with check (private.ist_mitglied(revier_id));
create policy zaehlsitzungen_update on public.zaehlsitzungen for update to authenticated
  using (private.ist_mitglied(revier_id)) with check (private.ist_mitglied(revier_id));
create policy zaehlsitzungen_delete on public.zaehlsitzungen for delete to authenticated
  using (private.ist_inhaber(revier_id) or erstellt_von = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['zaehlungen', 'beobachtungen', 'abschuesse'] loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated using (private.ist_mitglied(revier_id))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated with check (private.ist_mitglied(revier_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated using (private.ist_mitglied(revier_id)) with check (private.ist_mitglied(revier_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated using (private.ist_inhaber(revier_id) or erfasst_von = (select auth.uid()))', t);
  end loop;
end;
$$;
