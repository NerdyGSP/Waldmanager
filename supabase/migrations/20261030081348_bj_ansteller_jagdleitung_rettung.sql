alter table public.bewegungsjagd_teilnehmer
  add column ist_ansteller boolean not null default false,
  add column ansteller_id uuid references public.bewegungsjagd_teilnehmer(id) on delete set null,
  add column hegebeitrag_bezahlt boolean not null default false,
  add column schuesseltreiben_teilgenommen boolean not null default false,
  add column anwesend boolean not null default false,
  add constraint bjt_ansteller_nicht_selbst check (not (ist_ansteller and ansteller_id is not null) and ansteller_id is distinct from id);

create index bjt_ansteller_idx on public.bewegungsjagd_teilnehmer(ansteller_id);

alter table public.bewegungsjagden add column info_jagdleitung text;

create table public.bewegungsjagd_jagdleitung (
  id uuid primary key default gen_random_uuid(),
  bewegungsjagd_id uuid not null references public.bewegungsjagden(id) on delete cascade,
  name text not null,
  telefon text,
  funktion text,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now()
);
create index bjl_jagd_idx on public.bewegungsjagd_jagdleitung(bewegungsjagd_id);
alter table public.bewegungsjagd_jagdleitung enable row level security;
create policy bjl_inhaber_alle on public.bewegungsjagd_jagdleitung for all to authenticated
  using (private.bj_ist_inhaber(bewegungsjagd_id)) with check (private.bj_ist_inhaber(bewegungsjagd_id));

create table public.bewegungsjagd_rettungspunkte (
  id uuid primary key default gen_random_uuid(),
  bewegungsjagd_id uuid not null references public.bewegungsjagden(id) on delete cascade,
  name text not null,
  bemerkung text,
  lng double precision not null,
  lat double precision not null,
  erstellt_am timestamptz not null default now()
);
create index bjr_jagd_idx on public.bewegungsjagd_rettungspunkte(bewegungsjagd_id);
alter table public.bewegungsjagd_rettungspunkte enable row level security;
create policy bjr_inhaber_alle on public.bewegungsjagd_rettungspunkte for all to authenticated
  using (private.bj_ist_inhaber(bewegungsjagd_id)) with check (private.bj_ist_inhaber(bewegungsjagd_id));

-- Ansteller-Regeln: Ansteller hat selbst keinen Ansteller; Zuweisung nur auf Ansteller derselben Jagd;
-- wird jemand kein Ansteller mehr, werden seine Gruppenmitglieder "ohne Ansteller"
create or replace function private.bjt_ansteller_pruefen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ist_ansteller then new.ansteller_id := null; end if;
  if new.ansteller_id is not null then
    if not exists (select 1 from public.bewegungsjagd_teilnehmer a
        where a.id = new.ansteller_id and a.bewegungsjagd_id = new.bewegungsjagd_id and a.ist_ansteller) then
      raise exception 'Der gewählte Teilnehmer ist kein Ansteller dieser Jagd';
    end if;
  end if;
  return new;
end $$;
create trigger bjt_ansteller_pruefen before insert or update of ist_ansteller, ansteller_id on public.bewegungsjagd_teilnehmer
  for each row execute function private.bjt_ansteller_pruefen();

create or replace function private.bjt_ansteller_abgewaehlt() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.bewegungsjagd_teilnehmer set ansteller_id = null where ansteller_id = new.id;
  return null;
end $$;
create trigger bjt_ansteller_abgewaehlt after update of ist_ansteller on public.bewegungsjagd_teilnehmer
  for each row when (old.ist_ansteller and not new.ist_ansteller) execute function private.bjt_ansteller_abgewaehlt();

-- Teilnehmerseite: eigener Ansteller, Jagdleitung und Rettungspunkte (nur Name/Telefon dieser Personen)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.bj_laden(uuid,text)'::regprocedure);
  d := replace(d, 'declare t public.bewegungsjagd_teilnehmer; b public.bewegungsjagden; boecke jsonb;',
                  'declare t public.bewegungsjagd_teilnehmer; b public.bewegungsjagden; boecke jsonb;');
  d := replace(d, '''einrichtung_id'', t.zugeordnete_einrichtung_id),',
                  '''einrichtung_id'', t.zugeordnete_einrichtung_id, ''ist_ansteller'', t.ist_ansteller),
    ''ansteller'', (select jsonb_build_object(''name'', a.name, ''telefon'', a.telefon)
      from public.bewegungsjagd_teilnehmer a where a.id = t.ansteller_id and a.aktiv),
    ''jagdleitung'', (select coalesce(jsonb_agg(jsonb_build_object(''name'', l.name, ''telefon'', l.telefon, ''funktion'', l.funktion) order by l.sortierung, l.erstellt_am), ''[]''::jsonb)
      from public.bewegungsjagd_jagdleitung l where l.bewegungsjagd_id = b.id),
    ''rettungspunkte'', (select coalesce(jsonb_agg(jsonb_build_object(''id'', r.id, ''name'', r.name, ''bemerkung'', r.bemerkung, ''lng'', r.lng, ''lat'', r.lat) order by r.erstellt_am), ''[]''::jsonb)
      from public.bewegungsjagd_rettungspunkte r where r.bewegungsjagd_id = b.id),');
  if position('rettungspunkte' in d) = 0 then raise exception 'Patch von bj_laden fehlgeschlagen'; end if;
  execute d;
end $$;
