create table public.jagdzeiten (
  id uuid primary key default gen_random_uuid(),
  bundesland text not null,
  wildart_id text not null references public.wildarten(id),
  klasse text,
  jagdzeit_von text check (jagdzeit_von ~ '^[0-1][0-9]-[0-3][0-9]$'),
  jagdzeit_bis text check (jagdzeit_bis ~ '^[0-1][0-9]-[0-3][0-9]$'),
  ganzjaehrig boolean not null default false,
  schonzeit_text text,
  sonderregel text,
  gueltig_ab date not null,
  quelle text not null,
  quelle_url text,
  sortierung int not null default 0,
  check (ganzjaehrig or (jagdzeit_von is not null and jagdzeit_bis is not null))
);
create index jagdzeiten_bl_idx on public.jagdzeiten (bundesland, wildart_id);
alter table public.jagdzeiten enable row level security;
create policy jagdzeiten_lesen on public.jagdzeiten for select to authenticated using (true);
revoke all on public.jagdzeiten from anon, public;
grant select on public.jagdzeiten to authenticated;
comment on table public.jagdzeiten is 'Statische Jagd- und Schonzeiten je Bundesland (Pflege per Migration; verbindlich ist die Landesverordnung)';

alter table public.reviere add column bundesland text not null default 'Niedersachsen'
  check (bundesland in ('Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen'));

