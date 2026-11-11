-- =====================================================================
-- Waldmanager · Initialmigration (Entwurf)
-- Abgeleitet aus Hegewerk (Stand 11.11.2026), entkernt und umbenannt:
--   reviere → betriebe · revier_mitglieder → betrieb_mitglieder
--   revier_grenzen → betrieb_grenzen · zonen → bestaende
--   flaechen(+ebenen) → flurstuecke · aufgaben(+listen) → massnahmen
--   wildschaeden → funde (Käferbaum, Windwurf, Wildschaden …)
-- Weggelassen: Hegeringe, Wildarten, Jagdzeiten, Zählungen, Abschüsse,
--   Bewegungsjagd, Pirschwege/Routen, Begehungsscheine, Freigaben,
--   Einrichtungen, Ereignisse (kommen bei Bedarf als eigene Migration)
-- =====================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------
create type public.betrieb_rolle as enum ('inhaber', 'mitarbeiter');

-- ---------------------------------------------------------------------
-- Stammtabellen: Nutzer, Betriebe, Mitglieder, Einladungen
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  benachrichtigungen jsonb not null default '{}'::jsonb,
  zuletzt_aktiv_am timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create table public.masteradmins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);

create table public.betriebe (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  flaeche_ha numeric check (flaeche_ha > 0),
  bundesland text not null default 'Niedersachsen' check (bundesland in (
    'Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen',
    'Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz',
    'Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen')),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create table public.betrieb_mitglieder (
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rolle public.betrieb_rolle not null,
  erstellt_am timestamptz not null default now(),
  primary key (betrieb_id, user_id)
);
create index betrieb_mitglieder_user_idx on public.betrieb_mitglieder (user_id);

create table public.einladungen (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  betrieb_id uuid references public.betriebe(id) on delete cascade,
  rolle text not null check (rolle in ('inhaber', 'mitarbeiter', 'masteradmin')),
  email text,
  erstellt_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  gueltig_bis timestamptz not null,
  eingeloest_am timestamptz,
  eingeloest_von uuid references public.profiles(id) on delete set null,
  check ((rolle = 'masteradmin') = (betrieb_id is null))
);
create index einladungen_betrieb_idx on public.einladungen (betrieb_id);

-- ---------------------------------------------------------------------
-- Geodaten: Betriebsgrenze, Flurstücke, Bestände
-- ---------------------------------------------------------------------
create table public.betrieb_grenzen (
  betrieb_id uuid primary key references public.betriebe(id) on delete cascade,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  erstellt_von uuid references public.profiles(id) on delete set null,
  geaendert_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
create index betrieb_grenzen_geom_idx on public.betrieb_grenzen using gist (geom);

-- Flurstücke aus ALKIS/SHP-Import (Eigentumsebene)
create table public.flurstuecke (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  gemarkung text,
  flur text,
  nummer text,                       -- Zähler/Nenner, z. B. '41/1'
  bezeichnung text not null default '',
  geom extensions.geometry(MultiPolygon, 4326) not null,
  flaeche_ha numeric not null,       -- aus Geometrie berechnet
  flaeche_amtlich_ha numeric,        -- optional aus Grundbuch/ALKIS
  erstellt_von uuid references public.profiles(id) on delete set null,
  geaendert_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
create index flurstuecke_betrieb_idx on public.flurstuecke (betrieb_id);
create index flurstuecke_geom_idx on public.flurstuecke using gist (geom);

-- Bestände (Bewirtschaftungsebene, entspricht Hegewerk-Zonen)
create table public.bestaende (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),   -- z. B. '4a'
  abteilung text,
  bestandestyp text,                                     -- z. B. 'Fichten-Baumholz'
  baumarten jsonb not null default '[]'::jsonb,          -- [{"art":"Fi","anteil":80}, …]
  pflanzjahr integer check (pflanzjahr between 1700 and 2100),
  vorrat_vfm_ha numeric check (vorrat_vfm_ha >= 0),
  farbe text,
  sortierung integer not null default 0,
  bemerkung text,
  geom extensions.geometry(MultiPolygon, 4326),
  erstellt_von uuid references public.profiles(id) on delete set null,
  geaendert_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz,
  check (jsonb_typeof(baumarten) = 'array')
);
create index bestaende_betrieb_idx on public.bestaende (betrieb_id);
create index bestaende_geom_idx on public.bestaende using gist (geom);
create unique index bestaende_name_eindeutig on public.bestaende (betrieb_id, lower(btrim(name))) where geloescht_am is null;

-- ---------------------------------------------------------------------
-- Fachdaten: Maßnahmen und Funde
-- ---------------------------------------------------------------------
create table public.massnahmen (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  bestand_id uuid references public.bestaende(id) on delete set null,
  typ text not null default 'sonstiges' check (typ in (
    'durchforstung','holzeinschlag','holzabfuhr','pflanzung','kulturpflege',
    'kaeferkontrolle','zaunbau','wegebau','grenzkontrolle','sonstiges')),
  titel text not null check (length(btrim(titel)) > 0),
  beschreibung text,
  faellig_am date,
  status text not null default 'geplant' check (status in ('geplant','in_arbeit','erledigt')),
  zugewiesen_an uuid references public.profiles(id) on delete set null,
  zustaendig_extern text,            -- z. B. Lohnunternehmer, Förster
  erledigt_am timestamptz,
  erledigt_von uuid references public.profiles(id) on delete set null,
  erstellt_von uuid references public.profiles(id) on delete set null default auth.uid(),
  geaendert_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index massnahmen_betrieb_idx on public.massnahmen (betrieb_id, status, faellig_am);
create index massnahmen_bestand_idx on public.massnahmen (bestand_id) where bestand_id is not null;

-- Punktfunde für Fundmeldung und Heatmap; id kann offline vom Client vergeben werden
create table public.funde (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  bestand_id uuid references public.bestaende(id) on delete set null,   -- per Trigger aus geom
  typ text not null check (typ in ('kaeferbaum','windwurf','wildschaden','sonstiges')),
  merkmal text,                      -- z. B. bohrmehl, harzfluss, rote_krone / verbiss, schaele, fege
  anzahl integer not null default 1 check (anzahl > 0),
  menge_fm numeric check (menge_fm >= 0),
  geom extensions.geometry(Point, 4326) not null,
  genauigkeit_m numeric,
  beobachtet_am timestamptz not null default now(),
  foto_pfad text,                    -- Pfad im Storage-Bucket (folgt separat)
  notiz text,
  status text not null default 'offen' check (status in ('offen','erledigt')),
  erledigt_am timestamptz,
  erledigt_von uuid references public.profiles(id) on delete set null,
  erfasst_von uuid references public.profiles(id) on delete set null default auth.uid(),
  geaendert_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index funde_betrieb_zeit_idx on public.funde (betrieb_id, typ, beobachtet_am desc);
create index funde_geom_idx on public.funde using gist (geom);

-- ---------------------------------------------------------------------
-- Hilfsfunktionen (private)
-- ---------------------------------------------------------------------
create function private.ist_masteradmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.masteradmins m where m.user_id = (select auth.uid()));
$$;

create function private.ist_mitglied(p_betrieb_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.betrieb_mitglieder bm
                 where bm.betrieb_id = p_betrieb_id and bm.user_id = (select auth.uid()));
$$;

create function private.ist_inhaber(p_betrieb_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.betrieb_mitglieder bm
                 where bm.betrieb_id = p_betrieb_id and bm.user_id = (select auth.uid()) and bm.rolle = 'inhaber');
$$;

create function private.teilt_betrieb_mit(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.betrieb_mitglieder a
                 join public.betrieb_mitglieder b on b.betrieb_id = a.betrieb_id
                 where a.user_id = (select auth.uid()) and b.user_id = p_user_id);
$$;

create function private.set_aktualisiert_am() returns trigger
language plpgsql set search_path = '' as $$
begin new.aktualisiert_am := now(); return new; end $$;

-- unverändert aus Hegewerk: setzt erstellt_von/erfasst_von/geaendert_von und <prefix>_von/_am bei Statuswechsel
create function private.audit_setzen() returns trigger
language plpgsql set search_path = '' as $$
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
  if v_uid is null then return new; end if;
  if tg_op = 'INSERT' then
    foreach k in array array['erstellt_von', 'erfasst_von', 'geaendert_von'] loop
      if v_neu ? k then v_patch := v_patch || jsonb_build_object(k, v_uid); end if;
    end loop;
  else
    v_alt := to_jsonb(old);
    foreach k in array array['erstellt_von', 'erfasst_von'] loop
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

create function private.code_generieren() returns text
language plpgsql set search_path = '' as $$
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
end $$;

create function private.code_normalisieren(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function private.einladung_anwenden(p_code text, p_user_id uuid, p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.einladungen%rowtype;
begin
  select * into e from public.einladungen
  where code = private.code_normalisieren(p_code) and eingeloest_am is null and gueltig_bis > now()
  for update;
  if not found then raise exception 'Einladungscode ungültig oder abgelaufen'; end if;
  if e.email is not null and lower(e.email) <> lower(p_email) then
    raise exception 'Dieser Einladungscode ist für eine andere E-Mail-Adresse bestimmt';
  end if;
  if e.rolle = 'masteradmin' then
    insert into public.masteradmins (user_id) values (p_user_id) on conflict (user_id) do nothing;
  else
    insert into public.betrieb_mitglieder (betrieb_id, user_id, rolle)
    values (e.betrieb_id, p_user_id, e.rolle::public.betrieb_rolle)
    on conflict (betrieb_id, user_id) do update
      set rolle = case when excluded.rolle = 'inhaber' then 'inhaber'::public.betrieb_rolle
                       else public.betrieb_mitglieder.rolle end;
  end if;
  update public.einladungen set eingeloest_am = now(), eingeloest_von = p_user_id where id = e.id;
  return e.betrieb_id;
end $$;

-- Registrierung nur mit Einladungscode (wie Hegewerk)
create function private.neuer_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := new.raw_user_meta_data ->> 'einladungscode';
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));
begin
  if v_code is null or private.code_normalisieren(v_code) = '' then
    raise exception 'Registrierung nur mit Einladungscode möglich';
  end if;
  insert into public.profiles (id, name, email) values (new.id, v_name, new.email);
  perform private.einladung_anwenden(v_code, new.id, new.email);
  return new;
end $$;

create function private.user_email_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

create function private.letzten_inhaber_schuetzen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.rolle = 'inhaber'
     and (tg_op = 'DELETE' or new.rolle <> 'inhaber')
     and (select auth.uid()) is not null
     and not private.ist_masteradmin()
     and exists (select 1 from public.betriebe b where b.id = old.betrieb_id)
     and not exists (select 1 from public.betrieb_mitglieder bm
                     where bm.betrieb_id = old.betrieb_id and bm.rolle = 'inhaber' and bm.user_id <> old.user_id) then
    raise exception 'Ein Forstbetrieb braucht mindestens einen Inhaber';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create function private.flaeche_aus_geojson(p_geojson jsonb) returns extensions.geometry
language plpgsql immutable set search_path = '' as $$
declare g extensions.geometry;
begin
  g := extensions.st_force2d(extensions.st_geomfromgeojson(p_geojson::text));
  if extensions.st_srid(g) = 0 then g := extensions.st_setsrid(g, 4326); end if;
  g := extensions.st_collectionextract(extensions.st_makevalid(g), 3);
  if extensions.st_isempty(g) then raise exception 'Die Geometrie enthält keine Fläche'; end if;
  return extensions.st_multi(g);
end $$;

-- Bezüge innerhalb desselben Betriebs prüfen
create function private.bezug_pruefen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.bestand_id is not null
     and not exists (select 1 from public.bestaende b where b.id = new.bestand_id and b.betrieb_id = new.betrieb_id) then
    raise exception 'Der Bestand gehört nicht zu diesem Forstbetrieb';
  end if;
  if tg_table_name = 'massnahmen' and new.zugewiesen_an is not null
     and not exists (select 1 from public.betrieb_mitglieder m where m.user_id = new.zugewiesen_an and m.betrieb_id = new.betrieb_id) then
    raise exception 'Maßnahmen können nur Mitgliedern des Forstbetriebs zugewiesen werden';
  end if;
  return new;
end $$;

-- Fund automatisch dem Bestand an seiner Position zuordnen
create function private.fund_bestand_setzen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.bestand_id is null or (tg_op = 'UPDATE' and not extensions.st_equals(new.geom, old.geom)) then
    select b.id into new.bestand_id from public.bestaende b
    where b.betrieb_id = new.betrieb_id and b.geloescht_am is null and b.geom is not null
      and extensions.st_intersects(b.geom, new.geom)
    order by extensions.st_area(b.geom) limit 1;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------
create trigger auth_neuer_user after insert on auth.users for each row execute function private.neuer_user();
create trigger auth_email_sync after update of email on auth.users for each row execute function private.user_email_sync();

create trigger profiles_aktualisiert before update on public.profiles for each row execute function private.set_aktualisiert_am();
create trigger betriebe_aktualisiert before update on public.betriebe for each row execute function private.set_aktualisiert_am();
create trigger mitglieder_inhaber_schuetzen before update or delete on public.betrieb_mitglieder for each row execute function private.letzten_inhaber_schuetzen();

create trigger betrieb_grenzen_aktualisiert before update on public.betrieb_grenzen for each row execute function private.set_aktualisiert_am();
create trigger zz_audit before insert or update on public.betrieb_grenzen for each row execute function private.audit_setzen();

create trigger flurstuecke_aktualisiert before update on public.flurstuecke for each row execute function private.set_aktualisiert_am();
create trigger zz_audit before insert or update on public.flurstuecke for each row execute function private.audit_setzen();

create trigger bestaende_aktualisiert before update on public.bestaende for each row execute function private.set_aktualisiert_am();
create trigger zz_audit before insert or update on public.bestaende for each row execute function private.audit_setzen();

create trigger massnahmen_aktualisiert before update on public.massnahmen for each row execute function private.set_aktualisiert_am();
create trigger massnahmen_bezug before insert or update on public.massnahmen for each row execute function private.bezug_pruefen();
create trigger zz_audit before insert or update on public.massnahmen for each row execute function private.audit_setzen('erledigt', 'erledigt');

create trigger funde_aktualisiert before update on public.funde for each row execute function private.set_aktualisiert_am();
create trigger funde_bestand before insert or update on public.funde for each row execute function private.fund_bestand_setzen();
create trigger funde_bezug before insert or update on public.funde for each row execute function private.bezug_pruefen();
create trigger zz_audit before insert or update on public.funde for each row execute function private.audit_setzen('erledigt', 'erledigt');

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.masteradmins enable row level security;
alter table public.betriebe enable row level security;
alter table public.betrieb_mitglieder enable row level security;
alter table public.einladungen enable row level security;
alter table public.betrieb_grenzen enable row level security;
alter table public.flurstuecke enable row level security;
alter table public.bestaende enable row level security;
alter table public.massnahmen enable row level security;
alter table public.funde enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.ist_masteradmin()) or private.teilt_betrieb_mit(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy masteradmins_select on public.masteradmins for select to authenticated
  using (user_id = (select auth.uid()));

create policy betriebe_select on public.betriebe for select to authenticated
  using ((select private.ist_masteradmin()) or private.ist_mitglied(id));
create policy betriebe_insert on public.betriebe for insert to authenticated
  with check ((select private.ist_masteradmin()));
create policy betriebe_update on public.betriebe for update to authenticated
  using ((select private.ist_masteradmin()) or private.ist_inhaber(id))
  with check ((select private.ist_masteradmin()) or private.ist_inhaber(id));
create policy betriebe_delete on public.betriebe for delete to authenticated
  using ((select private.ist_masteradmin()));

create policy mitglieder_select on public.betrieb_mitglieder for select to authenticated
  using ((select private.ist_masteradmin()) or private.ist_mitglied(betrieb_id));
create policy mitglieder_update on public.betrieb_mitglieder for update to authenticated
  using ((select private.ist_masteradmin()) or private.ist_inhaber(betrieb_id))
  with check ((select private.ist_masteradmin()) or private.ist_inhaber(betrieb_id));
create policy mitglieder_delete on public.betrieb_mitglieder for delete to authenticated
  using ((select private.ist_masteradmin()) or private.ist_inhaber(betrieb_id) or user_id = (select auth.uid()));

create policy einladungen_select on public.einladungen for select to authenticated
  using ((select private.ist_masteradmin()) or (betrieb_id is not null and private.ist_inhaber(betrieb_id)));
create policy einladungen_delete on public.einladungen for delete to authenticated
  using ((select private.ist_masteradmin()) or (betrieb_id is not null and private.ist_inhaber(betrieb_id)));

-- Geodaten: lesen alle Mitglieder, schreiben nur Inhaber
create policy grenzen_select on public.betrieb_grenzen for select to authenticated using (private.ist_mitglied(betrieb_id));
create policy grenzen_insert on public.betrieb_grenzen for insert to authenticated with check (private.ist_inhaber(betrieb_id));
create policy grenzen_update on public.betrieb_grenzen for update to authenticated using (private.ist_inhaber(betrieb_id)) with check (private.ist_inhaber(betrieb_id));
create policy grenzen_delete on public.betrieb_grenzen for delete to authenticated using (private.ist_inhaber(betrieb_id));

create policy flurstuecke_select on public.flurstuecke for select to authenticated using (private.ist_mitglied(betrieb_id));
create policy flurstuecke_insert on public.flurstuecke for insert to authenticated with check (private.ist_inhaber(betrieb_id));
create policy flurstuecke_update on public.flurstuecke for update to authenticated using (private.ist_inhaber(betrieb_id)) with check (private.ist_inhaber(betrieb_id));
create policy flurstuecke_delete on public.flurstuecke for delete to authenticated using (private.ist_inhaber(betrieb_id));

create policy bestaende_select on public.bestaende for select to authenticated using (private.ist_mitglied(betrieb_id));
create policy bestaende_insert on public.bestaende for insert to authenticated with check (private.ist_inhaber(betrieb_id));
create policy bestaende_update on public.bestaende for update to authenticated using (private.ist_inhaber(betrieb_id)) with check (private.ist_inhaber(betrieb_id));
create policy bestaende_delete on public.bestaende for delete to authenticated using (private.ist_inhaber(betrieb_id));

-- Maßnahmen: alle Mitglieder anlegen; ändern Inhaber, Ersteller oder Zugewiesene
create policy massnahmen_select on public.massnahmen for select to authenticated using (private.ist_mitglied(betrieb_id));
create policy massnahmen_insert on public.massnahmen for insert to authenticated with check (private.ist_mitglied(betrieb_id));
create policy massnahmen_update on public.massnahmen for update to authenticated
  using (private.ist_inhaber(betrieb_id) or erstellt_von = (select auth.uid()) or zugewiesen_an = (select auth.uid()))
  with check (private.ist_mitglied(betrieb_id));
create policy massnahmen_delete on public.massnahmen for delete to authenticated
  using (private.ist_inhaber(betrieb_id) or erstellt_von = (select auth.uid()));

-- Funde: alle Mitglieder melden; ändern Inhaber oder Melder
create policy funde_select on public.funde for select to authenticated using (private.ist_mitglied(betrieb_id));
create policy funde_insert on public.funde for insert to authenticated with check (private.ist_mitglied(betrieb_id));
create policy funde_update on public.funde for update to authenticated
  using (private.ist_inhaber(betrieb_id) or erfasst_von = (select auth.uid()))
  with check (private.ist_inhaber(betrieb_id) or erfasst_von = (select auth.uid()));
create policy funde_delete on public.funde for delete to authenticated using (private.ist_inhaber(betrieb_id));

-- ---------------------------------------------------------------------
-- RPCs (public)
-- ---------------------------------------------------------------------
create function public.aktivitaet_melden() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set zuletzt_aktiv_am = now()
  where id = (select auth.uid()) and (zuletzt_aktiv_am is null or zuletzt_aktiv_am < now() - interval '1 hour');
$$;

create function public.einladung_pruefen(p_code text)
returns table(gueltig boolean, betrieb_name text, rolle text)
language sql stable security definer set search_path = '' as $$
  select true, b.name, e.rolle from public.einladungen e
  left join public.betriebe b on b.id = e.betrieb_id
  where e.code = private.code_normalisieren(p_code) and e.eingeloest_am is null and e.gueltig_bis > now()
  union all
  select false, null::text, null::text
  where not exists (select 1 from public.einladungen e
                    where e.code = private.code_normalisieren(p_code) and e.eingeloest_am is null and e.gueltig_bis > now());
$$;

create function public.einladung_einloesen(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_email text;
begin
  if v_uid is null then raise exception 'Nicht angemeldet'; end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  return private.einladung_anwenden(p_code, v_uid, v_email);
end $$;

create function public.einladung_erstellen(p_betrieb_id uuid, p_rolle public.betrieb_rolle,
                                           p_email text default null, p_gueltig_tage integer default 14)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if p_betrieb_id is null then raise exception 'Forstbetrieb fehlt'; end if;
  if not (private.ist_masteradmin() or private.ist_inhaber(p_betrieb_id)) then
    raise exception 'Keine Berechtigung, für diesen Forstbetrieb einzuladen';
  end if;
  if p_gueltig_tage not between 1 and 90 then raise exception 'Gültigkeit muss zwischen 1 und 90 Tagen liegen'; end if;
  loop
    v_code := private.code_generieren();
    exit when not exists (select 1 from public.einladungen where code = v_code);
  end loop;
  insert into public.einladungen (code, betrieb_id, rolle, email, erstellt_von, gueltig_bis)
  values (v_code, p_betrieb_id, p_rolle::text, nullif(trim(p_email), ''), (select auth.uid()),
          now() + make_interval(days => p_gueltig_tage));
  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
end $$;

create function public.grenze_setzen(p_betrieb_id uuid, p_geojson jsonb) returns numeric
language plpgsql set search_path = '' as $$
declare
  g extensions.geometry := private.flaeche_aus_geojson(p_geojson);
  v_ha numeric := round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 2);
begin
  if not private.ist_inhaber(p_betrieb_id) then raise exception 'Nur der Inhaber kann die Betriebsgrenze ändern'; end if;
  insert into public.betrieb_grenzen (betrieb_id, geom) values (p_betrieb_id, g)
  on conflict (betrieb_id) do update set geom = excluded.geom;
  update public.betriebe set flaeche_ha = v_ha where id = p_betrieb_id;
  return v_ha;
end $$;

-- Grenze aus der Vereinigung aller Flurstücke ableiten (Alternative zum manuellen Zeichnen)
create function public.grenze_aus_flurstuecken(p_betrieb_id uuid) returns numeric
language plpgsql set search_path = '' as $$
declare g extensions.geometry; v_ha numeric;
begin
  if not private.ist_inhaber(p_betrieb_id) then raise exception 'Keine Berechtigung'; end if;
  select extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(extensions.st_union(f.geom)), 3))
    into g from public.flurstuecke f where f.betrieb_id = p_betrieb_id;
  if g is null or extensions.st_isempty(g) then raise exception 'Keine Flurstücke vorhanden'; end if;
  v_ha := round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 2);
  insert into public.betrieb_grenzen (betrieb_id, geom) values (p_betrieb_id, g)
  on conflict (betrieb_id) do update set geom = excluded.geom;
  update public.betriebe set flaeche_ha = v_ha where id = p_betrieb_id;
  return v_ha;
