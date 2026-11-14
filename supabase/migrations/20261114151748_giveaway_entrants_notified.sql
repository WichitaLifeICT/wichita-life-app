-- When staff told everyone who entered who won (Staff tools -> Giveaways), so it isn't sent twice.
-- Drawing a new winner clears it, along with the winner's name in the app and their notification.
alter table public.giveaways add column entrants_notified_at timestamptz;

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
    where e.giveaway_id = draw_giveaway_winner.giveaway and not private.uncounted(e.user_id)
    group by e.user_id
  ) t
  order by -ln(1 - random()) / t.n
  limit 1;
  if winner is null then raise exception 'No eligible entries yet (staff and test accounts can''t win).'; end if;
  update public.giveaways
    set winner_user_id = winner, winner_label = null, winner_notified_at = null, entrants_notified_at = null
    where id = draw_giveaway_winner.giveaway;
  return query select * from public.giveaway_winner(draw_giveaway_winner.giveaway);
end;
$$;