insert into public.jagdzeiten (bundesland,wildart_id,klasse,jagdzeit_von,jagdzeit_bis,ganzjaehrig,schonzeit_text,sonderregel,gueltig_ab,quelle,quelle_url,sortierung) values
('Niedersachsen','rotwild','Hirsche, Kälber, Alttiere','08-01','01-31',false,'1.2.–31.7.',null,'2026-10-06','Q','U',1),
('Niedersachsen','rotwild','Schmaltiere, Schmalspießer','04-01','05-15',false,'1.2.–31.3. und 16.5.–31.7.',null,'2026-10-06','Q','U',2),
('Niedersachsen','rotwild','Schmaltiere, Schmalspießer','08-01','01-31',false,null,null,'2026-10-06','Q','U',3),
('Niedersachsen','damwild','Hirsche','08-01','01-31',false,'1.2.–31.7.',null,'2026-10-06','Q','U',4),
('Niedersachsen','damwild','Kälber, Alttiere','09-01','01-31',false,'1.2.–31.8.',null,'2026-10-06','Q','U',5),
('Niedersachsen','damwild','Schmaltiere, Schmalspießer','04-01','05-15',false,'1.2.–31.3. und 16.5.–31.7.',null,'2026-10-06','Q','U',6),
('Niedersachsen','damwild','Schmaltiere, Schmalspießer','08-01','01-31',false,null,null,'2026-10-06','Q','U',7),
('Niedersachsen','sikawild','Hirsche','08-01','01-31',false,'1.2.–31.7.',null,'2026-10-06','Q','U',8),
('Niedersachsen','sikawild','Kälber, Alttiere','09-01','01-31',false,'1.2.–31.8.',null,'2026-10-06','Q','U',9),
('Niedersachsen','sikawild','Schmaltiere, Schmalspießer','08-01','01-31',false,'1.2.–31.7.',null,'2026-10-06','Q','U',10),
('Niedersachsen','rehwild','Rehböcke','04-01','01-31',false,'1.2.–31.3.',null,'2026-10-06','Q','U',11),
('Niedersachsen','rehwild','Schmalrehe','04-01','05-15',false,'1.2.–31.3. und 16.5.–31.8.',null,'2026-10-06','Q','U',12),
('Niedersachsen','rehwild','Schmalrehe','09-01','01-31',false,null,null,'2026-10-06','Q','U',13),
('Niedersachsen','rehwild','Ricken, Kitze','09-01','01-31',false,'1.2.–31.8.',null,'2026-10-06','Q','U',14),
('Niedersachsen','muffelwild','Widder, Schafe, Lämmer, Schmalschafe','08-01','01-31',false,'1.2.–31.7.',null,'2026-10-06','Q','U',15),
('Niedersachsen','schwarzwild','Keiler, Bachen',null,null,true,'keine Schonzeit','Elterntierschutz nach § 22 Abs. 4 BJagdG bleibt unberührt: führende Bachen mit abhängigen Frischlingen dürfen nicht bejagt werden.','2026-10-06','Q','U',16),
('Niedersachsen','schwarzwild','Überläufer, Frischlinge',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',17),
('Niedersachsen','feldhase',null,'10-01','12-31',false,'1.1.–30.9.',null,'2026-10-06','Q','U',18),
('Niedersachsen','wildkaninchen','ohne Jungkaninchen','10-01','02-15',false,'16.2.–30.9.',null,'2026-10-06','Q','U',19),
('Niedersachsen','wildkaninchen','Jungkaninchen',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',20),
('Niedersachsen','steinmarder',null,'09-16','02-28',false,'1.3.–15.9.',null,'2026-10-06','Q','U',21),
('Niedersachsen','baummarder',null,'09-16','02-28',false,'1.3.–15.9.',null,'2026-10-06','Q','U',22),
('Niedersachsen','iltis',null,'08-01','02-28',false,'1.3.–31.7.',null,'2026-10-06','Q','U',23),
('Niedersachsen','hermelin',null,'08-01','02-28',false,'1.3.–31.7.',null,'2026-10-06','Q','U',24),
('Niedersachsen','dachs','ohne Jungdachse','08-01','01-31',false,'1.2.–31.7.',null,'2026-10-06','Q','U',25),
('Niedersachsen','dachs','Jungdachse',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',26),
('Niedersachsen','fuchs','ohne Jungfüchse','06-16','02-28',false,'1.3.–15.6.',null,'2026-10-06','Q','U',27),
('Niedersachsen','fuchs','Jungfüchse',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',28),
('Niedersachsen','waschbaer','ohne Jungtiere','07-16','03-31',false,'1.4.–15.7.',null,'2026-10-06','Q','U',29),
('Niedersachsen','waschbaer','Jungtiere',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',30),
('Niedersachsen','marderhund','ohne Jungtiere','09-01','02-28',false,'1.3.–31.8.',null,'2026-10-06','Q','U',31),
('Niedersachsen','marderhund','Jungtiere',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',32),
('Niedersachsen','mink','ohne Jungtiere','08-01','02-28',false,'1.3.–31.7.',null,'2026-10-06','Q','U',33),
('Niedersachsen','mink','Jungtiere',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',34),
('Niedersachsen','nutria',null,null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',35),
('Niedersachsen','rabenkraehe',null,'08-01','02-20',false,'21.2.–31.7.',null,'2026-10-06','Q','U',36),
('Niedersachsen','elster',null,'08-01','02-28',false,'1.3.–31.7.',null,'2026-10-06','Q','U',37),
('Niedersachsen','nilgans','ohne Jungtiere','07-16','01-31',false,'1.2.–15.7.',null,'2026-10-06','Q','U',38),
('Niedersachsen','nilgans','Jungnilgänse',null,null,true,'keine Schonzeit',null,'2026-10-06','Q','U',39),
('Niedersachsen','rebhuhn',null,'09-16','11-30',false,'1.12.–15.9.',null,'2026-10-06','Q','U',40),
('Niedersachsen','fasan',null,'10-01','01-15',false,'16.1.–30.9.',null,'2026-10-06','Q','U',41),
('Niedersachsen','ringeltaube','Alttauben','08-20','03-31',false,'1.4.–19.8.','Alttauben 20.8.–31.10. und 21.2.–31.3. nur zur Schadensabwehr, nur gegen Trupps auf Ackerland, Neueinsaaten oder Baumschulkulturen.','2026-10-06','Q','U',42),
('Niedersachsen','ringeltaube','Jungtauben',null,null,true,'keine Schonzeit','Jungtauben 21.2.–31.3. nur zur Schadensabwehr gegen Trupps auf Ackerland, Neueinsaaten oder Baumschulkulturen.','2026-10-06','Q','U',43),
('Niedersachsen','graugans',null,'07-16','02-15',false,'16.2.–15.7.','In den Vogelschutzgebieten der Anlage zur DVO-NJagdG nur 16.7.–30.11.','2026-10-06','Q','U',44),
('Niedersachsen','kanadagans',null,'07-16','02-15',false,'16.2.–15.7.','In den Vogelschutzgebieten der Anlage zur DVO-NJagdG nur 16.7.–30.11.','2026-10-06','Q','U',45),
('Niedersachsen','stockente',null,'09-01','01-15',false,'16.1.–31.8.',null,'2026-10-06','Q','U',46),
('Niedersachsen','waldschnepfe',null,'10-16','12-31',false,'1.1.–15.10.',null,'2026-10-06','Q','U',47);

update public.jagdzeiten set
  quelle = 'DVO-NJagdG, konsolidierte Fassung (Stand 06.10.2026; zuletzt geändert durch Verordnung vom 05.10.2026, Nds. GVBl. Nr. 84)',
  quelle_url = 'https://www.ml.niedersachsen.de/download/163729/Aktuelle_Jagdzeiten_in_Niedersachsen_Stand_06.10.2026_.pdf'
where quelle = 'Q';
