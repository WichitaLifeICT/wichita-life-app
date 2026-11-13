-- Security rules: run after the migration (see .github/workflows/ci.yml).
-- Each block raises an exception if a rule doesn't hold.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
-- Pushes sent right away plus those held overnight (quiet hours depend on when the tests run).
create view public.test_sent_pushes as
  select body from net.requests
  union all select jsonb_build_object('job', job) || payload from private.push_queue;

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
  if has_function_privilege('authenticated', 'public.verify_club_updates_key(text)', 'execute') then raise exception 'members can check the club bot key'; end if;
  if public.verify_club_updates_key('wrong') then raise exception 'wrong club bot key accepted'; end if;
  if has_function_privilege('authenticated', 'public.whatsgood_api_key()', 'execute') or has_function_privilege('anon', 'public.whatsgood_api_key()', 'execute') then raise exception 'members can read the What''s Good key'; end if;
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
  if exists (select 1 from public.giveaway_entries where user_id = '44444444-4444-4444-4444-444444444444' and kind = 'referral' and entries > 0) then
    raise exception 'referral bonus given before the friend entered';
  end if;
end $$;
-- The friend enters, so Maria gets her +3
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
insert into public.giveaway_entries (giveaway_id, user_id, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'enter');
reset role;
do $$ begin
  if (select entries from public.giveaway_entries where user_id = '44444444-4444-4444-4444-444444444444' and kind = 'referral') <> 3 then raise exception 'referral bonus not given'; end if;
end $$;
-- An invite from the same Gmail inbox (dots, +tags) doesn't count
insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'jane.doe@gmail.com', '{}'),
  ('88888888-8888-8888-8888-888888888888', 'JaneDoe+win@gmail.com', '{}');
update public.profiles set referral_code = 'JANE22' where id = '77777777-7777-7777-7777-777777777777';
set role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
do $$ begin
  if public.claim_referral('JANE22') <> 'own_code' then raise exception 'same-inbox referral accepted'; end if;
end $$;
reset role;

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

-- News filter: blocked words hide headlines (whole words only) and re-check when the list changes
insert into public.news_items (source_name, title, url, published_at) values
 ('KSN','Trump rally draws crowd','u1',now()), ('KSN','Two killed in crash on Kellogg','u2',now()),
 ('KSN','New brewery opens in Delano','u3',now()), ('KSN','Deadline extended for property tax','u4',now()),
 ('KSN','Skill-building workshop at library','u5',now()), ('KSN','Police: man shot and killed','u6',now());
do $$ begin
  if (select string_agg(url, ',' order by url) from public.news_items where url like 'u_' and filtered) <> 'u1,u2,u6' then
    raise exception 'news filter wrong: %', (select string_agg(url, ',' order by url) from public.news_items where url like 'u_' and filtered);
  end if;
end $$;
-- The sync jobs save news as service_role, which can't use the private schema; the filter must still run.
grant select, insert, update on public.news_items to service_role;
set role service_role;
insert into public.news_items (source_name, title, url, published_at) values ('KSN', 'Man killed on I-135', 'u7', now());
reset role;
do $$ begin
  if not (select filtered from public.news_items where url = 'u7') then raise exception 'filter skipped for service_role'; end if;
end $$;
delete from public.news_blocked_words where word = 'trump';
do $$ begin
  if (select filtered from public.news_items where url = 'u1') then raise exception 'refilter after removing a word failed'; end if;
end $$;

-- Feedback: anyone can send it, nobody can send it as someone else, only staff read it
set role anon;
select set_config('request.jwt.claim.sub', '', false);
insert into public.feedback (kind, message) values ('idea', 'Add a live music tab please');
insert into public.feedback (kind, message) values ('spotlight', 'Nominee: The baker on Douglas');
do $$ begin
  begin
    insert into public.feedback (user_id, message) values ('11111111-1111-1111-1111-111111111111', 'Pretending to be Ana');
    raise exception 'feedback as someone else was allowed';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.feedback) then raise exception 'guest can read feedback'; end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.feedback (user_id, kind, message) values ('11111111-1111-1111-1111-111111111111', 'bug', 'Map is blank');
do $$ begin
  if exists (select 1 from public.feedback) then raise exception 'member can read feedback'; end if;
end $$;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin
  if (select count(*) from public.feedback) <> 3 then raise exception 'staff cannot read feedback'; end if;
  if (select count(*) from public.feedback_inbox('new')) <> 3 then raise exception 'feedback inbox wrong'; end if;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  begin
    perform public.feedback_inbox('all');
    raise exception 'member opened the feedback inbox';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Polls: vote once (changeable while open), results only after voting, suggestions wait for staff
insert into public.polls (id, question, ends_at) values ('cccccccc-0000-0000-0000-000000000001', 'Best coffee?', now() + interval '7 days');
insert into public.polls (id, question, starts_at, ends_at) values ('cccccccc-0000-0000-0000-000000000002', 'Best tacos?', now() - interval '9 days', now() - interval '2 days');
insert into public.poll_options (id, poll_id, label) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Reverie'),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'Espresso to Go Go'),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000002', 'Molino''s');
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  begin
    perform public.poll_results('cccccccc-0000-0000-0000-000000000001');
    raise exception 'saw results before voting';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.poll_results('cccccccc-0000-0000-0000-000000000002')) <> 1 then raise exception 'closed poll results hidden'; end if;
  begin
    insert into public.poll_votes (poll_id, user_id, option_id) values ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-000000000003');
    raise exception 'voted on a closed poll';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.poll_votes (poll_id, user_id, option_id) values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000001');
    raise exception 'voted as someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.poll_votes (poll_id, user_id, option_id) values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-000000000003');
    raise exception 'voted with another poll''s option';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.poll_votes (poll_id, user_id, option_id) values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-000000000001');
do $$ begin
  begin
    insert into public.poll_votes (poll_id, user_id, option_id) values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-000000000002');
    raise exception 'voted twice';
  exception when unique_violation then null; end;
end $$;
update public.poll_votes set option_id = 'dddddddd-0000-0000-0000-000000000002' where poll_id = 'cccccccc-0000-0000-0000-000000000001';
do $$ begin
  if (select votes from public.poll_results('cccccccc-0000-0000-0000-000000000001') where label = 'Espresso to Go Go') <> 1 then raise exception 'changed vote not counted'; end if;
  begin
    insert into public.poll_options (poll_id, label, suggested_by) values ('cccccccc-0000-0000-0000-000000000001', 'Sneaky', '22222222-2222-2222-2222-222222222222');
    raise exception 'suggestion skipped review';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.poll_options (poll_id, label, suggested_by, status) values ('cccccccc-0000-0000-0000-000000000001', 'Little Jerry''s', '22222222-2222-2222-2222-222222222222', 'pending');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  if exists (select 1 from public.poll_options where status = 'pending') then raise exception 'pending suggestion visible to others'; end if;
  if exists (select 1 from public.poll_votes) then raise exception 'saw someone else''s vote'; end if;
  if (select vote_count from public.polls where id = 'cccccccc-0000-0000-0000-000000000001') <> 1 then raise exception 'vote total wrong'; end if;
end $$;
reset role;

-- Weekly specials: everyone sees active ones, only staff add or change them
insert into public.weekly_specials (kind, title, venue, days, starts, ends) values
  ('happy_hour', 'Half-price apps', 'Test Bar', '{1,2,3,4,5}', '16:00', '18:00'),
  ('trivia', 'Old trivia night', 'Gone Pub', '{2}', '19:00', null);
update public.weekly_specials set active = false where venue = 'Gone Pub';
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.weekly_specials) <> 1 then raise exception 'inactive special visible'; end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  begin
    insert into public.weekly_specials (kind, title, venue, days) values ('trivia', 'Fake', 'Nowhere', '{1}');
    raise exception 'member added a weekly special';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Hidden newsletter posts aren't public
