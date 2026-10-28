-- Deleting an account must always work (Apple and Google require it). A giveaway winner or a
-- staff reviewer used to block it; now those links clear and the giveaway/post stays.
alter table public.giveaways drop constraint giveaways_winner_user_id_fkey;
alter table public.giveaways add constraint giveaways_winner_user_id_fkey
  foreign key (winner_user_id) references public.profiles (id) on delete set null;
alter table public.threads drop constraint threads_reviewed_by_fkey;
alter table public.threads add constraint threads_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles (id) on delete set null;
