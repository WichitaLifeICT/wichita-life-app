-- Staff tools → Plans: who's making plans. Names and counts only: plans are private unless shared, so
-- staff see how many plans someone made (and how many they posted publicly), never the plans themselves.
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
      -- "I'm in" on someone else's plan
      select j.user_id as uid, count(*) as joined, max(j.created_at) as last_at
      from public.plan_joins j join public.plans p on p.id = j.plan_id
      where p.owner_id <> j.user_id
      group by j.user_id
    )
    select pr.id, pr.display_name, coalesce(m.plans, 0)::bigint, coalesce(m.posted, 0)::bigint,
      coalesce(j.joined, 0)::bigint, greatest(m.last_at, j.last_at), pr.role in ('admin', 'moderator')
    from public.profiles pr
    left join made m on m.uid = pr.id
    left join joins j on j.uid = pr.id
    where m.uid is not null or j.uid is not null
    order by 7, 6 desc nulls last;
end $$;
revoke execute on function public.plan_makers() from public, anon;
grant execute on function public.plan_makers() to authenticated;
