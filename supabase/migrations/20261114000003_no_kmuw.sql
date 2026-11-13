-- Owner, Nov 13: "remove anything KMUW related". Its news feed is switched off and its stories
-- cleared (sync-news also skips KMUW now, see BLOCKED_OUTLETS in _shared/feeds.ts), and KMUW radio
-- shows listed on the calendar are hidden (sync-events now skips KMUW listings, see whatsgood.ts).
update public.news_sources set active = false where name ~* '\mkmuw\M' or feed_url ~* 'kmuw';
delete from public.news_items where source_name ~* '\mkmuw\M' or url ~* 'kmuw\.org';
-- Crossroads is KMUW's blues and soul show; Blues Brunch with Robb Morrison is a radio show too.
update public.events set hidden = true, hidden_reason = 'not_an_event'
where not hidden
  and (title ~* '^\s*(crossroads contemporary blues|blues brunch with robb morrison)' or title ~* '\mkmuw\M'
       or description ~* '\mkmuw\M|\m89\.1\s*fm\M');
