-- Today's weather next to the greeting on the Today tab. sync-weather keeps this one row up to date
-- from the National Weather Service (Wichita airport reading plus today's forecast) every 20 minutes.
create table public.weather (
  id smallint primary key default 1 check (id = 1),
  temp_f smallint not null,
  conditions text check (char_length(conditions) <= 80),
  icon text not null,
  high_f smallint,
  low_f smallint,
  forecast_day date not null,            -- the Central-time day high_f and low_f are for
  observed_at timestamptz not null,
  synced_at timestamptz not null default now()
);
alter table public.weather enable row level security;
create policy "anyone can see the weather" on public.weather for select using (true);
revoke insert, update, delete, truncate on public.weather from anon, authenticated;

select cron.schedule('sync-weather', '*/20 * * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/sync-weather',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);

-- Staff hear about it (email and the "What needs you" box) if the weather stops updating for 2 hours.
create or replace function private.health_problems()
returns table (key text, problem text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with checks(key, label, last_run, max_age) as (
    values
      ('events', 'Events calendar sync', (select max(synced_at) from public.events where source = 'wichitalife_events'), interval '8 hours'),
      ('news', 'Local news sync', (select max(last_fetched_at) from public.news_sources), interval '3 hours'),
      ('newsletter', 'Newsletter stories sync', (select max(synced_at) from public.posts), interval '30 hours'),
      ('guides', 'Local guides sync', (select max(synced_at) from public.guides), interval '36 hours'),
      ('places', 'Restaurants sync', (select max(synced_at) from public.places), interval '40 days'),
      ('shop', 'Shop products sync', (select max(synced_at) from public.shop_products), interval '2 days'),
      ('weather', 'Weather sync', (select max(synced_at) from public.weather), interval '2 hours')
  ),
  stale as (
    select c.key, format('%s hasn''t updated since %s Central (it normally runs every %s).',
      c.label, coalesce(to_char(c.last_run at time zone 'America/Chicago', 'Mon DD at FMHH12:MI am'), 'it was set up'),
      case c.key when 'events' then '3 hours' when 'news' then '30 minutes' when 'places' then 'month'
        when 'shop' then '6 hours' when 'weather' then '20 minutes' else 'day' end) as problem
    from checks c
    where c.last_run is null or c.last_run < now() - c.max_age
  ),
  failed as (
    select 'cron:' || j.jobname as key,
      format('The scheduled job "%s" failed %s time(s) in the last 3 hours: %s', j.jobname, count(*),
        left(max(d.return_message), 160)) as problem
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where d.status = 'failed' and d.start_time > now() - interval '3 hours'
    group by j.jobname
  )
  select * from stale union all select * from failed;
end $$;
