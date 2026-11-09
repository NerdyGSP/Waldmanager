
create table public.bewegungsjagden (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  titel text not null,
  art text not null default 'Drückjagd' check (art in ('Drückjagd','Treibjagd','Ansitzdrückjagd','Sonstige')),
  datum date not null,
  uhrzeit time,
  treffpunkt extensions.geometry(Point,4326),
  treffpunkt_lng double precision generated always as (extensions.st_x(treffpunkt)) stored,
  treffpunkt_lat double precision generated always as (extensions.st_y(treffpunkt)) stored,
  schuesseltreiben boolean not null default false,
  schuesseltreiben_adresse text,
  schuesseltreiben_anmeldung_pflicht boolean not null default false,
  hegebeitrag_aktiv boolean not null default false,
  hegebeitrag_betrag numeric(8,2),
  einladungstext text,
  status text not null default 'offen' check (status in ('offen','abgeschlossen')),
  abschlusskommentar text,
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index on public.bewegungsjagden (revier_id) where geloescht_am is null;

create table public.bewegungsjagd_teilnehmer (
  id uuid primary key default gen_random_uuid(),
  bewegungsjagd_id uuid not null references public.bewegungsjagden(id) on delete cascade,
  name text not null,
  email text not null,
  anschrift text,
  einladungscode text not null unique default private.code_generieren(),
  aktiv boolean not null default true,
  status text not null default 'eingeladen' check (status in ('eingeladen','zugesagt','abgesagt')),
  hat_hund boolean,
  hat_hornblaeser boolean,
  auto_vorhanden boolean,
  mitfahrplaetze int check (mitfahrplaetze is null or mitfahrplaetze between 0 and 20),
  schuesseltreiben_teilnahme boolean,
  zugeordnete_einrichtung_id uuid references public.einrichtungen(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  mail_status text check (mail_status in ('gesendet','fehler')),
  mail_gesendet_am timestamptz,
  mail_fehler text,
  antwort_am timestamptz,
  erstellt_am timestamptz not null default now()
);
create index on public.bewegungsjagd_teilnehmer (bewegungsjagd_id);

alter table public.aufgaben add column bewegungsjagd_id uuid references public.bewegungsjagden(id) on delete set null;
create index on public.aufgaben (bewegungsjagd_id) where bewegungsjagd_id is not null;

create function private.bj_aktualisiert() returns trigger language plpgsql set search_path = '' as $$
begin new.aktualisiert_am := now(); return new; end $$;
create trigger bj_aktualisiert before update on public.bewegungsjagden for each row execute function private.bj_aktualisiert();

create function private.bj_ist_inhaber(p_jagd uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bewegungsjagden b where b.id = p_jagd and private.ist_inhaber(b.revier_id));
$$;

alter table public.bewegungsjagden enable row level security;
alter table public.bewegungsjagd_teilnehmer enable row level security;

create policy bj_inhaber_alle on public.bewegungsjagden for all to authenticated
  using (private.ist_inhaber(revier_id)) with check (private.ist_inhaber(revier_id));
create policy bjt_inhaber_alle on public.bewegungsjagd_teilnehmer for all to authenticated
  using (private.bj_ist_inhaber(bewegungsjagd_id)) with check (private.bj_ist_inhaber(bewegungsjagd_id));

revoke all on public.bewegungsjagden, public.bewegungsjagd_teilnehmer from anon;

create function private.bj_teilnehmer(p_jagd uuid, p_code text) returns public.bewegungsjagd_teilnehmer
language sql stable security definer set search_path = '' as $$
  select t.* from public.bewegungsjagd_teilnehmer t
  join public.bewegungsjagden b on b.id = t.bewegungsjagd_id
  where t.bewegungsjagd_id = p_jagd and t.aktiv and b.geloescht_am is null
    and t.einladungscode = private.code_normalisieren(p_code)
    and b.datum >= (now() at time zone 'Europe/Berlin')::date
  limit 1;
$$;

create function public.bj_laden(p_jagd uuid, p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t public.bewegungsjagd_teilnehmer; b public.bewegungsjagden; boecke jsonb;
begin
  t := private.bj_teilnehmer(p_jagd, p_code);
  if t.id is null then return null; end if;
  select * into b from public.bewegungsjagden where id = p_jagd;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name,
      'lng', extensions.st_x(e.geom), 'lat', extensions.st_y(e.geom))), '[]'::jsonb)
    into boecke from public.einrichtungen e
    where e.revier_id = b.revier_id and e.typ = 'drueckjagdbock' and e.geloescht_am is null;
  return jsonb_build_object(
    'jagd', jsonb_build_object('id', b.id, 'titel', b.titel, 'art', b.art, 'datum', b.datum, 'uhrzeit', b.uhrzeit,
      'lng', b.treffpunkt_lng, 'lat', b.treffpunkt_lat, 'schuesseltreiben', b.schuesseltreiben,
      'schuesseltreiben_adresse', b.schuesseltreiben_adresse, 'anmeldung_pflicht', b.schuesseltreiben_anmeldung_pflicht,
      'hegebeitrag_aktiv', b.hegebeitrag_aktiv, 'hegebeitrag_betrag', b.hegebeitrag_betrag,
      'einladungstext', b.einladungstext, 'status', b.status),
    'ich', jsonb_build_object('name', t.name, 'anschrift', t.anschrift, 'status', t.status, 'hat_hund', t.hat_hund,
      'hat_hornblaeser', t.hat_hornblaeser, 'auto_vorhanden', t.auto_vorhanden, 'mitfahrplaetze', t.mitfahrplaetze,
      'schuesseltreiben_teilnahme', t.schuesseltreiben_teilnahme, 'einrichtung_id', t.zugeordnete_einrichtung_id),
    'boecke', boecke);
