-- Spotlight nominations come in through the feedback form as their own kind, so they land
-- in the staff Feedback inbox with a reply-to email like any other note.
alter table public.feedback drop constraint feedback_kind_check;
alter table public.feedback add constraint feedback_kind_check
  check (kind in ('idea', 'bug', 'love', 'other', 'spotlight'));
