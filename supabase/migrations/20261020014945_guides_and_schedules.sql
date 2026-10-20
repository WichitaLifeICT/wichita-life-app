-- Local guides from wichitalifeict.com/guides, plus schedules that match how often each
-- source actually changes.

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  image_url text,
  url text not null,
  position int not null default 0,         -- order shown on wichitalifeict.com/guides
  published_at timestamptz,
  updated_at timestamptz,
  active boolean not null default true,    -- false once it's removed from the guides page
  synced_at timestamptz not null default now()
);
alter table public.guides enable row level security;
create policy "active guides are public" on public.guides for select using (active);
create policy "staff manage guides" on public.guides for all using (private.is_staff()) with check (private.is_staff());

-- Newsletter goes out Mon, Wed, Thu and Fri at 6am Central. 11:10 and 12:10 UTC cover
-- 6:10am under both daylight and standard time; a nightly run catches edits.
select cron.alter_job((select jobid from cron.job where jobname = 'sync-beehiiv'), schedule := '10 11,12 * * 1,3,4,5');
select cron.schedule('sync-beehiiv-nightly', '0 4 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-beehiiv',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

-- Jobs: once a day, early morning Central.
select cron.alter_job((select jobid from cron.job where jobname = 'sync-jobs'), schedule := '15 12 * * *');

-- Guides: once a day.
select cron.schedule('sync-guides', '30 12 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-guides',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
