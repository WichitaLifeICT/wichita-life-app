-- Staff tools → Plans: how many friend connections members have made (counts only).
create or replace function public.friend_stats()
returns table (friendships bigint, pending bigint, members_with_friends bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select
      count(*) filter (where f.status = 'accepted'),
      count(*) filter (where f.status <> 'accepted'),
      (select count(distinct x.id) from (
         select requester_id as id from public.friendships where status = 'accepted'
         union select addressee_id from public.friendships where status = 'accepted') x)
    from public.friendships f;
end $$;
revoke execute on function public.friend_stats() from public, anon;
grant execute on function public.friend_stats() to authenticated;
