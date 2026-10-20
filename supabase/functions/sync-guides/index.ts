// Pulls the local guides listed on wichitalifeict.com/guides into public.guides, in page order.
// Guides that come off the page are marked inactive.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { guideLinks, parseGuidePage, SITE, type GuideRow } from '../_shared/guides.ts';

const UA = 'Mozilla/5.0 (compatible; WichitaLifeApp/1.0; +https://wichitalifeict.com)';

async function get(path: string) {
  const res = await fetch(`${SITE}${path}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const paths = guideLinks(await get('/guides'));
  // An empty page is more likely an outage than no guides; don't deactivate everything.
  if (!paths.length) return json({ error: 'No guides found on /guides' }, 502);

  const guides: GuideRow[] = [];
  const failures: string[] = [];
  const pages = await Promise.allSettled(paths.map(async (p, i) => parseGuidePage(p, await get(p), i)));
  pages.forEach((r) => (r.status === 'fulfilled' ? r.value && guides.push(r.value) : failures.push(String(r.reason))));

  const db = adminClient();
  const now = new Date().toISOString();
  const { error } = await db.from('guides').upsert(guides.map((g) => ({ ...g, synced_at: now })), { onConflict: 'slug' });
  if (error) return json({ error: error.message }, 500);

  const { data: removed, error: rmErr } = await db
    .from('guides')
    .update({ active: false })
    .eq('active', true)
    .not('slug', 'in', `(${guides.map((g) => `"${g.slug}"`).join(',')})`)
    .select('slug');
  if (rmErr) return json({ error: rmErr.message }, 500);

  return json({ guides: guides.length, deactivated: removed?.length ?? 0, failures });
});
