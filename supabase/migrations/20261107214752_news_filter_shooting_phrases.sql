-- Shooting stories without blocking the word "shot" itself (flu shots, basketball).
insert into public.news_blocked_words (word) values
  ('being shot'), ('was shot'), ('were shot'), ('been shot'), ('got shot'), ('gets shot'),
  ('people shot'), ('man shot'), ('men shot'), ('woman shot'), ('women shot'), ('teen shot'), ('teens shot'),
  ('child shot'), ('boy shot'), ('girl shot'), ('shot during'),
  ('shot in the face'), ('shot in the head'), ('shot in the chest'), ('shot in the back'), ('shot multiple times'),
  ('gunshot'), ('gunshots'), ('gunshot wound'), ('gunshot wounds')
on conflict (word) do nothing;
