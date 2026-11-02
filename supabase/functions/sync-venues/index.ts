// Pulls live music from venues' own calendars (see _shared/venues.ts) into public.events, every
// 6 hours. A show the Wichita Life calendar also lists at that venue within 2 hours is skipped, so
// nothing shows twice; the calendar's listing wins. Shows a venue drops are removed.
// Body {"dryRun": true} changes nothing and reports what would be added.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import type { EventRow } from '../_shared/listings.ts';
import { VENUE_FEEDS } from '../_shared/venues.ts';

const NEAR = 2 * 3_600_000;

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);
  const { dryRun } = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const db = adminClient();
  const now = Date.now();
  const report: Record<string, unknown> = {};

  for (const feed of VENUE_FEEDS) {
    let rows: EventRow[];
    try {
      rows = (await feed.fetch()).filter((e) => Date.parse(e.ends_at ?? e.starts_at) >= now);
    } catch (e) {
      report[feed.key] = { error: (e as Error).message };
      continue;
    }

    // The calendar's own listings at this venue, to skip shows it already has.
    const { data: calendar, error: calErr } = await db
      .from('events')
      .select('starts_at')
      .eq('source', 'wichitalife_events')
      .ilike('venue', feed.calendarVenue)
      .gte('starts_at', new Date(now - NEAR).toISOString());
    if (calErr) return json({ error: calErr.message }, 500);
    const taken = (calendar ?? []).map((r) => Date.parse(r.starts_at));
    const fresh = rows.filter((e) => !taken.some((t) => Math.abs(t - Date.parse(e.starts_at)) < NEAR));

    const { data: existing, error: readErr } = await db
      .from('events')
      .select('id, source_id, starts_at')
      .eq('source', 'venue_feed')
      .like('source_id', `${feed.key}:%`);
    if (readErr) return json({ error: readErr.message }, 500);
    const known = new Set((existing ?? []).map((r) => r.source_id));
    const live = new Set(fresh.map((e) => e.source_id));
    const gone = (existing ?? []).filter((r) => !live.has(r.source_id) && Date.parse(r.starts_at) >= now);

    if (dryRun) {
      report[feed.key] = {
        feed: rows.length,
        alreadyOnCalendar: rows.length - fresh.length,
        new: fresh.filter((e) => !known.has(e.source_id)).map((e) => [e.title, e.starts_at]),
        wouldRemove: gone.length,
      };
      continue;
    }

    const synced = new Date(now).toISOString();
    const row = ({ free: _free, ...e }: EventRow) => ({ ...e, synced_at: synced });
    const added = fresh.filter((e) => !known.has(e.source_id)).map((e) => ({ ...row(e), tags: e.free ? ['free'] : [] }));
    const updated = fresh.filter((e) => known.has(e.source_id)).map(row);
    if (added.length) {
      const { error } = await db.from('events').insert(added);
      if (error) return json({ error: error.message }, 500);
    }
    if (updated.length) {
      const { error } = await db.from('events').upsert(updated, { onConflict: 'source,source_id' });
      if (error) return json({ error: error.message }, 500);
    }
    // An empty feed is more likely a hiccup than a venue cancelling everything.
    let removed = 0;
    if (gone.length && rows.length) {
      const { error } = await db.from('events').delete().in('id', gone.map((r) => r.id));
      if (error) return json({ error: error.message }, 500);
      removed = gone.length;
    }
    report[feed.key] = {
      feed: rows.length,
      alreadyOnCalendar: rows.length - fresh.length,
      added: added.length,
      updated: updated.length,
      removed,
    };
  }
  return json(report);
});
