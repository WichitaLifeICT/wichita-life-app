-- Automatic club checks: a bot (Grok, signed in to Facebook and Instagram) looks at each club's
-- page on a schedule and sends what it finds to the club-updates function with a private key.
--   * Each club's latest post date is saved right away (clubs.last_post_on), so Meet can show
--     "Active · posted Oct 19".
--   * A changed schedule, or "they've stopped meeting", waits in club_updates for staff to
--     Apply or Dismiss in Staff tools > Clubs, since the bot can be wrong.

alter table public.clubs add column last_post_on date;

create table public.club_updates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  received_at timestamptz not null default now(),
  last_post_on date,
  still_meets boolean,
  schedule text check (char_length(schedule) <= 200),
  notes text check (char_length(notes) <= 500),
  status text not null default 'pending' check (status in ('pending', 'applied', 'dismissed'))
);
create index club_updates_pending_idx on public.club_updates (club_id) where status = 'pending';
alter table public.club_updates enable row level security;
create policy "staff manage club updates" on public.club_updates for all
  using (private.is_staff()) with check (private.is_staff());

-- The bot's key, in Vault. club-updates checks it with verify_club_updates_key (service role only);
-- staff see the bot's link in Staff tools > Clubs through club_updates_link().
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'club_updates_key', 'Key the club-checking bot sends to club-updates');

create or replace function public.verify_club_updates_key(key text)
returns boolean
language sql
stable
security definer
set search_path = vault, pg_catalog
as $$
  select exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'club_updates_key' and s.decrypted_secret = verify_club_updates_key.key
  );
$$;
revoke execute on function public.verify_club_updates_key(text) from public, anon, authenticated;
grant execute on function public.verify_club_updates_key(text) to service_role;

create or replace function public.club_updates_link()
returns text
language plpgsql
stable
security definer
set search_path = public, vault, pg_catalog
as $$
begin
  if not private.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return 'https://rbxmzybuduluzpvtgfil.supabase.co/functions/v1/club-updates?key='
    || (select decrypted_secret from vault.decrypted_secrets where name = 'club_updates_key');
end;
$$;
revoke execute on function public.club_updates_link() from public, anon;
grant execute on function public.club_updates_link() to authenticated;
