-- Plans can hold things that aren't events: places to eat (search the restaurant list), activities
-- from "What should we do?" (bowling, the zoo, mini golf...), and your own spot (a name and an
-- optional address, like a friend's house or a place we don't list). Your own spots are member
-- text, so adding one to a public plan sends it back for review, like a note.

alter table public.plan_items
  add column activity_id text references public.activities (id) on delete cascade,
  add column address text check (address is null or char_length(address) <= 200);
alter table public.plan_items drop constraint plan_items_kind_check;
alter table public.plan_items add constraint plan_items_kind_check
  check (kind in ('event', 'special', 'place', 'meetup', 'note', 'activity', 'spot'));
alter table public.plan_items drop constraint plan_items_check;
alter table public.plan_items drop constraint plan_items_check1;
alter table public.plan_items add constraint plan_items_target_check check (case kind
  when 'note' then ref_id is null and activity_id is null and note is not null
  when 'spot' then ref_id is null and activity_id is null and note is not null
  when 'activity' then ref_id is null and activity_id is not null
  else ref_id is not null and activity_id is null end);

create or replace function private.plan_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'plans' then
    if (select count(*) from public.plans where owner_id = new.owner_id) >= 30 then
      raise exception 'You can have up to 30 plans. Delete an old one first.' using errcode = 'check_violation';
    end if;
    new.share_code := null;
    new.public_status := 'private';
    new.staff_pick := false;
    new.published_at := null;
  else
    if (select count(*) from public.plan_items where plan_id = new.plan_id) >= 100 then
      raise exception 'A plan can hold up to 100 things.' using errcode = 'check_violation';
    end if;
    update public.plans set updated_at = now(),
      public_status = case when new.kind in ('note', 'spot') and public_status = 'approved' and not private.is_staff()
        then 'pending' else public_status end
      where id = new.plan_id;
  end if;
  return new;
end $$;


create or replace function public.get_plan(plan uuid default null, code text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'starts_on', p.starts_on,
    'ends_on', p.ends_on,
    'mine', p.owner_id = auth.uid(),
    'owner_id', p.owner_id,
    'share_code', case when p.owner_id = auth.uid() then p.share_code end,
    'public_status', case when p.owner_id = auth.uid() or private.is_staff() then p.public_status
      when p.public_status = 'approved' then 'approved' end,
    'friends_can_see', case when p.owner_id = auth.uid() then p.friends_can_see end,
    'staff_pick', p.staff_pick,
    'owner_name', split_part(pr.display_name, ' ', 1),
    'im_in', exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = auth.uid()),
    'going', coalesce((
      select jsonb_agg(jsonb_build_object('id', j.user_id, 'name', split_part(jp.display_name, ' ', 1)) order by j.created_at)
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
          when 'activity' then (select jsonb_build_object('title', a.name, 'address', nullif(a.address, ''), 'website', a.website,
              'blurb', nullif(a.blurb, ''))
            from public.activities a where a.id = i.activity_id and a.active)
          when 'spot' then jsonb_build_object('title', i.note, 'address', i.address)
        end
      ) order by i.created_at)
      from public.plan_items i where i.plan_id = p.id
    ), '[]'::jsonb)
  )
  from public.plans p
  join public.profiles pr on pr.id = p.owner_id
  where (get_plan.plan is not null and p.id = get_plan.plan
          and (private.can_see_plan(p, auth.uid()) or (p.public_status <> 'private' and private.is_staff())))
     or (get_plan.code is not null and p.share_code = get_plan.code);
$$;
grant execute on function public.get_plan(uuid, text) to anon, authenticated;

create or replace function public.get_public_plans()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.staff_pick desc, x.published_at desc), '[]'::jsonb)
  from (
    select p.id, p.title, p.starts_on, p.ends_on, p.staff_pick, p.published_at,
      split_part(pr.display_name, ' ', 1) as owner_name,
      (select count(*) from public.plan_items i where i.plan_id = p.id) as items,
      (select coalesce(jsonb_agg(t.title), '[]'::jsonb) from (
        select coalesce(e.title, w.title, l.name, m.title, a.name, i.note) as title
        from public.plan_items i
        left join public.events e on i.kind = 'event' and e.id = i.ref_id and not e.hidden
        left join public.weekly_specials w on i.kind = 'special' and w.id = i.ref_id and w.active
        left join public.places l on i.kind = 'place' and l.id = i.ref_id and l.status = 'active'
        left join public.meetups m on i.kind = 'meetup' and m.id = i.ref_id
        left join public.activities a on i.kind = 'activity' and a.id = i.activity_id and a.active
        where i.plan_id = p.id
        order by i.created_at
        limit 3
      ) t where t.title is not null) as preview
    from public.plans p
    join public.profiles pr on pr.id = p.owner_id
    where p.public_status = 'approved'
      and (p.ends_on is null or p.ends_on >= (now() at time zone 'America/Chicago')::date)
      and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.owner_id)
    order by p.staff_pick desc, p.published_at desc
    limit 60
  ) x;
$$;
grant execute on function public.get_public_plans() to anon, authenticated;

create or replace function public.copy_plan(plan uuid default null, code text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare src public.plans; new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to copy plans' using errcode = 'insufficient_privilege';
  end if;
  select * into src from public.plans p
  where (copy_plan.plan is not null and p.id = copy_plan.plan and private.can_see_plan(p, auth.uid()))
     or (copy_plan.code is not null and p.share_code = copy_plan.code);
  if src.id is null then
    raise exception 'Plan not found' using errcode = 'no_data_found';
  end if;
  insert into public.plans (owner_id, title, starts_on, ends_on)
    values (auth.uid(), src.title, src.starts_on, src.ends_on) returning id into new_id;
  insert into public.plan_items (plan_id, kind, ref_id, activity_id, address, on_date, at_time, note)
    select new_id, kind, ref_id, activity_id, address, on_date, at_time, note from public.plan_items where plan_id = src.id
    order by created_at limit 100;
  return new_id;
end $$;
