-- "Not interested": members can hide an event from Picked for you (and their personalized
-- Thursday push). Dropping a whole interest just edits profiles.interests.
create table public.dismissed_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.dismissed_events enable row level security;
create policy "see your dismissed events" on public.dismissed_events for select to authenticated
  using (user_id = auth.uid());
create policy "dismiss events" on public.dismissed_events for insert to authenticated
  with check (user_id = auth.uid());
create policy "undo a dismissal" on public.dismissed_events for delete to authenticated
  using (user_id = auth.uid());

-- Staff: how many phones a push to this topic (and, optionally, these interests) would reach.
create or replace function public.push_audience(topic text, interests text[] default '{}')
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return (
    select count(distinct t.token)::int
    from public.push_tokens t
    join public.notification_prefs n on n.user_id = t.user_id
    join public.profiles p on p.id = t.user_id
    where case push_audience.topic
            when 'daily' then n.daily
            when 'giveaways' then n.giveaways
            when 'weekend' then n.weekend
            when 'breaking' then n.breaking
            else false
          end
      and (cardinality(push_audience.interests) = 0 or p.interests && push_audience.interests)
  );
end;
$$;
revoke execute on function public.push_audience(text, text[]) from public, anon;
grant execute on function public.push_audience(text, text[]) to authenticated;
