-- Twice-weekly checks of the page behind each deal (check-deals, Monday and Thursday). Keeps the
-- deal-ish part of the page; when it changes or the page stops loading, the deal needs a look.
-- Staff only: the app's members never read this.
create table public.deal_checks (
  special_id uuid primary key references public.weekly_specials (id) on delete cascade,
  url text not null,
  status smallint not null,              -- HTTP status of the last read (0 = didn't load)
  page_hash text,                        -- of the deal-ish lines, to spot changes
  excerpt text check (excerpt is null or char_length(excerpt) <= 4000),
  checked_at timestamptz not null default now(),
  changed_at timestamptz,                -- last time those lines changed
  failed_at timestamptz                  -- last time the page didn't load
);
alter table public.deal_checks enable row level security;
create policy "staff read deal checks" on public.deal_checks for select using (private.is_staff());
revoke insert, update, delete, truncate on public.deal_checks from anon, authenticated;

select cron.schedule('check-deals', '3 18 * * 1,4', $$
  select net.http_post(
    url := 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/check-deals',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);
