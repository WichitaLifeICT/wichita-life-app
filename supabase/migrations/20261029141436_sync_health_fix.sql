-- sync_health_due: its output column "key" clashed with the CTE columns of the same name.
create or replace function public.sync_health_due()
returns table (key text, problem text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with checks(key, label, last_run, max_age) as (
    values
      ('events', 'Events calendar sync', (select max(synced_at) from public.events where source = 'wichitalife_events'), interval '8 hours'),
      ('news', 'Local news sync', (select max(last_fetched_at) from public.news_sources), interval '3 hours'),
      ('newsletter', 'Newsletter stories sync', (select max(synced_at) from public.posts), interval '30 hours'),
      ('guides', 'Local guides sync', (select max(synced_at) from public.guides), interval '36 hours'),
      ('places', 'Restaurants sync', (select max(synced_at) from public.places), interval '40 days')
  ),
  stale as (
    select c.key, format('%s hasn''t updated since %s Central (it normally runs every %s).',
      c.label, to_char(c.last_run at time zone 'America/Chicago', 'Mon DD at FMHH12:MI am'),
      case c.key when 'events' then '3 hours' when 'news' then '30 minutes' when 'places' then 'month' else 'day' end) as problem
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
  ),
  problems as (select * from stale union all select * from failed),
  due as (
    select p.* from problems p
    left join private.health_alerts h on h.key = p.key
    where h.sent_at is null or h.sent_at < now() - interval '24 hours'
  ),
  marked as (
    insert into private.health_alerts (key, sent_at) select d.key, now() from due d
    on conflict (key) do update set sent_at = excluded.sent_at
    returning 1
  )
  select d.key, d.problem from due d;
end;
$$;
revoke execute on function public.sync_health_due() from public, anon, authenticated;
grant execute on function public.sync_health_due() to service_role;
