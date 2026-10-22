-- Things that happen every week at the same place: happy hours, trivia, karaoke, open mics.
-- Staff keep the list in Staff tools > Weekly; everyone can read active ones. `verified_on`
-- is the last day staff confirmed it's still running, so stale ones are easy to spot.
create table public.weekly_specials (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('happy_hour', 'trivia', 'karaoke', 'open_mic', 'live_music', 'game_night', 'food_deal', 'other')),
  title text not null check (char_length(title) between 2 and 120),
  venue text not null check (char_length(venue) between 2 and 120),
  address text check (address is null or char_length(address) <= 200),
  -- Days of the week it runs, 0 = Sunday ... 6 = Saturday.
  days smallint[] not null check (cardinality(days) > 0 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  starts time,
  ends time,
  details text check (details is null or char_length(details) <= 1000),
  url text check (url is null or url ~ '^https?://'),
  active boolean not null default true,
  verified_on date,
  created_at timestamptz not null default now()
);
create index weekly_specials_active_idx on public.weekly_specials (active, kind);
alter table public.weekly_specials enable row level security;

create policy "active weekly specials are public" on public.weekly_specials for select
  using (active or private.is_staff());
create policy "staff manage weekly specials" on public.weekly_specials for all
  using (private.is_staff()) with check (private.is_staff());
