-- Sponsored events and banners follow the events calendar:
--  * `featured` mirrors the calendar's Featured switch; the app treats featured events as sponsored,
--    on top of any staff mark as sponsored by hand (`is_sponsored`).
--  * `website` is the event's own site from the calendar.
--  * A sponsor banner belongs to the events whose website is on the same site as the banner's link
--    (or that staff link with sponsor_id), and comes down 12 hours after the last of them, even
--    if its end date is later. Banners with no matching events run on their dates as before.
alter table public.events
  add column featured boolean not null default false,
  add column website text check (website is null or char_length(website) <= 500),
  add column sponsor_id uuid references public.sponsors (id) on delete set null;
create index events_sponsor_idx on public.events (sponsor_id) where sponsor_id is not null;

-- The site part of a link: "https://www.rockyhorrorwichita.com/tickets" -> "rockyhorrorwichita.com".
create or replace function public.url_host(url text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(coalesce(url, '')), '^\s*https?://(www\.)?([^/:?#]+).*$', '\2'), lower(coalesce(url, '')));
$$;

create view public.live_sponsors with (security_invoker = true) as
  with linked as (
    select s.id as sponsor_id, e.hidden, coalesce(e.ends_at, e.starts_at) as ends
    from public.sponsors s
    join public.events e
      on e.sponsor_id = s.id
      or (public.url_host(e.website) is not null and public.url_host(e.website) = public.url_host(s.cta_url))
  )
  select s.*
  from public.sponsors s
  where now() between s.starts_at and s.ends_at
    and (
      not exists (select 1 from linked l where l.sponsor_id = s.id)
      or exists (select 1 from linked l where l.sponsor_id = s.id and not l.hidden and l.ends > now() - interval '12 hours')
    );
grant select on public.live_sponsors to anon, authenticated;
