-- Let staff hide a newsletter email from the app (a one-off announcement, say). The beehiiv
-- sync only updates titles and links, so a hidden post stays hidden.
alter table public.posts add column hidden boolean not null default false;
alter policy "content is public" on public.posts using (not hidden);
