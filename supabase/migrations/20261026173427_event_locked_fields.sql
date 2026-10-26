-- Hand-corrected event details (a real start time, venue or description) that the calendar sync
-- must not overwrite until the What's Good calendar itself is fixed. List the fields in
-- `locked_fields`; sync updates (they always set a new synced_at) keep the old values for those.
alter table public.events add column locked_fields text[] not null default '{}';

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
  if 'title' = any(old.locked_fields) then new.title := old.title; end if;
  if 'venue' = any(old.locked_fields) then new.venue := old.venue; end if;
  if 'address' = any(old.locked_fields) then new.address := old.address; end if;
  if 'description' = any(old.locked_fields) then new.description := old.description; end if;
  new.locked_fields := old.locked_fields;
  return new;
end;
$$;
revoke execute on function private.keep_locked_event_fields() from public, anon, authenticated;
create trigger events_keep_locked_fields before update on public.events
  for each row execute function private.keep_locked_event_fields();
