// Pulls jobs from the Wichita Life Job Board (Kardow) feed into public.jobs.
// Jobs that drop off the feed are marked inactive so the app stops showing them.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { parseKardowFeed } from '../_shared/listings.ts';

const FEED = 'https://jobs.wichitalifeict.com/feed';

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const res = await fetch(FEED, { headers: { 'User-Agent': 'WichitaLifeApp/1.0 (+https://wichitalifeict.com)' } });
  if (!res.ok) return json({ error: `Job feed HTTP ${res.status}` }, 502);
  const jobs = parseKardowFeed(await res.text());
  // An empty feed is more likely an outage than zero jobs; don't deactivate everything.
  if (!jobs.length) return json({ error: 'Job feed returned no jobs' }, 502);

  const db = adminClient();
  const { error } = await db.from('jobs').upsert(jobs, { onConflict: 'url' });
  if (error) return json({ error: error.message }, 500);

  const live = jobs.map((j) => j.url);
  const { data: stale, error: staleErr } = await db
    .from('jobs')
    .update({ active: false })
    .eq('source', 'kardow')
    .eq('active', true)
    .not('url', 'in', `(${live.map((u) => `"${u}"`).join(',')})`)
    .select('id');
  if (staleErr) return json({ error: staleErr.message }, 500);

  return json({ jobs: jobs.length, deactivated: stale?.length ?? 0 });
});
