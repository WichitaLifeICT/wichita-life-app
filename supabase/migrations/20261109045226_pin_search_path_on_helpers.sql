-- Supabase's security checker: pin search_path on the four helper functions that didn't set one,
-- so a function can never pick up a same-named object from another schema. They only use built-ins.
alter function public.url_host(text) set search_path = pg_catalog, public;
alter function private.normalize_email(text) set search_path = pg_catalog, public;
alter function private.archive_old_year_guide() set search_path = pg_catalog, public;
alter function private.plan_share_code_guard() set search_path = pg_catalog, public;
