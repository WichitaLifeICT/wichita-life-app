// Pulls upcoming events from the Wichita Life calendar (What's Good) into public.events.
// The calendar has no feed, so this reads the public event pages, which carry standard
// schema.org Event data: the home page (soonest events) plus pages the sitemap shows as
// changed since we last read them. Tags, sponsorship and hidden flags you set in Supabase are kept;
// the calendar's own tags go in `calendar_tags`. Body {"refresh": true} also re-reads upcoming
// events that have no calendar tags yet (used once to fill them in).

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { EVENTS_HOST, eventId, eventLinks, parseEventPage, recentSitemapLinks, type EventRow } from '../_shared/listings.ts';

const UA = 'Mozilla/5.0 (compatible; WichitaLifeApp/1.0; +https://wichitalifeict.com)';
const MAX_PAGES = 200;
const CONCURRENCY = 4;

async function get(path: string) {
  const res = await fetch(`${EVENTS_HOST}${path}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const { refresh } = (await req.json().catch(() => ({}))) as { refresh?: boolean };
  const db = adminClient();
  const [home, sitemap] = await Promise.all([get('/'), get('/sitemap.xml')]);

  let untagged: string[] = [];
  if (refresh) {
    const { data, error } = await db
      .from('events')
      .select('url')
      .eq('source', 'wichitalife_events')
      .eq('calendar_tags', '{}')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(MAX_PAGES);
    if (error) return json({ error: error.message }, 500);
    untagged = (data ?? []).map((r) => r.url?.replace(EVENTS_HOST, '')).filter((p): p is string => !!p?.startsWith('/'));
  }

  // Skip sitemap pages that haven't changed since we last synced them.
  const recent = recentSitemapLinks(sitemap, 60);
  const { data: seen, error: seenErr } = await db
    .from('events')
    .select('source_id, synced_at')
    .eq('source', 'wichitalife_events')
    .in('source_id', recent.map((r) => eventId(r.path)!));
  if (seenErr) return json({ error: seenErr.message }, 500);
  const syncedAt = new Map((seen ?? []).map((r) => [r.source_id, Date.parse(r.synced_at)]));
  const changed = recent.filter((r) => !(syncedAt.get(eventId(r.path)!)! > r.lastmod)).map((r) => r.path);

  // Home page events first (soonest), then changed pages; later runs pick up anything past the cap.
  const paths = [...new Set([...untagged, ...eventLinks(home), ...changed])].slice(0, MAX_PAGES);

  const events: EventRow[] = [];
  const failures: string[] = [];
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = await Promise.allSettled(paths.slice(i, i + CONCURRENCY).map(async (p) => parseEventPage(p, await get(p))));
    batch.forEach((r) => (r.status === 'fulfilled' ? r.value && events.push(r.value) : failures.push(String(r.reason))));
  }

  // Keep events that haven't ended yet.
  const cutoff = Date.now() - 6 * 3_600_000;
  const upcoming = events.filter((e) => Date.parse(e.ends_at ?? e.starts_at) >= cutoff);

  const { data: existing, error: readErr } = await db
    .from('events')
    .select('source_id')
    .eq('source', 'wichitalife_events')
    .in('source_id', upcoming.map((e) => e.source_id));
  if (readErr) return json({ error: readErr.message }, 500);
  const known = new Set((existing ?? []).map((r) => r.source_id));

  const now = new Date().toISOString();
  const row = ({ free: _free, ...e }: EventRow) => ({ ...e, synced_at: now });
  const fresh = upcoming.filter((e) => !known.has(e.source_id)).map((e) => ({ ...row(e), tags: e.free ? ['free'] : [] }));
  const updates = upcoming.filter((e) => known.has(e.source_id)).map(row);

  if (fresh.length) {
    const { error } = await db.from('events').insert(fresh);
    if (error) return json({ error: error.message }, 500);
  }
  if (updates.length) {
    const { error } = await db.from('events').upsert(updates, { onConflict: 'source,source_id' });
    if (error) return json({ error: error.message }, 500);
  }
  return json({ pages: paths.length, events: events.length, upcoming: upcoming.length, added: fresh.length, updated: updates.length, failures: failures.slice(0, 5) });
});
