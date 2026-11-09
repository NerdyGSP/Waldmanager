alter table public.abschuesse alter column wildart_id drop not null;
alter table public.abschuesse
  add column fang_ergebnis text check (fang_ergebnis in ('gefangen','leer','fehlfang')),
  add column fang_zustand text check (fang_zustand in ('lebend','tot'));
alter table public.abschuesse add constraint abschuesse_art_felder check (
  (art = 'abschuss' and wildart_id is not null and fang_ergebnis is null and fang_zustand is null)
  or (art = 'fang' and einrichtung_id is not null and fang_ergebnis is not null
      and (fang_ergebnis = 'leer' or wildart_id is not null)
      and (fang_ergebnis <> 'gefangen' or fang_zustand is not null)
      and (fang_ergebnis = 'gefangen' or fang_zustand is null))
);
create or replace function private.fang_einrichtung_pruefen() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.art = 'fang' and not exists (select 1 from public.einrichtungen e where e.id = new.einrichtung_id and e.revier_id = new.revier_id and e.typ = 'falle') then
    raise exception 'Ein Fang braucht eine Einrichtung vom Typ Falle in diesem Revier';
  end if;
  return new;
end $$;
create trigger abschuesse_fang_einrichtung before insert or update on public.abschuesse for each row execute function private.fang_einrichtung_pruefen();
