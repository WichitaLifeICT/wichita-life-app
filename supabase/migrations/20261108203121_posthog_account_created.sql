-- Tell PostHog the moment an account is created, so "new accounts" counts real accounts
-- (not just people who finished the welcome screens). Uses the app's public PostHog project key.
-- Fire-and-forget: a PostHog hiccup can never block a sign-up.
-- (The six accounts that existed before this were backfilled once with their real creation times.)
create or replace function private.posthog_account_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  begin
    perform net.http_post(
      url := 'https://us.i.posthog.com/i/v0/e/',
      body := jsonb_build_object(
        'api_key', 'phc_w3N7n3ku3tnsBfgyZKqfpUs9iSH7D7Stk6ZX5mTbWB6E',
        'event', 'account_created',
        'distinct_id', new.id::text,
        'timestamp', to_char(coalesce(new.created_at, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'properties', jsonb_build_object(
          'provider', coalesce(new.raw_app_meta_data->>'provider', 'email'),
          'source', 'database'
        )
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke execute on function private.posthog_account_created() from public, anon, authenticated;

create trigger posthog_account_created after insert on auth.users
  for each row execute function private.posthog_account_created();
