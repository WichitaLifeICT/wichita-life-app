-- Friday 4pm Wichita "Tonight in Wichita" picks (push-jobs 'tonight'); two UTC hours for daylight/standard time.
select cron.schedule('push-tonight', '3 21,22 * * 5', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"tonight"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
