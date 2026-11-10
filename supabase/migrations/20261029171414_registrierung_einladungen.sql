-- Code-Erzeugung: 8 Zeichen, ohne verwechselbare Zeichen (I, O, 0, 1)
create function private.code_generieren()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(8);
  ergebnis text := '';
  i int;
begin
  for i in 0..7 loop
    ergebnis := ergebnis || substr(zeichen, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return ergebnis;
end;
$$;

create function private.code_normalisieren(p_code text)
returns text
language sql immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Einladung anwenden (intern)
create function private.einladung_anwenden(p_code text, p_user_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.einladungen%rowtype;
begin
  select * into e
  from public.einladungen
  where code = private.code_normalisieren(p_code)
    and eingeloest_am is null
    and gueltig_bis > now()
  for update;

  if not found then
    raise exception 'Einladungscode ungültig oder abgelaufen';
  end if;

  if e.email is not null and lower(e.email) <> lower(p_email) then
    raise exception 'Dieser Einladungscode ist für eine andere E-Mail-Adresse bestimmt';
  end if;

  if e.rolle = 'masteradmin' then
    insert into public.masteradmins (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  else
    insert into public.revier_mitglieder (revier_id, user_id, rolle)
    values (e.revier_id, p_user_id, e.rolle::public.revier_rolle)
    on conflict (revier_id, user_id) do update
      set rolle = case when excluded.rolle = 'inhaber' then 'inhaber'::public.revier_rolle
                       else public.revier_mitglieder.rolle end;
  end if;

  update public.einladungen
  set eingeloest_am = now(), eingeloest_von = p_user_id
  where id = e.id;

  return e.revier_id;
end;
$$;
revoke all on function private.einladung_anwenden(text, uuid, text) from public;

-- Registrierung: nur mit gültigem Einladungscode (user_metadata: name, einladungscode)
create function private.neuer_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := new.raw_user_meta_data ->> 'einladungscode';
  v_name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
begin
  if v_code is null or private.code_normalisieren(v_code) = '' then
    raise exception 'Registrierung nur mit Einladungscode möglich';
  end if;

  insert into public.profiles (id, name, email) values (new.id, v_name, new.email);
  perform private.einladung_anwenden(v_code, new.id, new.email);
  return new;
end;
$$;
revoke all on function private.neuer_user() from public;

create trigger auth_neuer_user after insert on auth.users
  for each row execute function private.neuer_user();

-- E-Mail-Änderungen in Profile spiegeln
create function private.user_email_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.user_email_sync() from public;

create trigger auth_email_sync after update of email on auth.users
  for each row execute function private.user_email_sync();

-- RPC: Einladung erstellen (Masteradmin für jedes Revier, Inhaber für eigene Reviere)
create function public.einladung_erstellen(
  p_revier_id uuid,
  p_rolle public.revier_rolle,
  p_email text default null,
  p_gueltig_tage int default 14
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if p_revier_id is null then
    raise exception 'Revier fehlt';
  end if;
  if not (private.ist_masteradmin() or private.ist_inhaber(p_revier_id)) then
    raise exception 'Keine Berechtigung, für dieses Revier einzuladen';
  end if;
  if p_gueltig_tage not between 1 and 90 then
    raise exception 'Gültigkeit muss zwischen 1 und 90 Tagen liegen';
  end if;

  loop
    v_code := private.code_generieren();
    exit when not exists (select 1 from public.einladungen where code = v_code);
  end loop;

  insert into public.einladungen (code, revier_id, rolle, email, erstellt_von, gueltig_bis)
  values (v_code, p_revier_id, p_rolle::text, nullif(trim(p_email), ''),
          (select auth.uid()), now() + make_interval(days => p_gueltig_tage));

  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
end;
$$;
revoke all on function public.einladung_erstellen(uuid, public.revier_rolle, text, int) from public, anon;
grant execute on function public.einladung_erstellen(uuid, public.revier_rolle, text, int) to authenticated;

-- RPC: Einladung einlösen (bestehender Account tritt weiterem Revier bei)
create function public.einladung_einloesen(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  return private.einladung_anwenden(p_code, v_uid, v_email);
end;
$$;
revoke all on function public.einladung_einloesen(text) from public, anon;
grant execute on function public.einladung_einloesen(text) to authenticated;
