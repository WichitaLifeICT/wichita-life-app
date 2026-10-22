-- Starter content so a fresh Supabase project shows something real.
-- Posts, events, news and jobs come from the Oct 19, 2026 newsletter and will be
-- replaced by the sync jobs. Meetups, groups and the giveaway are examples to edit or delete.

insert into public.posts (id, title, slug, url, kind, excerpt, featured, published_at) values
  ('post_c830d420-a43c-4fe9-a88e-2098ef58c720', 'Wichita Guide to Real Haunted Places (and a few fake ones) + Pumpkin Patches 2026',
   'wichita-guide-to-real-haunted-places-and-a-few-fakes-ones-pumpkin-patches-2026',
   'https://wichitalife.beehiiv.com/p/wichita-guide-to-real-haunted-places-and-a-few-fakes-ones-pumpkin-patches-2026',
   'guide', 'Theorosa''s Bridge, the Broadview Hotel, Old Cowtown, the Orpheum and the Eaton Hotel ghost, plus guided ghost tours, eight pumpkin patches and corn mazes, and the area''s haunted houses.',
   true, '2026-10-07 11:00:00+00'),
  ('post_a07d6d27-a885-4b0f-838d-d360c7c348f8', 'Praying for Wichita', 'praying-for-wichita', 'https://wichitalife.beehiiv.com/p/praying-for-wichita', 'daily', null, false, '2026-10-19 11:00:00+00'),
  ('post_6a93cd24-f260-4718-9477-c87c87bc7bce', 'Harrison Ford Comes to Wichita (The movie)', 'harrison-ford-comes-to-wichita-the-movie', 'https://wichitalife.beehiiv.com/p/harrison-ford-comes-to-wichita-the-movie', 'deep', null, false, '2026-10-16 11:00:00+00'),
  ('post_773efade-98e2-4fa9-a90b-cdfbe58a7e70', 'What''s happening in Wichita this weekend? (10/15 - 10/18)', 'what-s-happening-in-wichita-this-weekend-10-15-10-18', 'https://wichitalife.beehiiv.com/p/what-s-happening-in-wichita-this-weekend-10-15-10-18', 'weekend', null, false, '2026-10-15 11:00:00+00'),
  ('post_4e7b39b2-303d-4280-826f-504399c43308', 'Tallgrass Film Festival 2026', 'tallgrass-film-festival-2026', 'https://wichitalife.beehiiv.com/p/tallgrass-film-festival-2026', 'deep', null, false, '2026-10-14 11:00:00+00'),
  ('post_3c99dedb-4f8e-4295-8891-40e6fca4d7e6', 'Downtown Block', 'downtown-block', 'https://wichitalife.beehiiv.com/p/downtown-block', 'spotlight', null, false, '2026-10-12 11:00:00+00'),
  ('post_4d45708a-2dd4-4570-b20e-b4dfe98f9a3e', 'New Hat Alert', 'new-hat-alert', 'https://wichitalife.beehiiv.com/p/new-hat-alert', 'spotlight', null, false, '2026-10-09 10:57:17+00'),
  ('post_2da6a7b6-300c-4153-9e18-0a76ba1b8864', 'What''s happening in Wichita this weekend? (10/8 - 10/11)', 'what-s-happening-in-wichita-this-weekend-10-8-10-11', 'https://wichitalife.beehiiv.com/p/what-s-happening-in-wichita-this-weekend-10-8-10-11', 'weekend', null, false, '2026-10-08 11:00:00+00'),
  ('post_e0fd8875-9155-49df-82ca-706831e3e052', '1 Year into Downtown Paid Parking', '1-year-into-downtown-paid-parking', 'https://wichitalife.beehiiv.com/p/1-year-into-downtown-paid-parking', 'deep', null, false, '2026-10-05 11:00:00+00'),
  ('post_cbd38376-0f6f-480a-b2ed-9c6870c6949d', 'Greater Andover Days & the Holiday Galleria', 'greater-andover-days-the-holiday-galleria', 'https://wichitalife.beehiiv.com/p/greater-andover-days-the-holiday-galleria', 'deep', null, false, '2026-10-02 11:00:00+00')
on conflict (id) do nothing;

