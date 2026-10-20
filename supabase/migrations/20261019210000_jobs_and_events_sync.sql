-- Jobs come from the Kardow job board feed (jobs.wichitalifeict.com/feed); events from the
-- What's Good calendar pages (events.wichitalifeict.com). Both are pulled by edge functions.

alter table public.jobs
  add column source text not null default 'manual',
  add column location text,
  add column job_type text;

create index jobs_source_active_idx on public.jobs (source, active);

-- Jobs that came from the Oct 19 newsletter seed are on the Kardow board too.
update public.jobs set source = 'kardow' where url like 'https://jobs.wichitalifeict.com/%';

select cron.schedule('sync-jobs', '12 */2 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

select cron.schedule('sync-events', '22 */3 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-events',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);
