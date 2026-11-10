alter table public.bewegungsjagd_teilnehmer
  drop column if exists anwesend,
  drop column if exists hegebeitrag_bezahlt,
  drop column if exists schuesseltreiben_teilgenommen;
