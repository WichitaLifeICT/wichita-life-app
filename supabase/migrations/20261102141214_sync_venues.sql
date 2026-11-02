-- Live music from venues' own calendars (sync-venues), every 6 hours. First venue: Wichita
-- Brewing Company. Rows use source 'venue_feed'.
select cron.schedule('sync-venues', '20 */6 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-venues',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
