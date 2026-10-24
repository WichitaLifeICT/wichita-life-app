-- No prison stories, and no politics (parties, elections, Congress and the Statehouse, politicians).
-- Local city news (council, parks, roads) still shows.
insert into public.news_blocked_words (word) values
  ('prisons'), ('prisoner'), ('prisoners'), ('penitentiary'), ('correctional'), ('corrections officer'), ('parole'),
  ('gop'), ('republican'), ('republicans'), ('democrat'), ('democrats'), ('democratic'), ('dems'), ('maga'),
  ('politics'), ('political'), ('politician'), ('politicians'), ('partisan'), ('bipartisan'), ('conservative'),
  ('conservatives'), ('liberal'), ('liberals'), ('progressive'), ('congress'), ('congressional'), ('congressman'),
  ('congresswoman'), ('senate'), ('senator'), ('senators'), ('sen'), ('rep'), ('legislature'), ('legislative'),
  ('legislator'), ('legislators'), ('lawmaker'), ('lawmakers'), ('statehouse'), ('governor'), ('gov'), ('election'),
  ('elections'), ('campaign'), ('candidate'), ('candidates'), ('ballot'), ('ballots'), ('voters'), ('caucus'),
  ('impeach'), ('impeachment'), ('white house'), ('president'), ('presidential'), ('biden'), ('harris'), ('vance'),
  ('kobach'), ('laura kelly'), ('roger marshall'), ('jerry moran'), ('ron estes'), ('sharice davids'), ('tracey mann'),
  ('derek schmidt')
on conflict (word) do nothing;
