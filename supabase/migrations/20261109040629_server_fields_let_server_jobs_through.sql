-- The server's own jobs (service role: staff alerts, reminders, syncs) were blocked by this trigger:
-- PL/pgSQL plans the whole IF expression, and the service role can't see the private schema, so
-- "or private.is_staff()" failed with "permission denied for schema private". That stopped report
-- alerts from being marked as sent (repeat emails every 10 minutes) and reminders from being marked done.
-- Check the role first, in its own statement, so server jobs return before private is touched.
create or replace function private.server_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if private.is_staff() then return new; end if;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    return new;
  end if;
  new.created_at := now();
  case tg_table_name
    when 'threads' then new.reply_count := 0;
    when 'clubs' then new.priority := 0; new.last_post_on := null;
    when 'reports' then
      new.resolved := false;
      new.alerted_at := null;
      new.reason := left(new.reason, 500);
      if private.my_reports_today() >= 20 then
        raise exception 'That''s a lot of reports today. Staff will look at the ones you sent.' using errcode = 'check_violation';
      end if;
    when 'saved_events', 'rsvps' then new.reminded_at := null;
    else null;
  end case;
  return new;
end $$;
