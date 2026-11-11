-- Fix: Beim Speichern eines Funds schlug die Prüfung fehl („record "new" has no field "zugewiesen_an"“),
-- weil PL/pgSQL die Bedingung nicht abkürzt und das Feld nur bei Maßnahmen existiert.
create or replace function private.bezug_pruefen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.bestand_id is not null
     and not exists (select 1 from public.bestaende b where b.id = new.bestand_id and b.betrieb_id = new.betrieb_id) then
    raise exception 'Der Bestand gehört nicht zu diesem Forstbetrieb';
  end if;
  if tg_table_name = 'massnahmen' then
    if new.zugewiesen_an is not null
       and not exists (select 1 from public.betrieb_mitglieder m where m.user_id = new.zugewiesen_an and m.betrieb_id = new.betrieb_id) then
      raise exception 'Maßnahmen können nur Mitgliedern des Forstbetriebs zugewiesen werden';
    end if;
  end if;
  return new;
end $$;
