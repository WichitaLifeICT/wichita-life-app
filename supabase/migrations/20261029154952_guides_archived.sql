-- Guides with an old year in the title ("Riverfest Guide 2024") are archived: hidden in the app,
-- kept in the table. sync-guides never resets this, and archives new old-year guides itself.
alter table public.guides add column archived boolean not null default false;

update public.guides g set archived = true
where (select max(m[1]::int) from regexp_matches(g.title, '\m((?:19|20)\d{2})\M', 'g') m)
  < extract(year from now() at time zone 'America/Chicago');
