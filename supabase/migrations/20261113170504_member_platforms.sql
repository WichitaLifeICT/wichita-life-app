-- Where members use Wichita Life (owner, Nov 13: how many signed in only through a browser).
-- The app notes its platform (ios, android or web) each time it opens signed in; staff see the
-- counts on the staff home. Members who allowed notifications already told us their phone.
alter table public.profiles add column platforms text[] not null default '{}';

update public.profiles p set platforms = coalesce(
  (select array_agg(distinct t.platform order by t.platform) from public.push_tokens t where t.user_id = p.id), '{}');

create or replace function public.note_platform(p_platform text)
returns void language sql security definer set search_path = public as $$
  update public.profiles set platforms = array_append(platforms, p_platform)
  where id = auth.uid() and p_platform in ('ios', 'android', 'web') and not (p_platform = any(platforms));
$$;
revoke execute on function public.note_platform(text) from public, anon;
grant execute on function public.note_platform(text) to authenticated;

-- Staff only. Leaves out staff and test accounts, like the giveaway counts.
create or replace function public.member_platforms()
returns table (members bigint, iphone bigint, android bigint, web_only bigint, not_seen bigint)
language sql stable security definer set search_path = public as $$
  select count(*),
    count(*) filter (where 'ios' = any(p.platforms)),
    count(*) filter (where 'android' = any(p.platforms)),
    count(*) filter (where p.platforms = '{web}'),
    count(*) filter (where p.platforms = '{}')
  from public.profiles p
  where private.is_staff() and not private.uncounted(p.id);
$$;
revoke execute on function public.member_platforms() from public, anon;
grant execute on function public.member_platforms() to authenticated;
