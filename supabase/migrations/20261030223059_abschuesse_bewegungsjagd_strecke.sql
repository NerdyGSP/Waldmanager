alter table public.abschuesse
  add column bewegungsjagd_id uuid references public.bewegungsjagden(id) on delete set null,
  add column erleger_teilnehmer_id uuid references public.bewegungsjagd_teilnehmer(id) on delete set null,
  add column erleger_name text;
create index abschuesse_bewegungsjagd_idx on public.abschuesse (bewegungsjagd_id) where bewegungsjagd_id is not null;

alter table public.abschuesse drop constraint abschuesse_art_check;
alter table public.abschuesse add constraint abschuesse_art_check check (art = any (array['abschuss','fang','fallwild']));
alter table public.abschuesse drop constraint abschuesse_art_felder;
alter table public.abschuesse add constraint abschuesse_art_felder check (
  (art in ('abschuss','fallwild') and wildart_id is not null and fang_ergebnis is null and fang_zustand is null)
  or (art = 'fang' and einrichtung_id is not null and fang_ergebnis is not null
      and (fang_ergebnis = 'leer' or wildart_id is not null)
      and (fang_ergebnis <> 'gefangen' or fang_zustand is not null)
      and (fang_ergebnis = 'gefangen' or fang_zustand is null))
);

-- Benachrichtigung: Strecke einer Bewegungsjagd wird zu EINER Meldung je Jagd gebündelt
create or replace function private.ev_abschuss() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_wild text; v_einr text; v_typ text; v_titel text; v_n int; v_uid uuid := auth.uid(); v_name text;
begin
  if new.bewegungsjagd_id is not null then
    select titel into v_titel from public.bewegungsjagden where id = new.bewegungsjagd_id;
    select count(*) into v_n from public.abschuesse where bewegungsjagd_id = new.bewegungsjagd_id and geloescht_am is null;
    if v_uid is not null then select name into v_name from public.profiles where id = v_uid; end if;
    insert into public.ereignisse (revier_id, typ, gruppe, sichtbar_fuer, akteur_id, akteur_name, titel, ziel_typ, ziel_id, ref, anzahl)
    values (new.revier_id, 'bj_strecke', 'bewegungsjagd', 'inhaber', v_uid, v_name,
            'Bewegungsjagd ' || coalesce(v_titel, '') || ': ' || v_n || ' Stück Strecke erfasst', 'bewegungsjagd', new.bewegungsjagd_id::text, 'strecke', v_n)
    on conflict (typ, ziel_id, ref) where ref is not null
    do update set titel = excluded.titel, anzahl = excluded.anzahl, akteur_id = excluded.akteur_id, akteur_name = excluded.akteur_name, erstellt_am = now();
    return null;
  end if;
  select name into v_wild from public.wildarten where id = new.wildart_id;
  select coalesce(name, private.einr_label(typ::text)), typ::text into v_einr, v_typ from public.einrichtungen where id = new.einrichtung_id;
  if new.art = 'fang' then
    perform private.ereignis_schreiben(new.revier_id, 'fang_erfasst', 'abschuesse', 'alle',
      case when v_typ = 'falle' then 'Fang in Falle „' || v_einr || '“' else 'Fang erfasst' end || coalesce(': ' || v_wild, ''),
      'abschuss', new.id::text, null, v_typ = 'falle');
  elsif new.art = 'fallwild' then
    perform private.ereignis_schreiben(new.revier_id, 'fallwild_erfasst', 'abschuesse', 'alle', 'Fallwild erfasst' || coalesce(': ' || v_wild, ''), 'abschuss', new.id::text);
  else
    perform private.ereignis_schreiben(new.revier_id, 'abschuss_erfasst', 'abschuesse', 'alle', 'Abschuss erfasst' || coalesce(': ' || v_wild, ''), 'abschuss', new.id::text);
  end if;
  return null;
end $$;
