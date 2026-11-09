-- The official rules say Wichita Life employees (and their households) can't enter, so staff
-- accounts never win the draw, and the entrants list marks them. (A staff account had 13 of the
-- first giveaway's 24 entries.)
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
    join public.profiles p on p.id = e.user_id
    where e.giveaway_id = draw_giveaway_winner.giveaway
      and p.role not in ('admin', 'moderator')
    group by e.user_id
  ) t
  order by -ln(1 - random()) / t.n
  limit 1;
  if winner is null then raise exception 'No eligible entries yet (staff can''t win).'; end if;
  update public.giveaways set winner_user_id = winner where id = draw_giveaway_winner.giveaway;
  return query select * from public.giveaway_winner(draw_giveaway_winner.giveaway);
end;
$$;

drop function public.giveaway_entrants(uuid);
create function public.giveaway_entrants(giveaway uuid)
returns table (user_id uuid, display_name text, email text, entries bigint, kinds jsonb, entered_at timestamptz, staff boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text, sum(e.entries)::bigint,
      jsonb_object_agg(e.kind, e.entries), min(e.created_at), p.role in ('admin', 'moderator')
    from public.giveaway_entries e
    join public.profiles p on p.id = e.user_id
    join auth.users u on u.id = e.user_id
    where e.giveaway_id = giveaway_entrants.giveaway
    group by p.id, p.display_name, u.email, p.role
    order by 7, 4 desc, 6;
end $$;
revoke execute on function public.giveaway_entrants(uuid) from public, anon;
grant execute on function public.giveaway_entrants(uuid) to authenticated;
