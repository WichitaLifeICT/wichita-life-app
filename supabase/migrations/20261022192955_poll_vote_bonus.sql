-- Voting in a Wichita vote while a giveaway is running earns +1 entry, once per giveaway
-- (like saving an event). Voting before entering counts too, as long as it was during the giveaway.
alter table public.giveaway_entries drop constraint giveaway_entries_kind_check;
alter table public.giveaway_entries add constraint giveaway_entries_kind_check
  check (kind in ('enter', 'newsletter', 'save_event', 'referral', 'poll_vote'));

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
    and exists (select 1 from public.poll_votes v where v.user_id = member and v.created_at between g.starts_at and g.ends_at)
  on conflict do nothing;
$$;
revoke execute on function private.grant_poll_vote_bonus(uuid) from public, anon, authenticated;

create or replace function private.on_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.grant_poll_vote_bonus(new.user_id);
  return null;
end;
$$;
revoke execute on function private.on_poll_vote() from public, anon, authenticated;
create trigger poll_votes_bonus after insert on public.poll_votes
  for each row execute function private.on_poll_vote();

-- Entering a giveaway also picks up a vote made earlier during it.
create or replace function private.on_save_or_enter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.grant_save_event_bonus(new.user_id);
  if tg_table_name = 'giveaway_entries' then
    perform private.grant_referral_bonus(new.user_id);
    perform private.grant_poll_vote_bonus(new.user_id);
  end if;
  return null;
end;
$$;
