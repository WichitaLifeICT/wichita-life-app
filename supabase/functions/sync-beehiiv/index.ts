// Pulls recent Wichita Life posts from beehiiv into public.posts.
// Secret: BEEHIIV_API_KEY. Called on a schedule with the cron secret (see _shared/admin.ts).
// New posts get a best-guess `kind`; edits you make to kind/featured/excerpt in Supabase are kept.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';

type BeehiivPost = {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  web_url: string;
  thumbnail_url?: string | null;
  publish_date: number | null; // unix seconds
};

// Wichita Life's beehiiv publication (not secret).
const PUBLICATION_ID = Deno.env.get('BEEHIIV_PUBLICATION_ID') ?? 'pub_a063b428-f4ec-4b8a-acd8-865dbdea2ec5';

const cleanTitle = (t: string) => t.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '').trim();

// Every Wednesday email is a deep dive, and deep dives only go out on Wednesdays.
function guessKind(title: string, publishedAt: Date): 'weekend' | 'deep' | 'daily' {
  const weekday = publishedAt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' });
  if (weekday === 'Wed') return 'deep';
  if (/what'?s happening .*weekend/i.test(title)) return 'weekend';
  return 'daily';
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const apiKey = Deno.env.get('BEEHIIV_API_KEY');
  if (!apiKey) return json({ error: 'Set the BEEHIIV_API_KEY secret' }, 500);

  const url = new URL(`https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/posts`);
  url.searchParams.set('status', 'confirmed');
  url.searchParams.set('limit', '50');
  url.searchParams.set('order_by', 'publish_date');
  url.searchParams.set('direction', 'desc');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) return json({ error: `beehiiv ${res.status}`, body: await res.text() }, 502);
  const { data } = (await res.json()) as { data: BeehiivPost[] };
  const posts = data.filter((p) => p.publish_date && p.publish_date * 1000 <= Date.now());

  const db = adminClient();
  const { data: existing, error: readErr } = await db.from('posts').select('id').in('id', posts.map((p) => p.id));
  if (readErr) return json({ error: readErr.message }, 500);
  const known = new Set((existing ?? []).map((r) => r.id));

  const base = (p: BeehiivPost) => ({
    id: p.id,
    title: cleanTitle(p.title),
    subtitle: p.subtitle ?? null,
    slug: p.slug,
    url: p.web_url,
    thumbnail_url: p.thumbnail_url ?? null,
    published_at: new Date(p.publish_date! * 1000).toISOString(),
    synced_at: new Date().toISOString(),
  });

  const fresh = posts
    .filter((p) => !known.has(p.id))
    .map((p) => ({ ...base(p), kind: guessKind(p.title, new Date(p.publish_date! * 1000)) }));
  const updates = posts.filter((p) => known.has(p.id)).map(base);

  if (fresh.length) {
    const { error } = await db.from('posts').insert(fresh);
    if (error) return json({ error: error.message }, 500);
  }
  if (updates.length) {
    const { error } = await db.from('posts').upsert(updates, { onConflict: 'id' });
    if (error) return json({ error: error.message }, 500);
  }
  return json({ added: fresh.length, updated: updates.length });
});
