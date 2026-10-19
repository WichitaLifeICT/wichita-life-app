-- Wichita Life app: initial schema
-- Content tables (posts, events, news, jobs) are filled by sync jobs and are public to read.
-- Member tables (saves, RSVPs, entries, posts on the board) belong to the signed-in user.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  interests text[] not null default '{}',
  role text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

-- Members can't promote themselves: role is only changed by admins.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- Create a profile and default notification settings for every new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  daily boolean not null default true,       -- "Today in Wichita", 7am
  giveaways boolean not null default true,
  weekend boolean not null default true,     -- Thursday weekend guide
  breaking boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,               -- Expo push token
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------------------
-- Content (synced)
-- ---------------------------------------------------------------------------

create table public.posts (
  id text primary key,                       -- beehiiv post id
  title text not null,
  subtitle text,
  slug text not null,
  url text not null,
  kind text not null default 'deep' check (kind in ('daily', 'deep', 'weekend', 'spotlight', 'guide')),
  excerpt text,
  thumbnail_url text,
  featured boolean not null default false,  -- pin as the Today hero
  published_at timestamptz not null,
  synced_at timestamptz not null default now()
);
create index posts_published_at_idx on public.posts (published_at desc);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  source text not null,                      -- 'wichitalife_events', 'manual', ...
  source_id text not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  venue text,
  address text,
  price_text text,
  url text,
  image_url text,
  tags text[] not null default '{}',         -- 'free', 'family', 'music', 'food', 'spooky', ...
  is_sponsored boolean not null default false,
  hidden boolean not null default false,
  synced_at timestamptz not null default now(),
  unique (source, source_id)
);
create index events_starts_at_idx on public.events (starts_at);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  title text not null,
  url text not null unique,
  summary text,
  published_at timestamptz not null,
  hidden boolean not null default false,
  synced_at timestamptz not null default now()
);
create index news_items_published_at_idx on public.news_items (published_at desc);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  url text not null unique,
  pay_text text,
  posted_at timestamptz not null default now(),
  active boolean not null default true
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text not null,
  body text,
  cta_label text,
  cta_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Member activity
-- ---------------------------------------------------------------------------

create table public.saved_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  remind boolean not null default true,      -- push the day before
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- Meetups hosted by Wichita Life (dinner club, walks, happy hours)
create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  area text not null,                        -- shown to everyone, e.g. 'Delano'
  capacity int not null check (capacity > 0),
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'canceled')),
  group_id uuid,
  created_at timestamptz not null default now()
);

-- Exact location is only visible to people who are going.
create table public.meetup_private (
  meetup_id uuid primary key references public.meetups (id) on delete cascade,
  venue text not null,
  address text,
  host_notes text
);

create table public.rsvps (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'waitlist')),
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text
);
alter table public.meetups
  add constraint meetups_group_id_fkey foreign key (group_id) references public.groups (id) on delete set null;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Community board: every thread is reviewed before it goes live.
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('recommendations', 'ask', 'free_for_sale', 'lost_found')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'removed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id)
);
create index threads_status_created_idx on public.threads (status, created_at desc);

-- Replies go live right away and can be reported.
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'approved' check (status in ('approved', 'removed')),
  created_at timestamptz not null default now()
);
create index replies_thread_idx on public.replies (thread_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid references public.threads (id) on delete cascade,
  reply_id uuid references public.replies (id) on delete cascade,
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  check ((thread_id is null) <> (reply_id is null))
);

-- Giveaways
create table public.giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prize text not null,
  description text,
  sponsor_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rules_url text not null,                   -- official rules, "no purchase necessary"
  winner_user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- One row per way of earning entries. Members can only add the basic 'enter' row;
-- bonus rows are added by the server once the action is verified.
create table public.giveaway_entries (
  giveaway_id uuid not null references public.giveaways (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('enter', 'newsletter', 'save_event', 'referral')),
  entries int not null default 1 check (entries > 0),
  created_at timestamptz not null default now(),
  primary key (giveaway_id, user_id, kind)
);

