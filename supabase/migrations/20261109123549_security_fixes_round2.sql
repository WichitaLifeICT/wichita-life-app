-- Security review, round 2 (Nov 9). Nothing critical; these close the medium/low findings.

-- 1. "Someone joined your plan" pushes go through private.notify, so toggling join/leave
--    can't send the owner a push every time (notify skips repeats within a day).
create or replace function private.on_plan_join()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.notify('plan_join', jsonb_build_object('plan', new.plan_id, 'member', new.user_id));
  return null;
end $$;

-- 2. Push tokens: only real Expo tokens (one junk token would make Expo reject a whole batch of
--    100 pushes), and at most 5 phones per member (the oldest drop off).
alter table public.push_tokens add constraint push_tokens_token_format
  check (char_length(token) <= 200 and token ~ '^Expo(nent)?PushToken\[[^\]]+\]$');

create or replace function private.push_tokens_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_tokens where id in (
    select id from public.push_tokens where user_id = new.user_id order by created_at desc offset 5);
  return null;
end $$;
create trigger push_tokens_cap after insert or update of user_id on public.push_tokens
  for each row execute function private.push_tokens_cap();

-- A phone moves to whoever is signed in on it now (if the last person's sign-out couldn't
-- remove it, a plain upsert is blocked by RLS and the old account keeps getting this phone's pushes).
create or replace function public.save_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  insert into public.push_tokens (user_id, token, platform) values (auth.uid(), p_token, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, created_at = now();
end $$;
revoke all on function public.save_push_token(text, text) from public, anon;
grant execute on function public.save_push_token(text, text) to authenticated;

-- 3. Daily posting limits for members (staff and server jobs are exempt), and a cap on anonymous
--    feedback so the staff inbox can't be flooded.
create or replace function private.posting_limit(tbl text)
returns text language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if tbl = 'threads' and (select count(*) from public.threads
      where author_id = uid and created_at > now() - interval '1 day') >= 10 then
    return 'You''ve posted a lot today. Try again tomorrow.';
  elsif tbl = 'replies' and (select count(*) from public.replies
      where author_id = uid and created_at > now() - interval '1 day') >= 50 then
    return 'That''s a lot of replies today. Try again tomorrow.';
  elsif tbl = 'feedback' and uid is not null and (select count(*) from public.feedback
      where user_id = uid and created_at > now() - interval '1 day') >= 10 then
    return 'Thanks! You''ve sent us a lot today. Try again tomorrow.';
  elsif tbl = 'feedback' and uid is null and (select count(*) from public.feedback
      where user_id is null and created_at > now() - interval '1 hour') >= 30 then
    return 'We''re getting a lot of messages right now. Please try again in a bit, or sign in.';
  end if;
  return null;
end $$;

create or replace function private.server_fields()
returns trigger language plpgsql set search_path = public as $$
declare too_many text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if private.is_staff() then return new; end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; return new; end if;
  new.created_at := now();
  case tg_table_name
    when 'threads' then
      new.reply_count := 0;
      too_many := private.posting_limit('threads');
    when 'replies' then too_many := private.posting_limit('replies');
    when 'feedback' then
      if auth.uid() is not null then new.user_id := auth.uid(); end if;
      too_many := private.posting_limit('feedback');
    when 'clubs' then new.priority := 0; new.last_post_on := null;
    when 'reports' then
      new.resolved := false; new.alerted_at := null; new.reason := left(new.reason, 500);
      if private.my_reports_today() >= 20 then
        too_many := 'That''s a lot of reports today. Staff will look at the ones you sent.';
      end if;
    when 'saved_events', 'rsvps' then new.reminded_at := null;
    else null;
  end case;
  if too_many is not null then raise exception '%', too_many using errcode = 'check_violation'; end if;
  return new;
end $$;

-- 4. A reply hidden by two reports waits for staff ('pending') instead of counting as removed,
--    so a pair of reports can't take away someone's trusted-poster status. Staff decide.
alter table public.replies drop constraint replies_status_check;
alter table public.replies add constraint replies_status_check check (status in ('approved', 'pending', 'removed'));

create or replace function private.hide_reported()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.thread_id is not null and (
    select count(distinct r.reporter_id) from public.reports r join public.profiles p on p.id = r.reporter_id
    where r.thread_id = new.thread_id and not r.resolved and p.created_at < now() - interval '7 days') >= 2 then
    update public.threads set status = 'pending' where id = new.thread_id and status = 'approved';
  elsif new.reply_id is not null and (
    select count(distinct r.reporter_id) from public.reports r join public.profiles p on p.id = r.reporter_id
    where r.reply_id = new.reply_id and not r.resolved and p.created_at < now() - interval '7 days') >= 2 then
    update public.replies set status = 'pending' where id = new.reply_id and status = 'approved';
  end if;
  return new;
end $$;

-- 5. Blocking someone also takes them out of each other's plans: plans sent between the two and
--    joins on each other's plans (it already ended the friendship).
create or replace function private.unfriend_on_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
  where least(requester_id, addressee_id) = least(new.blocker_id, new.blocked_id)
    and greatest(requester_id, addressee_id) = greatest(new.blocker_id, new.blocked_id);
  delete from public.plan_sends s using public.plans p
  where p.id = s.plan_id
    and ((p.owner_id = new.blocker_id and s.to_id = new.blocked_id)
      or (p.owner_id = new.blocked_id and s.to_id = new.blocker_id));
  delete from public.plan_joins j using public.plans p
  where p.id = j.plan_id
    and ((p.owner_id = new.blocker_id and j.user_id = new.blocked_id)
      or (p.owner_id = new.blocked_id and j.user_id = new.blocker_id));
  return null;
end $$;