insert into public.posts (id, title, slug, url, kind, published_at, hidden) values
  ('post_hidden_test', 'Two quick things...', 'two-quick-things', 'https://example.com/p', 'daily', now(), true);
set role anon;
do $$ begin
  if exists (select 1 from public.posts where id = 'post_hidden_test') then raise exception 'hidden post is public'; end if;
end $$;
reset role;

-- Places: hidden, closed and (by default) chains never get picked; members can't edit
-- (starting from just these three; migrations add real restaurants)
delete from public.places;
insert into public.places (name, kind, categories, chain, status) values
  ('Local Taco', 'restaurant', '{mexican}', false, 'active'),
  ('Big Chain Burger', 'fast_food', '{burgers}', true, 'active'),
  ('Gone Diner', 'restaurant', '{breakfast}', false, 'closed');
set role anon;
do $$ declare i int; n text; begin
  for i in 1..20 loop
    select name into n from public.random_place(null, true, '{}');
    if n <> 'Local Taco' then raise exception 'picked % with local only', n; end if;
  end loop;
  if exists (select 1 from public.random_place('breakfast', false, '{}')) then raise exception 'closed place picked'; end if;
  if (select count(*) from public.places) <> 2 then raise exception 'closed place visible'; end if;
  if exists (select 1 from public.random_place(null, true, (select array_agg(id) from public.places where name = 'Local Taco'))) then
    raise exception 'skip list ignored';
  end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  update public.places set note = 'hacked' where name = 'Local Taco';
  if exists (select 1 from public.places where note = 'hacked') then raise exception 'member edited a place'; end if;
end $$;
reset role;

-- Search finds visible things only, with every word required
set role anon;
do $$ begin
  if not exists (select 1 from public.search_all('local taco') where kind = 'place') then raise exception 'search missed a place'; end if;
  if exists (select 1 from public.search_all('gone diner')) then raise exception 'search found a closed place'; end if;
  if exists (select 1 from public.search_all('two quick')) then raise exception 'search found a hidden post'; end if;
  if exists (select 1 from public.search_all('t')) then raise exception 'one-letter search returned results'; end if;
  if exists (select 1 from public.search_all('local taco zzzz')) then raise exception 'search ignored a word'; end if;
  if not exists (select 1 from public.search_all('half-price mon') where kind = 'weekly') then raise exception 'search missed a weekly special by day'; end if;
end $$;
reset role;

-- Dismissed events are private; push audience counts are staff-only
insert into public.push_tokens (user_id, token, platform) values ('11111111-1111-1111-1111-111111111111', 'ExponentPushToken[test]', 'ios');
update public.profiles set interests = '{music}' where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.dismissed_events (user_id, event_id) select '11111111-1111-1111-1111-111111111111', id from public.events limit 1;
do $$ begin
  begin
    insert into public.dismissed_events (user_id, event_id) select '22222222-2222-2222-2222-222222222222', id from public.events limit 1;
    raise exception 'dismissed an event for someone else';
  exception when insufficient_privilege then null; end;
  begin
    perform public.push_audience('weekend', '{}');
    raise exception 'member counted a push audience';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if exists (select 1 from public.dismissed_events) then raise exception 'saw someone else''s dismissed events'; end if;
end $$;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin
  if public.push_audience('weekend', '{music}') <> 1 then raise exception 'interest audience wrong'; end if;
  if public.push_audience('weekend', '{food}') <> 0 then raise exception 'interest audience not filtered'; end if;
  if public.push_audience('breaking', '{}') <> 0 then raise exception 'topic audience not filtered'; end if;
end $$;
reset role;

-- Voting during a giveaway earns +1 entry once, but members can't add it themselves
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.poll_votes (poll_id, user_id, option_id) values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000001');
do $$ begin
  if (select entries from public.giveaway_entries where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'poll_vote') <> 1 then
    raise exception 'no bonus entry for voting';
  end if;
  begin
    insert into public.giveaway_entries (giveaway_id, user_id, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'poll_vote');
    raise exception 'member added a vote bonus themselves';
  exception when insufficient_privilege or unique_violation then null; end;
end $$;
reset role;

-- Members can suggest weekly specials, which stay hidden until staff approve
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.weekly_specials (kind, title, venue, days, pending, active, suggested_by)
  values ('trivia', 'Suggested trivia', 'Some Pub', '{3}', true, false, '22222222-2222-2222-2222-222222222222');
do $$ begin
  if exists (select 1 from public.weekly_specials where title = 'Suggested trivia') then raise exception 'pending suggestion is visible'; end if;
  begin
    insert into public.weekly_specials (kind, title, venue, days, pending, active, suggested_by)
      values ('trivia', 'Sneaky live special', 'Some Pub', '{3}', true, true, '22222222-2222-2222-2222-222222222222');
    raise exception 'suggestion went live without review';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.weekly_specials (kind, title, venue, days, pending, active, suggested_by)
      values ('trivia', 'As someone else', 'Some Pub', '{3}', true, false, '11111111-1111-1111-1111-111111111111');
    raise exception 'suggested as someone else';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.weekly_specials (kind, title, venue, days, pending, active, suggested_by) values
  ('trivia', 's2 night', 'Pub', '{1}', true, false, '22222222-2222-2222-2222-222222222222'),
  ('trivia', 's3 night', 'Pub', '{1}', true, false, '22222222-2222-2222-2222-222222222222'),
  ('trivia', 's4 night', 'Pub', '{1}', true, false, '22222222-2222-2222-2222-222222222222'),
  ('trivia', 's5 night', 'Pub', '{1}', true, false, '22222222-2222-2222-2222-222222222222');
do $$ begin
  begin
    insert into public.weekly_specials (kind, title, venue, days, pending, active, suggested_by)
      values ('trivia', 's6 night', 'Pub', '{1}', true, false, '22222222-2222-2222-2222-222222222222');
    raise exception 'more than 5 suggestions a day';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Clubs and groups: members can suggest them; suggestions stay hidden until staff approve
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if not exists (select 1 from public.clubs where name = 'Run 316') then raise exception 'seeded club not visible'; end if;
  begin
    insert into public.clubs (name, category, url) values ('Live club', 'run', 'https://example.com');
    raise exception 'member added a live club';
  exception when insufficient_privilege then null; end;
  begin
    update public.meetups set signup_url = 'https://evil.example' where true;
    if exists (select 1 from public.meetups where signup_url = 'https://evil.example') then raise exception 'member edited a meetup link'; end if;
  exception when insufficient_privilege then null; end;
end $$;
insert into public.clubs (name, category, url, pending, active, suggested_by)
  values ('Suggested club', 'games', 'https://example.com', true, false, '22222222-2222-2222-2222-222222222222');
insert into public.groups (slug, name, description, pending, suggested_by)
  values ('suggested-group-x1', 'Suggested group', 'People who like things', true, '22222222-2222-2222-2222-222222222222');
do $$ begin
  if exists (select 1 from public.clubs where name = 'Suggested club') then raise exception 'pending club is visible'; end if;
  if exists (select 1 from public.groups where name = 'Suggested group') then raise exception 'pending group is visible'; end if;
  begin
    insert into public.groups (slug, name, pending, suggested_by) values ('live-group-x1', 'Live group', false, '22222222-2222-2222-2222-222222222222');
    raise exception 'member added a live group';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.clubs (name, category, url, pending, active, suggested_by) values
  ('c3', 'other', 'https://example.com', true, false, '22222222-2222-2222-2222-222222222222'),
  ('c4', 'other', 'https://example.com', true, false, '22222222-2222-2222-2222-222222222222'),
  ('c5', 'other', 'https://example.com', true, false, '22222222-2222-2222-2222-222222222222');
