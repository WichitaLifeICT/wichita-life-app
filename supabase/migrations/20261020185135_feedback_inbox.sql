-- Staff inbox for app feedback, with the sender's name and an email to reply to
-- (the account email for members, the one they typed for guests).
create or replace function public.feedback_inbox(want_status text default 'new')
returns table (
  id uuid, kind text, message text, status text, staff_note text, screen text, platform text,
  app_version text, created_at timestamptz, sender_name text, reply_email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
    select f.id, f.kind, f.message, f.status, f.staff_note, f.screen, f.platform, f.app_version, f.created_at,
           coalesce(nullif(p.display_name, ''), case when f.user_id is null then 'Guest' else 'Member' end),
           coalesce(u.email::text, f.contact_email)
    from public.feedback f
    left join public.profiles p on p.id = f.user_id
    left join auth.users u on u.id = f.user_id
    where feedback_inbox.want_status = 'all' or f.status = feedback_inbox.want_status
    order by f.created_at desc
    limit 200;
end;
$$;
revoke execute on function public.feedback_inbox(text) from public, anon;
grant execute on function public.feedback_inbox(text) to authenticated;
