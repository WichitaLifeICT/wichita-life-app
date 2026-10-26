-- Question of the day on the Today tab. It's a poll marked `daily` (one per day, Central time).
-- Answering while a giveaway runs enters you in it and adds +1 entry for each day you answer.
-- Daily questions don't count toward the once-per-giveaway Wichita votes bonus.

alter table public.polls add column daily boolean not null default false;
create index polls_daily_idx on public.polls (starts_at) where daily;

alter table public.giveaway_entries drop constraint giveaway_entries_kind_check;
alter table public.giveaway_entries add constraint giveaway_entries_kind_check
  check (kind in ('enter', 'newsletter', 'save_event', 'referral', 'poll_vote', 'daily_question'));

-- Days answered during each running giveaway become that many entries (kept as one row, like saved events).
create or replace function private.grant_daily_question_entries(member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  days int;
begin
  for g in select id, starts_at, ends_at from public.giveaways where now() between starts_at and ends_at loop
    select count(distinct (v.created_at at time zone 'America/Chicago')::date) into days
    from public.poll_votes v
    join public.polls p on p.id = v.poll_id
    where p.daily and v.user_id = member and v.created_at between g.starts_at and g.ends_at;
    continue when days = 0;
    insert into public.giveaway_entries (giveaway_id, user_id, kind, entries)
    values (g.id, member, 'enter', 1)
    on conflict do nothing;
    insert into public.giveaway_entries as ge (giveaway_id, user_id, kind, entries)
    values (g.id, member, 'daily_question', days)
    on conflict (giveaway_id, user_id, kind) do update set entries = excluded.entries;
  end loop;
end;
$$;
revoke execute on function private.grant_daily_question_entries(uuid) from public, anon, authenticated;

-- The Wichita votes bonus only counts regular votes.
create or replace function private.grant_poll_vote_bonus(member uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.giveaway_entries (giveaway_id, user_id, kind, entries)
  select g.id, member, 'poll_vote', 1
  from public.giveaways g
  where now() between g.starts_at and g.ends_at
    and exists (select 1 from public.giveaway_entries e where e.giveaway_id = g.id and e.user_id = member and e.kind = 'enter')
    and exists (
      select 1 from public.poll_votes v join public.polls p on p.id = v.poll_id
      where not p.daily and v.user_id = member and v.created_at between g.starts_at and g.ends_at)
  on conflict do nothing;
$$;

create or replace function private.on_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.grant_daily_question_entries(new.user_id);
  perform private.grant_poll_vote_bonus(new.user_id);
  return null;
end;
$$;
