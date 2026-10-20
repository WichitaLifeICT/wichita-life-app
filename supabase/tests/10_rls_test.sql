-- Security rules: run after the migration (see .github/workflows/ci.yml).
-- Each block raises an exception if a rule doesn't hold.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{"display_name":"Ana"}'),
  ('22222222-2222-2222-2222-222222222222', '{}'),
  ('33333333-3333-3333-3333-333333333333', '{}');
insert into public.giveaways (id, title, prize, starts_at, ends_at, rules_url)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Test', '$100', now() - interval '1 day', now() + interval '1 day', 'https://example.com');
insert into public.meetups (id, title, starts_at, area, capacity)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Walk', now() + interval '1 day', 'Riverside', 2);

-- New accounts get a profile and notification settings
do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'profiles not created'; end if;
  if (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') <> 'Ana' then raise exception 'display name not copied'; end if;
  if (select count(*) from public.notification_prefs) <> 3 then raise exception 'prefs not created'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- Members can enter, but can't award themselves bonus entries
insert into public.giveaway_entries (giveaway_id, user_id, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'enter');
do $$ begin
  begin
    insert into public.giveaway_entries (giveaway_id, user_id, kind, entries) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'referral', 3);
    raise exception 'bonus entry was allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- Members can't RSVP for someone else
