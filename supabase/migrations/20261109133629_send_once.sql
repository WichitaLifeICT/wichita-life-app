-- Scheduled pushes and the staff digest send at most once a day, even if a job is run twice
-- (a retry, a manual re-run). The job claims "daily:2026-11-09" before sending; a second run
-- finds it taken and skips. If sending fails, the job lets go of the claim so a re-run can send.
create or replace function public.claim_send(k text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into private.push_log (key, sent_at) values ('once:' || k, now()) on conflict (key) do nothing;
  return found;
end $$;

create or replace function public.release_send(k text)
returns void language sql security definer set search_path = public as $$
  delete from private.push_log where key = 'once:' || k;
$$;

revoke execute on function public.claim_send(text) from public, anon, authenticated;
revoke execute on function public.release_send(text) from public, anon, authenticated;
grant execute on function public.claim_send(text) to service_role;
grant execute on function public.release_send(text) to service_role;
