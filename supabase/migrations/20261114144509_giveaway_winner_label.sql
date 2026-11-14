-- The winner as shown in the app ("Sarah M."), typed by staff once the winner has claimed the
-- prize, so people can see real members win. Never filled in automatically from the account.
alter table public.giveaways
  add column winner_label text check (winner_label is null or char_length(winner_label) between 1 and 40);
