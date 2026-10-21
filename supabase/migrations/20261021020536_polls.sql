-- Community votes on the Explore tab ("Best coffee in Wichita"). Staff create polls and their
-- options; members vote once per poll (and can change their pick while it's open), and can
-- suggest a missing option, which waits for staff approval before anyone else sees it.
-- Per-option results only show to people who voted, after the poll closes, or to staff, so
-- nobody just piles onto the leader.

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 200),
  description text check (description is null or char_length(description) <= 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  published boolean not null default true,
  allow_suggestions boolean not null default true,
  vote_count int not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index polls_ends_idx on public.polls (ends_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  status text not null default 'approved' check (status in ('pending', 'approved', 'removed')),
  suggested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index poll_options_poll_idx on public.poll_options (poll_id, status);
create unique index poll_options_label_idx on public.poll_options (poll_id, lower(label)) where status <> 'removed';

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create index poll_votes_option_idx on public.poll_votes (option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create or replace function private.poll_is_open(poll uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.polls p
    where p.id = poll and p.published and now() >= p.starts_at and now() < p.ends_at
  );
$$;

-- Up to 3 suggestions per member per poll. (A policy can't count its own table directly.)
create or replace function private.my_poll_suggestions(poll uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.poll_options where poll_id = poll and suggested_by = auth.uid();
$$;

-- Polls
create policy "see published polls" on public.polls for select
  using ((published and starts_at <= now()) or private.is_staff());
create policy "staff manage polls" on public.polls for all using (private.is_staff()) with check (private.is_staff());

-- Options: approved ones on visible polls, plus your own suggestions
create policy "see approved options and your suggestions" on public.poll_options for select
  using (
    (status = 'approved' and exists (
      select 1 from public.polls p where p.id = poll_id and p.published and p.starts_at <= now()))
    or (suggested_by = auth.uid() and status <> 'removed')
    or private.is_staff()
  );
create policy "suggest options on open polls" on public.poll_options for insert to authenticated
  with check (
    suggested_by = auth.uid()
    and status = 'pending'
    and private.poll_is_open(poll_id)
    and exists (select 1 from public.polls p where p.id = poll_id and p.allow_suggestions)
    and private.my_poll_suggestions(poll_id) < 3
  );
create policy "staff manage options" on public.poll_options for all using (private.is_staff()) with check (private.is_staff());

-- Votes: one per member per poll, on an approved option of an open poll
create policy "see your votes" on public.poll_votes for select to authenticated
  using (user_id = auth.uid() or private.is_staff());
create policy "vote on open polls" on public.poll_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.poll_is_open(poll_id)
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id and o.status = 'approved')
  );
create policy "change your vote while open" on public.poll_votes for update to authenticated
  using (user_id = auth.uid() and private.poll_is_open(poll_id))
  with check (
    user_id = auth.uid()
    and private.poll_is_open(poll_id)
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id and o.status = 'approved')
  );
create policy "staff manage votes" on public.poll_votes for all using (private.is_staff()) with check (private.is_staff());

-- Members can only change which option they picked.
revoke update on public.poll_votes from authenticated;
grant update (option_id) on public.poll_votes to authenticated;

-- Total votes per poll, kept by a trigger so it can be public without exposing the split.
create or replace function private.count_poll_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.polls set vote_count = (select count(*) from public.poll_votes v where v.poll_id = polls.id)
  where id = coalesce(new.poll_id, old.poll_id);
  return null;
end;
$$;
revoke execute on function private.count_poll_votes() from public, anon, authenticated;
create trigger poll_votes_count after insert or delete on public.poll_votes
  for each row execute function private.count_poll_votes();

-- Results per option, for people who voted, once the poll has closed, or for staff.
create or replace function public.poll_results(poll uuid)
returns table (option_id uuid, label text, votes int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    private.is_staff()
    or exists (select 1 from public.poll_votes v where v.poll_id = poll_results.poll and v.user_id = auth.uid())
    or exists (select 1 from public.polls p where p.id = poll_results.poll and p.published and p.ends_at <= now())
  ) then
    raise exception 'vote to see results' using errcode = '42501';
  end if;
  return query
    select o.id, o.label, count(v.*)::int
    from public.poll_options o
    left join public.poll_votes v on v.option_id = o.id
    where o.poll_id = poll_results.poll and o.status = 'approved'
    group by o.id, o.label
    order by count(v.*) desc, o.label;
end;
$$;
revoke execute on function public.poll_results(uuid) from public;
grant execute on function public.poll_results(uuid) to anon, authenticated;
