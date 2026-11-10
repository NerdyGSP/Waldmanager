create function public.masteradmin_letzte_logins() returns table (user_id uuid, letzter_login timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.last_sign_in_at from auth.users u
  where (select private.ist_masteradmin());
$$;
revoke all on function public.masteradmin_letzte_logins() from public, anon;
grant execute on function public.masteradmin_letzte_logins() to authenticated;
