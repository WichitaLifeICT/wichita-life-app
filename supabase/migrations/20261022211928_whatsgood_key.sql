-- The What's Good (events calendar) API key lives in Supabase Vault as `whatsgood_api_key`.
-- sync-events reads it through this function, which only the service role can call.
create or replace function public.whatsgood_api_key()
returns text
language sql
stable
security definer
set search_path = vault, pg_catalog
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'whatsgood_api_key';
$$;
revoke execute on function public.whatsgood_api_key() from public, anon, authenticated;
grant execute on function public.whatsgood_api_key() to service_role;
