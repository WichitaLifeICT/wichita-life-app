-- Minimal stand-ins for what a Supabase project provides, so the migration can be
-- tested on a plain Postgres in CI. Not used in production.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
