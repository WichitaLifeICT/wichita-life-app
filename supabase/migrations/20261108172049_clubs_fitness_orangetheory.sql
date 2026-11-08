-- A Fitness category for clubs, starting with Orangetheory's three Wichita studios
-- (addresses and links from orangetheory.com location pages).
alter table public.clubs drop constraint clubs_category_check;
alter table public.clubs add constraint clubs_category_check
  check (category in ('run', 'fitness', 'games', 'books', 'sports', 'social', 'arts', 'professional', 'other'));

insert into public.clubs (name, category, description, schedule, url, verified_on, priority) values
  ('Orangetheory Fitness Downtown', 'fitness',
   'Heart-rate-based group workouts with a coach: treadmill, rowing and strength. First class free.',
   'Classes daily at 645 E Douglas Ave #106; book on their page',
   'https://www.orangetheory.com/en-us/locations/wichita-kansas-1546', '2026-11-08', 1),
  ('Orangetheory Fitness Wichita East', 'fitness',
   'Heart-rate-based group workouts with a coach: treadmill, rowing and strength. First class free.',
   '1423 N Webb Rd #159; check their page for class times and opening status before you go',
   'https://www.orangetheory.com/en-us/locations/wichita-kansas-0589', null, 1),
  ('Orangetheory Fitness Wichita West', 'fitness',
   'Heart-rate-based group workouts with a coach: treadmill, rowing and strength. First class free.',
   '2835 N Maize Rd #161; check their page for class times and opening status before you go',
   'https://www.orangetheory.com/en-us/locations/wichita-kansas-0590', null, 1);
