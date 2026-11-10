alter table public.profiles add column if not exists zuletzt_aktiv_am timestamptz;

-- Eigene Aktivität melden (höchstens einmal pro Stunde)
create or replace function public.aktivitaet_melden() returns void language sql security definer set search_path = '' as $$
  update public.profiles set zuletzt_aktiv_am = now()
  where id = (select auth.uid()) and (zuletzt_aktiv_am is null or zuletzt_aktiv_am < now() - interval '1 hour');
$$;
revoke all on function public.aktivitaet_melden() from public, anon;
grant execute on function public.aktivitaet_melden() to authenticated;

-- Letzte Anmeldung/Aktivität der Mitglieder eines Reviers – nur für Inhaber dieses Reviers
create or replace function private.revier_letzte_logins(p_revier_id uuid)
returns table(user_id uuid, letzter_login timestamptz, zuletzt_aktiv_am timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.last_sign_in_at, p.zuletzt_aktiv_am
  from public.revier_mitglieder m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.revier_id = p_revier_id and private.ist_inhaber(p_revier_id);
$$;
create or replace function public.revier_letzte_logins(p_revier_id uuid)
returns table(user_id uuid, letzter_login timestamptz, zuletzt_aktiv_am timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.revier_letzte_logins(p_revier_id);
$$;
revoke all on function public.revier_letzte_logins(uuid) from public, anon;
grant execute on function public.revier_letzte_logins(uuid) to authenticated;
revoke all on function private.revier_letzte_logins(uuid) from public, anon;
grant execute on function private.revier_letzte_logins(uuid) to authenticated;
grant usage on schema private to authenticated;
