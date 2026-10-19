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
end $$;
delete from public.rsvps where user_id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select status from public.rsvps where user_id = '33333333-3333-3333-3333-333333333333') <> 'going' then raise exception 'waitlist not promoted'; end if;
end $$;

select 'all security tests passed' as result;