end $$;

create function public.bj_antworten(p_jagd uuid, p_code text, p_name text, p_anschrift text, p_zusage boolean,
  p_hund boolean, p_hornblaeser boolean, p_auto boolean, p_plaetze int, p_schuesseltreiben boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.bewegungsjagd_teilnehmer;
begin
  t := private.bj_teilnehmer(p_jagd, p_code);
  if t.id is null or (select status from public.bewegungsjagden where id = p_jagd) <> 'offen' then return false; end if;
  update public.bewegungsjagd_teilnehmer set
    name = coalesce(nullif(btrim(p_name), ''), name), anschrift = nullif(btrim(p_anschrift), ''),
    status = case when p_zusage then 'zugesagt' else 'abgesagt' end,
    hat_hund = p_hund, hat_hornblaeser = p_hornblaeser, auto_vorhanden = p_auto,
    mitfahrplaetze = case when p_auto then least(greatest(coalesce(p_plaetze, 0), 0), 20) else null end,
    schuesseltreiben_teilnahme = p_schuesseltreiben, antwort_am = now()
  where id = t.id;
  return true;
end $$;

create function public.bj_absagen_loeschen(p_jagd uuid, p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.bewegungsjagd_teilnehmer;
begin
  t := private.bj_teilnehmer(p_jagd, p_code);
  if t.id is null then return false; end if;
  delete from public.bewegungsjagd_teilnehmer where id = t.id;
  return true;
end $$;

revoke all on function private.bj_teilnehmer(uuid,text), private.bj_ist_inhaber(uuid) from public, anon, authenticated;
grant execute on function private.bj_ist_inhaber(uuid) to authenticated;
revoke all on function public.bj_laden(uuid,text), public.bj_antworten(uuid,text,text,text,boolean,boolean,boolean,boolean,int,boolean), public.bj_absagen_loeschen(uuid,text) from public;
grant execute on function public.bj_laden(uuid,text), public.bj_antworten(uuid,text,text,text,boolean,boolean,boolean,boolean,int,boolean), public.bj_absagen_loeschen(uuid,text) to anon, authenticated;
