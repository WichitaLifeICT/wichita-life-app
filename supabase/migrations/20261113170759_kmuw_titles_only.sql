-- The KMUW cleanup also hid a real show (a band at Mort's) whose description ends with a
-- blues-society blurb listing KMUW radio shows. Only titles count now; show it again.
update public.events set hidden = false, hidden_reason = null
where hidden_reason = 'not_an_event'
  and title !~* '^\s*(crossroads contemporary blues|blues brunch with robb morrison|uncle buc plays the blues)'
  and title !~* '\mkmuw\M';
