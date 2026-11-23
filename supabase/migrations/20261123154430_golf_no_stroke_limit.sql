-- Mini golf has no stroke limit now (keep putting until it drops), so scores up to 99 count.
alter table public.golf_scores drop constraint golf_scores_best_check;
alter table public.golf_scores add constraint golf_scores_best_check check (best between 1 and 99);

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
  if p_hole is null or p_hole not between 1 and 9 or p_strokes is null or p_strokes not between 1 and 99 then
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
