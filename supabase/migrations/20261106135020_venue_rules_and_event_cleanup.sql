-- Two owner rules for events, run every hour after the syncs:
-- 1. Venue rules: at some venues only one kind of listing shows (Gilley's: live music only, no
--    promos, drink specials, dancing, trivia or karaoke). Matching listings without the kept tag,
--    or with a dropped tag, are hidden with hidden_reason = 'venue_rule'. Staff can un-hide one
--    (hidden_reason stays) and it isn't hidden again.
-- 2. Duplicates (previous migration), now never matching street-closure notices to the event.

create table private.venue_rules (
  venue_pattern text primary key,       -- ILIKE pattern on events.venue
  keep_tag text not null,               -- calendar tag a listing must have to show
  drop_tags text[] not null default '{}', -- calendar tags that hide a listing even with keep_tag
  note text
);
insert into private.venue_rules (venue_pattern, keep_tag, drop_tags, note) values
  ('%gilley%', 'Live Music', '{Karaoke}', 'Owner, Nov 6: only live music at Gilley''s, not promotions, food and drink, dancing, trivia or karaoke');

create or replace function private.apply_venue_rules(dry_run boolean default false)
returns table (hidden_title text, venue text, day date)
language sql security definer set search_path = public as $$
  with hits as (
    select e.id, e.title, e.venue, (e.starts_at at time zone 'America/Chicago')::date as day
    from public.events e
    join private.venue_rules r on e.venue ilike r.venue_pattern
    where not e.hidden and e.hidden_reason is null and e.starts_at > now() - interval '12 hours'
      and (not (r.keep_tag = any (coalesce(e.calendar_tags, '{}'))) or coalesce(e.calendar_tags, '{}') && r.drop_tags)
  ),
  done as (
    update public.events e set hidden = true, hidden_reason = 'venue_rule'
    from hits h where e.id = h.id and not dry_run
    returning e.id
  )
  select title, venue, day from hits order by day, title;
$$;
revoke all on function private.apply_venue_rules(boolean) from public, anon, authenticated;

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
      and e.title !~* 'closure'  -- a street-closure notice isn't the event itself
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

select cron.schedule('event-rules', '35 * * * *',
  'select count(*) from private.apply_venue_rules(); select count(*) from private.hide_duplicate_events();');