-- Times are Wichita local time (CDT, UTC-5, until Nov 1; CST, UTC-6, after).
insert into public.events (source, source_id, title, description, starts_at, all_day, venue, address, price_text, url, tags, is_sponsored) values
  ('wichitalife_events', '3860', 'Invitation to Community with Jon Rolph', 'A morning community gathering at Botanica.', '2026-10-20 07:30-05', false, 'Botanica', null, null, 'https://events.wichitalifeict.com/d/events-3860_us_ks_wichita_invitation_to_community_with_jon_rolph?c=events', '{}', false),
  ('wichitalife_events', '3861', 'Founders Table ICT by Startup Grind', 'Startup Grind''s morning table for Wichita founders.', '2026-10-20 07:30-05', false, 'Ninth Floor', null, null, 'https://events.wichitalifeict.com/d/events-3861_us_ks_wichita_founders_table_ict_by_startup_grind?c=events', '{}', false),
  ('wichitalife_events', '3676', 'Yoga in the Gallery', 'Yoga surrounded by the art at Mark Arts.', '2026-10-21 18:00-05', false, 'Mark Arts', null, null, 'https://events.wichitalifeict.com/d/events-3676_us_ks_wichita_yoga_in_the_gallery?c=events', '{}', false),
  ('wichitalife_events', '3738', 'Mezcal Tasting for National Mezcal Day', 'Celebrate National Mezcal Day with a tasting at Wichita State.', '2026-10-21 18:00-05', false, 'WSU', null, null, 'https://events.wichitalifeict.com/d/events-3738_us_ks_wichita_mezcal_tasting_for_national_mezcal_day?c=events', '{food}', false),
  ('wichitalife_events', '3624', 'Wicked Wednesday Movie Night: Manos the Hands of Fate', 'A cult-classic bad movie night at White Crow Cider.', '2026-10-21 19:00-05', false, 'White Crow Cider', null, null, 'https://events.wichitalifeict.com/d/events-3624_us_ks_wichita_wicked_wednesday_movie_night_manos_the_hands_of_fate_1966?c=events', '{spooky}', false),
  ('wichitalife_events', '3864', 'Trunk or Treat', 'Bring the kids in costume.', '2026-10-22 17:00-05', false, 'Broadway Medical', null, null, 'https://events.wichitalifeict.com/d/events-3864_us_ks_wichita_trunk_or_treat?c=events', '{spooky,family}', false),
  ('wichitalife_events', '3866', 'Pumpkins & Pints', 'Pumpkins and pints at Artichoke East.', '2026-10-22 18:30-05', false, 'Artichoke East', null, null, 'https://events.wichitalifeict.com/d/events-3866_us_ks_wichita_pumpkins__pints_at_the_choke?c=events', '{food,spooky}', false),
  ('wichitalife_events', '2543', 'Wichita Wurlitzer 100th Birthday Celebration', 'The Wichita Wurlitzer turns 100.', '2026-10-22 19:00-05', false, 'Century II', null, null, 'https://events.wichitalifeict.com/d/events-2543_us_ks_wichita_wichita_wurlitzer_100th_birthday_celebration_?c=events', '{music}', false),
  ('manual', 'rocky-horror-2026-10-23', 'The Rocky Horror Show, Live', 'A fully staged production in the historic B-29 Doc Hangar with an all-local cast, a live band, tiered seating, bites and a themed bar. Seven performances: Oct 22-24 and 29-31, with a midnight show on Halloween.', '2026-10-23 19:00-05', false, 'B-29 Doc Hangar', null, null, 'https://www.rockyhorrorwichita.com/', '{spooky}', true),
  ('manual', 'seizure-safe-bingo-2026', 'Seizure Safe School Bingo', 'Bingo, a 50/50 raffle and a kids'' costume contest, benefiting the Epilepsy Foundation of Missouri and Kansas.', '2026-10-24 10:00-05', false, 'Chicken N Pickle Wichita East', '1240 N. Greenwich Rd', '$10 cards, $5 blackout round', 'https://www.kayvenshelpinghands.org/events', '{family}', false),
  ('wichitalife_events', '3599', 'Halloween Nights', 'Halloween Nights, open on weekends at Exploration Place.', '2026-10-24 00:00-05', true, 'Exploration Place', null, null, 'https://events.wichitalifeict.com/d/events-3599_us_ks_wichita_halloween_nights?c=events', '{spooky,family}', false),
  ('manual', 'stardust-2026', 'Stardust: Concert Under the Dome', 'John Allen loops and improvises the score live while 4K visuals fly you past asteroids and the rings of Saturn. Nov 5-8.', '2026-11-05 19:00-06', false, 'Exploration Place Dome', null, null, 'https://exploration.org/view-all-upcoming-events/', '{music}', false),
  ('manual', 'casaino-2026', 'CASAino', 'Casino games, raffles, auctions, food and prizes supporting CASA of Sedgwick County.', '2026-11-07 18:00-06', false, 'WSU Beggs Ballroom', null, null, 'https://givebutter.com/c/casaino-2026', '{}', false)