-- ---------------------------------------------------------------------------
-- Public counts (views run as owner, so they can count rows members can't read)
-- ---------------------------------------------------------------------------

create view public.meetup_counts as
  select m.id as meetup_id,
         count(r.*) filter (where r.status = 'going')::int as going,
         count(r.*) filter (where r.status = 'waitlist')::int as waitlist
  from public.meetups m
  left join public.rsvps r on r.meetup_id = m.id
  group by m.id;

create view public.group_counts as
  select g.id as group_id, count(gm.*)::int as members
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  group by g.id;

create view public.giveaway_counts as
  select giveaway_id, count(distinct user_id)::int as entrants
  from public.giveaway_entries
  group by giveaway_id;

create view public.thread_reply_counts as
  select thread_id, count(*)::int as replies
  from public.replies
  where status = 'approved'
  group by thread_id;

grant select on public.meetup_counts, public.group_counts, public.giveaway_counts, public.thread_reply_counts
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_tokens enable row level security;
alter table public.blocks enable row level security;
alter table public.posts enable row level security;
alter table public.events enable row level security;
alter table public.news_items enable row level security;
alter table public.jobs enable row level security;
alter table public.sponsors enable row level security;
alter table public.saved_events enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_private enable row level security;
alter table public.rsvps enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.threads enable row level security;
alter table public.replies enable row level security;
alter table public.reports enable row level security;
alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;

-- Public content
create policy "content is public" on public.posts for select using (true);
create policy "visible events are public" on public.events for select using (not hidden);
create policy "visible news is public" on public.news_items for select using (not hidden);
create policy "active jobs are public" on public.jobs for select using (active);
create policy "sponsors are public" on public.sponsors for select using (true);
create policy "open meetups are public" on public.meetups for select using (status <> 'draft');
create policy "groups are public" on public.groups for select using (true);
create policy "giveaways are public" on public.giveaways for select using (true);

-- Staff manage content
create policy "staff manage posts" on public.posts for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage events" on public.events for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage news" on public.news_items for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage jobs" on public.jobs for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage sponsors" on public.sponsors for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage meetups" on public.meetups for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage meetup details" on public.meetup_private for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage groups" on public.groups for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage giveaways" on public.giveaways for all using (public.is_staff()) with check (public.is_staff());

-- Profiles: names are visible to signed-in members (for the board); you edit your own.
create policy "members see profiles" on public.profiles for select to authenticated using (true);
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
create policy "staff manage profiles" on public.profiles for update using (public.is_staff()) with check (public.is_staff());

-- Own rows only
create policy "own notification prefs" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own push tokens" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own blocks" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "own saved events" on public.saved_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own group memberships" on public.group_members for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RSVPs: see and manage your own; staff see everyone's
create policy "see own rsvps" on public.rsvps for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "rsvp to open meetups" on public.rsvps for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.meetups m where m.id = meetup_id and m.status = 'open' and m.starts_at > now())
  );
create policy "cancel own rsvp" on public.rsvps for delete to authenticated using (user_id = auth.uid());
create policy "staff manage rsvps" on public.rsvps for all using (public.is_staff()) with check (public.is_staff());

-- Exact meetup location: only people who are going
create policy "attendees see meetup details" on public.meetup_private for select to authenticated
  using (exists (
    select 1 from public.rsvps r
    where r.meetup_id = meetup_private.meetup_id and r.user_id = auth.uid() and r.status = 'going'
  ));

-- Board threads
create policy "see approved threads and your own" on public.threads for select
  using (
    (status = 'approved' and not exists (
      select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = threads.author_id))
    or author_id = auth.uid()
    or public.is_staff()
  );
create policy "post threads for review" on public.threads for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending' and reviewed_at is null and reviewed_by is null);
create policy "delete own threads" on public.threads for delete to authenticated using (author_id = auth.uid());
create policy "staff review threads" on public.threads for update using (public.is_staff()) with check (public.is_staff());

-- Replies
create policy "see replies on visible threads" on public.replies for select
  using (
    (status = 'approved'
      and exists (select 1 from public.threads t where t.id = thread_id and t.status = 'approved')
      and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = replies.author_id))
    or author_id = auth.uid()
    or public.is_staff()
  );
create policy "reply to approved threads" on public.replies for insert to authenticated
  with check (
    author_id = auth.uid() and status = 'approved'
    and exists (select 1 from public.threads t where t.id = thread_id and t.status = 'approved')
  );
create policy "delete own replies" on public.replies for delete to authenticated using (author_id = auth.uid());
create policy "staff moderate replies" on public.replies for update using (public.is_staff()) with check (public.is_staff());

-- Reports
create policy "file reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "staff handle reports" on public.reports for all using (public.is_staff()) with check (public.is_staff());

-- Giveaway entries: members add the basic entry while the giveaway is open
create policy "see own entries" on public.giveaway_entries for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy "enter open giveaways" on public.giveaway_entries for insert to authenticated
  with check (
    user_id = auth.uid() and kind = 'enter' and entries = 1
    and exists (select 1 from public.giveaways g where g.id = giveaway_id and now() between g.starts_at and g.ends_at)
  );
create policy "staff manage entries" on public.giveaway_entries for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Meetup capacity: once a meetup is full, new RSVPs go on the waitlist.
-- ---------------------------------------------------------------------------

create or replace function public.rsvp_apply_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  taken int;
begin
  select capacity into cap from public.meetups where id = new.meetup_id for update;
  select count(*) into taken from public.rsvps where meetup_id = new.meetup_id and status = 'going';
  new.status := case when taken >= cap then 'waitlist' else 'going' end;
  return new;
end;
$$;

create trigger rsvps_apply_capacity
  before insert on public.rsvps
  for each row execute function public.rsvp_apply_capacity();

-- When someone who was going cancels, move the earliest waitlisted person up.
create or replace function public.rsvp_promote_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'going' then
    update public.rsvps set status = 'going'
    where (meetup_id, user_id) = (
      select meetup_id, user_id from public.rsvps
      where meetup_id = old.meetup_id and status = 'waitlist'
      order by created_at
      limit 1
    );
  end if;
  return old;
end;
$$;

create trigger rsvps_promote_waitlist
  after delete on public.rsvps
  for each row execute function public.rsvp_promote_waitlist();
