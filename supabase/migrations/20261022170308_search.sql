-- One search across the app: upcoming events, places to eat, weekly specials, newsletter
-- stories, guides and jobs. Every word has to appear somewhere (so "trivia tues" finds Tuesday
-- trivia nights); up to 6 results per kind. Runs with the caller's rights, and also filters out
-- hidden things explicitly, since staff can otherwise see them.
create or replace function public.search_all(q text)
returns table (kind text, id text, title text, detail text, url text, starts_at timestamptz)
language sql
stable
set search_path = public
as $$
  with words as (
    select array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%') as pats
    from unnest(regexp_split_to_array(lower(btrim(q)), '\s+')) w
    where length(w) > 0
  ),
  hits as (
    (select 'event' as kind, e.id::text, e.title, coalesce(e.venue, '') as detail, e.url, e.starts_at, 0 as rank
     from public.events e, words
     where not e.hidden and e.starts_at >= now() - interval '6 hours'
       and lower(e.title || ' ' || coalesce(e.venue, '') || ' ' || array_to_string(e.calendar_tags, ' ')) like all (words.pats)
     order by e.starts_at limit 6)
    union all
    (select 'place', p.id::text, p.name, coalesce(p.address, ''), p.website, null, case when p.local_pick then 0 when p.chain then 2 else 1 end
     from public.places p, words
     where p.status = 'active'
       and lower(p.name || ' ' || array_to_string(p.cuisine, ' ') || ' ' || array_to_string(p.categories, ' ') || ' ' || coalesce(p.address, '')) like all (words.pats)
     order by 7, p.name limit 6)
    union all
    (select 'weekly', w.id::text, w.title, w.venue, w.url, null, 0
     from public.weekly_specials w, words
     where w.active
       and lower(w.title || ' ' || w.venue || ' ' || replace(w.kind, '_', ' ') || ' ' || coalesce(w.details, '') || ' ' ||
         (select string_agg(d.name, ' ') from unnest(array['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])
            with ordinality as d(name, n) where (d.n - 1)::smallint = any (w.days))) like all (words.pats)
     order by w.venue limit 6)
    union all
    (select 'story', s.id, s.title, s.kind, s.url, s.published_at, 0
     from public.posts s, words
     where not s.hidden and s.kind <> 'spotlight'
       and lower(s.title || ' ' || coalesce(s.subtitle, '')) like all (words.pats)
     order by s.published_at desc limit 6)
    union all
    (select 'guide', g.id::text, g.title, coalesce(g.summary, ''), g.url, null, 0
     from public.guides g, words
     where g.active and lower(g.title || ' ' || coalesce(g.summary, '')) like all (words.pats)
     order by g.position limit 6)
    union all
    (select 'job', j.id::text, j.title, j.company, j.url, j.posted_at, 0
     from public.jobs j, words
     where j.active and lower(j.title || ' ' || j.company) like all (words.pats)
     order by j.posted_at desc limit 6)
  )
  select kind, id, title, detail, url, starts_at from hits
  where length(btrim(coalesce(q, ''))) >= 2;
$$;
grant execute on function public.search_all(text) to anon, authenticated;
