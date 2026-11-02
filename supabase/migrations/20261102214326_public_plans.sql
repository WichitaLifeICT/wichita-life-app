-- Public plans: a member can post a plan to "Plans around Wichita". It shows to everyone once
-- staff approve it (members' text is user content, so it's reviewed like board posts). Changing
-- the name or adding a note to an approved plan sends it back for review. Anyone can copy a
-- plan they can see into their own plans, and report a public one.

alter table public.plans
  add column public_status text not null default 'private'
    check (public_status in ('private', 'pending', 'approved', 'rejected')),
  add column published_at timestamptz,
  add column staff_pick boolean not null default false;
create index plans_public_idx on public.plans (public_status, published_at desc);

-- Staff review posted plans.
create policy "staff review posted plans" on public.plans for all to authenticated
  using (public_status <> 'private' and private.is_staff())
  with check (private.is_staff());

-- Members can post (pending) or take down (private) their own plan; only staff approve,
-- reject or pick. The share code is only set by set_plan_sharing().
create or replace function private.plan_share_code_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.share_code is distinct from old.share_code then
      raise exception 'Use set_plan_sharing to share a plan' using errcode = 'insufficient_privilege';
    end if;
    if not private.is_staff() then
      if new.public_status is distinct from old.public_status and new.public_status not in ('private', 'pending')
        or new.staff_pick is distinct from old.staff_pick
        or new.published_at is distinct from old.published_at then
        raise exception 'Only staff can approve plans' using errcode = 'insufficient_privilege';
      end if;
      if old.public_status = 'approved' and new.public_status = 'approved' and new.title is distinct from old.title then
        new.public_status := 'pending';
      end if;
    end if;
  end if;
  if new.public_status = 'approved' and old.public_status is distinct from 'approved' then
    new.published_at := now();
  end if;
  if new.public_status = 'private' then
    new.staff_pick := false;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- A new note on an approved plan goes back to staff (items from Wichita Life's own lists don't).
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
      public_status = case when new.kind = 'note' and public_status = 'approved' and not private.is_staff()
        then 'pending' else public_status end
      where id = new.plan_id;
  end if;
  return new;
end $$;

-- Anyone can now read an approved public plan by its id; staff can read posted ones.
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

-- "Plans around Wichita": approved public plans that haven't ended, staff picks first.
-- Plans by members you've blocked are left out.
create or replace function public.get_public_plans()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.staff_pick desc, x.published_at desc), '[]'::jsonb)
  from (
    select p.id, p.title, p.starts_on, p.ends_on, p.staff_pick, p.published_at,
      split_part(pr.display_name, ' ', 1) as owner_name,
      (select count(*) from public.plan_items i where i.plan_id = p.id) as items,
      (select coalesce(jsonb_agg(t.title), '[]'::jsonb) from (
        select coalesce(e.title, w.title, l.name, m.title, i.note) as title
        from public.plan_items i
        left join public.events e on i.kind = 'event' and e.id = i.ref_id and not e.hidden
        left join public.weekly_specials w on i.kind = 'special' and w.id = i.ref_id and w.active
        left join public.places l on i.kind = 'place' and l.id = i.ref_id and l.status = 'active'
        left join public.meetups m on i.kind = 'meetup' and m.id = i.ref_id
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

-- Copies a plan you can see (yours, a public one, or one shared with you by link) into your plans.
create or replace function public.copy_plan(plan uuid default null, code text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare src public.plans; new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to copy plans' using errcode = 'insufficient_privilege';
  end if;
  select * into src from public.plans p
  where (copy_plan.plan is not null and p.id = copy_plan.plan
          and (p.owner_id = auth.uid() or p.public_status = 'approved'))
     or (copy_plan.code is not null and p.share_code = copy_plan.code);
  if src.id is null then
    raise exception 'Plan not found' using errcode = 'no_data_found';
  end if;
  insert into public.plans (owner_id, title, starts_on, ends_on)
    values (auth.uid(), src.title, src.starts_on, src.ends_on) returning id into new_id;
  insert into public.plan_items (plan_id, kind, ref_id, on_date, at_time, note)
    select new_id, kind, ref_id, on_date, at_time, note from public.plan_items where plan_id = src.id
    order by created_at limit 100;
  return new_id;
end $$;
revoke all on function public.copy_plan(uuid, text) from public, anon;
grant execute on function public.copy_plan(uuid, text) to authenticated;

-- Reports can be about a public plan, too.
alter table public.reports add column plan_id uuid references public.plans (id) on delete cascade;
alter table public.reports drop constraint reports_check;
alter table public.reports add constraint reports_one_target check (num_nonnulls(thread_id, reply_id, plan_id) = 1);
