-- Staff (the owner included) can still enter a giveaway, so the app looks normal in a demo, but
-- their entries don't count: not in the public "N entered", not in PostHog, and never in the draw.
create or replace function private.refresh_giveaway_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  gid uuid := coalesce(new.giveaway_id, old.giveaway_id);
begin
  update public.giveaways set entrant_count = (
    select count(distinct e.user_id) from public.giveaway_entries e
    join public.profiles p on p.id = e.user_id
    where e.giveaway_id = gid and p.role not in ('admin', 'moderator'))
  where id = gid;
  return null;
end $$;

update public.giveaways g set entrant_count = (
  select count(distinct e.user_id) from public.giveaway_entries e
  join public.profiles p on p.id = e.user_id
  where e.giveaway_id = g.id and p.role not in ('admin', 'moderator'));

create or replace function private.posthog_giveaway_entry()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare added int := new.entries - case when tg_op = 'UPDATE' then old.entries else 0 end;
begin
  if added <= 0 then return new; end if;
  if exists (select 1 from public.profiles where id = new.user_id and role in ('admin', 'moderator')) then return new; end if;
  begin
    perform net.http_post(
      url := 'https://us.i.posthog.com/i/v0/e/',
      body := jsonb_build_object(
        'api_key', 'phc_w3N7n3ku3tnsBfgyZKqfpUs9iSH7D7Stk6ZX5mTbWB6E',
        'event', 'giveaway_entry_added',
        'distinct_id', new.user_id::text,
        'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'properties', jsonb_build_object(
          'giveaway_id', new.giveaway_id,
          'giveaway', (select title from public.giveaways where id = new.giveaway_id),
          'kind', new.kind,
          'entries', added,
          'source', 'database'
        )
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
  return new;
end $$;
revoke execute on function private.posthog_giveaway_entry() from public, anon, authenticated;
