
create table public.aufgabenlisten (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  name text not null,
  status text not null default 'offen' check (status in ('offen','abgeschlossen')),
  bewegungsjagd_id uuid unique references public.bewegungsjagden(id) on delete set null,
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index on public.aufgabenlisten (revier_id) where geloescht_am is null;
create trigger aufgabenlisten_aktualisiert before update on public.aufgabenlisten for each row execute function private.set_aktualisiert_am();
alter table public.aufgabenlisten enable row level security;
create policy aufgabenlisten_select on public.aufgabenlisten for select to authenticated using (private.ist_mitglied(revier_id));
create policy aufgabenlisten_insert on public.aufgabenlisten for insert to authenticated with check (private.ist_mitglied(revier_id));
create policy aufgabenlisten_update on public.aufgabenlisten for update to authenticated
  using (private.ist_inhaber(revier_id) or erstellt_von = (select auth.uid())) with check (private.ist_mitglied(revier_id));
create policy aufgabenlisten_delete on public.aufgabenlisten for delete to authenticated
  using (private.ist_inhaber(revier_id) or erstellt_von = (select auth.uid()));
revoke all on public.aufgabenlisten from anon;

alter table public.aufgaben add column liste_id uuid references public.aufgabenlisten(id) on delete set null;
create index on public.aufgaben (liste_id) where liste_id is not null;

-- Bestehende Verknüpfungen Aufgabe -> Bewegungsjagd in Listen überführen
insert into public.aufgabenlisten (revier_id, name, bewegungsjagd_id, erstellt_von)
select b.revier_id, 'Jagd: ' || b.titel, b.id, b.erstellt_von
from public.bewegungsjagden b where exists (select 1 from public.aufgaben a where a.bewegungsjagd_id = b.id);
update public.aufgaben a set liste_id = l.id from public.aufgabenlisten l where l.bewegungsjagd_id = a.bewegungsjagd_id;
alter table public.aufgaben drop column bewegungsjagd_id;

-- Triggerfunktion: Felder nur dort prüfen, wo die Tabelle sie hat (plpgsql wertet `and` nicht kurzgeschlossen aus)
create or replace function private.neue_module_bezug_pruefen() returns trigger
language plpgsql security definer set search_path = '' as $function$
begin
  if tg_table_name = 'wildschaeden' then
    if new.zone_id is not null
       and not exists (select 1 from public.zonen z where z.id = new.zone_id and z.revier_id = new.revier_id) then
      raise exception 'Die Zone gehört nicht zu diesem Revier';
    end if;
  elsif tg_table_name = 'aufgaben' then
    if new.einrichtung_id is not null
       and not exists (select 1 from public.einrichtungen e where e.id = new.einrichtung_id and e.revier_id = new.revier_id) then
      raise exception 'Die Einrichtung gehört nicht zu diesem Revier';
    end if;
    if new.liste_id is not null
       and not exists (select 1 from public.aufgabenlisten l where l.id = new.liste_id and l.revier_id = new.revier_id) then
      raise exception 'Die Liste gehört nicht zu diesem Revier';
    end if;
    if new.zugewiesen_an is not null
       and not exists (select 1 from public.revier_mitglieder m where m.user_id = new.zugewiesen_an and m.revier_id = new.revier_id) then
      raise exception 'Die Aufgabe kann nur Mitgliedern des Reviers zugewiesen werden';
    end if;
    if new.status = 'erledigt' and new.erledigt_am is null then new.erledigt_am := now(); end if;
    if new.status <> 'erledigt' then new.erledigt_am := null; end if;
  end if;
  return new;
end $function$;

create or replace function private.aufgabenliste_bezug_pruefen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.bewegungsjagd_id is not null
     and not exists (select 1 from public.bewegungsjagden b where b.id = new.bewegungsjagd_id and b.revier_id = new.revier_id) then
    raise exception 'Die Bewegungsjagd gehört nicht zu diesem Revier';
  end if;
  return new;
end $$;
create trigger aufgabenlisten_bezug before insert or update on public.aufgabenlisten for each row execute function private.aufgabenliste_bezug_pruefen();
