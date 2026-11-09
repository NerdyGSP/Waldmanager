create table public.ereignisse (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  typ text not null,
  gruppe text not null,
  sichtbar_fuer text not null default 'alle' check (sichtbar_fuer in ('alle', 'inhaber')),
  akteur_id uuid references public.profiles(id) on delete set null,
  akteur_name text,
  titel text not null,
  ziel_typ text,
  ziel_id text,
  anzahl integer not null default 1,
  hervorgehoben boolean not null default false,
  ref text,
  erstellt_am timestamptz not null default now()
);
create index ereignisse_revier_zeit_idx on public.ereignisse (revier_id, erstellt_am desc);
create unique index ereignisse_ref_eindeutig on public.ereignisse (typ, ziel_id, ref) where ref is not null;
alter table public.ereignisse enable row level security;
-- Lesen nur für Mitglieder des Reviers (Masteradmin nur als Mitglied); Verwaltungsereignisse nur für Inhaber. Schreiben nur per Trigger.
create policy ereignisse_select on public.ereignisse for select using (
  exists (select 1 from public.revier_mitglieder m where m.revier_id = ereignisse.revier_id and m.user_id = (select auth.uid())
          and (ereignisse.sichtbar_fuer = 'alle' or m.rolle = 'inhaber'))
);

create table public.ereignis_gelesen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  revier_id uuid not null references public.reviere(id) on delete cascade,
  zuletzt_gelesen_am timestamptz not null default now(),
  primary key (user_id, revier_id)
);
alter table public.ereignis_gelesen enable row level security;
create policy ereignis_gelesen_select on public.ereignis_gelesen for select using (user_id = (select auth.uid()));
create policy ereignis_gelesen_insert on public.ereignis_gelesen for insert with check (user_id = (select auth.uid()) and private.ist_mitglied(revier_id));
create policy ereignis_gelesen_update on public.ereignis_gelesen for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.profiles add column if not exists benachrichtigungen jsonb not null default '{}'::jsonb;

create or replace function private.einr_label(p text) returns text language sql immutable set search_path = '' as $$
  select case p when 'fuetterung' then 'Fütterung' when 'drueckjagdbock' then 'Drückjagdbock' when 'wildkamera' then 'Wildkamera' else initcap(p) end;
$$;

