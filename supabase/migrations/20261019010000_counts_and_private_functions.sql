-- Tighten what the public API exposes (from Supabase's security advisor):
-- 1. Replace the count views (which bypassed row level security) with count columns
--    kept up to date by triggers, so the tables' normal rules apply.
-- 2. Move helper and trigger functions into a `private` schema the API doesn't expose.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- is_staff() is used inside security policies, so members must still be able to run it,
-- just not call it directly over the API. Policies keep working after the move.
alter function public.is_staff() set schema private;

-- Trigger functions run on their own; nobody needs to call them.
alter function public.handle_new_user() set schema private;
alter function public.rsvp_apply_capacity() set schema private;
alter function public.rsvp_promote_waitlist() set schema private;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.rsvp_apply_capacity() from public, anon, authenticated;
revoke execute on function private.rsvp_promote_waitlist() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Count columns
-- ---------------------------------------------------------------------------

drop view public.meetup_counts;
drop view public.group_counts;
drop view public.giveaway_counts;
drop view public.thread_reply_counts;

alter table public.meetups add column going_count int not null default 0, add column waitlist_count int not null default 0;
alter table public.groups add column member_count int not null default 0;
alter table public.giveaways add column entrant_count int not null default 0;
alter table public.threads add column reply_count int not null default 0;

create or replace function private.refresh_meetup_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid := coalesce(new.meetup_id, old.meetup_id);
begin
  update public.meetups set
    going_count = (select count(*) from public.rsvps where meetup_id = mid and status = 'going'),
    waitlist_count = (select count(*) from public.rsvps where meetup_id = mid and status = 'waitlist')
  where id = mid;
  return null;
end;
$$;

create or replace function private.refresh_group_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid := coalesce(new.group_id, old.group_id);
begin
  update public.groups set member_count = (select count(*) from public.group_members where group_id = gid) where id = gid;
  return null;
end;
$$;

create or replace function private.refresh_giveaway_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid := coalesce(new.giveaway_id, old.giveaway_id);
begin
  update public.giveaways set entrant_count = (select count(distinct user_id) from public.giveaway_entries where giveaway_id = gid)
  where id = gid;
  return null;
end;
$$;

create or replace function private.refresh_thread_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid := coalesce(new.thread_id, old.thread_id);
begin
  update public.threads set reply_count = (select count(*) from public.replies where thread_id = tid and status = 'approved')
  where id = tid;
  return null;
end;
$$;

revoke execute on function private.refresh_meetup_counts() from public, anon, authenticated;
revoke execute on function private.refresh_group_counts() from public, anon, authenticated;
revoke execute on function private.refresh_giveaway_counts() from public, anon, authenticated;
revoke execute on function private.refresh_thread_counts() from public, anon, authenticated;

create trigger rsvps_refresh_counts after insert or update or delete on public.rsvps
  for each row execute function private.refresh_meetup_counts();
create trigger group_members_refresh_counts after insert or delete on public.group_members
  for each row execute function private.refresh_group_counts();
create trigger giveaway_entries_refresh_counts after insert or delete on public.giveaway_entries
  for each row execute function private.refresh_giveaway_counts();
create trigger replies_refresh_counts after insert or update or delete on public.replies
  for each row execute function private.refresh_thread_counts();

-- Backfill
update public.meetups m set
  going_count = (select count(*) from public.rsvps r where r.meetup_id = m.id and r.status = 'going'),
  waitlist_count = (select count(*) from public.rsvps r where r.meetup_id = m.id and r.status = 'waitlist');
update public.groups g set member_count = (select count(*) from public.group_members gm where gm.group_id = g.id);
update public.giveaways g set entrant_count = (select count(distinct user_id) from public.giveaway_entries e where e.giveaway_id = g.id);
update public.threads t set reply_count = (select count(*) from public.replies r where r.thread_id = t.id and r.status = 'approved');
