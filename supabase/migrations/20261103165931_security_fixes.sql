-- Security review fixes (Nov 3).

-- 1. Friend links get their own secret code, and members can no longer read each other's codes.
--    Before this, the invite code anyone could read doubled as an instant "add me" link.
create or replace function private.new_friend_code()
returns text language sql volatile set search_path = pg_catalog as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 12);
$$;
alter table public.profiles add column friend_code text unique;
update public.profiles set friend_code = private.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set default private.new_friend_code();
alter table public.profiles alter column friend_code set not null;


-- Your own codes, for the invite and friend-link buttons.
create or replace function public.my_codes()
returns table (referral_code text, friend_code text)
language sql stable security definer set search_path = public as $$
  select referral_code, friend_code from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_codes() from public, anon;
grant execute on function public.my_codes() to authenticated;

create or replace function public.add_friend_by_code(code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); them public.profiles; was text;
begin
  if me is null then raise exception 'Sign in first' using errcode = 'insufficient_privilege'; end if;
  select * into them from public.profiles where friend_code = upper(trim(code));
  if them.id is null or them.id = me or private.blocked_either(me, them.id) then
    raise exception 'Friend link not found' using errcode = 'no_data_found';
  end if;
  select status into was from public.friendships
  where least(requester_id, addressee_id) = least(me, them.id) and greatest(requester_id, addressee_id) = greatest(me, them.id);
  insert into public.friendships (requester_id, addressee_id, status, accepted_at)
    values (them.id, me, 'accepted', now())
  on conflict ((least(requester_id, addressee_id)), (greatest(requester_id, addressee_id)))
    do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, now());
  if was is distinct from 'accepted' then
    perform private.notify('friend', jsonb_build_object('kind', 'joined', 'to', them.id, 'from', me));
  end if;
  return jsonb_build_object('id', them.id, 'name', them.display_name);
end $$;

create or replace function public.friend_link_owner(code text)
returns text language sql stable security definer set search_path = public as $$
  select split_part(display_name, ' ', 1) from public.profiles where friend_code = upper(trim(code));
$$;

-- 2. The same alert to the same person goes out at most once a day, so friend/unfriend or
--    "I'm in"/out loops can't spam anyone.
create table private.push_log (key text primary key, sent_at timestamptz not null default now());

create or replace function private.notify(job text, payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text := job || ':' || md5(payload::text);
begin
  if exists (select 1 from private.push_log where key = k and sent_at > now() - interval '1 day') then return; end if;
  insert into private.push_log (key) values (k) on conflict (key) do update set sent_at = now();
  delete from private.push_log where sent_at < now() - interval '2 days';
  perform net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := jsonb_build_object('job', job) || payload,
    timeout_milliseconds := 30000
  );
end $$;
revoke execute on function private.notify(text, jsonb) from public, anon, authenticated;

-- 3. Editing anything on an approved public plan sends it back to staff.
create or replace function private.plan_item_edited()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.note, new.address, new.kind, new.ref_id, new.activity_id, new.plan_id)
       is distinct from (old.note, old.address, old.kind, old.ref_id, old.activity_id, old.plan_id)
     and not private.is_staff() then
    update public.plans set public_status = 'pending', updated_at = now()
      where id in (new.plan_id, old.plan_id) and public_status = 'approved';
  end if;
  return new;
end $$;
create trigger plan_items_edited before update on public.plan_items
  for each row execute function private.plan_item_edited();

-- 4. Reports: only accounts at least a week old count toward auto-hiding, up to 20 a day,
--    and reasons are capped at 500 characters.
create or replace function private.hide_reported()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.thread_id is not null and (
    select count(distinct r.reporter_id) from public.reports r join public.profiles p on p.id = r.reporter_id
    where r.thread_id = new.thread_id and not r.resolved and p.created_at < now() - interval '7 days') >= 2 then
    update public.threads set status = 'pending' where id = new.thread_id and status = 'approved';
  elsif new.reply_id is not null and (
    select count(distinct r.reporter_id) from public.reports r join public.profiles p on p.id = r.reporter_id
    where r.reply_id = new.reply_id and not r.resolved and p.created_at < now() - interval '7 days') >= 2 then
    update public.replies set status = 'removed' where id = new.reply_id and status = 'approved';
  end if;
  return new;
end;
$$;

create or replace function private.my_reports_today()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.reports where reporter_id = auth.uid() and created_at > now() - interval '1 day';
$$;

-- 5. Members can't set server-owned fields (timestamps, counts, review fields) on what they add.
--    Fixes backdated Question of the Day answers (fake streaks and giveaway entries).
create or replace function private.server_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_staff() then return new; end if;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    return new;
  end if;
  new.created_at := now();
  case tg_table_name
    when 'threads' then new.reply_count := 0;
    when 'clubs' then new.priority := 0; new.last_post_on := null;
    when 'reports' then
      new.resolved := false;
      new.alerted_at := null;
      new.reason := left(new.reason, 500);
      if private.my_reports_today() >= 20 then
        raise exception 'That''s a lot of reports today. Staff will look at the ones you sent.' using errcode = 'check_violation';
      end if;
    when 'saved_events', 'rsvps' then new.reminded_at := null;
    else null;
  end case;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['poll_votes', 'threads', 'replies', 'reports', 'rsvps', 'clubs', 'weekly_specials',
    'poll_options', 'feedback', 'saved_events', 'dismissed_events', 'giveaway_entries'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.server_fields()',
      t || '_server_fields', t);
  end loop;
end $$;