-- Ein Ereignis je Vorgang; schnelle Folgen desselben Nutzers (Importe) werden zu einer Meldung zusammengefasst
create or replace function private.ereignis_schreiben(
  p_revier uuid, p_typ text, p_gruppe text, p_sicht text, p_titel text, p_ziel_typ text, p_ziel_id text,
  p_zusammenfassen text default null, p_hervorgehoben boolean default false, p_akteur_name text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text; v_id uuid;
begin
  if v_uid is not null then select name into v_name from public.profiles where id = v_uid; end if;
  v_name := coalesce(v_name, p_akteur_name);
  if p_zusammenfassen is not null and v_uid is not null then
    select id into v_id from public.ereignisse
      where revier_id = p_revier and typ = p_typ and akteur_id = v_uid and erstellt_am > now() - interval '15 seconds'
      order by erstellt_am desc limit 1;
    if v_id is not null then
      update public.ereignisse set anzahl = anzahl + 1, titel = 'Datenimport: ' || (anzahl + 1) || ' ' || p_zusammenfassen,
        gruppe = 'import', sichtbar_fuer = 'inhaber', ziel_typ = 'import', ziel_id = null, erstellt_am = now() where id = v_id;
      return;
    end if;
  end if;
  insert into public.ereignisse (revier_id, typ, gruppe, sichtbar_fuer, akteur_id, akteur_name, titel, ziel_typ, ziel_id, hervorgehoben)
  values (p_revier, p_typ, p_gruppe, p_sicht, v_uid, v_name, p_titel, p_ziel_typ, p_ziel_id, p_hervorgehoben);
  -- Aufbewahrung: 30 Tage, höchstens 200 je Revier
  delete from public.ereignisse where revier_id = p_revier and (
    erstellt_am < now() - interval '30 days'
    or id in (select id from public.ereignisse where revier_id = p_revier order by erstellt_am desc offset 200));
end $$;

-- Einrichtungen
create or replace function private.ev_einrichtung() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text := coalesce(new.name, private.einr_label(new.typ::text));
begin
  if tg_op = 'INSERT' then
    perform private.ereignis_schreiben(new.revier_id, 'einrichtung_neu', 'einrichtungen', 'alle', 'Neue Einrichtung: ' || v_name, 'einrichtung', new.id::text, 'Einrichtungen');
  elsif old.geloescht_am is null and new.geloescht_am is not null then
    perform private.ereignis_schreiben(new.revier_id, 'einrichtung_geloescht', 'einrichtungen', 'alle', 'Einrichtung gelöscht: ' || v_name, null, null);
  elsif new.geloescht_am is null and new.geom is distinct from old.geom then
    perform private.ereignis_schreiben(new.revier_id, 'einrichtung_verschoben', 'einrichtungen', 'alle', 'Einrichtung verschoben: ' || v_name, 'einrichtung', new.id::text);
  end if;
  return null;
end $$;
create trigger zz_ereignis after insert or update on public.einrichtungen for each row execute function private.ev_einrichtung();

-- Zonen
create or replace function private.ev_zone() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.geloescht_am is null and new.geom is not null and (tg_op = 'INSERT' or old.geom is distinct from new.geom) then
    perform private.ereignis_schreiben(new.revier_id, 'zone_geaendert', 'karte', 'inhaber',
      case when tg_op = 'INSERT' or old.geom is null then 'Zone angelegt: ' else 'Zone ersetzt: ' end || new.name, 'zone', new.id::text, 'Zonen');
  end if;
  return null;
end $$;
create trigger zz_ereignis after insert or update of geom on public.zonen for each row execute function private.ev_zone();

-- Routen
create or replace function private.ev_route() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.ereignis_schreiben(new.revier_id, 'route_neu', 'karte', 'inhaber',
    'Neue Route (' || case new.typ when 'wte_route' then 'WTE-Route' when 'treiberroute' then 'Treiberroute' else 'Pirschweg' end || '): ' || new.name, 'route', new.id::text, 'Routen');
  return null;
end $$;
create trigger zz_ereignis after insert on public.pirschwege for each row execute function private.ev_route();

-- Reviergrenze
create or replace function private.ev_grenze() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.geom is distinct from new.geom then
    perform private.ereignis_schreiben(new.revier_id, 'grenze_geaendert', 'karte', 'inhaber',
      case when tg_op = 'INSERT' then 'Reviergrenze angelegt' else 'Reviergrenze ersetzt' end, 'karte', null);
  end if;
  return null;
end $$;
create trigger zz_ereignis after insert or update of geom on public.revier_grenzen for each row execute function private.ev_grenze();

-- Zählungen (WTE)
create or replace function private.ev_sitzung() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.ereignis_schreiben(new.revier_id, 'zaehlung_gestartet', 'zaehlung', 'alle', 'Zählung gestartet (' || to_char(new.datum, 'DD.MM.YYYY') || ')', 'zaehlung', new.id::text);
  elsif old.status is distinct from new.status and new.status = 'abgeschlossen' then
    perform private.ereignis_schreiben(new.revier_id, 'zaehlung_abgeschlossen', 'zaehlung', 'alle', 'Zählung abgeschlossen (' || to_char(new.datum, 'DD.MM.YYYY') || ')', 'zaehlung', new.id::text);
  end if;
  return null;
end $$;
create trigger zz_ereignis after insert or update of status on public.zaehlsitzungen for each row execute function private.ev_sitzung();

-- Abschüsse und Fänge (Fang in Falle hervorgehoben)
create or replace function private.ev_abschuss() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_wild text; v_einr text; v_typ text;
begin
  select name into v_wild from public.wildarten where id = new.wildart_id;
  select coalesce(name, private.einr_label(typ::text)), typ::text into v_einr, v_typ from public.einrichtungen where id = new.einrichtung_id;
  if new.art = 'fang' then
    perform private.ereignis_schreiben(new.revier_id, 'fang_erfasst', 'abschuesse', 'alle',
      case when v_typ = 'falle' then 'Fang in Falle „' || v_einr || '“' else 'Fang erfasst' end || coalesce(': ' || v_wild, ''),
      'abschuss', new.id::text, null, v_typ = 'falle');
  else
    perform private.ereignis_schreiben(new.revier_id, 'abschuss_erfasst', 'abschuesse', 'alle', 'Abschuss erfasst' || coalesce(': ' || v_wild, ''), 'abschuss', new.id::text);
  end if;
  return null;
end $$;
create trigger zz_ereignis after insert on public.abschuesse for each row execute function private.ev_abschuss();

-- Wildschäden
create or replace function private.ev_wildschaden() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.ereignis_schreiben(new.revier_id, 'wildschaden_gemeldet', 'wildschaeden', 'inhaber',
    'Wildschaden gemeldet' || coalesce(': ' || new.kultur, '') || ' (Anmeldefrist bis ' || to_char(new.kenntnis_am + 7, 'DD.MM.YYYY') || ')', 'wildschaden', new.id::text);
  return null;
end $$;
create trigger zz_ereignis after insert on public.wildschaeden for each row execute function private.ev_wildschaden();

-- Bewegungsjagd: Zu-/Absagen und Abschluss
create or replace function private.ev_bj_teilnehmer() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_revier uuid; v_titel text;
begin
  if old.status is distinct from new.status and new.status in ('zugesagt', 'abgesagt') then
    select revier_id, titel into v_revier, v_titel from public.bewegungsjagden where id = new.bewegungsjagd_id;
    perform private.ereignis_schreiben(v_revier, 'bj_antwort', 'bewegungsjagd', 'inhaber',
      new.name || case when new.status = 'zugesagt' then ' hat zugesagt' else ' hat abgesagt' end || ' (' || v_titel || ')', 'bewegungsjagd', new.bewegungsjagd_id::text, null, false, new.name);
  end if;
  return null;
end $$;
create trigger zz_ereignis after update of status on public.bewegungsjagd_teilnehmer for each row execute function private.ev_bj_teilnehmer();

create or replace function private.ev_bj_abschluss() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status and new.status = 'abgeschlossen' then
    perform private.ereignis_schreiben(new.revier_id, 'bj_abgeschlossen', 'bewegungsjagd', 'inhaber', 'Jagd abgeschlossen: ' || new.titel, 'bewegungsjagd', new.id::text);
  end if;
  return null;
end $$;
create trigger zz_ereignis after update of status on public.bewegungsjagden for each row execute function private.ev_bj_abschluss();

-- Aufgaben: zugewiesen, erledigt
create or replace function private.ev_aufgabe() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.geloescht_am is not null then return null; end if;
  if new.zugewiesen_an is not null and (tg_op = 'INSERT' or old.zugewiesen_an is distinct from new.zugewiesen_an) then
    perform private.ereignis_schreiben(new.revier_id, 'aufgabe_zugewiesen', 'aufgaben', 'alle', 'Aufgabe zugewiesen: ' || new.titel, 'aufgabe', new.id::text);
  end if;
  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'erledigt' then
    perform private.ereignis_schreiben(new.revier_id, 'aufgabe_erledigt', 'aufgaben', 'alle', 'Aufgabe erledigt: ' || new.titel, 'aufgabe', new.id::text);
  end if;
  return null;
end $$;
create trigger zz_ereignis after insert or update of zugewiesen_an, status on public.aufgaben for each row execute function private.ev_aufgabe();

-- Mitglieder (auch bei eingelöster Einladung)
create or replace function private.ev_mitglied() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select name into v_name from public.profiles where id = new.user_id;
  perform private.ereignis_schreiben(new.revier_id, 'mitglied_beigetreten', 'mitglieder', 'inhaber', 'Mitglied beigetreten: ' || coalesce(v_name, 'neues Mitglied'), 'reviermanagement', null);
  return null;
end $$;
create trigger zz_ereignis after insert on public.revier_mitglieder for each row execute function private.ev_mitglied();

-- Fällige Aufgaben: einmal je Aufgabe und Fälligkeitstag; wird beim Öffnen der App angestoßen (kein Cron nötig)
create or replace function public.aufgaben_faellig_pruefen(p_revier_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.ist_mitglied(p_revier_id) then return; end if;
  insert into public.ereignisse (revier_id, typ, gruppe, sichtbar_fuer, titel, ziel_typ, ziel_id, ref, erstellt_am)
  select a.revier_id, 'aufgabe_faellig', 'aufgaben', 'alle', 'Aufgabe fällig: ' || a.titel, 'aufgabe', a.id::text, a.faellig_am::text, now()
  from public.aufgaben a
  where a.revier_id = p_revier_id and a.geloescht_am is null and a.status <> 'erledigt' and a.faellig_am is not null and a.faellig_am <= current_date and a.faellig_am > current_date - 7
  on conflict do nothing;
end $$;
revoke all on function public.aufgaben_faellig_pruefen(uuid) from public, anon;
grant execute on function public.aufgaben_faellig_pruefen(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.ereignisse;
exception when others then raise notice 'Realtime-Publikation: %', sqlerrm;
end $$;
