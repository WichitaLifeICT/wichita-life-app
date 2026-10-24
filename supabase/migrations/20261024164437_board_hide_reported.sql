-- When two different members report a post it goes back into review (hidden); two reports
-- on a reply hide it. Staff decide in Staff tools > Board.
create or replace function private.hide_reported()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.thread_id is not null and (
    select count(distinct reporter_id) from public.reports where thread_id = new.thread_id and not resolved) >= 2 then
    update public.threads set status = 'pending' where id = new.thread_id and status = 'approved';
  elsif new.reply_id is not null and (
    select count(distinct reporter_id) from public.reports where reply_id = new.reply_id and not resolved) >= 2 then
    update public.replies set status = 'removed' where id = new.reply_id and status = 'approved';
  end if;
  return new;
end;
$$;
create trigger reports_hide_reported after insert on public.reports
  for each row execute function private.hide_reported();
