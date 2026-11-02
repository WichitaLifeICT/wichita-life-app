-- Friends. Mutual only. Two ways to add someone:
--   * their friend link (app.wichitalifeict.com/f/<their invite code>): you're friends right away,
--     since they chose to share it;
--   * tapping their name somewhere (like a plan's "I'm in" list): a request they accept.
-- Friends can see plans you show to friends, see when friends saved an event, and get plans
-- you send them. Blocking someone ends the friendship.

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);
alter table public.friendships enable row level security;
-- Read through my_friends(); changes only through the functions below.
create policy "see your friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));

create or replace function private.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$$;

create or replace function private.notify(job text, payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := jsonb_build_object('job', job) || payload,
    timeout_milliseconds := 30000
  );
end $$;
revoke execute on function private.notify(text, jsonb) from public, anon, authenticated;

create or replace function private.blocked_either(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Ask someone to be friends, or accept their request if they already asked you.
-- Returns 'pending', 'accepted' or 'already'.
create or replace function public.request_friend(member uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f public.friendships;
begin
  if me is null then raise exception 'Sign in first' using errcode = 'insufficient_privilege'; end if;
  if member = me or private.blocked_either(me, member) or not exists (select 1 from public.profiles where id = member) then
    raise exception 'Can’t add this person' using errcode = 'check_violation';
  end if;
  select * into f from public.friendships
  where least(requester_id, addressee_id) = least(me, member) and greatest(requester_id, addressee_id) = greatest(me, member);
  if f.status = 'accepted' or (f.status = 'pending' and f.requester_id = me) then return 'already'; end if;
  if f.status = 'pending' then
    update public.friendships set status = 'accepted', accepted_at = now()
      where requester_id = member and addressee_id = me;
    perform private.notify('friend', jsonb_build_object('kind', 'accepted', 'to', member, 'from', me));
    return 'accepted';
  end if;
  if (select count(*) from public.friendships where requester_id = me and status = 'pending'
        and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That’s a lot of requests today. Try again tomorrow.' using errcode = 'check_violation';
  end if;
  insert into public.friendships (requester_id, addressee_id) values (me, member);
  perform private.notify('friend', jsonb_build_object('kind', 'request', 'to', member, 'from', me));
  return 'pending';
end $$;

-- Opening someone's friend link and tapping Add: friends right away.
create or replace function public.add_friend_by_code(code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); them public.profiles;
begin
  if me is null then raise exception 'Sign in first' using errcode = 'insufficient_privilege'; end if;
  select * into them from public.profiles where referral_code = upper(code);
  if them.id is null or them.id = me or private.blocked_either(me, them.id) then
    raise exception 'Friend link not found' using errcode = 'no_data_found';
  end if;
  insert into public.friendships (requester_id, addressee_id, status, accepted_at)
    values (them.id, me, 'accepted', now())
  on conflict ((least(requester_id, addressee_id)), (greatest(requester_id, addressee_id)))
    do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, now());
  perform private.notify('friend', jsonb_build_object('kind', 'joined', 'to', them.id, 'from', me));
  return jsonb_build_object('id', them.id, 'name', them.display_name);
end $$;

-- Whose friend link this is (first name only), for the landing page.
create or replace function public.friend_link_owner(code text)
returns text language sql stable security definer set search_path = public as $$
  select split_part(display_name, ' ', 1) from public.profiles where referral_code = upper(code);
$$;
grant execute on function public.friend_link_owner(text) to anon, authenticated;

create or replace function public.respond_friend(member uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if accept then
    update public.friendships set status = 'accepted', accepted_at = now()
      where requester_id = member and addressee_id = me and status = 'pending';
    if found then perform private.notify('friend', jsonb_build_object('kind', 'accepted', 'to', member, 'from', me)); end if;
  else
    delete from public.friendships where requester_id = member and addressee_id = me and status = 'pending';
  end if;
end $$;

-- Unfriend, or cancel a request you sent.
create or replace function public.remove_friend(member uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friendships
  where least(requester_id, addressee_id) = least(auth.uid(), member)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), member);
$$;

-- Friends, requests to you, and requests you sent.
create or replace function public.my_friends()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.display_name,
      'status', case when f.status = 'accepted' then 'friend' when f.requester_id = auth.uid() then 'sent' else 'incoming' end,
      'since', coalesce(f.accepted_at, f.created_at))
    order by f.status, p.display_name), '[]'::jsonb)
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
    and not private.blocked_either(f.requester_id, f.addressee_id);
$$;

