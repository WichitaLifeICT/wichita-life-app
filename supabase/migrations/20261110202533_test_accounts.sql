-- Test accounts (the App Store reviewer's) are left out of every count, like staff: giveaway entrant
-- counts, the draw, PostHog giveaway entries, Staff tools' plan and friend numbers. Only staff (or the
-- service role) can set the flag; members can't update it (profiles' update grant is per column).
alter table public.profiles add column test_account boolean not null default false;
grant select (test_account) on public.profiles to authenticated;

-- Members still can't change it on their own row (like role).
alter policy "edit own profile" on public.profiles
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and test_account = (select p.test_account from public.profiles p where p.id = auth.uid())
  );

-- Staff or a test account: their activity works normally but isn't counted.
create or replace function private.uncounted(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.role in ('admin', 'moderator') or p.test_account from public.profiles p where p.id = uid), false);
$$;
revoke execute on function private.uncounted(uuid) from public, anon, authenticated;

create or replace function private.refresh_giveaway_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  gid uuid := coalesce(new.giveaway_id, old.giveaway_id);
begin
  update public.giveaways set entrant_count = (
    select count(distinct e.user_id) from public.giveaway_entries e
    where e.giveaway_id = gid and not private.uncounted(e.user_id))
  where id = gid;
  return null;
end $$;

-- Recount now (counts otherwise refresh only when an entry changes).
update public.giveaways g set entrant_count = (
  select count(distinct e.user_id) from public.giveaway_entries e
  where e.giveaway_id = g.id and not private.uncounted(e.user_id));

create or replace function private.posthog_giveaway_entry()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare added int := new.entries - case when tg_op = 'UPDATE' then old.entries else 0 end;
begin
  if added <= 0 then return new; end if;
  if private.uncounted(new.user_id) then return new; end if;
  begin
    perform net.http_post(
      url := 'https://us.i.posthog.com/i/v0/e/',
      body := jsonb_build_object(
        'api_key', 'phc_w3N7n3ku3tnsBfgyZKqfpUs9iSH7D7Stk6ZX5mTbWB6E',
        'event', 'giveaway_entry_added',
        'distinct_id', new.user_id::text,
        'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'properties', jsonb_build_object(
          'giveaway_id', new.giveaway_id,
          'giveaway', (select title from public.giveaways where id = new.giveaway_id),
          'kind', new.kind,
          'entries', added,
          'source', 'database'
        )
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
  return new;
end $$;
revoke execute on function private.posthog_giveaway_entry() from public, anon, authenticated;

create or replace function public.draw_giveaway_winner(giveaway uuid)
returns table (user_id uuid, display_name text, email text, entries integer)
language plpgsql security definer set search_path = public as $$
declare
  winner uuid;
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  select t.user_id into winner
  from (
    select e.user_id, sum(e.entries) as n
    from public.giveaway_entries e
    where e.giveaway_id = draw_giveaway_winner.giveaway and not private.uncounted(e.user_id)
    group by e.user_id
  ) t
  order by -ln(1 - random()) / t.n
  limit 1;
  if winner is null then raise exception 'No eligible entries yet (staff and test accounts can''t win).'; end if;
  update public.giveaways set winner_user_id = winner where id = draw_giveaway_winner.giveaway;
  return query select * from public.giveaway_winner(draw_giveaway_winner.giveaway);
end;
$$;

-- "staff" in these lists now means "not counted" (staff or a test account).
create or replace function public.giveaway_entrants(giveaway uuid)
returns table (user_id uuid, display_name text, email text, entries bigint, kinds jsonb, entered_at timestamptz, staff boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text, sum(e.entries)::bigint,
      jsonb_object_agg(e.kind, e.entries), min(e.created_at), (p.role in ('admin', 'moderator') or p.test_account)
    from public.giveaway_entries e
    join public.profiles p on p.id = e.user_id
    join auth.users u on u.id = e.user_id
    where e.giveaway_id = giveaway_entrants.giveaway
    group by p.id, p.display_name, u.email, p.role, p.test_account
    order by 7, 4 desc, 6;
end $$;

create or replace function public.plan_makers()
returns table (user_id uuid, display_name text, plans bigint, posted bigint, joined bigint, last_at timestamptz, staff boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    with made as (
      select owner_id as uid, count(*) as plans,
        count(*) filter (where public_status in ('pending', 'approved')) as posted,
        max(created_at) as last_at
      from public.plans group by owner_id
    ), joins as (
      select j.user_id as uid, count(*) as joined, max(j.created_at) as last_at
      from public.plan_joins j join public.plans p on p.id = j.plan_id
      where p.owner_id <> j.user_id
      group by j.user_id
    )
    select pr.id, pr.display_name, coalesce(m.plans, 0)::bigint, coalesce(m.posted, 0)::bigint,
      coalesce(j.joined, 0)::bigint, greatest(m.last_at, j.last_at), (pr.role in ('admin', 'moderator') or pr.test_account)
    from public.profiles pr
    left join made m on m.uid = pr.id
    left join joins j on j.uid = pr.id
    where m.uid is not null or j.uid is not null
    order by 7, 6 desc nulls last;
end $$;

-- Friend numbers count members only; friendships_all includes staff and test accounts.
drop function public.friend_stats();
create function public.friend_stats()
returns table (friendships bigint, pending bigint, members_with_friends bigint, friendships_all bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    with f as (
      select f.*, private.uncounted(f.requester_id) or private.uncounted(f.addressee_id) as uncounted
      from public.friendships f
    )
    select
      count(*) filter (where f.status = 'accepted' and not f.uncounted),
      count(*) filter (where f.status <> 'accepted' and not f.uncounted),
      (select count(distinct x.id) from (
         select requester_id as id from f where status = 'accepted' and not uncounted
         union select addressee_id from f where status = 'accepted' and not uncounted) x),
      count(*) filter (where f.status = 'accepted')
    from f;
end $$;
revoke execute on function public.friend_stats() from public, anon;
grant execute on function public.friend_stats() to authenticated;
