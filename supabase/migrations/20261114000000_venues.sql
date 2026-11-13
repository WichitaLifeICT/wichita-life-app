-- Venues with checked addresses (owner, Nov 13: "do your own check of locations based on venue
-- address too"). The events calendar's venue and address are often wrong or missing: a listing
-- filed at just "Wichita, Kansas", a show title in the venue field, junk in the address. Each row
-- here was checked against the venue's own site or listing. When an event arrives (or syncs again)
--   * at a venue whose name or alias matches, it gets the checked name and address;
--   * with no real place but a title that names a venue (title_pattern), it gets that venue.
-- Fixes staff made on an event (locked venue/address) always win.
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 120),
  address text not null check (char_length(address) between 5 and 200),
  -- Other names the calendar uses for this venue, compared loosely (case and punctuation ignored).
  aliases text[] not null default '{}',
  -- Regex (case-insensitive) on event titles, used only when a listing has no real place.
  title_pattern text,
  source text check (source is null or char_length(source) <= 500),
  verified_on date,
  -- For the map, later.
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now()
);
alter table public.venues enable row level security;
create policy "venues are public" on public.venues for select using (true);
create policy "staff manage venues" on public.venues for all using (private.is_staff()) with check (private.is_staff());

-- Venue names compared loosely: case, punctuation and apostrophes ignored ("Mortdecai’s" = "Mortdecais").
create or replace function private.norm_venue(t text)
returns text language sql immutable set search_path = pg_catalog as $$
  select private.norm_text(replace(replace(coalesce(t, ''), '''', ''), '’', ''));
$$;

-- A listing with no real place: no venue, or a venue/address that's just the city or state.
create or replace function private.no_real_place(venue text, address text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(btrim(venue), '') ~* '^(|wichita|west wichita|east wichita|kansas|wichita,? (ks|kansas))$'
      or coalesce(btrim(address), '') ~* '^(|kansas|ks|wichita|wichita,? (ks|kansas))$';
$$;

create or replace function private.fix_event_place()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v public.venues;
begin
  -- Staff fixed this event's place by hand: leave it alone.
  if 'venue' = any(new.locked_fields) or 'address' = any(new.locked_fields) then
    return new;
  end if;
  select * into v from public.venues x
  where private.norm_venue(new.venue) <> ''
    and private.norm_venue(new.venue) in (select private.norm_venue(n) from unnest(x.name || x.aliases) n)
  limit 1;
  if v.id is null and private.no_real_place(new.venue, new.address) then
    select * into v from public.venues x
    where x.title_pattern is not null and new.title ~* x.title_pattern
    order by char_length(x.title_pattern) desc
    limit 1;
  end if;
  if v.id is not null then
    new.venue := v.name;
    new.address := v.address;
  end if;
  return new;
end;
$$;
revoke execute on function private.fix_event_place() from public, anon, authenticated;
-- Runs before events_keep_locked_fields (triggers fire in name order), which then restores any
-- staff-locked fields on a calendar sync.
create trigger events_fix_place before insert or update on public.events
  for each row execute function private.fix_event_place();

-- Re-check events when a venue is added or changed (also from the app's staff tools).
create or replace function private.refix_venue_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events e set venue = e.venue
  where e.starts_at > now() - interval '1 day'
    and (private.norm_venue(e.venue) in (select private.norm_venue(n) from unnest(new.name || new.aliases) n)
         or (new.title_pattern is not null and private.no_real_place(e.venue, e.address) and e.title ~* new.title_pattern));
  return null;
end;
$$;
revoke execute on function private.refix_venue_events() from public, anon, authenticated;
create trigger venues_refix_events after insert or update on public.venues
  for each row execute function private.refix_venue_events();
