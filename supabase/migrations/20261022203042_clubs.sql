-- Meet tab: three kinds of things to join.
--   1. Upcoming meetups. Some are hosted elsewhere and link out to sign up (signup_url),
--      e.g. the Wichita Life Dinner Club on wichitalife.dnnr.io, synced by sync-dinner-club.
--   2. Local clubs that already exist (run clubs, board game groups…): public.clubs, each with a link.
--   3. Wichita Life groups: interest groups inside the app (public.groups).
-- Members can suggest a club or a new group; suggestions stay hidden until staff approve them.

alter table public.meetups
  add column signup_url text check (signup_url ~ '^https?://'),
  -- Set for meetups copied from another site, so a re-sync updates the same row.
  add column source_key text unique;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (category in ('run', 'games', 'books', 'sports', 'social', 'arts', 'professional', 'other')),
  description text check (char_length(description) <= 300),
  -- When and where they meet, in words ("Saturdays 8am at Exploration Place").
  schedule text check (char_length(schedule) <= 200),
  url text not null check (url ~ '^https?://'),
  active boolean not null default true,
  pending boolean not null default false,
  suggested_by uuid references public.profiles (id) on delete set null,
  -- When staff last confirmed the schedule.
  verified_on date,
  created_at timestamptz not null default now()
);
create index clubs_active_idx on public.clubs (active, category);
alter table public.clubs enable row level security;

create policy "active clubs are public" on public.clubs for select
  using ((active and not pending) or private.is_staff());
create policy "staff manage clubs" on public.clubs for all
  using (private.is_staff()) with check (private.is_staff());

alter table public.groups
  add column pending boolean not null default false,
  add column suggested_by uuid references public.profiles (id) on delete set null;

alter policy "groups are public" on public.groups using (not pending or private.is_staff());

-- Up to 5 club or group suggestions a day per member, counted together.
create or replace function private.my_club_suggestions_today()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (
    (select count(*) from public.clubs where suggested_by = auth.uid() and created_at > now() - interval '1 day')
    + (select count(*) from public.groups g where g.suggested_by = auth.uid() and g.pending)
  )::int;
$$;

create policy "suggest clubs" on public.clubs for insert to authenticated
  with check (
    suggested_by = auth.uid()
    and pending
    and not active
    and verified_on is null
    and private.my_club_suggestions_today() < 5
  );
create policy "suggest groups" on public.groups for insert to authenticated
  with check (
    suggested_by = auth.uid()
    and pending
    and member_count = 0
    and private.my_club_suggestions_today() < 5
  );

