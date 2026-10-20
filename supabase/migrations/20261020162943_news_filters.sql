-- Keep national politics and violent-crime headlines out of the app's news feed.
-- Words live in public.news_blocked_words: add or remove rows in the Supabase table editor
-- and existing headlines are re-checked right away. Matches whole words, any capitalization.

create table public.news_blocked_words (
  word text primary key check (word = lower(word) and word ~ '^[a-z'' -]+$')
);
alter table public.news_blocked_words enable row level security;
create policy "staff manage blocked words" on public.news_blocked_words for all
  using (private.is_staff()) with check (private.is_staff());

-- Filtered headlines are kept (so they aren't re-added) but not shown. Separate from
-- `hidden`, which staff set by hand.
alter table public.news_items add column filtered boolean not null default false;

create or replace function private.news_title_blocked(title text)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.news_blocked_words w
    where news_title_blocked.title ~* ('\m' || regexp_replace(w.word, '([^a-z0-9 ])', '\\\1', 'g') || '\M')
  );
$$;

create or replace function private.filter_news_item()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.filtered := private.news_title_blocked(new.title);
  return new;
end;
$$;

create trigger news_items_filter before insert or update of title on public.news_items
  for each row execute function private.filter_news_item();

create or replace function private.refilter_news()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.news_items set filtered = private.news_title_blocked(title)
    where filtered is distinct from private.news_title_blocked(title);
  return null;
end;
$$;

create trigger news_blocked_words_changed after insert or update or delete on public.news_blocked_words
  for each statement execute function private.refilter_news();

revoke execute on function private.news_title_blocked(text) from public, anon, authenticated;
revoke execute on function private.filter_news_item() from public, anon, authenticated;
revoke execute on function private.refilter_news() from public, anon, authenticated;

alter policy "visible news is public" on public.news_items using (not hidden and not filtered);

-- Adding the starter list re-checks every existing headline (trigger above).
insert into public.news_blocked_words (word) values
  ('trump'), ('kill'), ('kills'), ('killed'), ('killing'), ('killings'), ('killer'), ('killers'),
  ('murder'), ('murders'), ('murdered'), ('murderer'), ('homicide'), ('homicides'), ('manslaughter'),
  ('shooting'), ('shootings'), ('shot and killed'), ('gunman'), ('gunfire'),
  ('stabbing'), ('stabbed'), ('slain'), ('fatal'), ('fatally'),
  ('dead'), ('death'), ('deaths'), ('died'), ('dies'), ('body found');
