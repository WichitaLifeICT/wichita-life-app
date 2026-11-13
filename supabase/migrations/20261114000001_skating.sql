-- "What should we do?" gets a Skating filter (owner, Nov 13: skating rinks open year-round).
-- The four year-round rinks were only under Jump & climb; they keep that and add Skating.
update public.activities set kinds = array_append(kinds, 'skating')
where id in ('icecenter', 'carousel', 'rollercity', 'skatesouth') and not ('skating' = any(kinds));
-- Roller City's address had no ZIP code.
update public.activities set address = '3234 S Meridian Ave, Wichita, KS 67217'
where id = 'rollercity' and address = '3234 S Meridian Ave, Wichita, KS';
