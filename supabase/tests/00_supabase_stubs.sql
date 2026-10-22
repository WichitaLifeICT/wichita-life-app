-- Minimal stand-ins for what a Supabase project provides, so the migration can be
-- tested on a plain Postgres in CI. Not used in production.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated;

-- Stand-ins for Supabase platform extensions used by the migrations (CI strips the
-- `create extension pg_net/pg_cron` lines and uses these instead).
-- Like Supabase's: skips row level security, but has no access to the private schema.
create role service_role nologin bypassrls;
create schema extensions;
create function extensions.gen_random_bytes(n int) returns bytea language sql as $$
  select decode(string_agg(lpad(to_hex((random() * 255)::int), 2, '0'), ''), 'hex') from generate_series(1, n)
$$;
create schema vault;
create table vault.decrypted_secrets (name text primary key, secret text, decrypted_secret text);
create function vault.create_secret(new_secret text, new_name text, new_description text default '') returns uuid language sql as $$
  insert into vault.decrypted_secrets (name, secret, decrypted_secret) values (new_name, 'encrypted', new_secret);
  select gen_random_uuid();
$$;
create schema cron;
create table cron.job (jobid serial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid::bigint;
$$;
create function cron.alter_job(job_id bigint, schedule text default null, command text default null) returns void language sql as $$
  update cron.job set schedule = coalesce(alter_job.schedule, job.schedule), command = coalesce(alter_job.command, job.command) where jobid = job_id;
$$;
