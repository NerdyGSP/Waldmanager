-- Letzte Anmeldung und Aktivität der Mitglieder (nur für Inhaber des Betriebs bzw. Masteradmins)
create function private.betrieb_letzte_logins(p_betrieb_id uuid)
returns table(user_id uuid, letzter_login timestamptz, zuletzt_aktiv_am timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.last_sign_in_at, p.zuletzt_aktiv_am
  from public.betrieb_mitglieder m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.betrieb_id = p_betrieb_id and private.ist_inhaber(p_betrieb_id);
$$;

create function public.betrieb_letzte_logins(p_betrieb_id uuid)
returns table(user_id uuid, letzter_login timestamptz, zuletzt_aktiv_am timestamptz)
language sql stable set search_path = '' as $$
  select * from private.betrieb_letzte_logins(p_betrieb_id);
$$;

create function public.masteradmin_letzte_logins()
returns table(user_id uuid, letzter_login timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.last_sign_in_at from auth.users u where (select private.ist_masteradmin());
$$;

revoke all on function private.betrieb_letzte_logins(uuid) from public;
grant execute on function private.betrieb_letzte_logins(uuid) to authenticated;
revoke all on function public.betrieb_letzte_logins(uuid), public.masteradmin_letzte_logins() from public, anon;
grant execute on function public.betrieb_letzte_logins(uuid), public.masteradmin_letzte_logins() to authenticated;