do $$ begin
  begin
    insert into public.clubs (name, category, url, pending, active, suggested_by)
      values ('c6', 'other', 'https://example.com', true, false, '22222222-2222-2222-2222-222222222222');
    raise exception 'more than 5 club suggestions';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Group boards: members post in their group; trusted posters skip review; two reports hide a post
insert into public.groups (id, slug, name) values ('cccccccc-0000-0000-0000-000000000001', 'test-group', 'Test group');
insert into public.group_members (group_id, user_id) values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  begin
    insert into public.threads (author_id, category, title, group_id)
      values ('33333333-3333-3333-3333-333333333333', 'group', 'Not a member', 'cccccccc-0000-0000-0000-000000000001');
    raise exception 'non-member posted in a group';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.threads (id, author_id, category, title, group_id)
  values ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'group', 'First group post', 'cccccccc-0000-0000-0000-000000000001');
reset role;
do $$ begin
  if (select status from public.threads where id = 'dddddddd-0000-0000-0000-000000000001') <> 'pending' then raise exception 'first post skipped review'; end if;
end $$;
update public.threads set status = 'approved' where id = 'dddddddd-0000-0000-0000-000000000001';
-- only accounts at least a week old count toward hiding a post
update public.profiles set created_at = now() - interval '30 days' where id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.threads (id, author_id, category, title, group_id)
  values ('dddddddd-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'group', 'Second group post', 'cccccccc-0000-0000-0000-000000000001');
insert into public.reports (reporter_id, thread_id, reason) values ('22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-000000000002', 'test');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if not exists (select 1 from public.threads where id = 'dddddddd-0000-0000-0000-000000000002') then raise exception 'trusted post not live'; end if;
end $$;
insert into public.reports (reporter_id, thread_id, reason) values ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000002', 'test');
do $$ begin
  if exists (select 1 from public.threads where id = 'dddddddd-0000-0000-0000-000000000002') then raise exception 'twice-reported post still visible'; end if;
end $$;
reset role;

-- Members can't list a group's members or size up a group push
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  begin
    perform * from public.group_member_list((select id from public.groups limit 1));
    raise exception 'member listed a group''s members';
  exception when insufficient_privilege then null; end;
  begin
    perform public.group_push_audience((select id from public.groups limit 1));
    raise exception 'member counted a group push';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Members can't see the club bot's link or its updates
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  begin
    perform public.club_updates_link();
    raise exception 'member read the club bot link';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.club_updates) then raise exception 'member sees club updates'; end if;
end $$;
reset role;

-- Question of the day: answering enters you in the running giveaway (+1 a day) and doesn't count as a Wichita vote
insert into public.polls (id, question, starts_at, ends_at, daily, allow_suggestions)
  values ('cccccccc-0000-0000-0000-0000000000d1', 'Best patio?', now() - interval '1 hour', now() + interval '1 hour', true, false);
insert into public.poll_options (id, poll_id, label) values
  ('dddddddd-0000-0000-0000-0000000000d1', 'cccccccc-0000-0000-0000-0000000000d1', 'Nortons');
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
insert into public.poll_votes (poll_id, user_id, option_id)
  values ('cccccccc-0000-0000-0000-0000000000d1', '33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-0000000000d1');
reset role;
do $$ begin
  if not exists (select 1 from public.giveaway_entries where user_id = '33333333-3333-3333-3333-333333333333' and kind = 'enter')
    then raise exception 'daily answer did not enter the giveaway'; end if;
  if (select entries from public.giveaway_entries where user_id = '33333333-3333-3333-3333-333333333333' and kind = 'daily_question') <> 1
    then raise exception 'daily answer not counted once'; end if;
  if exists (select 1 from public.giveaway_entries where user_id = '33333333-3333-3333-3333-333333333333' and kind = 'poll_vote')
    then raise exception 'daily answer counted as a Wichita vote'; end if;
end $$;

-- Hand-corrected event fields survive a calendar sync
insert into public.events (id, source, source_id, title, starts_at, all_day, url, synced_at)
  values ('eeeeeeee-0000-0000-0000-0000000000f1', 'wichitalife_events', 'lock-test', 'Tosca', '2026-10-30 05:00+00', true, 'https://x', now() - interval '1 hour');
update public.events set starts_at = '2026-10-31 00:00+00', all_day = false, locked_fields = '{starts_at,all_day}'
  where id = 'eeeeeeee-0000-0000-0000-0000000000f1';
update public.events set starts_at = '2026-10-30 05:00+00', all_day = true, title = 'Tosca!', synced_at = now()
  where id = 'eeeeeeee-0000-0000-0000-0000000000f1';
do $$ begin
  if (select starts_at from public.events where id = 'eeeeeeee-0000-0000-0000-0000000000f1') <> '2026-10-31 00:00+00'
    then raise exception 'sync overwrote a locked start time'; end if;
  if (select all_day from public.events where id = 'eeeeeeee-0000-0000-0000-0000000000f1') then raise exception 'sync overwrote locked all_day'; end if;
  if (select title from public.events where id = 'eeeeeeee-0000-0000-0000-0000000000f1') <> 'Tosca!' then raise exception 'unlocked field not synced'; end if;
end $$;
delete from public.events where id = 'eeeeeeee-0000-0000-0000-0000000000f1';

-- Plans are private; a shared plan is readable by its link only, and only the owner can share
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.plans (id, title) values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'This weekend');
insert into public.plan_items (plan_id, kind, note) values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'note', 'Pick up Sam at 6');
do $$ begin
  begin
    update public.plans set share_code = 'guessable' where id = 'bbbbbbbb-0000-0000-0000-0000000000a1';
    raise exception 'member set their own share code';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if exists (select 1 from public.plans where id = 'bbbbbbbb-0000-0000-0000-0000000000a1') then raise exception 'saw someone else''s plan'; end if;
  if public.get_plan('bbbbbbbb-0000-0000-0000-0000000000a1') is not null then raise exception 'get_plan leaked by id'; end if;
  begin
    perform public.set_plan_sharing('bbbbbbbb-0000-0000-0000-0000000000a1', true);
    raise exception 'shared someone else''s plan';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.plan_items (plan_id, kind, note) values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'note', 'sneaky');
    raise exception 'added to someone else''s plan';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ declare code text; begin
  code := public.set_plan_sharing('bbbbbbbb-0000-0000-0000-0000000000a1', true);
  if code is null or length(code) < 10 then raise exception 'no share code'; end if;
  if public.set_plan_sharing('bbbbbbbb-0000-0000-0000-0000000000a1', true) <> code then raise exception 'share code changed'; end if;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
  if (public.get_plan(code => code) ->> 'title') <> 'This weekend' then raise exception 'shared plan not readable'; end if;
  if (public.get_plan(code => code) ->> 'mine')::boolean then raise exception 'shared plan marked mine'; end if;
  if jsonb_array_length(public.get_plan(code => code) -> 'items') <> 1 then raise exception 'shared plan items missing'; end if;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
  perform public.set_plan_sharing('bbbbbbbb-0000-0000-0000-0000000000a1', false);
  if public.get_plan(code => code) is not null then raise exception 'unshared plan still readable'; end if;
end $$;
reset role;

-- Public plans: members can post but not approve; approved plans show in the feed and can be
-- copied; a new note sends an approved plan back for review
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.plans (id, title) values ('bbbbbbbb-0000-0000-0000-0000000000b1', 'Date night in Delano');
insert into public.plan_items (plan_id, kind, note) values ('bbbbbbbb-0000-0000-0000-0000000000b1', 'note', 'Dinner first');
update public.plans set public_status = 'pending' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
do $$ begin
  begin
    update public.plans set public_status = 'approved' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
    raise exception 'member approved their own plan';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.get_public_plans()) <> 0 then raise exception 'pending plan in the feed'; end if;
