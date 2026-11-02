-- Plans: a member's itineraries ("This weekend", "Mom's visit"). Each holds events, weekly
-- specials, places to eat, meetups and notes. Private to the member; sharing a plan makes a
-- random link code that lets anyone view that one plan (read-only) through get_plan().

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  starts_on date,
  ends_on date,
  share_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on),
  check (ends_on is null or starts_on is not null)
);
create index plans_owner_idx on public.plans (owner_id, updated_at desc);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  kind text not null check (kind in ('event', 'special', 'place', 'meetup', 'note')),
  ref_id uuid,
  -- The day (Wichita time) for things without their own date: specials, places and notes.
  on_date date,
  at_time time,
  note text check (note is null or char_length(note) between 1 and 300),
  created_at timestamptz not null default now(),
  check ((kind = 'note') = (ref_id is null)),
  check (kind <> 'note' or note is not null)
);
create index plan_items_plan_idx on public.plan_items (plan_id);

alter table public.plans enable row level security;
alter table public.plan_items enable row level security;

create policy "own plans" on public.plans for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "items in own plans" on public.plan_items for all to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()));

-- The share code is only set by set_plan_sharing() (which runs as the table owner), so links
-- stay unguessable. Members editing a plan directly can't change it.
create or replace function private.plan_share_code_guard()
returns trigger language plpgsql as $$
begin
  if new.share_code is distinct from old.share_code and current_user in ('authenticated', 'anon') then
    raise exception 'Use set_plan_sharing to share a plan' using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger plans_share_code_guard before update on public.plans for each row execute function private.plan_share_code_guard();

-- Limits, so one account can't fill the database: 30 plans, 100 items a plan.
create or replace function private.plan_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'plans' then
    if (select count(*) from public.plans where owner_id = new.owner_id) >= 30 then
      raise exception 'You can have up to 30 plans. Delete an old one first.' using errcode = 'check_violation';
    end if;
    new.share_code := null;
  else
    if (select count(*) from public.plan_items where plan_id = new.plan_id) >= 100 then
      raise exception 'A plan can hold up to 100 things.' using errcode = 'check_violation';
    end if;
    update public.plans set updated_at = now() where id = new.plan_id;
  end if;
  return new;
end $$;
create trigger plans_limit before insert on public.plans for each row execute function private.plan_limits();
create trigger plan_items_limit before insert on public.plan_items for each row execute function private.plan_limits();

-- Turns sharing on (returns the link code, keeping an existing one) or off (returns null).
create or replace function public.set_plan_sharing(plan uuid, shared boolean)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not exists (select 1 from public.plans where id = plan and owner_id = auth.uid()) then
    raise exception 'Plan not found' using errcode = 'insufficient_privilege';
  end if;
  if shared then
    select share_code into code from public.plans where id = plan;
    if code is null then
      code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
      update public.plans set share_code = code, updated_at = now() where id = plan;
    end if;
  else
    update public.plans set share_code = null, updated_at = now() where id = plan;
  end if;
  return code;
end $$;
revoke all on function public.set_plan_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_plan_sharing(uuid, boolean) to authenticated;

-- A plan with what each item points at, for its owner (by id) or anyone with the link (by code).
-- Items whose event, special, place or meetup is gone or hidden come back with "gone": true.
create or replace function public.get_plan(plan uuid default null, code text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'starts_on', p.starts_on,
    'ends_on', p.ends_on,
    'mine', p.owner_id = auth.uid(),
    'share_code', case when p.owner_id = auth.uid() then p.share_code end,
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
  where (get_plan.plan is not null and p.id = get_plan.plan and p.owner_id = auth.uid())
     or (get_plan.code is not null and p.share_code = get_plan.code);
$$;
grant execute on function public.get_plan(uuid, text) to anon, authenticated;
