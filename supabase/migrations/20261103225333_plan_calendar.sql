-- Plans in the phone calendar: a one-tap "Add plan to calendar" file and a private calendar feed
-- (plans you made or are in, plus saved events) that phone and Google calendars subscribe to.
-- Each member has a secret calendar_token in their link; only the calendar function reads the items.

alter table public.profiles add column calendar_token text unique
  default replace(gen_random_uuid()::text, '-', '');
update public.profiles set calendar_token = replace(gen_random_uuid()::text, '-', '') where calendar_token is null;
alter table public.profiles alter column calendar_token set not null;

-- Your calendar link's secret, or a new one (reset = true) if you shared it by mistake.
create or replace function public.my_calendar_token(reset boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = 'insufficient_privilege'; end if;
  if reset then
    update public.profiles set calendar_token = replace(gen_random_uuid()::text, '-', '')
      where id = auth.uid() returning calendar_token into t;
  else
    select calendar_token into t from public.profiles where id = auth.uid();
  end if;
  return t;
end $$;
revoke all on function public.my_calendar_token(boolean) from public, anon;
grant execute on function public.my_calendar_token(boolean) to authenticated;

-- What goes in the calendar for a token: one plan (plan given) or the whole feed. Times are real
-- instants; all_day_on/all_day_until (inclusive) are for items with a day but no time.
create or replace function public.calendar_items(token text, plan uuid default null)
returns table (
  uid text, title text, starts_at timestamptz, ends_at timestamptz, all_day_on date, all_day_until date,
  location text, url text, details text, calendar_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  member uuid;
  today date := (now() at time zone 'America/Chicago')::date;
  one public.plans;
begin
  select id into member from public.profiles where calendar_token = token;
  if member is null or token is null or length(token) < 32 then return; end if;

  if plan is not null then
    select * into one from public.plans p where p.id = plan
      and (private.can_see_plan(p, member) or exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = member));
    if one.id is null then return; end if;
  end if;

  return query
  with my_plans as (
    select p.* from public.plans p
    where (plan is not null and p.id = one.id)
       or (plan is null and (p.owner_id = member
           or exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = member)))
  ),
  items as (
    select i.id, i.kind, i.note, p.id as plan_id, p.title as plan_title, p.starts_on, p.ends_on,
      e.id as event_id, e.title as e_title, e.starts_at as e_starts, e.ends_at as e_ends, (e.all_day or e.time_tbd) as e_untimed,
      e.venue as e_venue, e.address as e_address,
      m.title as m_title, m.starts_at as m_starts, m.area as m_area,
      w.id as special_id, w.title as w_title, w.venue as w_venue, w.address as w_address, w.days as w_days, w.starts as w_starts, w.ends as w_ends,
      l.name as l_name, l.address as l_address,
      a.name as a_name, nullif(a.address, '') as a_address,
      i.address as spot_address,
      -- the day: the event's own day, the day picked on the plan, or a weekly special's next night
      case
        when i.kind in ('event', 'meetup') then null
        when i.on_date is not null then i.on_date
        when i.kind = 'special' and w.days is not null then (
          select d::date from generate_series(greatest(coalesce(p.starts_on, today), today), greatest(coalesce(p.starts_on, today), today) + 6, interval '1 day') d
          where extract(dow from d)::smallint = any (w.days) and (p.ends_on is null or d::date <= p.ends_on)
          order by d limit 1)
      end as on_day,
      coalesce(i.at_time, case when i.kind = 'special' then w.starts end) as at_time
    from my_plans p
    join public.plan_items i on i.plan_id = p.id
    left join public.events e on i.kind = 'event' and e.id = i.ref_id and not e.hidden
    left join public.meetups m on i.kind = 'meetup' and m.id = i.ref_id and m.status in ('open', 'closed')
    left join public.weekly_specials w on i.kind = 'special' and w.id = i.ref_id and w.active and not w.pending
    left join public.places l on i.kind = 'place' and l.id = i.ref_id and l.status = 'active'
    left join public.activities a on i.kind = 'activity' and a.id = i.activity_id and a.active
  ),
  entries as (
    select
      'planitem-' || x.id as uid,
      coalesce(x.e_title, x.m_title, x.w_title, x.l_name, x.a_name, x.note) as title,
      case
        when x.e_starts is not null and not x.e_untimed then x.e_starts
        when x.m_starts is not null then x.m_starts
        when x.on_day is not null and x.at_time is not null then (x.on_day + x.at_time) at time zone 'America/Chicago'
      end as starts_at,
      case
        when x.e_starts is not null and not x.e_untimed then x.e_ends
        when x.on_day is not null and x.at_time is not null and x.w_ends is not null then
          (x.on_day + x.w_ends + case when x.w_ends <= x.at_time then interval '1 day' else interval '0' end) at time zone 'America/Chicago'
      end as ends_at,
      case
        when x.e_starts is not null and x.e_untimed then (x.e_starts at time zone 'America/Chicago')::date
        when x.on_day is not null and x.at_time is null then x.on_day
      end as all_day_on,
      x.kind, x.note, x.plan_id, x.plan_title, x.event_id, x.special_id,
      nullif(concat_ws(', ', coalesce(x.e_venue, x.w_venue, case when x.kind = 'spot' then x.note end),
        coalesce(x.e_address, x.w_address, x.l_address, x.a_address, x.spot_address, x.m_area)), '') as location
    from items x
    where coalesce(x.e_title, x.m_title, x.w_title, x.l_name, x.a_name, x.note) is not null
  )
  select r.uid, r.title, r.starts_at, r.ends_at, r.all_day_on, r.all_day_on,
    r.location,
    case when r.event_id is not null then 'https://app.wichitalifeict.com/event/' || r.event_id
         when r.special_id is not null then 'https://app.wichitalifeict.com/special/' || r.special_id
         else 'https://app.wichitalifeict.com/p/' || r.plan_id end,
    concat_ws(E'\n\n', case when r.kind not in ('note', 'spot') then nullif(r.note, '') end,
      'From your Wichita Life plan “' || r.plan_title || '”'),
    case when plan is not null then one.title else 'Wichita Life' end
  from entries r
  where (r.starts_at is not null or r.all_day_on is not null)
    and coalesce(r.all_day_on, (r.starts_at at time zone 'America/Chicago')::date) >= today - 30

  union all
  -- One plan: a banner across the plan's days listing the things with no day picked yet.
  select 'plan-' || one.id, one.title, null, null, one.starts_on, coalesce(one.ends_on, one.starts_on), null,
    'https://app.wichitalifeict.com/p/' || one.id,
    'Also on this plan, any time: ' || string_agg(r.title, ', '),
    one.title
  from entries r
  where plan is not null and one.starts_on is not null and r.starts_at is null and r.all_day_on is null
  group by one.id, one.title, one.starts_on, one.ends_on
  having count(*) > 0

  union all
  -- The feed also has saved events (skipping ones already in a plan above).
  select 'saved-' || e.id, e.title,
    case when e.all_day or e.time_tbd then null else e.starts_at end,
    case when e.all_day or e.time_tbd then null else e.ends_at end,
    case when e.all_day or e.time_tbd then (e.starts_at at time zone 'America/Chicago')::date end,
    case when e.all_day or e.time_tbd then (e.starts_at at time zone 'America/Chicago')::date end,
    nullif(concat_ws(', ', e.venue, e.address), ''),
    'https://app.wichitalifeict.com/event/' || e.id,
    'Saved on Wichita Life',
    'Wichita Life'
  from public.saved_events s
  join public.events e on e.id = s.event_id and not e.hidden
  where plan is null and s.user_id = member
    and e.starts_at >= now() - interval '30 days'
    and not exists (select 1 from entries r where r.event_id = e.id);
end $$;
revoke all on function public.calendar_items(text, uuid) from public, anon, authenticated;
grant execute on function public.calendar_items(text, uuid) to service_role;