end $$;

-- SHP/GeoJSON-Import von Flurstücken in Paketen à max. 500 Objekte
create function public.flurstuecke_importieren(p_betrieb_id uuid, p_objekte jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare o jsonb; g extensions.geometry; n_ok int := 0; n_bad int := 0;
begin
  if not private.ist_inhaber(p_betrieb_id) then raise exception 'Keine Berechtigung'; end if;
  if jsonb_typeof(p_objekte) <> 'array' or jsonb_array_length(p_objekte) > 500 then raise exception 'Ungültiges Paket'; end if;
  for o in select * from jsonb_array_elements(p_objekte) loop
    begin
      g := private.flaeche_aus_geojson(o -> 'geometry');
    exception when others then n_bad := n_bad + 1; continue;
    end;
    insert into public.flurstuecke (betrieb_id, gemarkung, flur, nummer, bezeichnung, geom, flaeche_ha, flaeche_amtlich_ha)
    values (p_betrieb_id,
            left(nullif(o ->> 'gemarkung', ''), 120), left(nullif(o ->> 'flur', ''), 20), left(nullif(o ->> 'nummer', ''), 30),
            left(coalesce(o ->> 'bezeichnung', ''), 200), g,
            round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 4),
            nullif(o ->> 'flaeche_amtlich_ha', '')::numeric);
    n_ok := n_ok + 1;
  end loop;
  return jsonb_build_object('importiert', n_ok, 'ungueltig', n_bad);