do $$ declare fn text; begin
  foreach fn in array array['request_friend(uuid)', 'add_friend_by_code(text)', 'respond_friend(uuid, boolean)', 'remove_friend(uuid)', 'my_friends()'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- Blocking someone ends the friendship.
create or replace function private.unfriend_on_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
  where least(requester_id, addressee_id) = least(new.blocker_id, new.blocked_id)
    and greatest(requester_id, addressee_id) = greatest(new.blocker_id, new.blocked_id);
  return null;
end $$;
create trigger blocks_unfriend after insert on public.blocks for each row execute function private.unfriend_on_block();

-- Plans friends can see -------------------------------------------------------------------

alter table public.plans add column friends_can_see boolean not null default false;

-- Plans sent to particular friends.
create table public.plan_sends (
  plan_id uuid not null references public.plans (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, to_id)
);
alter table public.plan_sends enable row level security;
create policy "see plans sent to you" on public.plan_sends for select to authenticated using (to_id = auth.uid());

-- Can this member see this plan? Owner, public, friends (when shown to friends), or sent to them.
create or replace function private.can_see_plan(p public.plans, member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p.owner_id = member
    or p.public_status = 'approved'
    or (member is not null and p.friends_can_see and private.are_friends(p.owner_id, member))
    or (member is not null and exists (select 1 from public.plan_sends s where s.plan_id = p.id and s.to_id = member));
$$;

-- Send a plan to friends: it shows under "Sent to you" for them, with a push.
create or replace function public.send_plan(plan uuid, friends uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); sent uuid[];
begin
  if not exists (select 1 from public.plans where id = plan and owner_id = me) then
    raise exception 'Plan not found' using errcode = 'insufficient_privilege';
  end if;
  with ins as (
    insert into public.plan_sends (plan_id, to_id)
    select plan, f from unnest(friends) f
    where private.are_friends(me, f)
    on conflict do nothing
    returning to_id
  ) select array_agg(to_id) into sent from ins;
  if sent is not null then
    perform private.notify('plan_sent', jsonb_build_object('plan', plan, 'from', me, 'to', to_jsonb(sent)));
  end if;
  return coalesce(array_length(sent, 1), 0);
end $$;
revoke all on function public.send_plan(uuid, uuid[]) from public, anon;
grant execute on function public.send_plan(uuid, uuid[]) to authenticated;

-- Friends' plans (shown to friends and not over) and plans sent to me, newest first.
create or replace function public.friends_plans()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.sent desc, x.updated_at desc), '[]'::jsonb) from (
    select p.id, p.title, p.starts_on, p.ends_on, p.updated_at,
      split_part(pr.display_name, ' ', 1) as owner_name,
      exists (select 1 from public.plan_sends s where s.plan_id = p.id and s.to_id = auth.uid()) as sent,
      exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = auth.uid()) as im_in,
      (select count(*) from public.plan_items i where i.plan_id = p.id) as items
    from public.plans p join public.profiles pr on pr.id = p.owner_id
    where p.owner_id <> auth.uid()
      and (p.ends_on is null or p.ends_on >= (now() at time zone 'America/Chicago')::date)
      and ((p.friends_can_see and private.are_friends(p.owner_id, auth.uid()))
           or exists (select 1 from public.plan_sends s where s.plan_id = p.id and s.to_id = auth.uid()))
    limit 50
  ) x;
$$;
grant execute on function public.friends_plans() to authenticated;

-- Friends who saved these events, by event (for "Ana and Ben saved this").
create or replace function public.friends_saved(events uuid[])
returns table (event_id uuid, names text[]) language sql stable security definer set search_path = public as $$
  select s.event_id, array_agg(split_part(p.display_name, ' ', 1) order by s.created_at)
  from public.saved_events s join public.profiles p on p.id = s.user_id
  where s.event_id = any(events) and private.are_friends(s.user_id, auth.uid())
  group by s.event_id;
$$;
grant execute on function public.friends_saved(uuid[]) to authenticated;

-- get_plan, set_plan_join and copy_plan use can_see_plan; going includes ids (to add friends).
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

create or replace function public.set_plan_join(joining boolean, plan uuid default null, code text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare p public.plans;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;
  select * into p from public.plans x
  where (set_plan_join.plan is not null and x.id = set_plan_join.plan and private.can_see_plan(x, auth.uid()))
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
  insert into public.plan_items (plan_id, kind, ref_id, on_date, at_time, note)
    select new_id, kind, ref_id, on_date, at_time, note from public.plan_items where plan_id = src.id
    order by created_at limit 100;
  return new_id;
end $$;
