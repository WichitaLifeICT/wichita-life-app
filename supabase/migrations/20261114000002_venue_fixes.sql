-- Places checked on Nov 13 (owner: "do your own check of locations based on venue address").
-- 1. Venues the calendar gets wrong, or names in titles when a listing has no place. Adding them
--    fixes their upcoming events now (venues_refix_events) and every time the calendar syncs.
-- 2. One-off events listed at just "Wichita, Kansas" or with no venue name: their real place,
--    found on the venue's or organizer's own site, saved like a staff fix (kept through syncs).
-- Official sources only (venue/organizer sites and pages, city/county/university sites).
insert into public.venues (name, address, aliases, title_pattern, source, verified_on) values
  ('Mortdecai’s Tavern & Eatery', '330 S Greenwich Rd, Wichita, KS 67207', '{}', 'mortdecai', 'mortdecaistavern.com; facebook.com/mortdecais', '2026-11-13'),
  ('Shamrock Lounge', '1724 W Douglas Ave, Wichita, KS 67203', '{}', '\mshamrock\M', 'Shamrock Lounge trivia ticket pages (Eventbrite)', '2026-11-13'),
  ('Roxy’s Downtown', '412 1/2 E Douglas Ave, Wichita, KS 67202', '{"Roxy''s Downtown"}', 'roxy.?s downtown', 'roxysdowntown.com', '2026-11-13'),
  ('The Dive - Beach Bar', '1207 E Douglas Ave, Wichita, KS 67211', '{"The Dive Beach Bar"}', 'the dive beach bar', 'organizer listing; facebook.com/thediveict', '2026-11-13'),
  ('Sedgwick County Park', '6501 W 21st St N, Wichita, KS 67212', '{}', null, 'sedgwickcounty.org', '2026-11-13'),
  ('Orpheum Theatre', '200 N Broadway St, Wichita, KS 67202',
    '{"\"National Lampoon''s Christmas Vacation\" Presented by Orpheum Theatre & Summit Media"}', null, 'wichitaorpheum.com', '2026-11-13'),
  ('Century II Performing Arts & Convention Center', '225 W Douglas Ave, Wichita, KS 67202',
    '{"There’s No Place Like Home Bully Bash"}', null, 'century2.com', '2026-11-13'),
  ('Century II Expo Hall', '225 W Douglas Ave, Wichita, KS 67202', '{}', 'century ii expo', 'century2.com', '2026-11-13'),
  ('WSU Eugene M. Hughes Metropolitan Complex', '5015 E 29th St N, Wichita, KS 67220',
    '{"Wichita''s WSU Eugene M. Hughes Metropolitan Complex"}', null, 'wichita.edu', '2026-11-13'),
  ('The Brickyard', '129 N Rock Island Ave, Wichita, KS 67202', '{}', null, 'brickyardoldtown.com', '2026-11-13'),
  ('Exploration Place', '300 N McLean Blvd, Wichita, KS 67203', '{}', 'exploration place', 'exploration.org', '2026-11-13'),
  ('Towne East Square', '7700 E Kellogg Dr, Wichita, KS 67207', '{}', 'towne east square', 'simon.com', '2026-11-13'),
  ('Botanica, The Wichita Gardens', '701 N Amidon St, Wichita, KS 67203', '{}', 'illuminations at botanica', 'botanica.org', '2026-11-13'),
  ('Revolutsia', '2721 E Central Ave, Wichita, KS 67214', '{}', 'revolutsia', 'Revolutsia event listings', '2026-11-13');

-- One-off events (by id; nothing happens if the calendar has since dropped one).
update public.events e set venue = f.venue, address = f.address,
  locked_fields = array(select distinct unnest(e.locked_fields || '{venue,address}'::text[]))
