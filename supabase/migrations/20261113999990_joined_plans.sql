-- "I'm in" on a friend's plan now puts it under "Plans you're in" on My plans (a member's report,
-- Nov 13: "Saying I'm in doesn't add it to my plans"). Joiners can always open a plan they're in,
-- even if its owner later turns the share link off.
create or replace function private.can_see_plan(p public.plans, member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p.owner_id = member
    or p.public_status = 'approved'
    or (member is not null and p.friends_can_see and private.are_friends(p.owner_id, member))
    or (member is not null and exists (select 1 from public.plan_sends s where s.plan_id = p.id and s.to_id = member))
    or (member is not null and exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = member));
$$;

-- Plans the signed-in member said they're in on: upcoming and undated first, past ones last.
create or replace function public.my_joined_plans()
returns table (id uuid, title text, starts_on date, ends_on date, share_code text, owner_name text, items bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.starts_on, p.ends_on, p.share_code,
    coalesce(nullif(split_part(pr.display_name, ' ', 1), ''), 'A friend'),
    (select count(*) from public.plan_items i where i.plan_id = p.id)
  from public.plan_joins j
  join public.plans p on p.id = j.plan_id
  join public.profiles pr on pr.id = p.owner_id
  where j.user_id = auth.uid()
  order by (coalesce(p.ends_on, p.starts_on) < (now() at time zone 'America/Chicago')::date) nulls first,
    p.starts_on nulls last, j.created_at desc;
$$;
revoke execute on function public.my_joined_plans() from public, anon;
grant execute on function public.my_joined_plans() to authenticated;
