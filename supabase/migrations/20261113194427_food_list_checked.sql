-- Food list check, Nov 13 (owner: make sure Wichita's well-known local restaurants are on "Where
-- should I eat?" and that they're all open). Each was checked on its own site, Facebook page or
-- Google/Yelp listing. Corrected OpenStreetMap entries become staff entries (the monthly map
-- refresh overwrites names and addresses on map entries, never on staff ones) and the old entry is
-- hidden. Closed or unconfirmed places weren't added.

insert into public.places (name, kind, categories, address, website, phone, status, source) values
  ('Newport Grill', 'restaurant', '{steak_seafood,american}', '1900 N Rock Rd, Wichita, KS 67206', 'https://newportgrill.com/', '(316) 636-9555', 'active', 'staff'),
  ('Kababji Grill', 'restaurant', '{mediterranean}', '6257 E 21st St N, Wichita, KS 67208', 'https://www.kababjigrillks.com/', '(316) 796-5584', 'active', 'staff'),
  ('Albero Bistro', 'restaurant', '{italian}', '2684 N Greenwich Rd, Suite 600, Wichita, KS 67226', 'https://alberobistro.com/', '(316) 364-3628', 'active', 'staff'),
  ('Buster''s Burger Joint', 'restaurant', '{burgers,american}', '1202 E MacArthur Rd, Wichita, KS 67216', 'https://www.facebook.com/p/Busters-Burger-Joint-100057286885833/', '(316) 524-7800', 'active', 'staff'),
  ('Ben''s Big Bowl', 'restaurant', '{asian}', '3811 W 13th St N, Wichita, KS 67203', 'https://bensbigbowl.com/', '(316) 518-4139', 'active', 'staff'),
  ('Vora Restaurant European', 'restaurant', '{italian,pizza,steak_seafood}', '3252 E Douglas Ave, Suite 106, Wichita, KS 67208', 'https://www.vorawichita.com/', '(316) 977-9277', 'active', 'staff'),
  ('Todd''s Creole Kitchen', 'restaurant', '{steak_seafood,american}', '8641 W 13th St N, Suite 111, Wichita, KS 67212', 'https://toddscreolekitchen.com/', '(316) 295-4260', 'active', 'staff'),
  ('Barrel Boys BBQ', 'restaurant', '{bbq}', '2202 W 13th St N, Wichita, KS 67203', 'https://www.barrelboysbbq.com/', '(316) 494-5364', 'active', 'staff'),
  ('Kelly''s Family Diner', 'restaurant', '{american,breakfast}', '1825 S Broadway, Wichita, KS 67211', 'https://kellysfamilydiner.com/', '(316) 978-9255', 'active', 'staff'),
  ('Krispy''s Fried Chicken & Seafood', 'fast_food', '{chicken,steak_seafood}', '3009 S Hillside St, Wichita, KS 67216', 'https://krispyswichita.com/', '(316) 765-7574', 'active', 'staff'),
  ('Sazon Mexican Restaurant', 'restaurant', '{mexican,breakfast}', '2624 E 21st St N, Wichita, KS 67214', 'https://www.facebook.com/sazon.316/', '(316) 794-0926', 'active', 'staff'),
  ('Public at the Brickyard', 'pub', '{burgers,pizza,american}', '129 N Rock Island Ave, Wichita, KS 67202', 'https://publicbrickyard.com/', '(316) 263-4044', 'active', 'staff'),
  ('Japan Express Restaurant', 'fast_food', '{asian}', '2250 N Rock Rd Ct, Suite 126, Wichita, KS 67226', 'http://japanexpress.us/', '(316) 682-3183', 'active', 'staff'),
  ('Ah-So Oriental Restaurant', 'restaurant', '{asian}', '855 S Oliver Ave, Wichita, KS 67218', null, '(316) 685-2091', 'active', 'staff'),
  ('El Rancho Restaurant', 'restaurant', '{mexican,breakfast}', '2801 N Broadway St, Wichita, KS 67219', 'https://www.facebook.com/p/El-Rancho-Restaurant-100054366888456/', '(316) 838-8252', 'active', 'staff'),
  ('Kim''s Noodles Bar & Grill', 'restaurant', '{asian}', '10919 E Harry St, Suite 101, Wichita, KS 67207', 'https://kimsnoodleswichita.com/', '(316) 990-2872', 'active', 'staff'),
  ('Siena Steakhouse', 'restaurant', '{italian,steak_seafood,breakfast}', '104 S Broadway, Wichita, KS 67202', 'https://www.marriott.com/en-us/hotels/ictak-ambassador-hotel-wichita-autograph-collection/dining/', '(316) 440-5300', 'active', 'staff'),
  ('Jimenez Tacos', 'restaurant', '{mexican}', '2787 S Roosevelt St, Suite B, Wichita, KS 67210', 'https://www.facebook.com/JimenezTacos71/', '(316) 665-9795', 'active', 'staff'),
  ('Lottē', 'restaurant', '{american}', '320 S Market St, Suite 101, Wichita, KS 67202', 'https://lotteict.com/', '(316) 358-9183', 'active', 'staff'),
  ('Restaurante Usuluteco', 'restaurant', '{mexican}', '2265 S Seneca St, Wichita, KS 67213', 'https://www.facebook.com/restauranteusuluteco/', '(316) 409-3820', 'active', 'staff'),
  ('First Mile Kitchen', 'restaurant', '{american,steak_seafood}', '2141 N Bradley Fair Pkwy, Suite 111, Wichita, KS 67206', 'https://www.firstmilekitchen.com/', '(316) 358-0130', 'active', 'staff'),
  ('Puerto Vallarta Mexican Restaurant', 'restaurant', '{mexican}', '756 N Tyler Rd, Wichita, KS 67212', 'https://www.facebook.com/PVWichita/', '(316) 295-3949', 'active', 'staff'),
  ('Thai House', 'restaurant', '{asian}', '969 N West St, Wichita, KS 67203', 'https://www.thaihousewichita.com/', '(316) 941-4777', 'active', 'staff'),
  ('The Kitchen', 'restaurant', '{american}', '3622 N Oliver St, Wichita, KS 67220', 'https://thekitchenwichita.com/', '(316) 364-3557', 'active', 'staff'),
  ('Jumbo''s Beef & Brew', 'pub', '{burgers,sandwiches,american}', '3750 N Woodlawn Blvd, Suite 102, Wichita, KS 67220', 'https://jumbosbeef.com/', '(316) 358-0407', 'active', 'staff'),
  ('Taqueria El Fogon', 'restaurant', '{mexican}', '1555 S Bluffview Dr, Wichita, KS 67218', 'https://www.facebook.com/elfogonwichita/', '(316) 681-0969', 'active', 'staff'),
  ('Whiskey Dicks', 'pub', '{burgers,american}', '801 S Seneca St, Wichita, KS 67213', 'https://www.whiskeydicksict.com/', '(316) 201-6209', 'active', 'staff'),
  ('Fish And More', 'restaurant', '{steak_seafood}', '2021 S Oliver Ave, Wichita, KS 67218', 'https://fishandmorewichita.com/', '(316) 201-4949', 'active', 'staff'),
  ('Tor Brewing', 'pub', '{burgers}', '222 S Commerce St, Wichita, KS 67202', 'https://torbrewing.com/', '(316) 201-6561', 'active', 'staff'),
  ('Nortons Brewing Company', 'pub', '{burgers,sandwiches,american}', '125 N St Francis St, Wichita, KS 67202', 'https://nortonsbrewing.com/', '(316) 425-9009', 'active', 'staff'),
  ('The Envision Bistro at NICHE', 'restaurant', '{american}', '124 S Broadway, Wichita, KS 67202', 'https://nicheks.com/bistro/', null, 'active', 'staff'),
  ('Tokyo Japanese Cuisine', 'restaurant', '{asian}', '446 N West St, Wichita, KS 67203', 'https://tokyoks.com/', '(316) 636-7777', 'active', 'staff'),
  ('Carnitas Morelia', 'restaurant', '{mexican}', '3088 W 13th St N, Wichita, KS 67203', 'https://www.facebook.com/people/Carnitas-Morelia/61558159936050/', '(316) 358-9753', 'active', 'staff'),
  ('The Nelson''s Kitchen', 'restaurant', '{chicken,steak_seafood,burgers,sandwiches}', '1712 E Morris St, Wichita, KS 67211', 'https://order.online/store/nelson-s-kitchen-e-morris-st-30959314', '(316) 397-0009', 'active', 'staff'),
  ('Argentina''s Empanadas', 'restaurant', '{mexican}', '3700 E Douglas Ave, Suite 2, Wichita, KS 67208', 'https://www.argentinasempanadas.com/', '(316) 559-5650', 'active', 'staff'),
  ('Kababs', 'restaurant', '{indian}', '3101 N Rock Rd, Suite 110, Wichita, KS 67226', 'https://www.ordermykababs.com/', '(316) 260-9999', 'active', 'staff'),
  ('KVH Chophouse', 'restaurant', '{steak_seafood}', '2926 N Tyler Rd, Wichita, KS 67205', 'https://kvhchophouse.com/', '(316) 330-7036', 'active', 'staff'),
  ('KPOT Korean BBQ & Hot Pot', 'restaurant', '{asian}', '7700 E Kellogg Dr, Suite N03, Wichita, KS 67207', 'https://www.thekpot.com/', '(316) 558-3838', 'active', 'staff'),
  ('Georgio''s BBQ', 'restaurant', '{bbq}', '2251 E 21st St N, Suite 123, Wichita, KS 67214', 'https://www.facebook.com/stevenmoore281/', '(316) 282-4989', 'active', 'staff'),
  ('Napoli Italian Eatery', 'restaurant', '{italian,pizza}', '7718 E 37th St N, Suite 500, Wichita, KS 67226', 'https://www.napoliwichita.com/', '(316) 260-5859', 'active', 'staff'),
  ('Pho Ong 8', 'restaurant', '{asian}', '3801 E Harry St, Suite 101, Wichita, KS 67218', 'https://www.facebook.com/Ph%E1%BB%9F-%C3%94ng-8-104392727645189/', '(316) 613-2373', 'active', 'staff'),
  ('Bill''s Charcoal Grill', 'restaurant', '{burgers,american}', '2957 N Arkansas Ave, Wichita, KS 67204', 'https://billscharcoalgrill.com/', '(316) 832-0288', 'active', 'staff'),
  ('New Paradise Biryani Pointe', 'restaurant', '{indian}', '1648 S Rock Rd, Wichita, KS 67207', 'https://www.newparadisebiryanipointe.com/', '(316) 927-3580', 'active', 'staff'),
  ('Scotch & Sirloin', 'restaurant', '{steak_seafood}', '5325 E Kellogg Dr, Wichita, KS 67218', 'https://www.scotchandsirloin.net/', '(316) 685-8701', 'active', 'staff'),
  ('GangNam Korean BBQ and Sushi Bar', 'restaurant', '{asian}', '210 N Washington St, Wichita, KS 67202', 'https://www.facebook.com/WichitaGangNam/', '(316) 201-6400', 'active', 'staff'),
  ('Mi Lindo Michoacán', 'restaurant', '{mexican}', '2120 N Broadway, Wichita, KS 67214', 'https://www.facebook.com/100054633872382', '(316) 214-2734', 'active', 'staff'),
  ('N & J Cafe & Bakery', 'restaurant', '{mediterranean}', '5600 E Lincoln St, Wichita, KS 67218', 'https://njwichita.com/', '(316) 681-3975', 'active', 'staff'),
  ('Social Tap Drinkery', 'pub', '{burgers,pizza}', '4510 E 19th St N, Suite 101, Wichita, KS 67208', 'https://socialtapdrinkery.com/', '(316) 260-8591', 'active', 'staff'),
  ('Rice & Roll by Bao Xing', 'restaurant', '{asian}', '6100 E 21st St N, Suite 190, Wichita, KS 67208', 'https://riceandrollwichita.com/', '(316) 789-5060', 'active', 'staff'),
  -- Other locations of places with more than one in town (each location is its own entry).
  ('Ziggy''s Pizza', 'restaurant', '{pizza}', '13605 W Maple St, Suite 111, Wichita, KS 67235', 'https://www.ziggyswichita.com/', '(316) 364-4827', 'active', 'staff'),
  ('Bella Luna Cafe', 'restaurant', '{mediterranean}', '1441 N Webb Rd, Wichita, KS 67206', 'https://bellalunacafe.com', '(316) 634-0008', 'active', 'staff'),
  ('HomeGrown', 'restaurant', '{breakfast}', '2835 N Maize Rd, Suite 195, Wichita, KS 67205', 'https://homegrownkitchen.com/store-locations/homegrown-wichita-west/', '(316) 347-7073', 'active', 'staff'),
  ('Doc Green''s Salads & Grill', 'restaurant', '{sandwiches,american}', '10096 E 13th St N, Suite 102, Wichita, KS 67206', 'https://www.eatdocgreens.com/locations', '(316) 636-8997', 'active', 'staff'),
  ('Doc Green''s Salads & Grill', 'restaurant', '{sandwiches,american}', '2441 N Maize Rd, Suite 1607, Wichita, KS 67205', 'https://www.eatdocgreens.com/locations', '(316) 558-8077', 'active', 'staff'),
  ('Ninza Sushi Bar', 'restaurant', '{asian}', '8641 W 13th St N, Suite 103, Wichita, KS 67212', null, '(316) 558-5111', 'active', 'staff'),
  ('Tacos TJ 664', 'fast_food', '{mexican}', '1014 N West St, Wichita, KS 67203', 'https://tacostj664.com', '(316) 461-0610', 'active', 'staff'),
  ('The Artichoke Sandwichbar East', 'restaurant', '{sandwiches}', '2959 N Rock Rd, Wichita, KS 67226', 'https://artichokesandwichbar.com/', '(316) 221-9088', 'active', 'staff'),
  ('Wichita Brewing Company', 'pub', '{pizza,burgers}', '901 W Douglas Ave, Wichita, KS 67213', 'https://www.wichitabrew.com/locations/', '(316) 295-4734', 'active', 'staff'),
  ('Taqueria El Fogon', 'restaurant', '{mexican}', '2604 N Arkansas Ave, Wichita, KS 67204', 'https://ordertaqueriaelfogon2north.com/', '(316) 208-9217', 'active', 'staff'),
  ('KPOT Korean BBQ & Hot Pot', 'restaurant', '{asian}', '2243 N Tyler Rd, Suite 121, Wichita, KS 67205', 'https://www.thekpot.com/', '(316) 558-3088', 'active', 'staff'),
  ('N&J Mediterranean Bar & Grill', 'restaurant', '{mediterranean}', '8448 W Central Ave, Wichita, KS 67212', 'https://njwichita.com/', '(316) 364-4784', 'active', 'staff'),
  ('Social Tap Drinkery', 'pub', '{burgers,pizza}', '2244 N Greenwich Rd, Suite 100, Wichita, KS 67226', 'https://socialtapdrinkery.com/', '(316) 364-3303', 'active', 'staff'),
  ('Social Tap Drinkery', 'pub', '{burgers,pizza}', '420 S Heritage Way, Suite 200, Andover, KS 67002', 'https://socialtapdrinkery.com/', '(316) 239-6600', 'active', 'staff');

-- Angelo's last day at 5900 E Central is Nov 15; it's moving to 550 N Rock Rd (no reopening date
-- yet). Show it again, with the new address, once it reopens.
update public.places set status = 'hidden' where id = '60848ea7-8f2b-4066-ba5f-5f6b8a4bcdeb';

-- KPOT is a national chain; it's here because it's one of the city's best-known spots.
update public.places set chain = true where source = 'staff' and name = 'KPOT Korean BBQ & Hot Pot';

-- Corrected map entries: each becomes a staff entry with the checked name, address, website and
-- phone (blank = keep what the map had), and the old map entry is hidden.
with fixes (id, name, categories, address, website, phone) as (values
  ('68393f8b-4a0e-4dca-85bb-d146e4622aa5'::uuid, null, null::text[], '1103 N Broadway, Wichita, KS 67214', 'https://www.wichitasaigon.com', '(316) 262-8134'), -- Saigon
  ('fc337398-0469-4100-8375-baae93456295', null, null, '2441 N Maize Rd, Suite 2511, Wichita, KS 67205', 'https://bellalunacafe.com', '(316) 613-3320'), -- Bella Luna Cafe
  ('6c052ade-b682-429a-b736-ed52619e9f49', null, null, '1100 E 3rd St N, Wichita, KS 67214', 'https://www.instagram.com/station8bbq/', '(316) 841-8549'), -- Station 8 BBQ
  ('6690ee06-17b1-406e-9088-c5285af0699c', null, null, '3141 S Hillside St, Wichita, KS 67216', 'https://www.chiangmaithaiwichita.com', '(316) 652-8910'), -- Chiang Mai Thai
  ('40f824fc-634c-4868-a55a-f921a73958fd', null, null, '134 N Hillside St, Wichita, KS 67214', 'https://www.facebook.com/profile.php?id=157956950893569', '(316) 683-6503'), -- Sport Burger
  ('0c1764db-ed45-4c38-8b53-75a4b10e2fe0', 'Ninza Sushi East', null, '306 N Rock Rd, Suite 20, Wichita, KS 67206', 'https://www.ninzasushieast.com', '(316) 260-5002'), -- Ninza Sushi Bar
  ('ae341aeb-67ed-427f-b11d-515afba81b76', 'Tacos TJ 664', '{mexican}', '3526 N Rock Rd, Suite 100, Wichita, KS 67226', 'https://tacostj664.com', '(316) 665-3320'), -- Tacos TJ 664
  ('64859f5b-d6d0-426a-8cf9-eaf41ea788d8', null, null, '206 E Kellogg St, Wichita, KS 67202', 'https://doodahdiner.com', '(316) 265-7011'), -- Doo-Dah Diner
  ('dacb7ecb-efea-4fd2-a4cf-fba85bac2096', null, null, '134 N St. Francis, Wichita, KS 67202', 'https://www.prostwichita.com', '(316) 260-3220'), -- Prost
  ('e5f314d7-e47e-4b9f-ad20-ac1370f9e323', null, null, '1900 N Rock Rd, Suite 108, Wichita, KS 67206', 'https://homegrownkitchen.com/store-locations/homegrown-wichita-at-bradley-fair/', '(316) 247-9611'), -- Homegrown
  ('656212bb-1dc0-4815-90b4-1330e6193936', null, null, '579 W Douglas Ave, Wichita, KS 67213', 'https://monarchwichita.com', '(316) 201-6626'), -- The Monarch
  ('aebc8b52-8164-4170-bf69-c585effa56e5', 'Twelve Restaurant & Bar', null, '12111 W Maple St, Suite 121, Wichita, KS 67235', 'https://twelvewichita.com', '(316) 440-2812'), -- Twelve Restaurant & Bar
  ('38eef8a9-5685-4892-a986-14290df74ca7', null, null, '604 E Douglas Ave, Wichita, KS 67202', 'https://www.instagram.com/oldmilltasty/', '(316) 264-6500'), -- Old Mill Tasty Shop
  ('539fabee-5acd-4fcb-b5fb-6b2d69d1cc0e', 'Doc Green''s Salads & Grill', '{sandwiches,american}', '410 N Hillside St, Suite 1000, Wichita, KS 67214', 'https://www.eatdocgreens.com', '(316) 252-8124'), -- Doc Green's
  ('fca22d18-530a-4c44-8a21-fbe161489d2e', null, null, '1212 S Tyler Rd, Suite 100, Wichita, KS 67209', 'https://www.facebook.com/p/Tutas-Teriyaki-Restaurant-100075480505868/', '(316) 729-9003'), -- Tuta's Teriyaki
  ('d16198cc-c219-4fec-94c1-3c0e057bce80', null, null, '8065 E Peachtree Ln, Wichita, KS 67207', 'https://www.sapporoks.com', '(316) 977-8808'), -- Sapporo
  ('a37ec1ed-c9ef-44a7-8b4e-f2bdb733ac35', null, null, '1015 N Broadway, Wichita, KS 67214', null, '(316) 265-0054'), -- Little Saigon
  ('a2428f7b-980c-4085-be07-fdffc8059b47', null, null, '928 W 2nd St N, Wichita, KS 67203', 'https://www.facebook.com/TysDiner/', '(316) 263-1416'), -- Ty's Diner
  ('cce56aca-041b-4b32-81a6-f7c35045d633', null, null, '6428 E Central Ave, Wichita, KS 67206', 'https://www.wichitagyoza.com', '(316) 999-8929'), -- Gyoza Bar
  ('bbdc1573-1abe-4e4d-a144-a9e2262db517', null, null, '7011 W Central Ave, Suite 116, Wichita, KS 67212', null, '(316) 295-2150'), -- When Pigs Fly Bar-B-Que
  ('4f899b8b-fee1-4057-ab1f-1dfdf9894896', null, null, '535 N Woodlawn St, Wichita, KS 67208', 'https://www.wichitabrew.com/locations/east/', '(316) 440-4885'), -- Wichita Brewing Company
  ('147754a6-e9db-4a49-969d-765e0d9fc374', 'Yokohama Ramen Izakaya', null, null, 'https://wichitaramen.com', '(316) 796-5395'), -- Yokohama Ramen Izakaya
  ('87ad306e-b557-4a87-864f-60ea725479d6', 'Yokohama Ramen Joint', null, '613 W Douglas Ave, Suite A, Wichita, KS 67213', 'https://wichitaramen.com', '(316) 260-7031'), -- Yokohama Ramen Joint (Yokohama's Delano spot)
  ('e1abafa6-0b92-4d8d-b312-3b7f62f00a9c', null, null, '5400 E Central Ave, Wichita, KS 67208', 'https://www.facebook.com/LOCALFLAVORICT', '(316) 358-7771'), -- Local Flavor Grill & Tapworks
  ('f2ffbb5b-0c63-4e85-bd0b-7df75e566d77', 'Kobe Steak House of Japan', '{asian,steak_seafood}', '8760 W 21st St N, Wichita, KS 67205', 'https://www.kobewichita.com/', '(316) 558-3331'), -- KOBE on the map
  ('1f783567-6d83-4115-932c-fdb34b53e1b3', 'Redrock Canyon Grill', '{american,steak_seafood}', '1844 N Rock Rd, Wichita, KS 67206', 'https://www.redrockcanyongrill.com/locations/redrock-canyon-grill-wichita/', '(316) 636-1844') -- Red Rock Canyon on the map
),
src as (
  select p.*, f.name as new_name, f.categories as new_categories, f.address as new_address, f.website as new_website, f.phone as new_phone
  from public.places p join fixes f on f.id = p.id
  where p.status <> 'hidden'),
ins as (
  insert into public.places (name, kind, cuisine, categories, address, lat, lng, website, phone, opening_hours, chain, status, local_pick, note, source)
  select coalesce(new_name, name), kind, cuisine, coalesce(new_categories, categories), coalesce(new_address, address), lat, lng,
    coalesce(new_website, website), coalesce(new_phone, phone), opening_hours, chain, 'active', local_pick, note, 'staff'
  from src
  returning id)
update public.places p set status = 'hidden' from src where p.id = src.id and exists (select 1 from ins);
