-- Scheduled sync jobs.
-- - News sources live in a table (easy to add, pause or remove an outlet without redeploying).
-- - A random cron secret lives in Supabase Vault. Scheduled jobs send it, and the edge
--   functions check it with verify_cron_secret(), which only the service role can call.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- shown in the app, e.g. 'KSN'
  feed_url text not null unique,
  active boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.news_sources enable row level security;
create policy "staff manage news sources" on public.news_sources for all
  using (private.is_staff()) with check (private.is_staff());

-- Generate the secret inside the database; it never appears in code or logs.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'Shared secret for scheduled edge function calls');

-- Note: vault.decrypted_secrets has its own `secret` column, so the parameter is
-- referenced as verify_cron_secret.secret to avoid comparing the column with itself.
create or replace function public.verify_cron_secret(secret text)
returns boolean
language sql
stable
security definer
set search_path = vault, extensions, pg_catalog
as $$
  select exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'cron_secret' and s.decrypted_secret = verify_cron_secret.secret
  );
$$;
revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;
