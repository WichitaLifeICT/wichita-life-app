-- Who entered a giveaway (Staff tools > Giveaways > See who entered), and a PostHog event for
-- every entry so the Giveaways dashboard can count people and entries.

-- 1. Staff-only list: each member's total entries, what they came from, and when they entered.
create or replace function public.giveaway_entrants(giveaway uuid)
returns table (user_id uuid, display_name text, email text, entries bigint, kinds jsonb, entered_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, u.email::text, sum(e.entries)::bigint,
      jsonb_object_agg(e.kind, e.entries), min(e.created_at)
    from public.giveaway_entries e
    join public.profiles p on p.id = e.user_id
    join auth.users u on u.id = e.user_id
    where e.giveaway_id = giveaway_entrants.giveaway
    group by p.id, p.display_name, u.email
    order by 4 desc, 6;
end $$;
revoke execute on function public.giveaway_entrants(uuid) from public, anon;
grant execute on function public.giveaway_entrants(uuid) to authenticated;

-- 2. PostHog "giveaway_entry_added" for every entry, bonus entries included (entries = how many
--    were just added). Fire-and-forget like account_created: a PostHog hiccup never blocks an entry.
--    (Entries that existed before this were backfilled once with their real times.)
create or replace function private.posthog_giveaway_entry()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare added int := new.entries - case when tg_op = 'UPDATE' then old.entries else 0 end;
begin
  if added <= 0 then return new; end if;
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

create trigger posthog_giveaway_entry after insert or update of entries on public.giveaway_entries
  for each row execute function private.posthog_giveaway_entry();
