-- Keep gross restaurant-inspection details and police / missing-person stories out of the news feed.
-- (Adding words re-checks every headline and summary right away.)
insert into public.news_blocked_words (word) values
  -- gross
  ('urine'), ('urinate'), ('urinating'), ('pee'), ('feces'), ('fecal'), ('excrement'), ('poop'),
  ('vomit'), ('vomiting'), ('diarrhea'), ('sewage'), ('maggot'), ('maggots'), ('bugs'), ('insects'),
  ('infestation'), ('infested'), ('pests'), ('rancid'), ('stench'), ('filth'),
  -- police, investigations and missing people
  ('kbi'), ('fbi'), ('police'), ('sheriff'), ('deputies'), ('most wanted'), ('search warrant'),
  ('investigation'), ('investigations'), ('investigating'), ('investigators'),
  ('missing'), ('missing person'), ('runaway'), ('amber alert'), ('silver alert')
on conflict (word) do nothing;
