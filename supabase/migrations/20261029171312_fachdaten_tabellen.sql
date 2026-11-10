-- Reviergrenze (nie freigegeben)
create table public.revier_grenzen (
  revier_id uuid primary key references public.reviere(id) on delete cascade,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  aktualisiert_am timestamptz not null default now()
);
create index revier_grenzen_geom_idx on public.revier_grenzen using gist (geom);

-- Erfassungszonen
create table public.zonen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  name text not null,
  farbe text,
  sortierung int not null default 0,
  geom extensions.geometry(MultiPolygon, 4326),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index zonen_revier_id_idx on public.zonen(revier_id);
create index zonen_geom_idx on public.zonen using gist (geom);

-- Reviereinrichtungen
create table public.einrichtungen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  typ public.einrichtung_typ not null,
  name text,
  geom extensions.geometry(Point, 4326) not null,
  zustand text,
  bemerkung text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index einrichtungen_revier_id_idx on public.einrichtungen(revier_id);
create index einrichtungen_geom_idx on public.einrichtungen using gist (geom);

-- Pirschwege
create table public.pirschwege (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  name text not null,
  geom extensions.geometry(LineString, 4326) not null,
  bemerkung text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index pirschwege_revier_id_idx on public.pirschwege(revier_id);
create index pirschwege_geom_idx on public.pirschwege using gist (geom);

-- Zählsitzungen
create table public.zaehlsitzungen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  datum date not null,
  beginn timestamptz,
  ende timestamptz,
  status public.sitzung_status not null default 'offen',
  wetter jsonb,
  mondphase text,
  bemerkung text,
  erstellt_von uuid references public.profiles(id) on delete set null default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index zaehlsitzungen_revier_datum_idx on public.zaehlsitzungen(revier_id, datum);
create index zaehlsitzungen_erstellt_von_idx on public.zaehlsitzungen(erstellt_von);

-- Zählungen je Zone und Wildart innerhalb einer Sitzung
create table public.zaehlungen (
  id uuid primary key default gen_random_uuid(),
  sitzung_id uuid not null references public.zaehlsitzungen(id) on delete cascade,
  revier_id uuid not null references public.reviere(id) on delete cascade,
  zone_id uuid references public.zonen(id) on delete set null,
  wildart_id text not null references public.wildarten(id),
  geschlecht public.geschlecht not null default 'unbekannt',
  altersklasse text,
  anzahl int not null check (anzahl >= 0),
  bemerkung text,
  erfasst_von uuid references public.profiles(id) on delete set null default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index zaehlungen_sitzung_id_idx on public.zaehlungen(sitzung_id);
create index zaehlungen_revier_wildart_idx on public.zaehlungen(revier_id, wildart_id);
create index zaehlungen_zone_id_idx on public.zaehlungen(zone_id);
create index zaehlungen_wildart_id_idx on public.zaehlungen(wildart_id);
create index zaehlungen_erfasst_von_idx on public.zaehlungen(erfasst_von);

-- Einzelerfassung (Beobachtungen)
create table public.beobachtungen (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  zeitpunkt timestamptz not null default now(),
  wildart_id text not null references public.wildarten(id),
  geschlecht public.geschlecht not null default 'unbekannt',
  altersklasse text,
  anzahl int not null default 1 check (anzahl > 0),
  zone_id uuid references public.zonen(id) on delete set null,
  geom extensions.geometry(Point, 4326),
  bemerkung text,
  erfasst_von uuid references public.profiles(id) on delete set null default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index beobachtungen_revier_zeit_idx on public.beobachtungen(revier_id, zeitpunkt);
create index beobachtungen_wildart_id_idx on public.beobachtungen(wildart_id);
create index beobachtungen_zone_id_idx on public.beobachtungen(zone_id);
create index beobachtungen_erfasst_von_idx on public.beobachtungen(erfasst_von);
create index beobachtungen_geom_idx on public.beobachtungen using gist (geom);

-- Abschüsse
create table public.abschuesse (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  erlegt_am timestamptz not null,
  wildart_id text not null references public.wildarten(id),
  geschlecht public.geschlecht not null default 'unbekannt',
  altersklasse text,
  gewicht_kg numeric(6,2) check (gewicht_kg > 0),
  zone_id uuid references public.zonen(id) on delete set null,
  einrichtung_id uuid references public.einrichtungen(id) on delete set null,
  geom extensions.geometry(Point, 4326),
  erleger_id uuid references public.profiles(id) on delete set null,
  bemerkung text,
  erfasst_von uuid references public.profiles(id) on delete set null default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index abschuesse_revier_zeit_idx on public.abschuesse(revier_id, erlegt_am);
create index abschuesse_wildart_id_idx on public.abschuesse(wildart_id);
create index abschuesse_zone_id_idx on public.abschuesse(zone_id);
create index abschuesse_einrichtung_id_idx on public.abschuesse(einrichtung_id);
create index abschuesse_erleger_id_idx on public.abschuesse(erleger_id);
create index abschuesse_erfasst_von_idx on public.abschuesse(erfasst_von);
create index abschuesse_geom_idx on public.abschuesse using gist (geom);

-- Konsistenz: Zählung erbt Revier der Sitzung, Zone muss zum Revier gehören
create function private.zaehlung_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select s.revier_id into new.revier_id
  from public.zaehlsitzungen s
  where s.id = new.sitzung_id;

  if new.zone_id is not null and not exists (
    select 1 from public.zonen z where z.id = new.zone_id and z.revier_id = new.revier_id
  ) then
    raise exception 'Zone gehört nicht zum Revier der Zählsitzung';
  end if;
  return new;
end;
$$;
create trigger zaehlungen_pruefen before insert or update on public.zaehlungen
  for each row execute function private.zaehlung_pruefen();

-- Zone/Einrichtung muss zum Revier passen (Beobachtungen, Abschüsse)
create function private.revierbezug_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.zone_id is not null and not exists (
    select 1 from public.zonen z where z.id = new.zone_id and z.revier_id = new.revier_id
  ) then
    raise exception 'Zone gehört nicht zu diesem Revier';
  end if;
  if tg_table_name = 'abschuesse' and new.einrichtung_id is not null and not exists (
    select 1 from public.einrichtungen e where e.id = new.einrichtung_id and e.revier_id = new.revier_id
  ) then
    raise exception 'Einrichtung gehört nicht zu diesem Revier';
  end if;
  return new;
end;
$$;
create trigger beobachtungen_pruefen before insert or update on public.beobachtungen
  for each row execute function private.revierbezug_pruefen();
create trigger abschuesse_pruefen before insert or update on public.abschuesse
  for each row execute function private.revierbezug_pruefen();

-- aktualisiert_am
create trigger revier_grenzen_aktualisiert before update on public.revier_grenzen
  for each row execute function private.set_aktualisiert_am();
create trigger zonen_aktualisiert before update on public.zonen
  for each row execute function private.set_aktualisiert_am();
create trigger einrichtungen_aktualisiert before update on public.einrichtungen
  for each row execute function private.set_aktualisiert_am();
create trigger pirschwege_aktualisiert before update on public.pirschwege
  for each row execute function private.set_aktualisiert_am();
create trigger zaehlsitzungen_aktualisiert before update on public.zaehlsitzungen
  for each row execute function private.set_aktualisiert_am();
create trigger zaehlungen_aktualisiert before update on public.zaehlungen
  for each row execute function private.set_aktualisiert_am();
create trigger beobachtungen_aktualisiert before update on public.beobachtungen
  for each row execute function private.set_aktualisiert_am();
create trigger abschuesse_aktualisiert before update on public.abschuesse
  for each row execute function private.set_aktualisiert_am();

-- RLS
alter table public.revier_grenzen enable row level security;
alter table public.zonen enable row level security;
alter table public.einrichtungen enable row level security;
alter table public.pirschwege enable row level security;
alter table public.zaehlsitzungen enable row level security;
alter table public.zaehlungen enable row level security;
alter table public.beobachtungen enable row level security;
alter table public.abschuesse enable row level security;