end $$;

create function public.bestand_geometrie_setzen(p_bestand_id uuid, p_geojson jsonb, p_zuschneiden boolean default true)
returns numeric language plpgsql set search_path = '' as $$
declare g extensions.geometry := private.flaeche_aus_geojson(p_geojson); v_betrieb uuid; v_grenze extensions.geometry;
begin
  select b.betrieb_id into v_betrieb from public.bestaende b where b.id = p_bestand_id;
  if v_betrieb is null then raise exception 'Bestand nicht gefunden oder keine Berechtigung'; end if;
  if p_zuschneiden then
    select gr.geom into v_grenze from public.betrieb_grenzen gr where gr.betrieb_id = v_betrieb;
    if v_grenze is not null then
      g := extensions.st_collectionextract(extensions.st_makevalid(extensions.st_intersection(g, v_grenze)), 3);
      if g is null or extensions.st_isempty(g) or extensions.st_area(g::extensions.geography) < 1 then
        raise exception 'Der Bestand liegt außerhalb der Betriebsgrenze';
      end if;
      g := extensions.st_multi(g);
    end if;
  end if;
  update public.bestaende set geom = g where id = p_bestand_id;
  if not found then raise exception 'Bestand nicht gefunden oder keine Berechtigung'; end if;
  return round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 2);
