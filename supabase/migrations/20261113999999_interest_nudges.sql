-- "What are you into?" pushes (push-jobs, job "interests"): Monday and Saturday 11am for members
-- who haven't picked any interests, at most 4 times each. This counts how many each has had.
alter table public.profiles add column interest_nudges smallint not null default 0;

select cron.schedule('push-interests', '7 16,17 * * 1,6', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"interests"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
