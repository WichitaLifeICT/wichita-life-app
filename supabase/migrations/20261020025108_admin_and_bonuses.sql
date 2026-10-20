-- Staff tools and the last two giveaway bonuses (newsletter, refer a friend).

-- ---------------------------------------------------------------------------
-- Staff: accounts on this list become admins when they first sign in.
-- ---------------------------------------------------------------------------
create table private.staff_emails (
  email text primary key check (email = lower(email)),
  role text not null default 'admin' check (role in ('moderator', 'admin'))
);
insert into private.staff_emails (email) values ('wichitalifeict@gmail.com');

-- Profiles also get a short invite code for "refer a friend".
alter table public.profiles add column referral_code text unique;
create or replace function private.new_referral_code()
returns text
language sql
volatile
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;
update public.profiles set referral_code = private.new_referral_code() where referral_code is null;
alter table public.profiles alter column referral_code set default private.new_referral_code();
alter table public.profiles alter column referral_code set not null;

-- Members edit their name, interests and onboarding only (not role or invite code).
revoke update on public.profiles from authenticated;
grant update (display_name, interests, onboarded_at) on public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  display text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  staff_role text;
begin
  if display = '' and full_name <> '' then
    display := split_part(full_name, ' ', 1);
    if position(' ' in full_name) > 0 then
      display := display || ' ' || left(split_part(full_name, ' ', array_length(string_to_array(full_name, ' '), 1)), 1) || '.';
    end if;
  end if;
  select s.role into staff_role from private.staff_emails s where s.email = lower(new.email);
  insert into public.profiles (id, display_name, role) values (new.id, left(display, 40), coalesce(staff_role, 'member'));
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

-- Accounts that already exist when an email is added to the list.
update public.profiles p set role = s.role
  from auth.users u join private.staff_emails s on s.email = lower(u.email)
  where u.id = p.id and p.role = 'member';

-- ---------------------------------------------------------------------------
-- Refer a friend: +3 entries per friend who joins during the giveaway, up to 15.
-- ---------------------------------------------------------------------------
create table public.referrals (
  referred_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id, created_at);
alter table public.referrals enable row level security;
create policy "see your referrals" on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid() or private.is_staff());

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
  where now() between g.starts_at and g.ends_at
    and exists (select 1 from public.giveaway_entries e where e.giveaway_id = g.id and e.user_id = member and e.kind = 'enter')
  group by g.id
  on conflict (giveaway_id, user_id, kind) do update set entries = excluded.entries;
$$;
revoke execute on function private.grant_referral_bonus(uuid) from public, anon, authenticated;

-- Entering also picks up referrals made before you entered.
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
  end if;
  return null;
end;
$$;

-- Called by a new member with a friend's code. Only works for accounts made in the last week.
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
  insert into public.referrals (referred_id, referrer_id) values (me, friend);
  perform private.grant_referral_bonus(friend);
  return 'ok';
end;
$$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff: draw a winner (weighted by entries) and see who's going to a meetup.
-- ---------------------------------------------------------------------------
create or replace function public.draw_giveaway_winner(giveaway uuid)
returns table (user_id uuid, display_name text, email text, entries int)
language plpgsql
security definer
set search_path = public
as $$
declare
  winner uuid;
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  select t.user_id into winner
  from (
    select e.user_id, sum(e.entries) as n
    from public.giveaway_entries e where e.giveaway_id = draw_giveaway_winner.giveaway
    group by e.user_id
  ) t
  order by -ln(1 - random()) / t.n
  limit 1;
  if winner is null then raise exception 'no entries yet'; end if;
  update public.giveaways set winner_user_id = winner where id = draw_giveaway_winner.giveaway;
  return query select * from public.giveaway_winner(draw_giveaway_winner.giveaway);
end;
$$;

create or replace function public.giveaway_winner(giveaway uuid)
returns table (user_id uuid, display_name text, email text, entries int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text,
           (select sum(e.entries)::int from public.giveaway_entries e where e.giveaway_id = giveaway_winner.giveaway and e.user_id = p.id)
    from public.giveaways g
    join public.profiles p on p.id = g.winner_user_id
    join auth.users u on u.id = p.id
    where g.id = giveaway_winner.giveaway;
end;
$$;

create or replace function public.meetup_attendees(meetup uuid)
returns table (user_id uuid, display_name text, email text, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text, r.status, r.created_at
    from public.rsvps r
    join public.profiles p on p.id = r.user_id
    join auth.users u on u.id = r.user_id
    where r.meetup_id = meetup_attendees.meetup
    order by r.status, r.created_at;
end;
$$;

revoke execute on function public.draw_giveaway_winner(uuid) from public, anon;
revoke execute on function public.giveaway_winner(uuid) from public, anon;
revoke execute on function public.meetup_attendees(uuid) from public, anon;
grant execute on function public.draw_giveaway_winner(uuid) to authenticated;
grant execute on function public.giveaway_winner(uuid) to authenticated;
grant execute on function public.meetup_attendees(uuid) to authenticated;