end $$;
reset role;
update public.plans set public_status = 'approved' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ declare copied uuid; begin
  if jsonb_array_length(public.get_public_plans()) <> 1 then raise exception 'approved plan not in the feed'; end if;
  if (public.get_plan('bbbbbbbb-0000-0000-0000-0000000000b1') ->> 'title') <> 'Date night in Delano' then raise exception 'public plan not readable'; end if;
  copied := public.copy_plan('bbbbbbbb-0000-0000-0000-0000000000b1');
  if (select count(*) from public.plan_items where plan_id = copied) <> 1 then raise exception 'copy missing items'; end if;
  if (select public_status from public.plans where id = copied) <> 'private' then raise exception 'copy not private'; end if;
  begin
    perform public.copy_plan('bbbbbbbb-0000-0000-0000-0000000000a1');
    raise exception 'copied a private plan';
  exception when no_data_found then null; end;
  insert into public.reports (reporter_id, plan_id, reason) values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'spam');
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.plan_items (plan_id, kind, note) values ('bbbbbbbb-0000-0000-0000-0000000000b1', 'note', 'Then karaoke');
do $$ begin
  if (select public_status from public.plans where id = 'bbbbbbbb-0000-0000-0000-0000000000b1') <> 'pending'
    then raise exception 'new note did not send the plan back for review'; end if;
end $$;
reset role;

-- Streaks: answering on consecutive days counts up; every 7th day in a row adds a bonus entry
do $$ declare q uuid; d int; begin
  for d in 0..6 loop
    insert into public.polls (id, question, starts_at, ends_at, published, daily)
      values (gen_random_uuid(), 'Streak question number ' || d || '?', now() - interval '1 hour' - (d || ' days')::interval, now() + interval '1 day', true, true)
      returning id into q;
    insert into public.poll_options (poll_id, label, status) values (q, 'Yes', 'approved');
    insert into public.poll_votes (poll_id, user_id, option_id, created_at)
      select q, '55555555-5555-5555-5555-555555555555', o.id, now() - (d || ' days')::interval
      from public.poll_options o where o.poll_id = q;
  end loop;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin
  if public.my_streak() <> 7 then raise exception 'streak is %, expected 7', public.my_streak(); end if;
end $$;
reset role;

-- I'm in: friends with the link can join; the owner is told; strangers without it can't
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ declare code text; begin
  code := public.set_plan_sharing('bbbbbbbb-0000-0000-0000-0000000000a1', true);
  perform set_config('test.code', code, false);
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if not public.set_plan_join(true, code => current_setting('test.code')) then raise exception 'could not join'; end if;
  if not (public.get_plan(code => current_setting('test.code')) ->> 'im_in')::boolean then raise exception 'im_in not set'; end if;
  -- Once you're in, you can open it by id too (it's under "Plans you're in").
  if public.get_plan('bbbbbbbb-0000-0000-0000-0000000000a1') is null then raise exception 'joiner cannot open the plan by id'; end if;
end $$;
-- Someone without the link can't join a private plan by its id
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  begin
    perform public.set_plan_join(true, 'bbbbbbbb-0000-0000-0000-0000000000a1');
    raise exception 'joined a private plan by id';
  exception when no_data_found then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.test_sent_pushes where body ->> 'job' = 'plan_join') <> 1 then raise exception 'owner not notified'; end if;
end $$;

-- Friends: a friend link makes you friends; a request waits for an answer; friends see plans
-- shown to friends; plans sent to a friend show for them; blocking unfriends
select set_config('test.friend_code', (select friend_code from public.profiles where id = '11111111-1111-1111-1111-111111111111'), false);
select set_config('test.referral_code', (select referral_code from public.profiles where id = '11111111-1111-1111-1111-111111111111'), false);
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  -- the public invite code isn't a friend link (column grants hide both codes; this test
  -- database doesn't enforce grants, so that part is checked on the live project)
  begin
    perform public.add_friend_by_code(current_setting('test.referral_code'));
    raise exception 'invite code worked as a friend link';
  exception when no_data_found then null; end;
  if (select friend_code from public.my_codes()) is null then raise exception 'my_codes empty'; end if;
  perform public.add_friend_by_code(lower(current_setting('test.friend_code')));
  -- tapping the link again doesn't push again
  perform public.add_friend_by_code(current_setting('test.friend_code'));
  if not private.are_friends('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333')
    then raise exception 'friend link did not make friends'; end if;
  if public.request_friend('22222222-2222-2222-2222-222222222222') <> 'pending' then raise exception 'request not pending'; end if;
  if private.are_friends('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')
    then raise exception 'request made friends without accepting'; end if;
  -- Ana's private plan isn't visible to a friend until she shows it to friends
  if public.get_plan('bbbbbbbb-0000-0000-0000-0000000000a1') is not null then raise exception 'friend saw a plan not shown to friends'; end if;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.plans set friends_can_see = true where id = 'bbbbbbbb-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    perform public.send_plan('bbbbbbbb-0000-0000-0000-0000000000a1', array['22222222-2222-2222-2222-222222222222'::uuid]);
  end;
  if exists (select 1 from public.plan_sends where to_id = '22222222-2222-2222-2222-222222222222')
    then raise exception 'sent a plan to a non-friend'; end if;
end $$;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if public.get_plan('bbbbbbbb-0000-0000-0000-0000000000a1') is null then raise exception 'friend could not see plan shown to friends'; end if;
  if jsonb_array_length(public.friends_plans()) < 1 then raise exception 'friends_plans empty'; end if;
end $$;
-- (22222222 said they're in on this plan earlier, so they may see it; check someone who isn't.)
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  if public.get_plan('bbbbbbbb-0000-0000-0000-0000000000a1') is not null then raise exception 'non-friend saw a friends plan'; end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  perform public.respond_friend('33333333-3333-3333-3333-333333333333', true);
  if not private.are_friends('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')
    then raise exception 'accepting did not make friends'; end if;
end $$;
insert into public.blocks (blocker_id, blocked_id) values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
do $$ begin
  if private.are_friends('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')
    then raise exception 'blocking did not unfriend'; end if;
end $$;
reset role;

-- Plans hold activities and your own spots; a spot on a public plan goes back for review
reset role;
insert into public.activities (id, name) values ('test-zoo', 'Sedgwick County Zoo') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.plan_items (plan_id, kind, activity_id) values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'activity', 'test-zoo');
insert into public.plan_items (plan_id, kind, note, address) values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'spot', 'Sam''s house', '123 Main');
do $$ begin
  if not exists (select 1 from jsonb_array_elements(public.get_plan('bbbbbbbb-0000-0000-0000-0000000000a1') -> 'items') x
    where x -> 'ref' ->> 'title' = 'Sedgwick County Zoo') then raise exception 'activity missing from plan'; end if;
  begin
    insert into public.plan_items (plan_id, kind, activity_id, ref_id) values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'activity', 'test-zoo', gen_random_uuid());
    raise exception 'activity with a ref_id was allowed';
  exception when check_violation then null; end;
end $$;
reset role;

-- Security fixes: repeat alerts are dropped; backdated rows get the real time; editing an approved
-- plan sends it back to review
reset role;
do $$ begin
  if (select count(*) from public.test_sent_pushes where body ->> 'job' = 'friend' and body ->> 'kind' = 'joined') <> 1
    then raise exception 'friend link pushed more than once'; end if;
  perform private.notify('friend', '{"kind":"request","to":"x","from":"y"}');
  perform private.notify('friend', '{"kind":"request","to":"x","from":"y"}');
  if (select count(*) from public.test_sent_pushes where body ->> 'to' = 'x') <> 1 then raise exception 'repeat push not dropped'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.feedback (user_id, kind, message, created_at) values ('22222222-2222-2222-2222-222222222222', 'idea', 'backdated test', '2020-01-01');
reset role;
do $$ begin
  if (select created_at from public.feedback where message = 'backdated test') < now() - interval '1 hour'
    then raise exception 'member backdated a row'; end if;
