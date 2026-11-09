-- Ersteller/Bearbeiter/Abschluss: Spalten
alter table public.revier_grenzen add column if not exists erstellt_am timestamptz not null default now();
alter table public.einrichtungen add column if not exists erstellt_von uuid, add column if not exists geaendert_von uuid;
alter table public.zonen add column if not exists erstellt_von uuid, add column if not exists geaendert_von uuid;
alter table public.zonen_ebenen add column if not exists erstellt_von uuid, add column if not exists geaendert_von uuid;
alter table public.routen_ebenen add column if not exists erstellt_von uuid, add column if not exists geaendert_von uuid;
alter table public.revier_grenzen add column if not exists erstellt_von uuid, add column if not exists geaendert_von uuid;
alter table public.pirschwege add column if not exists geaendert_von uuid;
alter table public.zaehlsitzungen add column if not exists geaendert_von uuid, add column if not exists abgeschlossen_von uuid, add column if not exists abgeschlossen_am timestamptz;
alter table public.beobachtungen add column if not exists geaendert_von uuid;
alter table public.abschuesse add column if not exists geaendert_von uuid;
alter table public.wildschaeden add column if not exists geaendert_von uuid, add column if not exists erledigt_von uuid, add column if not exists erledigt_am timestamptz;
alter table public.aufgaben add column if not exists geaendert_von uuid, add column if not exists erledigt_von uuid;
alter table public.aufgabenlisten add column if not exists geaendert_von uuid, add column if not exists erledigt_von uuid, add column if not exists erledigt_am timestamptz;
alter table public.begehungsscheine add column if not exists geaendert_von uuid;
alter table public.bewegungsjagden add column if not exists geaendert_von uuid, add column if not exists abgeschlossen_von uuid, add column if not exists abgeschlossen_am timestamptz;

-- Fremdschlüssel auf profiles (ON DELETE SET NULL); verwaiste Werte vorher entfernen
do $$
declare r record;
begin
  for r in select * from (values
    ('einrichtungen','erstellt_von'),('einrichtungen','geaendert_von'),
    ('zonen','erstellt_von'),('zonen','geaendert_von'),
    ('zonen_ebenen','erstellt_von'),('zonen_ebenen','geaendert_von'),
    ('routen_ebenen','erstellt_von'),('routen_ebenen','geaendert_von'),
    ('revier_grenzen','erstellt_von'),('revier_grenzen','geaendert_von'),
    ('pirschwege','erstellt_von'),('pirschwege','geaendert_von'),
    ('zaehlsitzungen','geaendert_von'),('zaehlsitzungen','abgeschlossen_von'),
    ('beobachtungen','geaendert_von'),('abschuesse','geaendert_von'),
    ('wildschaeden','erfasst_von'),('wildschaeden','geaendert_von'),('wildschaeden','erledigt_von'),
    ('aufgaben','erstellt_von'),('aufgaben','geaendert_von'),('aufgaben','erledigt_von'),
    ('aufgabenlisten','erstellt_von'),('aufgabenlisten','geaendert_von'),('aufgabenlisten','erledigt_von'),
    ('begehungsscheine','ausgestellt_von'),('begehungsscheine','geaendert_von'),
    ('bewegungsjagden','erstellt_von'),('bewegungsjagden','geaendert_von'),('bewegungsjagden','abgeschlossen_von')
  ) v(t, c)
  loop
    if not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
                   where k.contype = 'f' and k.conrelid = ('public.' || r.t)::regclass and a.attname = r.c and k.confrelid = 'public.profiles'::regclass) then
      -- ein evtl. vorhandener FK auf auth.users wird durch den FK auf profiles ersetzt
      execute format('update public.%I set %I = null where %I is not null and not exists (select 1 from public.profiles p where p.id = %I.%I)', r.t, r.c, r.c, r.t, r.c);
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null', r.t, r.t || '_' || r.c || '_profil_fkey', r.c);
    end if;
  end loop;
end $$;

-- Gemeinsamer Trigger: Felder serverseitig aus auth.uid() füllen
create or replace function private.audit_setzen() returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_neu jsonb := to_jsonb(new);
  v_alt jsonb;
  v_patch jsonb := '{}'::jsonb;
  v_prefix text := coalesce(tg_argv[0], '');
  v_fertig_werte text[] := string_to_array(coalesce(tg_argv[1], ''), ',');
  v_fertig boolean;
  v_war_fertig boolean := false;
  k text;
begin
  -- Importe und Serverprozesse ohne Nutzer (Service-Rolle) bleiben unverändert
  if v_uid is null then return new; end if;
  if tg_op = 'INSERT' then
    foreach k in array array['erstellt_von', 'erfasst_von', 'ausgestellt_von', 'geaendert_von'] loop
      if v_neu ? k then v_patch := v_patch || jsonb_build_object(k, v_uid); end if;
    end loop;
  else
    v_alt := to_jsonb(old);
    -- Ersteller bleibt unveränderlich, Bearbeiter ist immer der aktuelle Nutzer
    foreach k in array array['erstellt_von', 'erfasst_von', 'ausgestellt_von'] loop
      if v_neu ? k then v_patch := v_patch || jsonb_build_object(k, v_alt -> k); end if;
    end loop;
    if v_neu ? 'geaendert_von' then v_patch := v_patch || jsonb_build_object('geaendert_von', v_uid); end if;
    v_war_fertig := (v_alt ->> 'status') = any (v_fertig_werte);
  end if;
  if v_prefix <> '' then
    v_fertig := (v_neu ->> 'status') = any (v_fertig_werte);
    if v_fertig and not v_war_fertig then
      v_patch := v_patch || jsonb_build_object(v_prefix || '_von', v_uid, v_prefix || '_am', now());
    elsif not v_fertig and v_war_fertig then
      v_patch := v_patch || jsonb_build_object(v_prefix || '_von', null, v_prefix || '_am', null);
    end if;
  end if;
  new := jsonb_populate_record(new, v_patch);
  return new;
end $$;

create trigger zz_audit before insert or update on public.einrichtungen for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.zonen for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.zonen_ebenen for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.routen_ebenen for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.revier_grenzen for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.pirschwege for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.zaehlsitzungen for each row execute function private.audit_setzen('abgeschlossen', 'abgeschlossen');
create trigger zz_audit before insert or update on public.beobachtungen for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.abschuesse for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.wildschaeden for each row execute function private.audit_setzen('erledigt', 'reguliert,abgelehnt');
create trigger zz_audit before insert or update on public.aufgaben for each row execute function private.audit_setzen('erledigt', 'erledigt');
create trigger zz_audit before insert or update on public.aufgabenlisten for each row execute function private.audit_setzen('erledigt', 'erledigt');
create trigger zz_audit before insert or update on public.begehungsscheine for each row execute function private.audit_setzen();
create trigger zz_audit before insert or update on public.bewegungsjagden for each row execute function private.audit_setzen('abgeschlossen', 'abgeschlossen');
