-- Run the sync edge functions on a schedule. Each call sends the cron secret from Vault.
-- To change timing: select cron.alter_job((select jobid from cron.job where jobname = 'sync-news'), schedule := '*/15 * * * *');

select cron.schedule('sync-beehiiv', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-beehiiv',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

select cron.schedule('sync-news', '7,37 * * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-news',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

-- Keep pg_net's response log from growing forever.
select cron.schedule('clean-net-responses', '0 4 * * *', $$
  delete from net._http_response where created < now() - interval '2 days';
$$);
