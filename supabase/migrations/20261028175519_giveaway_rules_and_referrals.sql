-- Official rules live in the app (/giveaway-rules), built from the giveaway's own details, and
-- refer-a-friend is harder to game: a friend only counts once they enter the same giveaway, and
-- an invite from what is really the same email (Gmail dots or +tags) doesn't count.

alter table public.giveaways
  add column prize_value numeric(10, 2) check (prize_value is null or prize_value >= 0),
  add column prize_provider text check (prize_provider is null or char_length(prize_provider) <= 120);

-- "Jane.Doe+win@gmail.com" and "janedoe@gmail.com" are the same inbox.
create or replace function private.normalize_email(email text)
returns text
language sql
immutable
as $$
  select case
    when split_part(lower(email), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else split_part(split_part(lower(email), '@', 1), '+', 1) || '@' || split_part(lower(email), '@', 2)
  end;
$$;

create or replace function private.grant_referral_bonus(member uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.giveaway_entries as ge (giveaway_id, user_id, kind, entries)
  select g.id, member, 'referral', least(3 * count(r.*), 15)::int
  from public.giveaways g
  join public.referrals r on r.referrer_id = member and r.created_at between g.starts_at and g.ends_at
  -- the friend has to have entered this giveaway too
  join public.giveaway_entries fe on fe.giveaway_id = g.id and fe.user_id = r.referred_id and fe.kind = 'enter'
  where now() between g.starts_at and g.ends_at
    and exists (select 1 from public.giveaway_entries e where e.giveaway_id = g.id and e.user_id = member and e.kind = 'enter')
  group by g.id
  on conflict (giveaway_id, user_id, kind) do update set entries = excluded.entries;
$$;
revoke execute on function private.grant_referral_bonus(uuid) from public, anon, authenticated;

-- Entering credits your own referrals and, if a friend invited you, theirs.
create or replace function private.on_save_or_enter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inviter uuid;
begin
  perform private.grant_save_event_bonus(new.user_id);
  if tg_table_name = 'giveaway_entries' then
    perform private.grant_referral_bonus(new.user_id);
    select r.referrer_id into inviter from public.referrals r where r.referred_id = new.user_id;
    if inviter is not null then perform private.grant_referral_bonus(inviter); end if;
  end if;
  return null;
end;
$$;

create or replace function public.claim_referral(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  friend uuid;
begin
  if me is null then return 'sign_in'; end if;
  if exists (select 1 from public.referrals where referred_id = me) then return 'already_claimed'; end if;
  if not exists (select 1 from public.profiles where id = me and created_at > now() - interval '7 days') then
    return 'too_late';
  end if;
  select id into friend from public.profiles where referral_code = upper(trim(claim_referral.code));
  if friend is null then return 'not_found'; end if;
  if friend = me then return 'own_code'; end if;
  if (select private.normalize_email(email) from auth.users where id = me)
     = (select private.normalize_email(email) from auth.users where id = friend) then
    return 'own_code';
  end if;
  insert into public.referrals (referred_id, referrer_id) values (me, friend);
  perform private.grant_referral_bonus(friend);
  return 'ok';
end;
$$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
