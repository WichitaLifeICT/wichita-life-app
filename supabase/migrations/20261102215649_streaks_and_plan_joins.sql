-- Stickier: question-of-the-day streaks, "I'm in" on plans, and plan reminders.

-- Streaks --------------------------------------------------------------------------------
-- A streak is the run of consecutive Wichita days a member answered the question of the day,
-- ending today (or yesterday, if they haven't answered yet today). During a giveaway, every 7th
-- day in a row adds +1 bonus entry ('streak'), on top of the +1 a day for answering.

alter table public.giveaway_entries drop constraint giveaway_entries_kind_check;
alter table public.giveaway_entries add constraint giveaway_entries_kind_check
  check (kind in ('enter', 'newsletter', 'save_event', 'referral', 'poll_vote', 'daily_question', 'streak'));

-- Each day a member answered, with its position in that run of consecutive days.
create or replace function private.daily_answer_runs(member uuid)
returns table (day date, n int)
language sql stable security definer set search_path = public as $$
  with days as (
    select distinct (v.created_at at time zone 'America/Chicago')::date as day
    from public.poll_votes v join public.polls p on p.id = v.poll_id
    where p.daily and v.user_id = member
  ), runs as (
    select day, day - (row_number() over (order by day))::int as grp from days
  )
  select day, (row_number() over (partition by grp order by day))::int as n from runs;
$$;
revoke execute on function private.daily_answer_runs(uuid) from public, anon, authenticated;

create or replace function public.my_streak()
returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select n from private.daily_answer_runs(auth.uid())
    where day >= (now() at time zone 'America/Chicago')::date - 1
    order by day desc limit 1
  ), 0);
$$;
grant execute on function public.my_streak() to authenticated;

create or replace function private.grant_daily_question_entries(member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  days int;
  sevens int;
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
    select count(*) into sevens from private.daily_answer_runs(member) r
    where r.n % 7 = 0
      and r.day between (g.starts_at at time zone 'America/Chicago')::date and (g.ends_at at time zone 'America/Chicago')::date;
    if sevens > 0 then
      insert into public.giveaway_entries as ge (giveaway_id, user_id, kind, entries)
      values (g.id, member, 'streak', sevens)
      on conflict (giveaway_id, user_id, kind) do update set entries = excluded.entries;
    end if;
  end loop;
end;
$$;
revoke execute on function private.grant_daily_question_entries(uuid) from public, anon, authenticated;

-- "I'm in" ---------------------------------------------------------------------------------
-- Anyone who can see a plan (by its shared link or because it's public) can say they're in.
-- The owner and everyone viewing see who's in; joiners get the plan's reminder too.

create table public.plan_joins (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
alter table public.plan_joins enable row level security;
create policy "see your own joins" on public.plan_joins for select to authenticated using (user_id = auth.uid());

-- Returns true when you're now in, false when you're out.
create or replace function public.set_plan_join(joining boolean, plan uuid default null, code text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare p public.plans;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;
  select * into p from public.plans x
  where (set_plan_join.plan is not null and x.id = set_plan_join.plan and x.public_status = 'approved')
     or (set_plan_join.code is not null and x.share_code = set_plan_join.code);
  if p.id is null then
    raise exception 'Plan not found' using errcode = 'no_data_found';
  end if;
  if p.owner_id = auth.uid() then return false; end if;
  if joining then
    insert into public.plan_joins (plan_id, user_id) values (p.id, auth.uid()) on conflict do nothing;
  else
    delete from public.plan_joins where plan_id = p.id and user_id = auth.uid();
  end if;
  return joining;
end $$;
revoke all on function public.set_plan_join(boolean, uuid, text) from public, anon;
grant execute on function public.set_plan_join(boolean, uuid, text) to authenticated;

-- Tell the plan's owner someone's in (push-jobs sends it right away).
create or replace function private.on_plan_join()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := jsonb_build_object('job', 'plan_join', 'plan', new.plan_id, 'member', new.user_id),
    timeout_milliseconds := 30000
  );
  return null;
end $$;
create trigger plan_join_notify after insert on public.plan_joins for each row execute function private.on_plan_join();

-- get_plan also says who's in and whether you are.
create or replace function public.get_plan(plan uuid default null, code text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'starts_on', p.starts_on,
    'ends_on', p.ends_on,
    'mine', p.owner_id = auth.uid(),
    'share_code', case when p.owner_id = auth.uid() then p.share_code end,
    'public_status', case when p.owner_id = auth.uid() or private.is_staff() then p.public_status
      when p.public_status = 'approved' then 'approved' end,
    'staff_pick', p.staff_pick,
    'owner_name', split_part(pr.display_name, ' ', 1),
    'im_in', exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = auth.uid()),
    'going', coalesce((
      select jsonb_agg(split_part(jp.display_name, ' ', 1) order by j.created_at)
      from public.plan_joins j join public.profiles jp on jp.id = j.user_id
      where j.plan_id = p.id
        and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = j.user_id)
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'ref_id', i.ref_id, 'on_date', i.on_date, 'at_time', i.at_time, 'note', i.note,
        'ref', case i.kind
          when 'event' then (select jsonb_build_object('title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
              'all_day', e.all_day, 'time_tbd', e.time_tbd, 'venue', e.venue, 'address', e.address)
            from public.events e where e.id = i.ref_id and not e.hidden)
          when 'special' then (select jsonb_build_object('title', w.title, 'kind', w.kind, 'venue', w.venue, 'address', w.address,
              'days', w.days, 'starts', w.starts, 'ends', w.ends)
            from public.weekly_specials w where w.id = i.ref_id and w.active and not w.pending)
          when 'place' then (select jsonb_build_object('title', l.name, 'address', l.address, 'website', l.website, 'cuisine', l.cuisine)
            from public.places l where l.id = i.ref_id and l.status = 'active')
          when 'meetup' then (select jsonb_build_object('title', m.title, 'starts_at', m.starts_at, 'area', m.area)
            from public.meetups m where m.id = i.ref_id and m.status in ('open', 'closed'))
        end
      ) order by i.created_at)
      from public.plan_items i where i.plan_id = p.id
    ), '[]'::jsonb)
  )
  from public.plans p
  join public.profiles pr on pr.id = p.owner_id
  where (get_plan.plan is not null and p.id = get_plan.plan
          and (p.owner_id = auth.uid() or p.public_status = 'approved'
               or (p.public_status <> 'private' and private.is_staff())))
     or (get_plan.code is not null and p.share_code = get_plan.code);
$$;
grant execute on function public.get_plan(uuid, text) to anon, authenticated;

-- Plan reminders: the evening before a plan's first day (push-jobs 'reminders').
alter table public.plans add column reminded_at timestamptz;
