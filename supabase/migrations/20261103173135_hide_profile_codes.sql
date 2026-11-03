-- Members can read each other's name and interests, but not invite or friend codes
-- (yours come from my_codes()). Applied after the app update that stops reading them.
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, interests, role, created_at, onboarded_at) on public.profiles to authenticated;