end $$;
update public.plans set public_status = 'approved' where id = 'bbbbbbbb-0000-0000-0000-0000000000a1';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.plan_items set note = 'edited after approval' where plan_id = 'bbbbbbbb-0000-0000-0000-0000000000a1' and kind = 'spot';
reset role;
do $$ begin
  if (select public_status from public.plans where id = 'bbbbbbbb-0000-0000-0000-0000000000a1') <> 'pending'
    then raise exception 'edit to an approved plan skipped review'; end if;
end $$;

-- Plans in the calendar: a member's private link lists their plan items (timed, all-day, a weekly
-- special's next night) and saved events; someone else's plan stays out until they're in it
reset role;
insert into public.plans (id, owner_id, title, starts_on, ends_on) values ('bbbbbbbb-0000-0000-0000-0000000000c1',
  '11111111-1111-1111-1111-111111111111', 'Cal weekend', (now() at time zone 'America/Chicago')::date + 1, (now() at time zone 'America/Chicago')::date + 2);
insert into public.weekly_specials (id, kind, title, venue, days, starts, ends)
  values ('dddddddd-0000-0000-0000-0000000000c1', 'trivia', 'Every night trivia', 'Cal Pub', '{0,1,2,3,4,5,6}', '19:00', '21:00');
insert into public.plan_items (plan_id, kind, note, on_date, at_time) values
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'note', 'Dinner at Mom''s', (now() at time zone 'America/Chicago')::date + 1, '18:30');
insert into public.plan_items (plan_id, kind, note, address, on_date) values
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'spot', 'Sam''s pool', '1 Pool Ln', (now() at time zone 'America/Chicago')::date + 2);
insert into public.plan_items (plan_id, kind, ref_id) values ('bbbbbbbb-0000-0000-0000-0000000000c1', 'special', 'dddddddd-0000-0000-0000-0000000000c1');
insert into public.plan_items (plan_id, kind, activity_id) values ('bbbbbbbb-0000-0000-0000-0000000000c1', 'activity', 'test-zoo');
insert into public.events (id, source, source_id, title, starts_at) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'manual', 'cal-test', 'Saved show', now() + interval '3 day');
insert into public.saved_events (user_id, event_id) values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1');
select set_config('test.ana_cal', (select calendar_token from public.profiles where id = '11111111-1111-1111-1111-111111111111'), false);
select set_config('test.ben_cal', (select calendar_token from public.profiles where id = '22222222-2222-2222-2222-222222222222'), false);
do $$ declare n int; r record; begin
  if length(current_setting('test.ana_cal')) <> 32 then raise exception 'calendar token too short'; end if;
  -- one plan: timed dinner, all-day pool day, trivia on its next night at 7, and a banner for the zoo
  select * into r from public.calendar_items(current_setting('test.ana_cal'), 'bbbbbbbb-0000-0000-0000-0000000000c1') where title = 'Dinner at Mom''s';
  if r.starts_at is null or (r.starts_at at time zone 'America/Chicago')::time <> '18:30' then raise exception 'timed item wrong: %', r; end if;
  select * into r from public.calendar_items(current_setting('test.ana_cal'), 'bbbbbbbb-0000-0000-0000-0000000000c1') where title = 'Sam''s pool';
  if r.all_day_on <> (now() at time zone 'America/Chicago')::date + 2 or r.starts_at is not null then raise exception 'all-day item wrong: %', r; end if;
  select * into r from public.calendar_items(current_setting('test.ana_cal'), 'bbbbbbbb-0000-0000-0000-0000000000c1') where title = 'Every night trivia';
  if (r.starts_at at time zone 'America/Chicago')::date <> (now() at time zone 'America/Chicago')::date + 1
    or (r.starts_at at time zone 'America/Chicago')::time <> '19:00' or r.ends_at - r.starts_at <> interval '2 hours'
    then raise exception 'special not on its next night: %', r; end if;
  select * into r from public.calendar_items(current_setting('test.ana_cal'), 'bbbbbbbb-0000-0000-0000-0000000000c1') where uid like 'plan-%';
  if r.details not like '%Sedgwick County Zoo%' or r.calendar_name <> 'Cal weekend' then raise exception 'banner wrong: %', r; end if;
  -- the feed: plan items and the saved event, but not someone else's plan
  select count(*) into n from public.calendar_items(current_setting('test.ana_cal')) where title = 'Saved show';
  if n <> 1 then raise exception 'saved event missing from feed'; end if;
  select count(*) into n from public.calendar_items(current_setting('test.ana_cal')) where title = 'Dinner at Mom''s';
  if n <> 1 then raise exception 'plan item missing from feed'; end if;
  select count(*) into n from public.calendar_items(current_setting('test.ben_cal'), 'bbbbbbbb-0000-0000-0000-0000000000c1');
  if n <> 0 then raise exception 'another member got a private plan in their calendar'; end if;
  select count(*) into n from public.calendar_items('not-a-real-token-not-a-real-token');
  if n <> 0 then raise exception 'bad token returned items'; end if;
end $$;
-- Once Ben is in, the plan is in his feed; a reset link stops the old one working
insert into public.plan_joins (plan_id, user_id) values ('bbbbbbbb-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222');
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ declare n int; begin
  if public.my_calendar_token() <> current_setting('test.ben_cal') then raise exception 'my_calendar_token wrong'; end if;
  if public.my_calendar_token(true) = current_setting('test.ben_cal') then raise exception 'reset kept the old link'; end if;
end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from public.calendar_items(current_setting('test.ben_cal'));
  if n <> 0 then raise exception 'old calendar link still works'; end if;
  select count(*) into n from public.calendar_items((select calendar_token from public.profiles where id = '22222222-2222-2222-2222-222222222222'))
    where title = 'Dinner at Mom''s';
  if n <> 1 then raise exception 'joined plan missing from feed'; end if;
end $$;

