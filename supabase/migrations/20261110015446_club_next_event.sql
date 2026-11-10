-- A club's next specific event (e.g. ICT YA Hangouts' "next hangout: 11/21 · Pickleball Tourney"), set by the
-- club checker (Grok, via club-updates) or by staff. Only real dates: no date, nothing shows.
-- It shows on the club's card and under Upcoming meetups on Meet, and as an Events row (source 'club';
-- the calendar sync only touches its own source). The time isn't known, so the event is "Time TBD"
-- at midnight Wichita time, the same way the calendar stores its time-TBD events.
alter table public.clubs
  add column next_on date,
  add column next_title text check (next_title is null or length(next_title) between 1 and 120);

create or replace function private.sync_club_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  today date := (now() at time zone 'America/Chicago')::date;
  from_today timestamptz := (now() at time zone 'America/Chicago')::date::timestamp at time zone 'America/Chicago';
  c public.clubs := case when tg_op = 'DELETE' then old else new end;
  keep text;
begin
  if tg_op <> 'DELETE' and new.next_on is not null and new.next_on >= today and new.active and not new.pending then
    keep := new.id::text || ':' || new.next_on::text;
  end if;
  -- This club's upcoming events other than the current one go (the date moved, was cleared, or the club was
  -- hidden or deleted). Past ones stay, so saves and plans that used them keep their history.
  delete from public.events
   where source = 'club' and split_part(source_id, ':', 1) = c.id::text
     and source_id is distinct from keep and starts_at >= from_today;
  if keep is not null then
    insert into public.events (source, source_id, title, description, starts_at, all_day, time_tbd, url, tags, calendar_tags, synced_at)
    values ('club', keep, new.name || ': ' || coalesce(new.next_title, 'next meetup'), new.description,
      new.next_on::timestamp at time zone 'America/Chicago', false, true, new.url,
      array['meetups'], array['Make Friends', 'Local Groups'], now())
    on conflict (source, source_id) do update
      set title = excluded.title, description = excluded.description, url = excluded.url, synced_at = now();
  end if;
  return null;
end;
$$;
revoke execute on function private.sync_club_event() from public, anon, authenticated;

create trigger club_next_event
  after insert or update of next_on, next_title, name, url, description, active, pending or delete on public.clubs
  for each row execute function private.sync_club_event();
