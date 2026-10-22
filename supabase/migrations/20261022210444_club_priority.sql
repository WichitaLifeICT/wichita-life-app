-- Pin clubs to the top of Clubs around town: higher priority shows first.
alter table public.clubs add column priority smallint not null default 0;

update public.clubs set priority = 2 where name = 'Fortune 88 Run Club';
update public.clubs set priority = 1 where name = 'Run 316';

-- Details checked Oct 22, 2026 (club Facebook pages, City of Wichita newsletter, TrainerDay).
update public.clubs set description = 'Wichita run club. Use code Fortune88 for 10% off at Doc Green''s.', verified_on = '2026-10-22'
  where name = 'Fortune 88 Run Club';
update public.clubs set schedule = 'Mondays 6:30pm at Sedgwick County Park · Saturdays 8am at Naftzger Park'
  where name = 'Run 316';
update public.clubs set description = 'Run or walk with us. You don''t have to be elite physically, just ready to be elite mentally. Faith, friendships and fitness.', verified_on = '2026-10-22'
  where name = 'Elite Running Club';
update public.clubs set verified_on = '2026-10-22' where name = 'Exploration Place parkrun';
update public.clubs set schedule = 'Tuesday nights at 2431 W Pawnee St', verified_on = '2026-10-22'
  where name = 'Pink Elephant open game night';
update public.clubs set schedule = 'Wednesdays 8:30am at Groover Labs, 334 St. Francis', verified_on = '2026-06-01'
  where name = '1 Million Cups Wichita';
update public.clubs set description = 'Nonprofit climbing gym at 4456 S Clifton, open to members anytime.'
  where name = 'Kansas Cliff Club';
