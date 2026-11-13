-- The full text of newsletter stories, so the app can show them on its own reading screen instead
-- of beehiiv's website (which asks app readers to subscribe again: its login doesn't carry into
-- the app). sync-beehiiv fills this from the beehiiv API for stories from the last 60 days.
create table public.post_content (
  post_id text primary key references public.posts (id) on delete cascade,
  html text not null check (char_length(html) <= 2000000),
  synced_at timestamptz not null default now()
);
alter table public.post_content enable row level security;
create policy "anyone can read stories that are shown" on public.post_content for select
  using (exists (select 1 from public.posts p where p.id = post_id and not coalesce(p.hidden, false)));
revoke insert, update, delete, truncate on public.post_content from anon, authenticated;
