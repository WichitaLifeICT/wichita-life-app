-- Events friends sent you show on Today until you open them, so nobody misses one when their phone
-- doesn't allow notifications (the push only reaches phones that do).
--   * event_sends.seen_at: when you opened the event.
--   * event_inbox(): the last few events friends sent you that you haven't opened, still upcoming.
--   * mark_event_seen(event): opening the event marks what friends sent you about it as seen.

alter table public.event_sends add column seen_at timestamptz;

create or replace function public.event_inbox()
returns table (event_id uuid, title text, starts_at timestamptz, all_day boolean, venue text, from_name text, note text, sent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (e.id) e.id, e.title, e.starts_at, e.all_day, e.venue, split_part(p.display_name, ' ', 1), s.note, s.created_at
  from public.event_sends s
  join public.events e on e.id = s.event_id and not e.hidden
  join public.profiles p on p.id = s.from_id
  where s.to_id = auth.uid()
    and s.seen_at is null
    and s.created_at > now() - interval '14 days'
    and e.starts_at > now() - interval '6 hours'
  order by e.id, s.created_at desc
  limit 5;
$$;
revoke all on function public.event_inbox() from public, anon;
grant execute on function public.event_inbox() to authenticated;

create or replace function public.mark_event_seen(event uuid)
returns void language sql security definer set search_path = public as $$
  update public.event_sends set seen_at = now()
  where event_id = event and to_id = auth.uid() and seen_at is null;
$$;
revoke all on function public.mark_event_seen(uuid) from public, anon;
grant execute on function public.mark_event_seen(uuid) to authenticated;
