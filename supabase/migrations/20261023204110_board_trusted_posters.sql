-- A member's first post waits for staff review. Once one of their posts has been approved,
-- later posts go live right away, unless something of theirs was removed in the last 90 days.
create or replace function private.is_trusted_poster(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.threads where author_id = uid and status = 'approved')
    and not exists (
      select 1 from public.threads where author_id = uid and status = 'removed' and created_at > now() - interval '90 days')
    and not exists (
      select 1 from public.replies where author_id = uid and status = 'removed' and created_at > now() - interval '90 days');
$$;

create or replace function private.auto_approve_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and private.is_trusted_poster(new.author_id) then
    new.status := 'approved';
  end if;
  return new;
end;
$$;
create trigger threads_auto_approve before insert on public.threads
  for each row execute function private.auto_approve_thread();
