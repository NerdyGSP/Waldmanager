create or replace function private.revierbezug_pruefen()
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

  if tg_table_name = 'abschuesse' then
    if new.einrichtung_id is not null and not exists (
      select 1 from public.einrichtungen e where e.id = new.einrichtung_id and e.revier_id = new.revier_id
    ) then
      raise exception 'Einrichtung gehört nicht zu diesem Revier';
    end if;
  end if;

  return new;
end;
$$;