do $$ begin
  begin
    insert into public.rsvps (meetup_id, user_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
    raise exception 'rsvp for someone else was allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- Board posts must start as pending
do $$ begin
  begin
    insert into public.threads (author_id, category, title, status) values ('11111111-1111-1111-1111-111111111111', 'ask', 'Skip review', 'approved');
    raise exception 'approved post was allowed';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.threads (author_id, category, title) values ('11111111-1111-1111-1111-111111111111', 'ask', 'Best tacos?');

-- Members can't make themselves admin
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'self-promotion was allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- Capacity: two going, the third waitlisted, and moved up when someone cancels
insert into public.rsvps (meetup_id, user_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.rsvps (meetup_id, user_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
-- Someone else's pending post stays hidden
do $$ begin
  if exists (select 1 from public.threads) then raise exception 'pending post visible to others'; end if;
end $$;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
insert into public.rsvps (meetup_id, user_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
reset role;

do $$ begin
  if (select status from public.rsvps where user_id = '33333333-3333-3333-3333-333333333333') <> 'waitlist' then raise exception 'third rsvp not waitlisted'; end if;
  if (select going_count from public.meetups where id = 'bbbbbbbb-0000-0000-0000-000000000001') <> 2 then raise exception 'going_count wrong'; end if;
  if (select waitlist_count from public.meetups where id = 'bbbbbbbb-0000-0000-0000-000000000001') <> 1 then raise exception 'waitlist_count wrong'; end if;
  if (select entrant_count from public.giveaways where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 1 then raise exception 'entrant_count wrong'; end if;
end $$;
delete from public.rsvps where user_id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select status from public.rsvps where user_id = '33333333-3333-3333-3333-333333333333') <> 'going' then raise exception 'waitlist not promoted'; end if;
  if (select going_count from public.meetups where id = 'bbbbbbbb-0000-0000-0000-000000000001') <> 2 then raise exception 'going_count not updated after cancel'; end if;
  if (select waitlist_count from public.meetups where id = 'bbbbbbbb-0000-0000-0000-000000000001') <> 0 then raise exception 'waitlist_count not updated after cancel'; end if;
end $$;

-- Members can't edit counts directly
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.meetups set going_count = 0 where id = 'bbbbbbbb-0000-0000-0000-000000000001';
reset role;
do $$ begin
  if (select going_count from public.meetups where id = 'bbbbbbbb-0000-0000-0000-000000000001') <> 2 then raise exception 'member changed a count'; end if;
end $$;

-- Helper functions are out of the API schema
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('is_staff', 'handle_new_user', 'rsvp_apply_capacity', 'rsvp_promote_waitlist'))
  then raise exception 'helper function still in public schema'; end if;
end $$;

-- Scheduled-job secret: only the real secret passes, and members can't call the check
do $$ begin
  if not public.verify_cron_secret((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')) then raise exception 'cron secret rejected'; end if;
  if public.verify_cron_secret('wrong') then raise exception 'wrong cron secret accepted'; end if;
  if has_function_privilege('authenticated', 'public.verify_cron_secret(text)', 'execute') then raise exception 'members can call verify_cron_secret'; end if;
  if (select count(*) from cron.job where jobname in ('sync-beehiiv', 'sync-news')) <> 2 then raise exception 'sync jobs not scheduled'; end if;
end $$;

-- Google sign-ins get a short display name
insert into auth.users (id, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', '{"full_name":"Maria de la Cruz"}');
do $$ begin
  if (select display_name from public.profiles where id = '44444444-4444-4444-4444-444444444444') <> 'Maria C.' then raise exception 'google name not shortened'; end if;
end $$;

-- Saving an upcoming event earns the bonus entry, but only after entering
insert into public.events (id, source, source_id, title, starts_at)
  values ('cccccccc-0000-0000-0000-000000000001', 'manual', 'bonus-test', 'Bonus test', now() + interval '2 day');
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
insert into public.saved_events (user_id, event_id) values ('44444444-4444-4444-4444-444444444444', 'cccccccc-0000-0000-0000-000000000001');
reset role;
do $$ begin
  if exists (select 1 from public.giveaway_entries where user_id = '44444444-4444-4444-4444-444444444444') then raise exception 'bonus given without entering'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
insert into public.giveaway_entries (giveaway_id, user_id, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'enter');
reset role;
do $$ begin
  if (select coalesce(sum(entries), 0) from public.giveaway_entries where user_id = '44444444-4444-4444-4444-444444444444') <> 2 then raise exception 'save-event bonus not given'; end if;
end $$;

-- Staff emails become admins on sign-up; everyone gets an invite code
insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'WichitaLifeICT@gmail.com', '{"display_name":"Staff"}'),
  ('66666666-6666-6666-6666-666666666666', 'friend@example.com', '{"display_name":"Friend"}');
do $$ begin
  if (select role from public.profiles where id = '55555555-5555-5555-5555-555555555555') <> 'admin' then raise exception 'staff email not made admin'; end if;
  if (select role from public.profiles where id = '66666666-6666-6666-6666-666666666666') <> 'member' then raise exception 'member made staff'; end if;
  if exists (select 1 from public.profiles where referral_code !~ '^[A-Z2-9]{6}$') then raise exception 'bad invite code'; end if;
end $$;

-- Refer a friend: Maria (entered) refers Friend, gets +3; can't claim twice or use own code
update public.profiles set referral_code = 'MARIA2' where id = '44444444-4444-4444-4444-444444444444';
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  if public.claim_referral('MARIA2') <> 'own_code' then raise exception 'own code accepted'; end if;
end $$;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
do $$ begin
  if public.claim_referral('nope00') <> 'not_found' then raise exception 'bad code accepted'; end if;
  if public.claim_referral(' maria2 ') <> 'ok' then raise exception 'referral not claimed'; end if;
  if public.claim_referral('MARIA2') <> 'already_claimed' then raise exception 'referral claimed twice'; end if;
end $$;
reset role;
do $$ begin
  if (select entries from public.giveaway_entries where user_id = '44444444-4444-4444-4444-444444444444' and kind = 'referral') <> 3 then raise exception 'referral bonus not given'; end if;
end $$;

-- Only staff can draw winners or see attendee emails
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  begin
    perform public.draw_giveaway_winner('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'member drew a winner';
  exception when insufficient_privilege then null; end;
  begin
    perform public.meetup_attendees('bbbbbbbb-0000-0000-0000-000000000001');
    raise exception 'member saw attendees';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin
  if (select count(*) from public.draw_giveaway_winner('aaaaaaaa-0000-0000-0000-000000000001')) <> 1 then raise exception 'no winner drawn'; end if;
  if (select count(*) from public.meetup_attendees('bbbbbbbb-0000-0000-0000-000000000001')) = 0 then raise exception 'staff cannot see attendees'; end if;
end $$;
reset role;

select 'all security tests passed' as result;
