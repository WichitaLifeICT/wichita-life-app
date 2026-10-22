-- Members can suggest a weekly special (happy hour, trivia…). Suggestions are saved hidden
-- (active = false, pending = true) until staff approve them in Staff tools > Weekly specials.
alter table public.weekly_specials
  add column pending boolean not null default false,
  add column suggested_by uuid references public.profiles (id) on delete set null;
create index weekly_specials_pending_idx on public.weekly_specials (pending) where pending;

-- Up to 5 suggestions a day per member. (A policy can't count its own table directly.)
create or replace function private.my_weekly_suggestions_today()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.weekly_specials
  where suggested_by = auth.uid() and created_at > now() - interval '1 day';
$$;

create policy "suggest weekly specials" on public.weekly_specials for insert to authenticated
  with check (
    suggested_by = auth.uid()
    and pending
    and not active
    and verified_on is null
    and private.my_weekly_suggestions_today() < 5
  );
