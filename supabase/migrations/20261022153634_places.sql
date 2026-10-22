-- Places to eat, for "Where should I eat?" on Explore. Started from OpenStreetMap (sync-places,
-- monthly) and curated by staff: hide or close places, mark chains, star local picks, add a
-- note, or add places by hand. The sync only refreshes map details (name, address, cuisine,
-- website), never the staff fields.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  osm_id text unique,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('restaurant', 'fast_food', 'cafe', 'dessert', 'pub')),
  cuisine text[] not null default '{}',
  -- App groups like 'mexican', 'bbq', 'coffee' (see sync-places), used by the cuisine chips.
  categories text[] not null default '{}',
  address text,
  lat double precision,
  lng double precision,
  website text,
  phone text,
  -- OpenStreetMap's opening_hours text when it has one (e.g. "Mo-Sa 11:00-21:00"); often missing.
  opening_hours text,
  chain boolean not null default false,
  status text not null default 'active' check (status in ('active', 'hidden', 'closed')),
  local_pick boolean not null default false,
  note text check (note is null or char_length(note) <= 300),
  source text not null default 'osm' check (source in ('osm', 'staff')),
  synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index places_pick_idx on public.places (status, chain);
create index places_categories_idx on public.places using gin (categories);
alter table public.places enable row level security;

create policy "open places are public" on public.places for select
  using (status = 'active' or private.is_staff());
create policy "staff manage places" on public.places for all
  using (private.is_staff()) with check (private.is_staff());

-- One random place, optionally of a category and local-only, skipping ones already shown.
-- Runs with the caller's rights, so only open places come back.
create or replace function public.random_place(want_category text default null, local_only boolean default true, skip uuid[] default '{}')
returns setof public.places
language sql
volatile
set search_path = public
as $$
  select * from public.places
  where status = 'active'
    and (not local_only or not chain)
    and (want_category is null or want_category = any (categories))
    and not (id = any (skip))
  order by random() * (case when local_pick then 3 else 1 end) desc
  limit 1;
$$;
grant execute on function public.random_place(text, boolean, uuid[]) to anon, authenticated;
