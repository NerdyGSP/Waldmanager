alter table public.zonen_ebenen add column wte_aktiv boolean not null default false;
alter table public.abschuesse add column art text not null default 'abschuss' check (art in ('abschuss','fang'));
create unique index zaehlsitzungen_eine_offene_je_revier on public.zaehlsitzungen (revier_id) where status = 'offen' and geloescht_am is null;

do $$
declare d text;
begin
  -- quervergleich: nur Abschüsse zählen, keine Fänge
  d := pg_get_functiondef('public.quervergleich'::regproc);
  d := replace(d, E'      and a.geloescht_am is null\n    group by a.revier_id', E'      and a.geloescht_am is null\n      and a.art = ''abschuss''\n    group by a.revier_id');
  if d not like '%a.art = ''abschuss''%' then raise exception 'quervergleich-Patch nicht angewendet'; end if;
  execute d;

  -- karte_daten: wte_aktiv je Ebene, Abschüsse ohne Fänge, art als Property
  d := pg_get_functiondef('public.karte_daten(uuid,integer)'::regprocedure);
  d := replace(d, '''farbe'', e.farbe) order by e.sortierung, e.name)', '''farbe'', e.farbe, ''wte_aktiv'', e.wte_aktiv) order by e.sortierung, e.name)');
  d := replace(d, 'where a.revier_id = p_revier_id and a.geloescht_am is null and a.geom is not null', 'where a.revier_id = p_revier_id and a.art = ''abschuss'' and a.geloescht_am is null and a.geom is not null');
  if d not like '%wte_aktiv%' or d not like '%a.art = ''abschuss''%' then raise exception 'karte_daten-Patch nicht angewendet'; end if;
  execute d;
end $$;
