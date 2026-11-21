-- Notes sent with an event can be up to 30 words (was 10), and up to 240 characters.
alter table public.event_sends drop constraint if exists event_sends_note_check;
alter table public.event_sends add constraint event_sends_note_check
  check (note is null or char_length(note) between 1 and 240);

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
  if clean is not null and (char_length(clean) > 240 or array_length(string_to_array(clean, ' '), 1) > 30) then
    raise exception 'Keep the note to 30 words' using errcode = 'check_violation';
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
