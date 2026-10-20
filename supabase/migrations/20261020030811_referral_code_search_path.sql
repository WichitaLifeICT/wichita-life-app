-- Pin the invite-code helper's search path (Supabase security advisor).
alter function private.new_referral_code() set search_path = pg_catalog;
