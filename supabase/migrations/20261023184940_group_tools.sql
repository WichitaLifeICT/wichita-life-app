-- Groups that do something: staff see who joined, and can notify a group's members
-- (send-push with a group; also used when a meetup is posted for a group).
-- Joining a group is the opt-in for its notifications; leaving stops them.

create or replace function public.group_member_list(target uuid)
returns table (user_id uuid, display_name text, email text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text, gm.created_at
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    join auth.users u on u.id = gm.user_id
    where gm.group_id = group_member_list.target
    order by gm.created_at desc;
end;
$$;
revoke execute on function public.group_member_list(uuid) from public, anon;
grant execute on function public.group_member_list(uuid) to authenticated;

-- How many phones a push to this group's members would reach.
create or replace function public.group_push_audience(target uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return (
    select count(distinct t.token)::int
    from public.push_tokens t
    join public.group_members gm on gm.user_id = t.user_id
    where gm.group_id = group_push_audience.target
  );
end;
$$;
revoke execute on function public.group_push_audience(uuid) from public, anon;
grant execute on function public.group_push_audience(uuid) to authenticated;
