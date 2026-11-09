update wildarten set sortierung = case id
  when 'feldhase' then 1 when 'rehwild' then 2 when 'fuchs' then 3 when 'waschbaer' then 4
  when 'dachs' then 5 when 'schwarzwild' then 6 when 'rebhuhn' then 7 when 'waldschnepfe' then 8
  else sortierung end
where id in ('feldhase','rehwild','fuchs','waschbaer','dachs','schwarzwild','rebhuhn','waldschnepfe');
