// Pulls recent Wichita Life posts from beehiiv into public.posts.
// Secrets: BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID, CRON_SECRET.
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

const cleanTitle = (t: string) => t.replace(/^\p{Extended_Pictographic}️?\s*/u, '').trim();

function guessKind(title: string): 'weekend' | 'guide' | 'deep' {
  if (/what'?s happening .*weekend/i.test(title)) return 'weekend';
  if (/\bguide\b/i.test(title)) return 'guide';
  return 'deep';
}

Deno.serve(async (req) => {
  if (!isCronRequest(req)) return json({ error: 'Forbidden' }, 403);

  const apiKey = Deno.env.get('BEEHIIV_API_KEY');
  const pub = Deno.env.get('BEEHIIV_PUBLICATION_ID');
  if (!apiKey || !pub) return json({ error: 'Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID' }, 500);

  const url = new URL(`https://api.beehiiv.com/v2/publications/${pub}/posts`);
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

  const fresh = posts.filter((p) => !known.has(p.id)).map((p) => ({ ...base(p), kind: guessKind(p.title) }));
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