from (values
  ('99bcb6d9-bb17-4d76-a96e-b3a16071a96e'::uuid, 'Shamrock Lounge', '1724 W Douglas Ave, Wichita, KS 67203'),  -- WBS Monthly Blues Jam at the Shamrock
  ('22902d12-f458-4f39-9836-5d6b4fcd7b4d'::uuid, 'Exploration Place', '300 N McLean Blvd, Wichita, KS 67203'),  -- Passport to Santa | Special Event | Exploration Place | Wich
  ('ea1d6d43-283c-4d39-a1e6-e45b1ee96c56'::uuid, 'Calico Creek Tattoo Co.', '946 S Rock Rd, Suite 100, Wichita, KS 67207'),  -- Friday the 13th One Year Anniversary Event!
  ('51e00d5d-2687-47ee-b865-75e2373af33d'::uuid, 'Baila Wichita', '125 S Hydraulic Ave, Wichita, KS 67211'),  -- SIP Savor & Dance with Juliana & Cosecha
  ('8ccd3846-3976-4f48-9270-ba56c107358f'::uuid, 'The Dive - Beach Bar', '1207 E Douglas Ave, Wichita, KS 67211'),  -- The Dive Beach Bar 🏝️ 4 Year Anniversary Celebration
  ('e11494a8-a109-4446-bce5-13e996c6a372'::uuid, 'Jerry''s Bar & Grill', '630 N Robin Rd, Wichita, KS 67212'),  -- Annie Up at Jerry’s Bar & Grill
  ('f9f09b67-0a9c-408c-b51f-04827826b8b8'::uuid, 'Loony Bin Comedy Club', '8406 W Central Ave, Wichita, KS 67212'),  -- John Caparulo in Wichita, KS!
  ('def8413c-f7b8-49e3-ad44-60b4a9265fff'::uuid, 'Hope Mennonite Church', '868 N Maize Rd, Wichita, KS 67212'),  -- Craft Bazaar and Peppernut Sale
  ('634867a1-256a-40f8-b86d-667b3b94dc58'::uuid, 'Wizard''s Alley', '114 N St Francis Ave, Suite 200, Wichita, KS 67202'),  -- Bam's Birthday Bash GT
  ('ecd331d3-9271-4040-972b-c2eeaf4dbdb8'::uuid, 'Hilton Garden Inn Wichita Airport', '1523 S Ridge Rd, Wichita, KS 67209'),  -- Kansas Card Show | Wichita TCG Card Show
  ('7c68f59b-dbaf-4914-be40-044e2c89651c'::uuid, 'Sedgwick County Zoo', '5555 W Zoo Blvd, Wichita, KS 67212'),  -- Zoo Art Fair
  ('0f3bb873-c12e-42fe-b49d-731a09736953'::uuid, 'Evergreen Recreation Center', '2700 N Woodland, Wichita, KS 67204'),  -- Wild, Wild West
  ('f7565e3c-decf-4696-b21a-71a2f4ff921d'::uuid, 'Lost World Dinosaur Experience (pop-up)', '339 N West St, Wichita, KS 67203'),  -- WICHITA:  LOST WORLD: The Dinosaur Experience - SATURDAY, 11
  ('edfe8781-ac24-4bf1-b6f9-63f24d776945'::uuid, 'St. Stephen''s Episcopal Church', '7404 E Killarney Pl, Wichita, KS 67206'),  -- Wichita Caledonian Pipes & Drums 20th Anniversary Concert
  ('a7129854-2194-4150-b827-8d0cb1b2d929'::uuid, 'Hopping Gnome Brewing Co. Taproom', '1719 E Victor St, Wichita, KS 67214'),  -- Sputnik @ Hopping Gnome
  ('240fe017-9a32-4bbc-ab0f-8f9a9f7c908b'::uuid, 'Eastminster Presbyterian Church', '1958 N Webb Rd, Wichita, KS 67206'),  -- Friends University Singing Quakers Alumni Choir Concert
  ('2a0f00bb-52e6-43a1-810c-de3804610e66'::uuid, 'Wichita Jewish Community Center', '1850 N Woodlawn, Wichita, KS 67208'),  -- Deli Day
  ('5398e465-c8fc-4a3f-b49d-f463a1340c1a'::uuid, 'Evidence Church', '11135 W Kellogg Dr, Wichita, KS 67209'),  -- Fall Fest
  ('ea48f9a0-df01-4f43-9b04-980a7e700974'::uuid, 'Limitless Barbershop', '8635 W Central Ave, Wichita, KS 67212'),  -- Barber master class
  ('2bda45b7-d519-49b4-9d8d-97949553a0a2'::uuid, 'Connect With Source', '611 S St Francis Ave, Wichita, KS 67202'),  -- Restoration Yoga w/ Kari Williams
  ('6b246347-839e-49e5-8a30-0440b0546ce3'::uuid, 'Wichita City Hall', '455 N Main St, Wichita, KS 67202'),  -- Board of Bids & Contracts
  ('21b6d502-f8c3-4371-9182-fbbd49c21661'::uuid, 'Auburn Wine & Spirits', '320 N Rock Rd, Wichita, KS 67206'),  -- Sip, Savor & Give Thanks: A Thanksgiving Wine Tasting Experi
  ('d23a509f-d5e9-4696-aa64-a6bcf7f03a65'::uuid, 'VIVRE Espresso + Bubbles', '3221 N Ridge Rd, Suite 101, Wichita, KS 67205'),  -- Friendsgiving - Coffee, Gratitude, & Connection
  ('bfc432c6-f043-494f-b7d6-3cf1f396c64b'::uuid, 'Exploration Place', '300 N McLean Blvd, Wichita, KS 67203'),  -- Sister Act | Craft Cinema | Exploration Place
  ('b8a13939-6bd7-4f71-90ad-349370527f2d'::uuid, 'GROW Plant Bar', '320 S Market St, Suite 120, Wichita, KS 67202'),  -- Apres Ski Opening Weekend
  ('4da9effd-fc8b-4525-99ee-1c8741cf84e4'::uuid, 'Ford Rockwell Branch Library', '5939 E 9th St N, Wichita, KS 67208'),  -- Ruby Bridges Walk to School Day: Steps Toward Belonging Stor
  ('1cba739d-fcce-4308-a1ce-5b37ad1fb9ab'::uuid, 'Smalls Sliders', '1370 N Greenwich Rd, Wichita, KS 67206'),  -- Slide Thru: Thursday Night Patio Games & Family Night at Sma
  ('17be44d9-58bd-4d30-881c-0e678d646e11'::uuid, 'Hopping Gnome Brewing Co.', '1710 E Douglas Ave, Wichita, KS 67214'),  -- Gnome for the Holidays Pop-Up Bar
  ('63210920-5045-45f0-929a-8b41621a0d58'::uuid, 'Auburn Spirits', '13303 W Maple St, Suite 111, Wichita, KS 67235'),  -- FREE Educational Wine Tasting Experience with Richard from B
  ('384ada87-737a-42b1-9ef1-8c8a2ddc8a69'::uuid, 'Orpheum Theatre', '200 N Broadway St, Wichita, KS 67202'),  -- Moulin Rouge! | 25th Anniversary
  ('f90e5197-bea1-4ae0-b789-8c42fd61a395'::uuid, 'Unity of Wichita', '10616 W Maple St, Suite 100, Wichita, KS 67209'),  -- Holiday Highland Cow Unity of Wichita Paint and Sip
  ('7a010719-aa93-40d0-8785-20dee4a0e83b'::uuid, 'Valley Rec Center', '1050 N Meridian Ave, Valley Center, KS 67147'),  -- Valley Rec Holiday Market 2026
  ('38b5f3b0-0d3a-4697-8155-22dc5879679e'::uuid, 'Evergreen Community Center & Library', '2601 N Arkansas Ave, Wichita, KS 67204'),  -- District 6 Coffee
  ('74dfc235-83ec-45ec-a91a-c530feed1dae'::uuid, 'Century II Expo Hall', '225 W Douglas Ave, Wichita, KS 67202'),  -- Wichita Flea Market - Nov. 21 & 22 - Century II Expo Hall
  ('f979050c-3abc-4e86-9c4c-6af417057a0f'::uuid, 'Kansas Humane Society', '3313 N Hillside St, Wichita, KS 67219'),  -- Holiday Pet Photos
  ('52297996-f09e-4998-8981-564cae3873f6'::uuid, 'Wichita-Sedgwick County Historical Museum', '204 S Main St, Wichita, KS 67202'),  -- 43rd Annual Wreath Festival
  ('b0295f58-e9e5-48dc-8aa4-d1bdaa3f8a2a'::uuid, 'Newman University', '3100 W McCormick St, Wichita, KS 67213'),  -- Jet Preview Day (Health & Medical Professions Track)
  ('e8652cef-4525-40a1-b69c-160cd948eb0f'::uuid, 'Bradley Fair Shopping Center', '2132 N Rock Rd, Suite 102, Wichita, KS 67206'),  -- Holiday Tree Lighting
  ('6d5671f1-0206-4cd8-8f08-c9a3505b2e99'::uuid, 'Botanica (south parking lot)', '1975 N Sim Park Dr, Wichita, KS 67203'),  -- Turkey Trails- Wichita
  ('cb23cef6-71f8-4d8c-aa4e-38d38e1cf543'::uuid, 'Revolutsia', '2721 E Central Ave, Wichita, KS 67214'),  -- Budget Bazaar at Revolutsia 2026
  ('e43b93e8-dbe8-4c0d-8e4c-2a1708d78d9c'::uuid, 'Towne East Square', '7700 E Kellogg Dr, Wichita, KS 67207'),  -- 🎄✨ Holiday Sip & Shop at Towne East Square ✨🎄
  ('f85e005a-52b9-4871-b8cb-cf54392e542a'::uuid, 'Botanica, The Wichita Gardens', '701 N Amidon St, Wichita, KS 67203'),  -- ✨ Illuminations at Botanica ✨
  ('89194f7f-7ada-42c8-806b-a8b31ff91bcc'::uuid, 'Wichita City Hall', '455 N Main St, Wichita, KS 67202'),  -- City Council Workshop
  ('d6202cd7-a7ed-4d29-98b2-85d9caf879e0'::uuid, 'GROW Plant Bar', '320 S Market St, Suite 120, Wichita, KS 67202'),  -- Family Ski Day
  ('c0ca57f7-cc8c-4b45-8a89-a465f23d55ba'::uuid, 'Second Church of Christ, Scientist', '4501 E Douglas Ave, Wichita, KS 67218'),  -- Thanksgiving Church Service
  ('cfd8a517-3226-49a1-b8d1-1b2e3449bd7d'::uuid, 'GROW Plant Bar', '320 S Market St, Suite 120, Wichita, KS 67202'),  -- 80s Ski Party
  ('7f5fcd40-4a5e-43ba-9756-f386e57e907d'::uuid, 'Delano District', null),  -- Holidays In Delano
  ('6c04cbb2-9756-4cd6-ad57-4dc5f89f1f92'::uuid, 'Revolutsia', '2721 E Central Ave, Suite 117, Wichita, KS 67214'),  -- Grand Opening of Wild Sunflower Silver Handmade Jewelry
  ('13c9e642-f0c2-4c16-a1de-17f91e88bb9d'::uuid, 'O.J. Watson Park', '3022 S McLean Blvd, Wichita, KS 67217'),  -- Watson's Christmas Event
  ('f808693b-1772-46a1-a809-38d0a1dac837'::uuid, 'Downtown Goddard', '118 N Main St, Goddard, KS 67052'),  -- Christmas on Main Street
  ('6f5c2759-4feb-4b26-8620-c8e7ecbdec2d'::uuid, 'DeMattias Fine Arts Center, Newman University', '3100 W McCormick St, Wichita, KS 67213'),  -- Blue Violin's Retro Rock & Roll Christmas
  ('e296d22c-2cde-4375-99b2-bced7d746701'::uuid, 'Eastminster Presbyterian Church', '1958 N Webb Rd, Wichita, KS 67206'),  -- Songs of the Season – An evening with Constanze Hochwartner 
  ('232b08b3-71ae-4f74-8604-ccc4a435e4b7'::uuid, 'Orpheum Theatre', '200 N Broadway St, Wichita, KS 67202'),  -- National Lampoon’s Christmas Vacation
  ('dff04334-bf39-49a0-85c1-5dc83c702132'::uuid, 'Botanica (south parking lot)', '1975 N Sim Park Dr, Wichita, KS 67203')  -- Cold Front - Wichita
) as f (id, venue, address)
where e.id = f.id and not ('venue' = any(e.locked_fields) or 'address' = any(e.locked_fields));
