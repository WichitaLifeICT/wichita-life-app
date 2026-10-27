-- Events whose calendar listing had no real time (a 12:00 AM start) show "Time TBD" instead of
-- "All day". Sync sets it; lock 'time_tbd' in locked_fields to keep a hand-set value (e.g. an
-- exhibit that really is all day).
alter table public.events add column time_tbd boolean not null default false;

create or replace function private.keep_locked_event_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.locked_fields = '{}' or new.synced_at is not distinct from old.synced_at then
    return new;
  end if;
  if 'starts_at' = any(old.locked_fields) then new.starts_at := old.starts_at; end if;
  if 'ends_at' = any(old.locked_fields) then new.ends_at := old.ends_at; end if;
  if 'all_day' = any(old.locked_fields) then new.all_day := old.all_day; end if;
  if 'time_tbd' = any(old.locked_fields) then new.time_tbd := old.time_tbd; end if;
  if 'title' = any(old.locked_fields) then new.title := old.title; end if;
  if 'venue' = any(old.locked_fields) then new.venue := old.venue; end if;
  if 'address' = any(old.locked_fields) then new.address := old.address; end if;
  if 'description' = any(old.locked_fields) then new.description := old.description; end if;
  new.locked_fields := old.locked_fields;
  return new;
end;
$$;
