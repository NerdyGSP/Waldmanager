
-- Wildschäden --------------------------------------------------------------
create table public.wildschaeden (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  kenntnis_am date not null default current_date,       -- Tag, an dem der Schaden bekannt wurde (Fristbeginn)
  angemeldet_am date,                                   -- Tag der Anmeldung (bei der Gemeinde / dem Jagdausübungsberechtigten)
  status text not null default 'erfasst' check (status in ('erfasst','angemeldet','besichtigt','reguliert','abgelehnt')),
  kultur text not null,
  flaeche_ha numeric(10,2),
  wildart_id text references public.wildarten(id),
  zone_id uuid references public.zonen(id) on delete set null,
  ort text,
  geom extensions.geometry(Point, 4326),
  geschaedigter text,
  kontakt text,
  schaden_eur numeric(12,2),
  bemerkung text,
  erfasst_von uuid references auth.users(id) on delete set null default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index wildschaeden_revier_idx on public.wildschaeden (revier_id, kenntnis_am desc);

-- Aufgaben ------------------------------------------------------------------
create table public.aufgaben (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  titel text not null check (length(trim(titel)) > 0),
  beschreibung text,
  faellig_am date,
  status text not null default 'offen' check (status in ('offen','in_arbeit','erledigt')),
  zugewiesen_an uuid references auth.users(id) on delete set null,
  einrichtung_id uuid references public.einrichtungen(id) on delete set null,
  erledigt_am timestamptz,
  erstellt_von uuid references auth.users(id) on delete set null default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index aufgaben_revier_idx on public.aufgaben (revier_id, status, faellig_am);

-- Begehungsscheine ----------------------------------------------------------
create table public.begehungsscheine (
  id uuid primary key default gen_random_uuid(),
  revier_id uuid not null references public.reviere(id) on delete cascade,
  gast_name text not null check (length(trim(gast_name)) > 0),
  gast_kontakt text,
  jagdschein_nr text,
  art text not null default 'unentgeltlich' check (art in ('unentgeltlich','entgeltlich')),
  entgelt_eur numeric(10,2),
  gueltig_von date not null,
  gueltig_bis date not null check (gueltig_bis >= gueltig_von),
  bereich text,
  wildarten text[] not null default '{}',
  bedingungen text,
  widerrufen_am date,
  ausgestellt_von uuid references auth.users(id) on delete set null default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index begehungsscheine_revier_idx on public.begehungsscheine (revier_id, gueltig_bis desc);

-- Trigger ---------------------------------------------------------------------
create trigger wildschaeden_aktualisiert before update on public.wildschaeden for each row execute function private.set_aktualisiert_am();
create trigger aufgaben_aktualisiert before update on public.aufgaben for each row execute function private.set_aktualisiert_am();
create trigger begehungsscheine_aktualisiert before update on public.begehungsscheine for each row execute function private.set_aktualisiert_am();

create or replace function private.neue_module_bezug_pruefen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'wildschaeden' and new.zone_id is not null
     and not exists (select 1 from public.zonen z where z.id = new.zone_id and z.revier_id = new.revier_id) then
    raise exception 'Die Zone gehört nicht zu diesem Revier';
  end if;
  if tg_table_name = 'aufgaben' then
    if new.einrichtung_id is not null
       and not exists (select 1 from public.einrichtungen e where e.id = new.einrichtung_id and e.revier_id = new.revier_id) then
      raise exception 'Die Einrichtung gehört nicht zu diesem Revier';
    end if;
    if new.zugewiesen_an is not null
       and not exists (select 1 from public.revier_mitglieder m where m.user_id = new.zugewiesen_an and m.revier_id = new.revier_id) then
      raise exception 'Die Aufgabe kann nur Mitgliedern des Reviers zugewiesen werden';
    end if;
    if new.status = 'erledigt' and new.erledigt_am is null then new.erledigt_am := now(); end if;
    if new.status <> 'erledigt' then new.erledigt_am := null; end if;
  end if;
  return new;
end $$;
create trigger wildschaeden_bezug before insert or update on public.wildschaeden for each row execute function private.neue_module_bezug_pruefen();
create trigger aufgaben_bezug before insert or update on public.aufgaben for each row execute function private.neue_module_bezug_pruefen();

-- RLS -------------------------------------------------------------------------
alter table public.wildschaeden enable row level security;
alter table public.aufgaben enable row level security;
alter table public.begehungsscheine enable row level security;

-- Wildschäden: alle Mitglieder erfassen und lesen, ändern/löschen Inhaber oder Ersteller
create policy wildschaeden_select on public.wildschaeden for select to authenticated using (private.ist_mitglied(revier_id));
create policy wildschaeden_insert on public.wildschaeden for insert to authenticated with check (private.ist_mitglied(revier_id));
create policy wildschaeden_update on public.wildschaeden for update to authenticated
  using (private.ist_inhaber(revier_id) or erfasst_von = (select auth.uid()))
  with check (private.ist_inhaber(revier_id) or erfasst_von = (select auth.uid()));
create policy wildschaeden_delete on public.wildschaeden for delete to authenticated using (private.ist_inhaber(revier_id));

-- Aufgaben: alle Mitglieder lesen und anlegen; Inhaber, Ersteller oder zugewiesene Person ändern
create policy aufgaben_select on public.aufgaben for select to authenticated using (private.ist_mitglied(revier_id));
create policy aufgaben_insert on public.aufgaben for insert to authenticated with check (private.ist_mitglied(revier_id));
create policy aufgaben_update on public.aufgaben for update to authenticated
  using (private.ist_inhaber(revier_id) or erstellt_von = (select auth.uid()) or zugewiesen_an = (select auth.uid()))
  with check (private.ist_mitglied(revier_id));
create policy aufgaben_delete on public.aufgaben for delete to authenticated
  using (private.ist_inhaber(revier_id) or erstellt_von = (select auth.uid()));

-- Begehungsscheine: nur Inhaber verwalten; Mitjäger sehen alle Scheine des Reviers (Kontrolle im Revier)
create policy begehungsscheine_select on public.begehungsscheine for select to authenticated using (private.ist_mitglied(revier_id));
create policy begehungsscheine_insert on public.begehungsscheine for insert to authenticated with check (private.ist_inhaber(revier_id));
create policy begehungsscheine_update on public.begehungsscheine for update to authenticated
  using (private.ist_inhaber(revier_id)) with check (private.ist_inhaber(revier_id));
create policy begehungsscheine_delete on public.begehungsscheine for delete to authenticated using (private.ist_inhaber(revier_id));
