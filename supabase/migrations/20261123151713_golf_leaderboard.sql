-- Wichita Mini Golf leaderboard: each member's best score on each hole, and a public top 10.
-- Scores come only through golf_post_score (signed in); anyone can read the board.

create table public.golf_scores (
  member_id uuid not null references public.profiles (id) on delete cascade,
  hole smallint not null check (hole between 1 and 9),
  best smallint not null check (best between 1 and 10),
  -- When they first got their best: ties go to whoever got there first.
  best_at timestamptz not null default now(),
  rounds integer not null default 1,
  last_at timestamptz not null default now(),
  primary key (member_id, hole)
);
create index golf_scores_board on public.golf_scores (hole, best, best_at);
alter table public.golf_scores enable row level security;
revoke all on public.golf_scores from anon, authenticated;

-- Records a finished hole. Keeps the best (fewest strokes) and returns it with their place.
create or replace function public.golf_post_score(p_hole int, p_strokes int)
returns table (best int, place bigint, improved boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  prev public.golf_scores;
begin
  if me is null then raise exception 'Sign in to post a score' using errcode = '28000'; end if;
  if p_hole is null or p_hole not between 1 and 9 or p_strokes is null or p_strokes not between 1 and 10 then
    raise exception 'That score doesn''t fit' using errcode = '22023';
  end if;
  select * into prev from public.golf_scores g where g.member_id = me and g.hole = p_hole for update;
  if prev.member_id is null then
    insert into public.golf_scores (member_id, hole, best) values (me, p_hole, p_strokes);
  elsif prev.last_at > now() - interval '3 seconds' then
    null; -- a repeat tap or a script: ignore it
  else
    update public.golf_scores g
    set rounds = g.rounds + 1,
        last_at = now(),
        best = least(g.best, p_strokes),
        best_at = case when p_strokes < g.best then now() else g.best_at end
    where g.member_id = me and g.hole = p_hole;
  end if;
  return query
  select s.best::int,
         (select count(*) + 1 from public.golf_scores o join public.profiles p on p.id = o.member_id
          where o.hole = p_hole and o.member_id <> me and not p.test_account
            and (o.best < s.best or (o.best = s.best and o.best_at < s.best_at))),
         prev.member_id is null or p_strokes < prev.best
  from public.golf_scores s where s.member_id = me and s.hole = p_hole;
end;
$$;

-- The top of the board (and your own row if you're further down). Names only, never emails.
create or replace function public.golf_leaderboard(p_hole int, p_limit int default 10)
returns table (place bigint, name text, best int, best_at timestamptz, is_me boolean, players bigint)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select row_number() over (order by g.best, g.best_at, g.member_id) as place,
           coalesce(nullif(btrim(p.display_name), ''), 'Golfer') as name,
           g.best::int as best,
           g.best_at,
           g.member_id = auth.uid() as is_me,
           count(*) over () as players
    from public.golf_scores g
    join public.profiles p on p.id = g.member_id
    -- Test accounts stay off the board (they still see their own score).
    where g.hole = p_hole and (not p.test_account or g.member_id = auth.uid())
  )
  select place, name, best, best_at, coalesce(is_me, false), players
  from ranked
  where place <= least(greatest(coalesce(p_limit, 10), 1), 50) or is_me
  order by place;
$$;

revoke execute on function public.golf_post_score(int, int) from public, anon;
revoke execute on function public.golf_leaderboard(int, int) from public;
grant execute on function public.golf_post_score(int, int) to authenticated;
grant execute on function public.golf_leaderboard(int, int) to anon, authenticated;
