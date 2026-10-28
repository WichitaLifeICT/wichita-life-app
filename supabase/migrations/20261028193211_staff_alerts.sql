-- Staff alerts (supabase/functions/staff-alerts): a push and email for each new report, and an
-- 8am email of everything waiting in Staff tools. The digest runs at two UTC hours so it lands at
-- 8am Wichita time in both daylight and standard time; the function only sends at 8am.

alter table public.reports add column alerted_at timestamptz;

select cron.schedule('staff-alerts-reports', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/staff-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"reports"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

select cron.schedule('staff-alerts-digest', '3 13,14 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/staff-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"digest"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
