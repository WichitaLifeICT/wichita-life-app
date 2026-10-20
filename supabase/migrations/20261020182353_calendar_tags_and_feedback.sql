-- The calendar's own tags on each event ("Live Music", "Rock", "Date Night"…), refreshed by
-- sync-events. Kept apart from `tags`, which staff edit by hand.
alter table public.events add column calendar_tags text[] not null default '{}';
create index events_calendar_tags_idx on public.events using gin (calendar_tags);

-- Feedback from the app. Anyone can send it (signed in or not); only staff can read it.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'idea' check (kind in ('idea', 'bug', 'love', 'other')),
  message text not null check (char_length(message) between 3 and 4000),
  contact_email text check (contact_email is null or char_length(contact_email) <= 200),
  screen text check (screen is null or char_length(screen) <= 200),
  platform text check (platform is null or char_length(platform) <= 40),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  staff_note text,
  created_at timestamptz not null default now()
);
create index feedback_status_created_idx on public.feedback (status, created_at desc);
alter table public.feedback enable row level security;

create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and status = 'new' and staff_note is null
  );
create policy "staff read feedback" on public.feedback for select using (private.is_staff());
create policy "staff update feedback" on public.feedback for update using (private.is_staff()) with check (private.is_staff());
create policy "staff delete feedback" on public.feedback for delete using (private.is_staff());
