// Pulls headlines from the local news feeds listed in public.news_sources into public.news_items.
// Add, pause or remove an outlet by editing that table; no redeploy needed.
// Only the headline, link and date are stored; the app links out to the full article.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { parseFeed } from '../_shared/feeds.ts';

const UA = 'Mozilla/5.0 (compatible; WichitaLifeApp/1.0; +https://wichitalifeict.com)';

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const db = adminClient();
  const { data: sources, error } = await db.from('news_sources').select('id, name, feed_url').eq('active', true);
  if (error) return json({ error: error.message }, 500);

  const results = await Promise.all(
    (sources ?? []).map(async (s) => {
      try {
        const res = await fetch(s.feed_url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseFeed(s.name, await res.text());
        await db.from('news_sources').update({ last_fetched_at: new Date().toISOString(), last_error: null }).eq('id', s.id);
        return { name: s.name, items };
      } catch (e) {
        await db.from('news_sources').update({ last_error: String(e) }).eq('id', s.id);
        return { name: s.name, items: [], error: String(e) };
      }
    }),
  );

  const items = results.flatMap((r) => r.items);
  if (items.length) {
    const { error: upsertErr } = await db.from('news_items').upsert(items, { onConflict: 'url', ignoreDuplicates: true });
    if (upsertErr) return json({ error: upsertErr.message }, 500);
  }
  return json({ sources: results.map((r) => ({ name: r.name, fetched: r.items.length, error: r.error })) });
});
