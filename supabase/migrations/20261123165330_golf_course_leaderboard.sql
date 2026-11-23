-- Mini golf, all 9 holes: each member's best on every hole, added up. Only members who've sunk all 9 are
-- ranked (ties go to whoever finished their set first); a member partway through gets their own progress.
create or replace function public.golf_course_leaderboard(p_limit int default 10)
returns table (place bigint, name text, total int, holes int, finished_at timestamptz, is_me boolean, players bigint)
language sql
stable
security definer
set search_path = public
as $$
  with per as (
    select g.member_id, sum(g.best)::int as total, count(*)::int as holes, max(g.best_at) as finished_at
    from public.golf_scores g
    join public.profiles p on p.id = g.member_id
    -- Test accounts stay off the board (they still see their own progress).
    where not p.test_account or g.member_id = auth.uid()
    group by g.member_id
  ),
  ranked as (
    select per.*, row_number() over (order by total, finished_at, member_id) as place, count(*) over () as players
    from per
    where holes = 9
  )
  select r.place, coalesce(nullif(btrim(p.display_name), ''), 'Golfer'), r.total, r.holes, r.finished_at,
         coalesce(r.member_id = auth.uid(), false), r.players
  from ranked r
  join public.profiles p on p.id = r.member_id
  where r.place <= least(greatest(coalesce(p_limit, 10), 1), 50) or r.member_id = auth.uid()
  union all
  select null, coalesce(nullif(btrim(p.display_name), ''), 'Golfer'), per.total, per.holes, per.finished_at, true,
         (select count(*) from per where holes = 9)
  from per
  join public.profiles p on p.id = per.member_id
  where per.member_id = auth.uid() and per.holes < 9
  order by 1 nulls last;
$$;

revoke execute on function public.golf_course_leaderboard(int) from public;
grant execute on function public.golf_course_leaderboard(int) to anon, authenticated;