-- Duplicate events: one exhibit listed three ways keeps its most detailed listing; the same generic
-- title at two venues stays; a listing staff un-hide isn't hidden again
reset role;
insert into public.events (id, source, source_id, title, starts_at, ends_at, venue) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'manual', 'dup-1', 'Wired', date_trunc('day', now()) + interval '2 day 13 hours', date_trunc('day', now()) + interval '3 day 2 hours', 'Woolsey Hall'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'manual', 'dup-2', '"Wired" art exhibition', date_trunc('day', now()) + interval '2 day 13 hours', date_trunc('day', now()) + interval '3 day 2 hours', 'Charles Koch Arena'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'manual', 'dup-3', '''Wired'' First Friday Opening Reception | art exhibition', date_trunc('day', now()) + interval '2 day 18 hours', date_trunc('day', now()) + interval '2 day 20 hours', 'Woolsey Hall'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'manual', 'dup-4', 'Trivia', date_trunc('day', now()) + interval '2 day 19 hours', null, 'Pub One'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'manual', 'dup-5', 'Trivia Night', date_trunc('day', now()) + interval '2 day 19 hours', null, 'Pub Two');
do $$ declare n int; begin
  select count(*) into n from private.hide_duplicate_events(true);
  if exists (select 1 from public.events where source = 'manual' and source_id like 'dup-%' and hidden) then raise exception 'dry run hid events'; end if;
  perform private.hide_duplicate_events();
  if (select hidden from public.events where source_id = 'dup-3') then raise exception 'kept the wrong Wired listing'; end if;
  if not (select hidden from public.events where source_id = 'dup-1') or not (select hidden from public.events where source_id = 'dup-2')
    then raise exception 'Wired duplicates not hidden'; end if;
  if (select duplicate_of from public.events where source_id = 'dup-1') <> 'eeeeeeee-0000-0000-0000-000000000003' then raise exception 'duplicate_of wrong'; end if;
  if (select hidden from public.events where source_id = 'dup-4') or (select hidden from public.events where source_id = 'dup-5')
    then raise exception 'trivia at two bars hidden as duplicates'; end if;
  -- staff un-hide one: it stays visible on the next run
  update public.events set hidden = false where source_id = 'dup-2';
  perform private.hide_duplicate_events();
  if (select hidden from public.events where source_id = 'dup-2') then raise exception 'staff un-hide was undone'; end if;
  -- the kept listing leaves the calendar: its hidden duplicate comes back (and is re-checked)
  delete from public.events where source_id = 'dup-3';
  perform private.hide_duplicate_events();
  if (select hidden from public.events where source_id = 'dup-1') and (select hidden from public.events where source_id = 'dup-2')
    then raise exception 'all Wired listings hidden after the kept one left'; end if;
end $$;

-- Venue rules: at Gilley's only live music shows (karaoke lives in Weekly specials); promos are hidden; a closure notice
-- isn't treated as the event it's for
reset role;
insert into public.events (id, source, source_id, title, starts_at, venue, calendar_tags) values
  ('eeeeeeee-0000-0000-0000-000000000011', 'manual', 'vr-1', 'MARC BAKER', date_trunc('day', now()) + interval '3 day 21 hours', 'Gilley''s', '{Drinks,Live Music,Country}'),
  ('eeeeeeee-0000-0000-0000-000000000012', 'manual', 'vr-2', 'COWBOY KARAOKE', date_trunc('day', now()) + interval '3 day 19 hours', 'Gilley''s', '{Karaoke,Live Music}'),
  ('eeeeeeee-0000-0000-0000-000000000013', 'manual', 'vr-3', 'Free Spin Friday', date_trunc('day', now()) + interval '3 day 21 hours', 'Gilley''s', '{Just for fun}'),
  ('eeeeeeee-0000-0000-0000-000000000014', 'manual', 'vr-4', 'Wichita Turkey Trot', date_trunc('day', now()) + interval '4 day 8 hours', 'Downtown Wichita', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000015', 'manual', 'vr-5', 'Street Closure for the Wichita Turkey Trot', date_trunc('day', now()) + interval '4 day 6 hours', 'Downtown Wichita', '{}');
do $$ begin
  perform private.apply_venue_rules();
  perform private.hide_duplicate_events();
  if (select hidden from public.events where source_id = 'vr-1') then raise exception 'Gilley''s live music hidden'; end if;
  if not (select hidden from public.events where source_id = 'vr-2') or not (select hidden from public.events where source_id = 'vr-3')
    then raise exception 'Gilley''s non-music listing still shows'; end if;
  if (select hidden from public.events where source_id = 'vr-4') then raise exception 'event hidden as a duplicate of its street closure'; end if;
  update public.events set hidden = false where source_id = 'vr-3';
  perform private.apply_venue_rules();
  if (select hidden from public.events where source_id = 'vr-3') then raise exception 'staff un-hide of a venue rule was undone'; end if;
end $$;

-- Security round 2: junk push tokens are refused, 5 phones per member, a phone moves to whoever signs in on it
reset role;
do $$ begin
  begin
    insert into public.push_tokens (user_id, token, platform) values ('22222222-2222-2222-2222-222222222222', 'not-a-push-token', 'ios');
    raise exception 'saved a junk push token';
  exception when check_violation then null; end;
end $$;
insert into public.push_tokens (user_id, token, platform)
  select '22222222-2222-2222-2222-222222222222', 'ExponentPushToken[cap-' || g || ']', 'android' from generate_series(1, 7) g;
do $$ begin
  if (select count(*) from public.push_tokens where user_id = '22222222-2222-2222-2222-222222222222') <> 5
    then raise exception 'push tokens not capped at 5 per member'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select public.save_push_token('ExponentPushToken[test]', 'ios');
reset role;
do $$ begin
  if (select user_id from public.push_tokens where token = 'ExponentPushToken[test]') <> '33333333-3333-3333-3333-333333333333'
    then raise exception 'phone did not move to the member signed in on it'; end if;
end $$;

-- Joining, leaving and re-joining a plan pushes the owner once
insert into public.plan_joins (plan_id, user_id) values ('bbbbbbbb-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444444');
delete from public.plan_joins where plan_id = 'bbbbbbbb-0000-0000-0000-0000000000a1' and user_id = '44444444-4444-4444-4444-444444444444';
insert into public.plan_joins (plan_id, user_id) values ('bbbbbbbb-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444444');
do $$ begin
  if (select count(*) from public.test_sent_pushes where body ->> 'job' = 'plan_join' and body ->> 'member' = '44444444-4444-4444-4444-444444444444') <> 1
    then raise exception 'plan join pushed more than once'; end if;
end $$;

-- Blocking takes the two out of each other's plans (sends and joins)
insert into public.plan_sends (plan_id, to_id) values ('bbbbbbbb-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444444');
insert into public.blocks (blocker_id, blocked_id) values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');
do $$ begin
  if exists (select 1 from public.plan_joins where plan_id = 'bbbbbbbb-0000-0000-0000-0000000000a1' and user_id = '44444444-4444-4444-4444-444444444444')
    or exists (select 1 from public.plan_sends where plan_id = 'bbbbbbbb-0000-0000-0000-0000000000a1' and to_id = '44444444-4444-4444-4444-444444444444')
    then raise exception 'block left them in each other''s plans'; end if;
end $$;
delete from public.blocks where blocker_id = '44444444-4444-4444-4444-444444444444';

-- A twice-reported reply waits for staff instead of counting as removed
insert into public.replies (id, thread_id, author_id, body, status)
  values ('dddddddd-0000-0000-0000-0000000000f1', 'dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Reported reply', 'approved');
insert into public.reports (reporter_id, reply_id, reason) values
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-0000000000f1', 'test'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-0000000000f1', 'test');
do $$ begin
  if (select status from public.replies where id = 'dddddddd-0000-0000-0000-0000000000f1') <> 'pending'
    then raise exception 'twice-reported reply not held for review'; end if;
end $$;

-- Daily limits: 10 posts, 50 replies, 10 feedback messages per member; 30 anonymous messages an hour
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ declare i int := 0; begin
  loop
    i := i + 1;
    if i > 15 then raise exception 'posts never hit the daily limit'; end if;
    begin
      insert into public.threads (author_id, category, title) values (auth.uid(), 'ask', 'Limit test ' || i);
    exception when check_violation then exit; end;
  end loop;
  if i > 11 then raise exception 'post limit is above 10'; end if;
  i := 0;
  loop
    i := i + 1;
    if i > 60 then raise exception 'replies never hit the daily limit'; end if;
    begin
      insert into public.replies (thread_id, author_id, body) values ('dddddddd-0000-0000-0000-000000000001', auth.uid(), 'reply ' || i);
    exception when check_violation then exit; end;
  end loop;
  if i <> 51 then raise exception 'reply limit is not 50 (stopped at %)', i; end if;
  i := 0;
  loop
    i := i + 1;
    if i > 15 then raise exception 'feedback never hit the daily limit'; end if;
    begin
      insert into public.feedback (user_id, kind, message) values (null, 'idea', 'member flood ' || i);
    exception when check_violation then exit; end;
  end loop;
end $$;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ declare i int := 0; begin
  loop
    i := i + 1;
    if i > 40 then raise exception 'anonymous feedback never capped'; end if;
    begin
      insert into public.feedback (kind, message) values ('idea', 'anon flood ' || i);
    exception when check_violation then exit; end;
  end loop;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.feedback where message like 'member flood%' and user_id = '44444444-4444-4444-4444-444444444444') <> 10
    then raise exception 'signed-in feedback not tied to the member'; end if;
end $$;

-- A scheduled push can only claim its day once; letting go after a failure allows a re-run
do $$ begin
  if not public.claim_send('daily:2026-11-09') then raise exception 'first claim refused'; end if;
  if public.claim_send('daily:2026-11-09') then raise exception 'same push claimed twice'; end if;
  perform public.release_send('daily:2026-11-09');
  if not public.claim_send('daily:2026-11-09') then raise exception 'claim not released after a failure'; end if;
end $$;

-- Notifications v2: new members start with reminders, friends, weekend and Tonight on; the daily
-- push and giveaways & deals are opt-in. Nothing member-triggered goes out between 9pm and 8am.
insert into auth.users (id, raw_user_meta_data) values ('99999999-9999-9999-9999-999999999999', '{}');
do $$ declare n public.notification_prefs; begin
  select * into n from public.notification_prefs where user_id = '99999999-9999-9999-9999-999999999999';
  if n.daily or n.giveaways or n.breaking then raise exception 'opt-in notifications on by default'; end if;
  if not (n.reminders and n.friends and n.weekend and n.tonight) then raise exception 'personal/weekend notifications off by default'; end if;
  -- 8:59pm and 8:00am Central are fine; 9:00pm and 7:59am are quiet (Nov = CST, UTC-6)
  if private.quiet_hours('2026-11-10 02:59+00') then raise exception '8:59pm counted as quiet'; end if;
  if not private.quiet_hours('2026-11-10 03:00+00') then raise exception '9pm not quiet'; end if;
  if not private.quiet_hours('2026-11-10 13:59+00') then raise exception '7:59am not quiet'; end if;
  if private.quiet_hours('2026-11-10 14:00+00') then raise exception '8am counted as quiet'; end if;
  -- held overnight, sent at 8am
  insert into private.push_queue (job, payload) values ('friend', '{"kind":"request","to":"q","from":"z"}');
  if private.flush_push_queue('2026-11-10 04:00+00') <> 0 then raise exception 'sent during quiet hours'; end if;
  if private.flush_push_queue('2026-11-10 14:05+00') < 1 then raise exception 'held push not sent at 8am'; end if;
  if exists (select 1 from private.push_queue) then raise exception 'queue not emptied'; end if;
  if not exists (select 1 from net.requests where body ->> 'to' = 'q') then raise exception 'held push never posted'; end if;
  -- the weekly limit on deals outlasts the 2-day cleanup of repeat-push records
  insert into private.push_log (key, sent_at) values ('once:promo:2026-11-09', now() - interval '3 days');
  perform private.notify('friend', '{"kind":"request","to":"w","from":"z"}');
  if not exists (select 1 from private.push_log where key = 'once:promo:2026-11-09') then raise exception 'weekly limit cleared early'; end if;
end $$;
do $$ begin
  if (select schedule from cron.job where jobname = 'push-daily') <> '0 13,14 * * *' then raise exception 'daily push not at 8am'; end if;
  if not exists (select 1 from cron.job where jobname = 'push-week') then raise exception 'Tuesday push not scheduled'; end if;
  if not exists (select 1 from cron.job where jobname = 'push-queue') then raise exception 'overnight queue never sent'; end if;
end $$;

-- Shop row: anyone sees in-stock products; sold-out ones are hidden; only the sync job writes
reset role;
insert into public.shop_products (id, handle, title, price, url, available) values
  (1, 'hat', 'Wichita Hat', 30, 'https://example.com/products/hat', true),
  (2, 'gone', 'Sold Out Hat', 30, 'https://example.com/products/gone', false);
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.shop_products) <> 1 then raise exception 'sold-out product visible'; end if;
  begin
    insert into public.shop_products (id, handle, title, price, url) values (3, 'x', 'x', 1, 'https://example.com/x');
    raise exception 'visitor added a shop product';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Giveaway entrants: staff see who entered (with totals); members can't; each entry goes to PostHog
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ declare n int; begin
  select count(*) into n from public.giveaway_entrants('aaaaaaaa-0000-0000-0000-000000000001');
  if n < 2 then raise exception 'staff entrants list short (%)', n; end if;
  if (select entries from public.giveaway_entrants('aaaaaaaa-0000-0000-0000-000000000001')
      where user_id = '44444444-4444-4444-4444-444444444444')
    <> (select sum(entries) from public.giveaway_entries
        where giveaway_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '44444444-4444-4444-4444-444444444444')
    then raise exception 'entrant total wrong'; end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  begin
    perform public.giveaway_entrants('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'member saw the entrants list';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from net.requests where body ->> 'event' = 'giveaway_entry_added'
      and body -> 'properties' ->> 'kind' = 'enter') then raise exception 'entry not sent to PostHog'; end if;
end $$;

-- Staff can't win (official rules): even with a huge pile of entries, the draw skips them
insert into public.giveaway_entries (giveaway_id, user_id, kind, entries)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'enter', 1000)
  on conflict (giveaway_id, user_id, kind) do update set entries = 1000;
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ declare w uuid; begin
  for i in 1..25 loop
    select user_id into w from public.draw_giveaway_winner('aaaaaaaa-0000-0000-0000-000000000001');
    if w = '55555555-5555-5555-5555-555555555555' then raise exception 'staff won the draw'; end if;
  end loop;
  if not (select staff from public.giveaway_entrants('aaaaaaaa-0000-0000-0000-000000000001')
      where user_id = '55555555-5555-5555-5555-555555555555') then raise exception 'staff not marked in entrants'; end if;
end $$;
reset role;
-- ...and staff entries don't count publicly or in PostHog
do $$ begin
  if (select entrant_count from public.giveaways where id = 'aaaaaaaa-0000-0000-0000-000000000001')
    <> (select count(distinct e.user_id) from public.giveaway_entries e join public.profiles p on p.id = e.user_id
        where e.giveaway_id = 'aaaaaaaa-0000-0000-0000-000000000001' and p.role not in ('admin', 'moderator'))
    then raise exception 'staff counted in entrant_count'; end if;
  if exists (select 1 from net.requests where body ->> 'event' = 'giveaway_entry_added'
      and body ->> 'distinct_id' = '55555555-5555-5555-5555-555555555555') then raise exception 'staff entry sent to PostHog'; end if;
end $$;

-- Who's making plans: staff see names and counts (never the plans); members can't
select set_config('test.plan_count', (select count(*) from public.plans)::text, false);
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin
  if (select coalesce(sum(plans), 0) from public.plan_makers()) <> current_setting('test.plan_count')::bigint
    then raise exception 'plan makers count wrong'; end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  begin
    perform public.plan_makers();
    raise exception 'member saw who makes plans';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A club's next event shows in Events (only with a real date, only while the club is listed)
insert into public.clubs (id, name, category, url, active, pending, next_on, next_title)
values ('cccccccc-0000-0000-0000-00000000c1ab', 'Test Hangouts', 'social', 'https://www.instagram.com/test_hangouts/', true, false,
  (now() at time zone 'America/Chicago')::date + 5, 'Pickleball Tourney');
do $$ declare e public.events; begin
  select * into e from public.events where source = 'club' and source_id like 'cccccccc-0000-0000-0000-00000000c1ab:%';
  if e.id is null then raise exception 'club event not added'; end if;
  if e.title <> 'Test Hangouts: Pickleball Tourney' or not e.time_tbd or e.url <> 'https://www.instagram.com/test_hangouts/'
    then raise exception 'club event wrong: %', e.title; end if;
  update public.clubs set next_on = next_on + 2 where id = 'cccccccc-0000-0000-0000-00000000c1ab';
  if (select count(*) from public.events where source = 'club' and source_id like 'cccccccc-0000-0000-0000-00000000c1ab:%') <> 1
    then raise exception 'moved club event left the old date behind'; end if;
  update public.clubs set active = false where id = 'cccccccc-0000-0000-0000-00000000c1ab';
  if exists (select 1 from public.events where source = 'club' and source_id like 'cccccccc-0000-0000-0000-00000000c1ab:%')
    then raise exception 'hidden club still has an event'; end if;
  update public.clubs set active = true, next_on = null where id = 'cccccccc-0000-0000-0000-00000000c1ab';
  if exists (select 1 from public.events where source = 'club' and source_id like 'cccccccc-0000-0000-0000-00000000c1ab:%')
    then raise exception 'club with no date has an event'; end if;
  delete from public.clubs where id = 'cccccccc-0000-0000-0000-00000000c1ab';
end $$;

-- Test accounts (the App Store reviewer) can use everything but aren't counted, like staff
update public.profiles set test_account = true where id = '44444444-4444-4444-4444-444444444444';
update public.giveaways g set entrant_count = (
  select count(distinct e.user_id) from public.giveaway_entries e
  where e.giveaway_id = g.id and not private.uncounted(e.user_id));
do $$ begin
  if (select entrant_count from public.giveaways where id = 'aaaaaaaa-0000-0000-0000-000000000001')
    <> (select count(distinct e.user_id) from public.giveaway_entries e join public.profiles p on p.id = e.user_id
        where e.giveaway_id = 'aaaaaaaa-0000-0000-0000-000000000001' and p.role not in ('admin', 'moderator') and not p.test_account)
    then raise exception 'test account counted in entrant_count'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  begin
    update public.profiles set test_account = false where id = '44444444-4444-4444-4444-444444444444';
    raise exception 'member cleared their own test flag';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set test_account = false where id = '44444444-4444-4444-4444-444444444444';

-- Venues: checked addresses replace the calendar's, a title names the venue when the listing has
-- none, and staff fixes on an event win (starting from no venues; the migration adds real ones)
delete from public.venues;
insert into public.venues (name, address, aliases, title_pattern) values
  ('Mortdecai’s Tavern & Eatery', '330 S Greenwich Rd, Wichita, KS 67207', '{"Mortdecais"}', 'mortdecai'),
  ('Shamrock Lounge', '1724 W Douglas Ave, Wichita, KS 67203', '{}', '\mshamrock\M');
insert into public.events (id, source, source_id, title, starts_at, venue, address, locked_fields) values
  ('dddddddd-0000-0000-0000-000000000ee1', 'manual', 've1', 'The Banned Live at Mortdecai''s!', now() + interval '1 day', 'Wichita', 'Kansas', '{}'),
  ('dddddddd-0000-0000-0000-000000000ee2', 'manual', 've2', 'Blues night', now() + interval '1 day', 'MORTDECAI''S', null, '{}'),
  ('dddddddd-0000-0000-0000-000000000ee3', 'manual', 've3', 'Shamrock trivia', now() + interval '1 day', 'Kirby''s', '3227 E 17th St N, Wichita, KS 67208', '{}'),
  ('dddddddd-0000-0000-0000-000000000ee4', 'manual', 've4', 'Mortdecai''s fan night', now() + interval '1 day', 'Someplace', 'Elsewhere', '{venue,address}');
do $$ begin
  if (select address from public.events where id = 'dddddddd-0000-0000-0000-000000000ee1') <> '330 S Greenwich Rd, Wichita, KS 67207'
    then raise exception 'title did not place a no-place listing'; end if;
  if (select venue from public.events where id = 'dddddddd-0000-0000-0000-000000000ee2') <> 'Mortdecai’s Tavern & Eatery'
    then raise exception 'alias did not match'; end if;
  if (select venue from public.events where id = 'dddddddd-0000-0000-0000-000000000ee3') <> 'Kirby''s'
    then raise exception 'title moved an event that has a real place'; end if;
  if (select venue from public.events where id = 'dddddddd-0000-0000-0000-000000000ee4') <> 'Someplace'
    then raise exception 'venue rule overrode a staff fix'; end if;
end $$;
-- A new venue fixes upcoming events already in the app
update public.events set venue = 'Wichita', address = 'Kansas' where id = 'dddddddd-0000-0000-0000-000000000ee3';
insert into public.venues (name, address, aliases) values ('Kirby’s Beer Store', '3227 E 17th St N, Wichita, KS 67208', '{"Kirbys"}');
update public.events set venue = 'Kirby''s', address = null where id = 'dddddddd-0000-0000-0000-000000000ee3';
do $$ begin
  if (select address from public.events where id = 'dddddddd-0000-0000-0000-000000000ee3') is distinct from '3227 E 17th St N, Wichita, KS 67208'
    then raise exception 'alias with apostrophe did not match'; end if;
end $$;
update public.venues set address = '1724 W Douglas Ave Ste B, Wichita, KS 67203' where name = 'Shamrock Lounge';
update public.events set title = 'Shamrock blues jam', venue = 'Wichita', address = 'Kansas', locked_fields = '{}' where id = 'dddddddd-0000-0000-0000-000000000ee2';
do $$ begin
  if (select address from public.events where id = 'dddddddd-0000-0000-0000-000000000ee2') <> '1724 W Douglas Ave Ste B, Wichita, KS 67203'
    then raise exception 'updated venue address not used'; end if;
end $$;
-- Members can read venues but not change them
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if (select count(*) from public.venues) < 3 then raise exception 'members cannot read venues'; end if;
  begin
    insert into public.venues (name, address) values ('Fake', '1 Fake St, Wichita, KS 67202');
    raise exception 'member added a venue';
  exception when insufficient_privilege then null; end;
  update public.venues set address = '1 Fake St, Wichita, KS 67202';
  if exists (select 1 from public.venues where address = '1 Fake St, Wichita, KS 67202') then raise exception 'member changed a venue'; end if;
end $$;
reset role;
delete from public.events where source_id in ('ve1', 've2', 've3', 've4');
delete from public.venues;

-- Platforms: members note their own (only known ones, no repeats); only staff see the counts
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select public.note_platform('web');
select public.note_platform('web');
select public.note_platform('toaster');
do $$ begin
  if (select platforms from public.profiles where id = '22222222-2222-2222-2222-222222222222') <> '{web}'
    then raise exception 'note_platform did not save web once'; end if;
  if (select members from public.member_platforms()) <> 0 then raise exception 'a member saw platform counts'; end if;
  -- (Members can't write platforms directly: no column grant. This test database grants everything,
  -- so that part is checked with has_column_privilege on the migrations alone.)
end $$;
select public.note_platform('ios');
reset role;
update public.profiles set role = 'admin' where id = '33333333-3333-3333-3333-333333333333';
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if (select iphone from public.member_platforms()) < 1 then raise exception 'staff platform counts missing iphone'; end if;
  if (select web_only from public.member_platforms()) <> 0 then raise exception 'member on web and iphone counted as web only'; end if;
end $$;
reset role;
update public.profiles set role = 'member' where id = '33333333-3333-3333-3333-333333333333';

-- Plans you're in show up for you, and only for you
insert into public.plans (id, owner_id, title) values ('eeeeeeee-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Join test');
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_config('test.join_code', public.set_plan_sharing('eeeeeeee-0000-0000-0000-0000000000a1', true), false);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select public.set_plan_join(true, code => current_setting('test.join_code'));
do $$ begin
  if not exists (select 1 from public.my_joined_plans() where id = 'eeeeeeee-0000-0000-0000-0000000000a1')
    then raise exception 'joined plan missing from my_joined_plans'; end if;
end $$;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if exists (select 1 from public.my_joined_plans()) then raise exception 'saw someone else''s joined plans'; end if;
end $$;
reset role;
do $$ begin
  if not private.can_see_plan((select p from public.plans p where id = 'eeeeeeee-0000-0000-0000-0000000000a1'), '22222222-2222-2222-2222-222222222222')
    then raise exception 'joiner cannot see the plan they are in'; end if;
end $$;
delete from public.plans where id = 'eeeeeeee-0000-0000-0000-0000000000a1';

select 'all security tests passed' as result;
