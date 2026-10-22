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
  if (select count(*) from public.feedback) <> 2 then raise exception 'staff cannot read feedback'; end if;
  if (select count(*) from public.feedback_inbox('new')) <> 2 then raise exception 'feedback inbox wrong'; end if;
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

select 'all security tests passed' as result;
