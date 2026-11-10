alter table public.abschuesse add column fallwild_ursache text;
alter table public.abschuesse add constraint abschuesse_fallwild_ursache_check check (
  (art = 'fallwild' and fallwild_ursache in ('verkehr','krankheit','sonstiges') and erleger_id is null and erleger_name is null and erleger_teilnehmer_id is null)
  or (art <> 'fallwild' and fallwild_ursache is null)) not valid;
