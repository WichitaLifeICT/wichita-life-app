-- Group boards: each Wichita Life group has its own board (threads with a group_id).
-- Anyone can read; only members of the group can start a post there (see board_post_policy).
alter table public.threads drop constraint threads_category_check;
alter table public.threads add constraint threads_category_check
  check (category in ('recommendations', 'ask', 'free_for_sale', 'lost_found', 'group'));
alter table public.threads add column group_id uuid references public.groups (id) on delete cascade;
alter table public.threads add constraint threads_group_posts check ((category = 'group') = (group_id is not null));
create index threads_group_idx on public.threads (group_id, created_at desc) where group_id is not null;
