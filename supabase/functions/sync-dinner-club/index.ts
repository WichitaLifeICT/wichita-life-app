// Keeps the Wichita Life Dinner Club in Meet > Upcoming meetups, with dates from wichitalife.dnnr.io.
// Each dinner links out to sign up there (no RSVP in the app). Runs every morning.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { DINNER_CLUB_URL, dinnerDates, wichitaToUtc } from '../_shared/dinner-club.ts';

const UA = 'Mozilla/5.0 (compatible; WichitaLifeApp/1.0; +https://wichitalifeict.com)';

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const res = await fetch(DINNER_CLUB_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return json({ error: `dnnr.io: HTTP ${res.status}` }, 502);
  const dates = dinnerDates(await res.text());
  // No dates at all is more likely a page change than no dinners; leave things as they are.
  if (!dates.length) return json({ error: 'No dinner dates found on the page' }, 502);

  const now = Date.now();
  const upcoming = dates.map((d) => ({ key: `dnnr:${d}`, at: wichitaToUtc(d) })).filter((d) => d.at.getTime() > now);

  const db = adminClient();
  if (upcoming.length) {
    const { error } = await db.from('meetups').upsert(
      upcoming.map((d) => ({
        source_key: d.key,
        title: 'Wichita Life Dinner Club',
        description: 'Take the quiz and get matched with 5 others for dinner, then meet every table at a secret after-party.',
        starts_at: d.at.toISOString(),
        area: 'Restaurant revealed the morning of',
        capacity: 6,
        status: 'open',
        signup_url: DINNER_CLUB_URL,
      })),
      { onConflict: 'source_key' },
    );
    if (error) return json({ error: error.message }, 500);
  }

  // A dinner that came off the page (moved or canceled) shouldn't stay listed.
  const keys = upcoming.map((d) => `"${d.key}"`).join(',');
  let stale = db
    .from('meetups')
    .update({ status: 'canceled' })
    .like('source_key', 'dnnr:%')
    .eq('status', 'open')
    .gt('starts_at', new Date(now).toISOString());
  if (keys) stale = stale.not('source_key', 'in', `(${keys})`);
  const { data: removed, error } = await stale.select('id');
  if (error) return json({ error: error.message }, 500);

  return json({ upcoming: upcoming.map((d) => d.at.toISOString()), canceled: removed?.length ?? 0 });
});