on conflict (source, source_id) do nothing;

insert into public.news_items (source_name, title, url, published_at) values
  ('Kansas.com', 'Derby''s Decarsky Park reopens after an $18M expansion that more than doubles it', 'https://www.kansas.com/news/local/article317545647.html', '2026-10-18 14:00:00+00'),
  ('KWCH', 'Kansas Aviation Museum opens its Runway to Innovation STEAM space for kids', 'https://www.kwch.com/2026/10/16/kansas-aviation-museum-opens-runway-innovation-steam-space/', '2026-10-16 18:00:00+00'),
  ('Kansas.com', 'Banana Ball returns to Equity Bank Park in May 2027. Ticket lottery open through 10/31', 'https://www.kansas.com/sports/article317643234.html', '2026-10-18 16:00:00+00'),
  ('KSN', 'Sedgwick County Zoo welcomes Finn the Amur tiger', 'https://www.ksn.com/video/sedgwick-county-zoo-announces-arrival-of-new-tiger/12270658/', '2026-10-17 15:00:00+00'),
  ('Kansas.com', 'Botanica pops up at Bradley Fair with Glow & Grow, Thursday-Sunday through 12/31', 'https://www.kansas.com/news/business/biz-columns-blogs/carrie-rengers/article317559768.html', '2026-10-17 13:00:00+00')
on conflict (url) do nothing;

insert into public.jobs (title, company, url, pay_text) values
  ('Marketing Insights Strategist', 'INTRUST Bank', 'https://jobs.wichitalifeict.com/companies/intrust-bank/jobs/marketing-insights-strategist-55f81108411a4df69e4baf11b108c887', null),
  ('Digital Marketing Project Manager', 'Full Circle Marketing and Design', 'https://jobs.wichitalifeict.com/companies/full-circle-marketing-and-design/jobs/digital-marketing-project-manager-c94e7f45d3ee4d19afdd5b4af746daeb', null),
  ('Social Media Marketing Intern', 'Smalls Sliders', 'https://jobs.wichitalifeict.com/companies/ict-sliders/jobs/social-media-marketing-intern-289a5ea4568941d1a46e2e879bbed0aa', '$20/hr')
on conflict (url) do nothing;

insert into public.sponsors (name, headline, body, cta_label, cta_url, starts_at, ends_at) values
  ('Rocky Horror Wichita', 'The Rocky Horror Show, live at the B-29 Doc Hangar', 'Seven shows only: Oct 22-24 and 29-31, with a midnight show on Halloween.', 'Get tickets', 'https://www.rockyhorrorwichita.com/', '2026-10-19 00:00-05', '2026-11-01 00:00-05');

-- Examples: edit or delete before launch
insert into public.groups (slug, name, description) values
  ('new-to-wichita', 'New to Wichita', 'Just moved here? Start here.'),
  ('foodies', 'Foodies', 'New openings, hidden gems and group dinners.'),
  ('young-professionals', 'Young Professionals', 'Networking without the awkwardness.'),
  ('parents', 'Parents of ICT', 'Kid-friendly plans and parent meetups.'),
  ('dogs', 'Dog People', 'Dog parks, patios and pack walks.')
on conflict (slug) do nothing;

insert into public.meetups (title, description, starts_at, area, capacity, signup_url, source_key) values
  ('Wichita Life Dinner Club', 'Dinner with 5 others, matched by a quiz.', '2026-11-10 18:30-06', 'Restaurant revealed the morning of', 6, 'https://wichitalife.dnnr.io/', 'dnnr:2026-11-10T18:30');

insert into public.meetups (title, description, starts_at, area, capacity, group_id) values
  ('Coffee & Walk: Riverside loop', 'An easy loop along the river, coffee after.', '2026-10-24 09:00-05', 'Keeper of the Plains', 20, null),
  ('New to Wichita Happy Hour', 'Meet other newcomers and a few locals who know the good spots.', '2026-10-29 17:30-05', 'Old Town', 30, (select id from public.groups where slug = 'new-to-wichita'));

insert into public.giveaways (title, prize, description, starts_at, ends_at, rules_url) values
  ('Dinner for two, on us', '$100 restaurant gift card', 'Example giveaway. Replace with a real prize and rules before launch.', '2026-10-19 00:00-05', '2026-10-25 20:00-05', 'https://wichitalifeict.com/giveaway-rules');
