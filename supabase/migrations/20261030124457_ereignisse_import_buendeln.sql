create or replace function private.ereignis_schreiben(
  p_revier uuid, p_typ text, p_gruppe text, p_sicht text, p_titel text, p_ziel_typ text, p_ziel_id text,
  p_zusammenfassen text default null, p_hervorgehoben boolean default false, p_akteur_name text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text; v_id uuid; v_n int;
begin
  if v_uid is not null then select name into v_name from public.profiles where id = v_uid; end if;
  v_name := coalesce(v_name, p_akteur_name);
  -- Serien (Datenimport) werden zu einer Meldung gebündelt: ab der dritten gleichartigen Aktion innerhalb von 15 Sekunden
  if p_zusammenfassen is not null and v_uid is not null then
    select id into v_id from public.ereignisse
      where revier_id = p_revier and typ = p_typ and gruppe = 'import' and akteur_id = v_uid and erstellt_am > now() - interval '15 seconds'
      order by erstellt_am desc limit 1;
    if v_id is not null then
      update public.ereignisse set anzahl = anzahl + 1, titel = 'Datenimport: ' || (anzahl + 1) || ' ' || p_zusammenfassen, erstellt_am = now() where id = v_id;
      return;
    end if;
    select count(*) into v_n from public.ereignisse
      where revier_id = p_revier and typ = p_typ and gruppe <> 'import' and akteur_id = v_uid and erstellt_am > now() - interval '15 seconds';
    if v_n >= 2 then
      delete from public.ereignisse
        where revier_id = p_revier and typ = p_typ and gruppe <> 'import' and akteur_id = v_uid and erstellt_am > now() - interval '15 seconds';
      insert into public.ereignisse (revier_id, typ, gruppe, sichtbar_fuer, akteur_id, akteur_name, titel, ziel_typ, anzahl)
      values (p_revier, p_typ, 'import', 'inhaber', v_uid, v_name, 'Datenimport: ' || (v_n + 1) || ' ' || p_zusammenfassen, 'import', v_n + 1);
      return;
    end if;
  end if;
  insert into public.ereignisse (revier_id, typ, gruppe, sichtbar_fuer, akteur_id, akteur_name, titel, ziel_typ, ziel_id, hervorgehoben)
  values (p_revier, p_typ, p_gruppe, p_sicht, v_uid, v_name, p_titel, p_ziel_typ, p_ziel_id, p_hervorgehoben);
  delete from public.ereignisse where revier_id = p_revier and (
    erstellt_am < now() - interval '30 days'
    or id in (select id from public.ereignisse where revier_id = p_revier order by erstellt_am desc offset 200));
end $$;
