-- Immigration enforcement is politics too, and animal deaths count as death stories.
-- ("ice" alone would block ice storms and skating, so only ICE phrases.)
insert into public.news_blocked_words (word) values
  ('detained'), ('detention'), ('deported'), ('deportation'), ('deportations'), ('deport'), ('immigration'),
  ('immigrant'), ('immigrants'), ('undocumented'), ('asylum'), ('by ice'), ('ice agents'), ('ice detention'),
  ('ice raid'), ('ice raids'), ('ice custody'), ('euthanize'), ('euthanized'), ('euthanasia'), ('put down')
on conflict (word) do nothing;
