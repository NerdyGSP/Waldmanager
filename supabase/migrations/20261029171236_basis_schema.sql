-- Erweiterungen & Schemas
create extension if not exists postgis with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Enums
create type public.revier_rolle as enum ('inhaber', 'mitjaeger');
create type public.geschlecht as enum ('maennlich', 'weiblich', 'unbekannt');
create type public.einrichtung_typ as enum (
  'hochsitz', 'kanzel', 'ansitzleiter', 'bodensitz', 'kirrung', 'salzlecke',
  'fuetterung', 'wildacker', 'wildkamera', 'falle', 'sonstiges'
);
create type public.sitzung_status as enum ('offen', 'abgeschlossen');

-- Trigger-Funktion für aktualisiert_am
create function private.set_aktualisiert_am()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aktualisiert_am := now();
  return new;
end;
$$;

-- Hegeringe (reine Datenebene für Durchschnittsberechnung)
create table public.hegeringe (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

-- Profile (1:1 zu auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

-- Masteradmins (nur über Einladung/Service-Rolle beschreibbar)
create table public.masteradmins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);

-- Reviere (Stammdaten, für Masteradmin sichtbar)
create table public.reviere (
  id uuid primary key default gen_random_uuid(),
  hegering_id uuid not null references public.hegeringe(id) on delete restrict,
  name text not null,
  flaeche_ha numeric(10,2) check (flaeche_ha > 0),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (hegering_id, name)
);
create index reviere_hegering_id_idx on public.reviere(hegering_id);

-- Mitgliedschaften (Rolle je Revier)
create table public.revier_mitglieder (
  revier_id uuid not null references public.reviere(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rolle public.revier_rolle not null,
  erstellt_am timestamptz not null default now(),
  primary key (revier_id, user_id)
);
create index revier_mitglieder_user_id_idx on public.revier_mitglieder(user_id);

-- Einladungen (je Revier & Rolle, einmalig, mit Ablaufdatum)
create table public.einladungen (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  revier_id uuid references public.reviere(id) on delete cascade,
  rolle text not null check (rolle in ('inhaber', 'mitjaeger', 'masteradmin')),
  email text,
  erstellt_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  gueltig_bis timestamptz not null,
  eingeloest_am timestamptz,
  eingeloest_von uuid references public.profiles(id) on delete set null,
  check ((rolle = 'masteradmin') = (revier_id is null))
);
create index einladungen_revier_id_idx on public.einladungen(revier_id);
create index einladungen_erstellt_von_idx on public.einladungen(erstellt_von);
create index einladungen_eingeloest_von_idx on public.einladungen(eingeloest_von);

-- Wildarten (Stammdaten)
create table public.wildarten (
  id text primary key,
  name text not null unique,
  gruppe text not null,
  sortierung int not null default 0
);

-- Trigger aktualisiert_am
create trigger hegeringe_aktualisiert before update on public.hegeringe
  for each row execute function private.set_aktualisiert_am();
create trigger profiles_aktualisiert before update on public.profiles
  for each row execute function private.set_aktualisiert_am();
create trigger reviere_aktualisiert before update on public.reviere
  for each row execute function private.set_aktualisiert_am();

-- RLS aktivieren (Policies folgen separat)
alter table public.hegeringe enable row level security;
alter table public.profiles enable row level security;
alter table public.masteradmins enable row level security;
alter table public.reviere enable row level security;
alter table public.revier_mitglieder enable row level security;
alter table public.einladungen enable row level security;
alter table public.wildarten enable row level security;