end $$;

create function public.bestand_an_position(p_betrieb_id uuid, p_lon double precision, p_lat double precision)
returns uuid language sql stable set search_path = '' as $$
  select b.id from public.bestaende b
  where b.betrieb_id = p_betrieb_id and b.geloescht_am is null and b.geom is not null
    and extensions.st_intersects(b.geom, extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326))
  order by extensions.st_area(b.geom) limit 1;
$$;

create function public.bestaende_flaechen(p_betrieb_id uuid)
returns table(bestand_id uuid, flaeche_ha numeric) language sql stable set search_path = '' as $$
  select b.id, round((extensions.st_area(b.geom::extensions.geography) / 10000)::numeric, 2)
  from public.bestaende b
  where b.betrieb_id = p_betrieb_id and b.geloescht_am is null and b.geom is not null;
$$;

-- Fundpunkte als GeoJSON für Karte und Heatmap (Interpolation im Client)
create function public.funde_laden(p_betrieb_id uuid, p_typ text default null,
                                   p_von timestamptz default null, p_bis timestamptz default null)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature', 'id', f.id,
    'geometry', extensions.st_asgeojson(f.geom, 6)::jsonb,
    'properties', jsonb_build_object('id', f.id, 'typ', f.typ, 'merkmal', f.merkmal, 'anzahl', f.anzahl,
      'menge_fm', f.menge_fm, 'bestand_id', f.bestand_id, 'status', f.status, 'beobachtet_am', f.beobachtet_am))
    order by f.beobachtet_am), '[]'::jsonb))
  from public.funde f
  where f.betrieb_id = p_betrieb_id and f.geloescht_am is null
    and (p_typ is null or f.typ = p_typ)
    and (p_von is null or f.beobachtet_am >= p_von)
    and (p_bis is null or f.beobachtet_am < p_bis);
