-- Signed-out visitors' board and Meet queries embed author names. They had table access before
-- (row security shows them no profile rows, so names come back empty); give back the same safe
-- columns so those queries load instead of failing. Codes stay hidden from everyone.
grant select (id, display_name, interests, role, created_at, onboarded_at) on public.profiles to anon;
