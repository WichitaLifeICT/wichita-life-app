// Twice a week (Monday and Thursday), reads the page behind every active deal or weekly special
// (happy hours, trivia, karaoke…) and saves the part that talks about deals, times and prices in
// public.deal_checks. When that part changes, or the page stops loading, the deal is flagged so
// staff (and Claude's twice-weekly deals review) know to look again before it goes stale.
// Body {"dryRun": true} reads the pages but saves nothing.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { dealExcerpt } from '../_shared/deal-excerpt.ts';

const UA = 'Mozilla/5.0 (compatible; WichitaLifeApp/1.0; +https://wichitalifeict.com)';

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);
  const { dryRun } = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const db = adminClient();

  const { data: deals, error } = await db.from('weekly_specials').select('id, url').eq('active', true).not('url', 'is', null);
  if (error) return json({ error: error.message }, 500);
  const { data: before, error: beforeErr } = await db.from('deal_checks').select('special_id, page_hash');
  if (beforeErr) return json({ error: beforeErr.message }, 500);
  const lastHash = new Map((before ?? []).map((r) => [r.special_id, r.page_hash]));

  // Several deals can share one page (a venue's specials page): read each page once.
  const byUrl = new Map<string, string[]>();
  for (const d of deals ?? []) byUrl.set(d.url!, [...(byUrl.get(d.url!) ?? []), d.id]);

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  let changed = 0;
  let failed = 0;
  const urls = [...byUrl.keys()];
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(
      urls.slice(i, i + 6).map(async (url) => {
        let status = 0;
        let excerpt = '';
        try {
          const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
          status = res.status;
          if (res.ok) excerpt = dealExcerpt(await res.text());
        } catch {
          status = 0;
        }
        const hash = res_ok(status) && excerpt ? await sha256(excerpt) : null;
        if (!res_ok(status)) failed++;
        for (const id of byUrl.get(url)!) {
          const was = lastHash.get(id);
          const isChange = hash !== null && was !== undefined && was !== null && was !== hash;
          if (isChange) changed++;
          rows.push({
            special_id: id,
            url,
            status,
            page_hash: hash ?? was ?? null,
            excerpt: excerpt ? excerpt.slice(0, 4000) : null,
            checked_at: now,
            ...(isChange ? { changed_at: now } : {}),
            ...(res_ok(status) ? {} : { failed_at: now }),
          });
        }
      }),
    );
  }

  if (!dryRun && rows.length) {
    const { error: saveErr } = await db.from('deal_checks').upsert(rows, { onConflict: 'special_id' });
    if (saveErr) return json({ error: saveErr.message }, 500);
  }
  return json({ pages: urls.length, deals: rows.length, changed, failed, dryRun: !!dryRun });
});

function res_ok(status: number) {
  return status >= 200 && status < 300;
}