$$;

-- ---------------------------------------------------------------------
-- Rechte auf Funktionen
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public;
grant execute on function private.ist_masteradmin(), private.ist_mitglied(uuid), private.ist_inhaber(uuid),
  private.teilt_betrieb_mit(uuid), private.flaeche_aus_geojson(jsonb) to authenticated;

revoke all on function public.aktivitaet_melden(), public.einladung_pruefen(text), public.einladung_einloesen(text),
  public.einladung_erstellen(uuid, public.betrieb_rolle, text, integer), public.grenze_setzen(uuid, jsonb),
  public.grenze_aus_flurstuecken(uuid), public.flurstuecke_importieren(uuid, jsonb),
  public.bestand_geometrie_setzen(uuid, jsonb, boolean), public.bestand_an_position(uuid, double precision, double precision),
  public.bestaende_flaechen(uuid), public.funde_laden(uuid, text, timestamptz, timestamptz) from public, anon;

grant execute on function public.aktivitaet_melden(), public.einladung_einloesen(text),
  public.einladung_erstellen(uuid, public.betrieb_rolle, text, integer), public.grenze_setzen(uuid, jsonb),
  public.grenze_aus_flurstuecken(uuid), public.flurstuecke_importieren(uuid, jsonb),
  public.bestand_geometrie_setzen(uuid, jsonb, boolean), public.bestand_an_position(uuid, double precision, double precision),
  public.bestaende_flaechen(uuid), public.funde_laden(uuid, text, timestamptz, timestamptz) to authenticated;

-- Code-Prüfung muss vor dem Login (Registrierung) möglich sein
grant execute on function public.einladung_pruefen(text) to anon, authenticated;
