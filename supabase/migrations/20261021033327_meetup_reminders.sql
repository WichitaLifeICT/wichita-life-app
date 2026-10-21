-- Meetup reminders: the 6pm reminders job also tells people going to a meetup tomorrow.
-- reminded_at marks who has been told, so nobody gets it twice.
alter table public.rsvps add column reminded_at timestamptz;
