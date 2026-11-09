-- Fewer, better notifications (Nov 9).
-- On by default: reminders for your saved events and plans, friend and plan activity, the
-- Thursday weekend push (your plans first, then picks), and Friday "Tonight" (only if you have
-- nothing planned for the weekend). Opt-in: the daily 8am push and "Giveaways & deals"
-- (Apple only allows promotional pushes to people who opted in). Nothing member-triggered
-- arrives between 9pm and 8am Wichita time: it waits and goes out at 8am.

-- 1. Separate switches for each kind, and the new defaults for everyone.
alter table public.notification_prefs
  add column reminders boolean not null default true,  -- evening-before reminders + Tuesday "Coming up this week"
  add column friends boolean not null default true,    -- friend requests, plan joins, plans sent to you
  add column tonight boolean not null default true;    -- Friday 4pm, only without weekend plans
alter table public.notification_prefs alter column daily set default false;
alter table public.notification_prefs alter column giveaways set default false;
-- All 9 members were still on the old defaults; move them to the new ones (big local news,
-- whose default didn't change, keeps each member's own choice).
update public.notification_prefs set daily = false, giveaways = false, updated_at = now();

-- 2. Quiet hours: 9pm to 8am Wichita time.
create or replace function private.quiet_hours(at timestamptz default now())
returns boolean language sql stable set search_path = pg_catalog, public as $$
  select extract(hour from at at time zone 'America/Chicago') not between 8 and 20;
$$;

create table private.push_queue (
  id bigserial primary key,
  job text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function private.post_push(job text, payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := jsonb_build_object('job', job) || payload,
    timeout_milliseconds := 30000
  );
end $$;

-- Member-triggered pushes (friends, plan joins, plans sent): skip repeats within a day, and
-- hold anything overnight until 8am.
create or replace function private.notify(job text, payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text := job || ':' || md5(payload::text);
begin
  if exists (select 1 from private.push_log where key = k and sent_at > now() - interval '1 day') then return; end if;
  insert into private.push_log (key) values (k) on conflict (key) do update set sent_at = now();
  -- Once-a-day/once-a-week claims ('once:...') are kept longer so a weekly limit holds all week.
  delete from private.push_log
  where (key not like 'once:%' and sent_at < now() - interval '2 days') or sent_at < now() - interval '10 days';
  if private.quiet_hours() then
    insert into private.push_queue (job, payload) values (job, payload);
  else
    perform private.post_push(job, payload);
  end if;
end $$;

-- Hourly: once it's 8am or later, send what waited overnight.
create or replace function private.flush_push_queue(at timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if private.quiet_hours(at) then return 0; end if;
  for r in delete from private.push_queue returning job, payload loop
    perform private.post_push(r.job, r.payload);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function private.post_push(text, jsonb) from public, anon, authenticated;
revoke execute on function private.flush_push_queue(timestamptz) from public, anon, authenticated;

select cron.schedule('push-queue', '1 * * * *', 'select private.flush_push_queue()');

-- 3. Schedule: the morning pushes move from 7am to 8am (no pushes before 8), and a Tuesday 5pm
--    "Coming up this week" goes only to members with saved events or plans Wednesday to Sunday.
--    Each job runs at two UTC hours and only sends in the matching Wichita hour.
select cron.alter_job((select jobid from cron.job where jobname = 'push-daily'), schedule := '0 13,14 * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'push-weekend'), schedule := '5 13,14 * * 4');
select cron.schedule('push-week', '3 22,23 * * 2', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"week"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
