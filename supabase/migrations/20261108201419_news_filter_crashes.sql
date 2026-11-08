-- No crash or wreck stories in the news feed.
insert into public.news_blocked_words (word) values
  ('crash'), ('crashes'), ('crashed'), ('wreck'), ('wrecks'), ('wrecked'),
  ('collision'), ('collisions'), ('rollover'), ('rolled over'), ('plane crash'), ('car crash')
on conflict (word) do nothing;
