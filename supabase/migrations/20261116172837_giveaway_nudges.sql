-- "👀 Have you checked out this week's giveaway yet?" (push-jobs 'giveaway_nudge'): noon in Wichita,
-- for members who turned on Giveaways & deals, entered an earlier giveaway and haven't entered the one
-- running now. At least 3 days apart and at most 3 per giveaway; this table remembers who got one.
create table public.giveaway_nudges (
  giveaway_id uuid not null references public.giveaways (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index giveaway_nudges_user_idx on public.giveaway_nudges (user_id, sent_at desc);
-- Only the server (push-jobs) reads and writes it.
alter table public.giveaway_nudges enable row level security;
revoke all on public.giveaway_nudges from anon, authenticated;

-- Noon in Wichita: 17:00 UTC in daylight time, 18:00 UTC in standard time (the job sends in the right hour only).
select cron.schedule('push-giveaway-nudge', '7 17,18 * * *', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/push-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"job":"giveaway_nudge"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