-- Starting list, from the Wichita Life guides "Join the Club" (Jan 2025) and
-- "How to Make Friends in Wichita" (Jan 2026). Schedules change; each card says to check their page.
insert into public.clubs (name, category, description, schedule, url, verified_on) values
  ('Run 316', 'run', 'Good vibes and good miles. New and experienced runners welcome; runs start and end at local businesses.', 'Saturdays 8am, often at Greater Grounds (location varies)', 'https://www.instagram.com/run__316/', '2025-01-08'),
  ('Fortune 88 Run Club', 'run', 'Wichita run club.', null, 'https://www.facebook.com/p/Fortune-88-Run-Club-61579867207224/', null),
  ('Run Wichita', 'run', 'Open to all, regardless of ability.', 'Tue 6pm track at The Independent School · Thu 6pm social run · Sat 8am long run', 'https://runwichita.org/', '2025-01-08'),
  ('Exploration Place parkrun', 'run', 'Free, weekly, timed 5K run, jog or walk. All ages and abilities; a tail walker means you''re never last.', 'Saturdays 8am at Exploration Place', 'https://www.facebook.com/explorationplaceparkrun', '2025-01-08'),
  ('4 Mile Friday', 'run', '4 miles at about a 10-minute pace, sometimes with an ice bath after.', 'Fridays 6am in front of SweatHouz at Bradley Fair', 'https://www.instagram.com/4milefriday/', '2025-01-08'),
  ('3run6 Run Club', 'run', 'Half-price smoothies after the run.', 'Wednesdays 6pm at Fartleks, 535 W Douglas (Delano)', 'https://www.instagram.com/3run6.runclub/', '2025-01-08'),
  ('Elite Running Club', 'run', 'Wichita running club.', null, 'https://www.facebook.com/ERC316/', null),
  ('TJ''s Running', 'run', 'Training runs, advice and support. $25 a year.', null, 'https://www.facebook.com/groups/tjsrunning/', '2025-01-08'),
  ('F3 Wichita', 'sports', 'Fitness, fellowship and faith, for men.', null, 'https://www.f3wichita.com/', '2026-01-07'),
  ('Wichita Board Game Group', 'games', 'Casual, party and euro-style game nights. 1,000+ members.', 'Meets at Pink Elephant, MakeICT and Arena Hobbies', 'https://www.facebook.com/groups/wichitaboardgamegroup/', '2026-01-07'),
  ('Pink Elephant open game night', 'games', 'Open board game night at Pink Elephant Games and Cafe.', 'Tuesday nights', 'https://www.facebook.com/p/Pink-Elephant-Games-and-Cafe-100039086185124/', '2025-01-08'),
  ('Wichita Chess Coop', 'games', 'Chess for every level.', null, 'https://www.wichitachess.org/', '2026-01-07'),
  ('Watermark Books book clubs', 'books', 'Classic Book Club, French Book Club, Hot & Popular and more.', null, 'https://watermarkbooks.com/watermark-book-clubs', '2026-01-07'),
  ('Wichita Public Library book discussions', 'books', 'Book discussion groups at library branches.', null, 'https://www.wichitalibrary.org/services/pages/book-discussions.aspx', '2026-01-07'),
  ('Wichita Pickleball', 'sports', 'Find games and partners. 4,000+ members.', null, 'https://www.facebook.com/groups/ICTpickleball/', '2026-01-07'),
  ('Wichita Disc Golf', 'sports', 'Rounds, leagues and course news. 3,800+ members.', null, 'https://www.facebook.com/groups/ictdiscgolf/', '2026-01-07'),
  ('Wichita Ultimate Federation', 'sports', 'Ultimate frisbee leagues and pickup.', null, 'https://wichita.ultimatecentral.com/', '2026-01-07'),
  ('Kansas Cliff Club', 'sports', 'Climbing club.', null, 'https://www.facebook.com/p/Kansas-Cliff-Club-100045251847242/', '2026-01-07'),
  ('ICT YA Hangouts', 'social', 'Hangouts for young adults.', null, 'https://www.instagram.com/ict_hangouts/', '2026-01-07'),
  ('ICT Social Club', 'social', 'A social club for women.', null, 'https://www.instagram.com/ictsocialclub/', '2026-01-07'),
  ('W: A Community of Young Professionals', 'professional', 'Young professionals in Wichita.', null, 'https://wyoungpros.com/', '2026-01-07'),
  ('ICT Vinyl Club', 'arts', 'Records and the people who love them.', null, 'https://www.instagram.com/ictvinylclub/', '2026-01-07'),
  ('Wichita Sketch Club', 'arts', 'Drawing and painting together.', null, 'https://www.wichitasketchclub.com/', '2026-01-07'),
  ('DevICT', 'professional', 'Wichita''s developer community.', null, 'https://devict.org/', '2026-01-07'),
  ('1 Million Cups Wichita', 'professional', 'Weekly coffee and a local startup pitch.', null, 'https://www.1millioncups.com/s/account/0014W00002AqQgCQAV/wichita-ks', '2026-01-07');

-- The placeholder "ICT Run & Walk Club" group duplicates the real run clubs above.
delete from public.groups where slug = 'run-walk' and member_count = 0;
-- The sample dinner club meetup had a made-up date; sync-dinner-club adds the real ones.
delete from public.meetups where title = 'Wichita Life Dinner Club' and source_key is null
  and not exists (select 1 from public.rsvps r where r.meetup_id = meetups.id);

-- Dinner club dates: re-read wichitalife.dnnr.io every morning.
select cron.schedule('sync-dinner-club', '41 12 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-dinner-club',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
