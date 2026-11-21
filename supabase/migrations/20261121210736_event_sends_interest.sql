-- Send an event to friends with a short note, and a public count of who's interested.
--   * event_interest_counts: how many members marked each event interested (saved it). Anyone can
--     see the number, never who. Test accounts (App Review) aren't counted.
--   * send_event: send an event to some of your friends, with an optional note of up to 10 words.
--     They get a push (friends notifications, held overnight like the rest) that opens the event.
--   * event_sent_to_me: on the event page, who sent you this event and what they said.

create or replace function public.event_interest_counts(events uuid[])
returns table (event_id uuid, interested int) language sql stable security definer set search_path = public as $$
  select s.event_id, count(*)::int
  from public.saved_events s join public.profiles p on p.id = s.user_id
  where s.event_id = any(events[1:200]) and not p.test_account
  group by s.event_id;
$$;
revoke all on function public.event_interest_counts(uuid[]) from public;
grant execute on function public.event_interest_counts(uuid[]) to anon, authenticated;

create table public.event_sends (
  event_id uuid not null references public.events (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  note text check (note is null or char_length(note) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (event_id, from_id, to_id)
);
create index event_sends_to_idx on public.event_sends (to_id, event_id);
alter table public.event_sends enable row level security;
revoke all on public.event_sends from anon, authenticated;

create or replace function public.send_event(event uuid, friends uuid[], note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  clean text := nullif(regexp_replace(btrim(coalesce(note, '')), '\s+', ' ', 'g'), '');
  sent uuid[];
begin
  if me is null then raise exception 'Sign in to send events' using errcode = 'insufficient_privilege'; end if;
  if not exists (select 1 from public.events e where e.id = event and not e.hidden) then
    raise exception 'That event isn''t listed anymore' using errcode = 'no_data_found';
  end if;
  if clean is not null and (char_length(clean) > 80 or array_length(string_to_array(clean, ' '), 1) > 10) then
    raise exception 'Keep the note to 10 words' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(friends, 1), 0) > 50 then
    raise exception 'Send it to 50 friends at most' using errcode = 'check_violation';
  end if;
  with ins as (
    insert into public.event_sends (event_id, from_id, to_id, note)
    select event, me, f, clean from (select distinct unnest(friends) as f) x
    where f <> me and private.are_friends(me, f)
    on conflict do nothing
    returning to_id
  ) select array_agg(to_id) into sent from ins;
  if sent is not null then
    perform private.notify('event_sent', jsonb_build_object('event', event, 'from', me, 'to', to_jsonb(sent), 'note', clean));
  end if;
  return coalesce(array_length(sent, 1), 0);
end $$;
revoke all on function public.send_event(uuid, uuid[], text) from public, anon;
grant execute on function public.send_event(uuid, uuid[], text) to authenticated;

create or replace function public.event_sent_to_me(event uuid)
returns table (name text, note text, sent_at timestamptz) language sql stable security definer set search_path = public as $$
  select split_part(p.display_name, ' ', 1), s.note, s.created_at
  from public.event_sends s join public.profiles p on p.id = s.from_id
  where s.event_id = event and s.to_id = auth.uid()
  order by s.created_at desc
  limit 5;
$$;
revoke all on function public.event_sent_to_me(uuid) from public, anon;
grant execute on function public.event_sent_to_me(uuid) to authenticated;
