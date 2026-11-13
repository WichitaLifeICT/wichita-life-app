// Pulls recent Wichita Life posts from beehiiv into public.posts, and each recent story's full
// text into public.post_content so the app can show it on its own reading screen.
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

/** Stories this recent get their full text saved for the app's reading screen. */
const CONTENT_DAYS = 60;
/** Text fetches per run, so a backfill can't run the sync past its time limit. */
const CONTENT_PER_RUN = 15;

/** A story's web version from beehiiv (the free version: everything subscribers see). */
async function fetchContent(apiKey: string, id: string): Promise<string | null> {
  const url = new URL(`https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/posts/${id}`);
  url.searchParams.append('expand[]', 'free_web_content');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`beehiiv post ${id}: HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: { content?: { free?: { web?: string | null } } } };
  const html = data.content?.free?.web?.trim();
  return html ? html : null;
}

const cleanTitle = (t: string) => t.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '').trim();

// The newsletter's schedule decides the type: Wednesday is the deep dive, Thursday is the
// weekend guide, and the other days (Monday and Friday) are the daily local news and events.
// Staff can still change a story's type in Staff tools > Stories.
function guessKind(publishedAt: Date): 'weekend' | 'deep' | 'daily' {
  const weekday = publishedAt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' });
  if (weekday === 'Wed') return 'deep';
  if (weekday === 'Thu') return 'weekend';
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
    .map((p) => ({ ...base(p), kind: guessKind(new Date(p.publish_date! * 1000)) }));
  const updates = posts.filter((p) => known.has(p.id)).map(base);

  if (fresh.length) {
    const { error } = await db.from('posts').insert(fresh);
    if (error) return json({ error: error.message }, 500);
  }
  if (updates.length) {
    const { error } = await db.from('posts').upsert(updates, { onConflict: 'id' });
    if (error) return json({ error: error.message }, 500);
  }

  // Full text: recent stories that don't have it yet, plus the two newest (in case they were edited).
  const recent = posts.filter((p) => p.publish_date! * 1000 > Date.now() - CONTENT_DAYS * 86_400_000);
  const { data: saved, error: savedErr } = await db
    .from('post_content')
    .select('post_id')
    .in('post_id', recent.map((p) => p.id));
  if (savedErr) return json({ error: savedErr.message }, 500);
  const have = new Set((saved ?? []).map((r) => r.post_id));
  const todo = [...new Set([...recent.slice(0, 2), ...recent.filter((p) => !have.has(p.id))].map((p) => p.id))].slice(
    0,
    CONTENT_PER_RUN,
  );
  let texts = 0;
  const textErrors: string[] = [];
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(
      todo.slice(i, i + 5).map(async (id) => {
        try {
          const html = await fetchContent(apiKey, id);
          if (!html) return;
          const { error } = await db
            .from('post_content')
            .upsert({ post_id: id, html: html.slice(0, 2_000_000), synced_at: new Date().toISOString() });
          if (error) throw error;
          texts++;
        } catch (e) {
          textErrors.push((e as Error).message);
        }
      }),
    );
  }

  return json({
    added: fresh.length,
    updated: updates.length,
    texts,
    textsLeft: recent.filter((p) => !have.has(p.id)).length - texts,
    ...(textErrors.length ? { textErrors: textErrors.slice(0, 5) } : {}),
  });
});
