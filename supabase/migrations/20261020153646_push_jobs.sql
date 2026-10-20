-- Scheduled pushes (supabase/functions/push-jobs). Each job runs at two UTC hours so it
-- lands at the right Wichita time in both daylight and standard time; the function only
-- sends during the matching Wichita hour.

alter table public.saved_events add column reminded_at timestamptz;

select cron.schedule('push-reminders', '0 23,0 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"reminders"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

select cron.schedule('push-daily', '0 12,13 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"daily"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

select cron.schedule('push-weekend', '5 12,13 * * 4', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"weekend"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
