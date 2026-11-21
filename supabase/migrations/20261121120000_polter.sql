-- Polter: aufgearbeitetes Holz, das am Weg liegt und noch abgefahren werden muss.
-- Punkt mit grober Menge; bleibt offen („liegt“), bis jemand „abgefahren“ setzt. id kann offline vom Client vergeben werden.
create table public.polter (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe(id) on delete cascade,
  bestand_id uuid references public.bestaende(id) on delete set null,   -- per Trigger aus geom
  baumart text,                      -- forstliches Kürzel, z. B. 'Fi'
  stueck integer check (stueck > 0),
  menge_fm numeric check (menge_fm >= 0),
  geom extensions.geometry(Point, 4326) not null,
  genauigkeit_m numeric,
  abgelegt_am timestamptz not null default now(),
  notiz text,
  status text not null default 'liegt' check (status in ('liegt','abgefahren')),
  abgefahren_am timestamptz,
  abgefahren_von uuid references public.profiles(id) on delete set null,
  erfasst_von uuid references public.profiles(id) on delete set null default auth.uid(),
  geaendert_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  geloescht_am timestamptz
);
create index polter_betrieb_idx on public.polter (betrieb_id, status, abgelegt_am);
create index polter_geom_idx on public.polter using gist (geom);
create index polter_bestand_idx on public.polter (bestand_id) where bestand_id is not null;

create trigger polter_aktualisiert before update on public.polter for each row execute function private.set_aktualisiert_am();
create trigger polter_bestand before insert or update on public.polter for each row execute function private.fund_bestand_setzen();
create trigger polter_bezug before insert or update on public.polter for each row execute function private.bezug_pruefen();
create trigger zz_audit before insert or update on public.polter for each row execute function private.audit_setzen('abgefahren', 'abgefahren');

-- RLS wie bei Funden: alle Mitglieder erfassen; ändern Inhaber oder Erfasser; löschen Inhaber
alter table public.polter enable row level security;
create policy polter_select on public.polter for select to authenticated using (private.ist_mitglied(betrieb_id));
create policy polter_insert on public.polter for insert to authenticated with check (private.ist_mitglied(betrieb_id));
create policy polter_update on public.polter for update to authenticated
  using (private.ist_inhaber(betrieb_id) or erfasst_von = (select auth.uid()))
  with check (private.ist_inhaber(betrieb_id) or erfasst_von = (select auth.uid()));
create policy polter_delete on public.polter for delete to authenticated using (private.ist_inhaber(betrieb_id));

revoke all on public.polter from anon;
grant select, insert, update, delete on public.polter to authenticated;

-- Polter als GeoJSON für Karte und Liste
create function public.polter_laden(p_betrieb_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature', 'id', p.id,
    'geometry', extensions.st_asgeojson(p.geom, 6)::jsonb,
    'properties', jsonb_build_object('id', p.id, 'baumart', p.baumart, 'stueck', p.stueck, 'menge_fm', p.menge_fm,
      'bestand_id', p.bestand_id, 'status', p.status, 'abgelegt_am', p.abgelegt_am, 'abgefahren_am', p.abgefahren_am,
      'notiz', p.notiz, 'erfasst_von', p.erfasst_von))
    order by p.abgelegt_am), '[]'::jsonb))
  from public.polter p
  where p.betrieb_id = p_betrieb_id and p.geloescht_am is null;
$$;

revoke all on function public.polter_laden(uuid) from public, anon;
grant execute on function public.polter_laden(uuid) to authenticated;
