alter table public.pirschwege drop constraint pirschwege_bewegungsjagd_id_fkey;
alter table public.pirschwege add constraint pirschwege_bewegungsjagd_id_fkey foreign key (bewegungsjagd_id) references public.bewegungsjagden(id) on delete cascade;
alter table public.pirschwege add constraint pirschwege_treiberroute_jagd check (typ <> 'treiberroute' or bewegungsjagd_id is not null);
