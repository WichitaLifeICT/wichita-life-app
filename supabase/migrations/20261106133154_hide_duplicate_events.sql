-- Hide likely duplicate events automatically (the calendar sometimes lists one thing two or
-- three times, e.g. an exhibit and its opening reception, or the same show from two feeds).
-- Two upcoming events on the same Wichita day are duplicates when their titles match (equal,
-- or one title's words appear whole inside the other's) and either the venue matches or they
-- start within 15 minutes of each other and end at the same time. Linked duplicates form a
-- group; the best listing stays (sponsored, then hand-edited, then with a real time, then the
-- most detailed title and description) and the rest are hidden with duplicate_of set.
-- If staff un-hide one, it keeps duplicate_of and is never hidden again by this.

alter table public.events add column duplicate_of uuid references public.events (id) on delete set null,
  add column hidden_reason text;
create index events_duplicate_of_idx on public.events (duplicate_of) where duplicate_of is not null;

create or replace function private.norm_text(t text)
returns text language sql immutable set search_path = pg_catalog as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', ' ', 'g'), '^the ', ''));
$$;

-- Titles too generic to match on their own words ("Trivia" at two bars isn't one event).
create or replace function private.generic_title(t text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select t = any (array['trivia', 'trivia night', 'karaoke', 'karaoke night', 'bingo', 'open mic', 'open mic night',
    'live music', 'music', 'comedy', 'comedy night', 'yoga', 'story time', 'storytime', 'happy hour', 'brunch',
    'market', 'farmers market', 'dj', 'jazz', 'dance', 'game night', 'run club', 'tour', 'class', 'workshop'])
    or length(t) < 5;
$$;

create or replace function private.words_in(short text, long text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select short <> '' and (short = long or (' ' || long || ' ') like ('% ' || short || ' %'));
$$;

-- Returns the events it hid and the listing it kept for each. dry_run = true only reports them.
create or replace function private.hide_duplicate_events(dry_run boolean default false)
returns table (hidden_title text, kept_title text, day date)
language plpgsql security definer set search_path = public as $$
begin
  -- A kept listing that left the calendar: show its hidden duplicates again (they're re-checked below).
  if not dry_run then
    update public.events set hidden = false, hidden_reason = null
      where hidden and hidden_reason = 'duplicate' and duplicate_of is null;
  end if;
  create temp table if not exists _dup_pairs (a uuid, b uuid) on commit drop;
  truncate _dup_pairs;
  with ev as (
    select e.id, e.title, private.norm_text(e.title) as t, private.norm_text(e.venue) as v,
      e.starts_at, e.ends_at, (e.starts_at at time zone 'America/Chicago')::date as d
    from public.events e
    where not e.hidden and e.starts_at > now() - interval '12 hours' and e.starts_at < now() + interval '90 days'
  )
  insert into _dup_pairs
  select x.id, y.id from ev x join ev y on x.d = y.d and x.id < y.id
  where (
      x.t = y.t
      or (length(x.t) <= length(y.t) and not private.generic_title(x.t) and private.words_in(x.t, y.t))
      or (length(y.t) < length(x.t) and not private.generic_title(y.t) and private.words_in(y.t, x.t))
    )
    and (
      (x.v not in ('', 'wichita', 'wichita ks', 'tbd', 'online') and y.v not in ('', 'wichita', 'wichita ks', 'tbd', 'online')
        and (private.words_in(x.v, y.v) or private.words_in(y.v, x.v)))
      or (abs(extract(epoch from x.starts_at - y.starts_at)) <= 900 and x.ends_at is not null and x.ends_at = y.ends_at)
      or (x.t = y.t and abs(extract(epoch from x.starts_at - y.starts_at)) <= 900)
    );

  return query
  with recursive edges as (
    select a, b from _dup_pairs union select b, a from _dup_pairs
  ),
  walk (root, node) as (
    select a, a from _dup_pairs union select b, b from _dup_pairs
    union
    select w.root, e.b from walk w join edges e on e.a = w.node
  ),
  groups as (
    select node as id, min(root::text) as grp from walk group by node
  ),
  ranked as (
    select g.grp, e.id, e.title, e.duplicate_of,
      row_number() over (partition by g.grp order by coalesce(e.is_sponsored, false) desc, (coalesce(cardinality(e.locked_fields), 0) > 0) desc,
        (not coalesce(e.all_day, false) and not coalesce(e.time_tbd, false)) desc, length(e.title) desc, length(coalesce(e.description, '')) desc, e.id) as rn
    from groups g join public.events e on e.id = g.id
  ),
  keep as (select grp, id, title from ranked where rn = 1),
  losers as (
    select r.id, r.title, k.id as keep_id, k.title as keep_title
    from ranked r join keep k on k.grp = r.grp
    where r.rn > 1 and r.duplicate_of is null
  ),
  done as (
    update public.events e set hidden = true, hidden_reason = 'duplicate', duplicate_of = l.keep_id
    from losers l where e.id = l.id and not dry_run
    returning e.id
  )
  select l.title, l.keep_title, (e.starts_at at time zone 'America/Chicago')::date
  from losers l join public.events e on e.id = l.id
  order by 3, 2;
end $$;
revoke all on function private.hide_duplicate_events(boolean) from public, anon, authenticated;

