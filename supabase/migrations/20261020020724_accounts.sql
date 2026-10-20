-- Accounts: names from Google sign-in, and the "save an event" giveaway bonus.

-- New accounts take their name from the sign-up form, or from Google ("Ana Lopez" -> "Ana L.").
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  display text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if display = '' and full_name <> '' then
    display := split_part(full_name, ' ', 1);
    if position(' ' in full_name) > 0 then
      display := display || ' ' || left(split_part(full_name, ' ', array_length(string_to_array(full_name, ' '), 1)), 1) || '.';
    end if;
  end if;
  insert into public.profiles (id, display_name) values (new.id, left(display, 40));
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 40) not valid;
alter table public.profiles add column onboarded_at timestamptz;

-- Bonus entry for saving an event, checked here instead of trusted from the app:
-- the member has entered the open giveaway and has saved an upcoming event.
create or replace function private.grant_save_event_bonus(member uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.giveaway_entries (giveaway_id, user_id, kind, entries)
  select g.id, member, 'save_event', 1
  from public.giveaways g
  where now() between g.starts_at and g.ends_at
    and exists (select 1 from public.giveaway_entries e where e.giveaway_id = g.id and e.user_id = member and e.kind = 'enter')
    and exists (
      select 1 from public.saved_events s join public.events ev on ev.id = s.event_id
      where s.user_id = member and ev.starts_at >= now() - interval '1 day')
  on conflict do nothing;
$$;

create or replace function private.on_save_or_enter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.grant_save_event_bonus(new.user_id);
  return null;
end;
$$;

revoke execute on function private.grant_save_event_bonus(uuid) from public, anon, authenticated;
revoke execute on function private.on_save_or_enter() from public, anon, authenticated;

create trigger saved_events_bonus after insert on public.saved_events
  for each row execute function private.on_save_or_enter();
create trigger giveaway_enter_bonus after insert on public.giveaway_entries
  for each row when (new.kind = 'enter') execute function private.on_save_or_enter();
