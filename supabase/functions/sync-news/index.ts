// Pulls headlines from local news RSS/Atom feeds into public.news_items.
// Secrets: NEWS_FEEDS, CRON_SECRET.
// NEWS_FEEDS format: "Source name|https://feed.url, Other source|https://other.feed"
// Only the headline, link and date are stored; the app links out to the full article.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { parseFeed } from '../_shared/feeds.ts';

Deno.serve(async (req) => {
  if (!isCronRequest(req)) return json({ error: 'Forbidden' }, 403);

  const feeds = (Deno.env.get('NEWS_FEEDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, url] = s.split('|').map((x) => x.trim());
      return { name, url };
    })
    .filter((f) => f.name && f.url);
  if (!feeds.length) return json({ error: 'Set NEWS_FEEDS' }, 500);

  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const res = await fetch(f.url, { headers: { 'User-Agent': 'WichitaLifeApp/1.0 (+https://wichitalifeict.com)' } });
      if (!res.ok) throw new Error(`${f.name}: HTTP ${res.status}`);
      return parseFeed(f.name, await res.text());
    }),
  );

  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const failures = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason)] : []));

  if (items.length) {
    const { error } = await adminClient().from('news_items').upsert(items, { onConflict: 'url', ignoreDuplicates: true });
    if (error) return json({ error: error.message }, 500);
  }
  return json({ fetched: items.length, failures });
});
