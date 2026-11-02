-- "Where should I eat?" can now pick from several food types at once (any of them). The old
-- one-type random_place stays for app versions that still call it.
create or replace function public.random_place_in(
  want_categories text[] default null,
  local_only boolean default true,
  skip uuid[] default '{}'
)
returns setof public.places
language sql
set search_path = public
as $$
  select * from public.places
  where status = 'active'
    and (not local_only or not chain)
    and (coalesce(cardinality(want_categories), 0) = 0 or categories && want_categories)
    and not (id = any (skip))
  order by random() * (case when local_pick then 3 else 1 end) desc
  limit 1;
$$;

grant execute on function public.random_place_in(text[], boolean, uuid[]) to anon, authenticated;
