// Pulls upcoming events from the Wichita Life calendar (What's Good API) into public.events.
// Each run reads the calendar's whole list of events that haven't ended, so it also notices
// events that were deleted there (the API drops them from the list) and removes them here.
// Tags, sponsorship and hidden flags you set in Supabase are kept; the calendar's own tags
// go in `calendar_tags`. The API key is in Supabase Vault (`whatsgood_api_key`).
// Body {"dryRun": true} changes nothing and reports how the calendar differs from the app.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import type { EventRow } from '../_shared/listings.ts';
import { fetchTagNames, fetchUpcomingEvents, toEventRow } from '../_shared/whatsgood.ts';

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const { dryRun } = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const db = adminClient();
  const { data: key, error: keyErr } = await db.rpc('whatsgood_api_key');
  if (keyErr || !key) return json({ error: keyErr?.message ?? 'whatsgood_api_key is not in Vault' }, 500);

  let list: Awaited<ReturnType<typeof fetchUpcomingEvents>>;
  let tags: Map<number, string>;
  try {
    [list, tags] = await Promise.all([fetchUpcomingEvents(key), fetchTagNames(key)]);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }

  const now = Date.now();
  const upcoming = list.events
    .filter((e) => e.status === 'active')
    .map((e) => toEventRow(e, tags, now))
    .filter((e): e is EventRow => !!e);

  const { data: existing, error: readErr } = await db
    .from('events')
    .select('id, source_id, starts_at, title')
    .eq('source', 'wichitalife_events');
  if (readErr) return json({ error: readErr.message }, 500);
  const known = new Set((existing ?? []).map((r) => r.source_id));

  if (dryRun) {
    const byId = new Map((existing ?? []).map((r) => [r.source_id, r]));
    const live = new Set(upcoming.map((e) => e.source_id));
    const moved = upcoming.filter((e) => {
      const r = byId.get(e.source_id);
      return r && Date.parse(r.starts_at) >= now && Date.parse(r.starts_at) !== Date.parse(e.starts_at);
    });
    return json({
      calendar: list.events.length,
      complete: list.complete,
      upcoming: upcoming.length,
      new: upcoming.filter((e) => !known.has(e.source_id)).length,
      timeChanged: moved.length,
      timeChangedSample: moved.slice(0, 8).map((e) => [e.title, byId.get(e.source_id)!.starts_at, e.starts_at]),
      notOnCalendar: (existing ?? []).filter((r) => !live.has(r.source_id) && Date.parse(r.starts_at) >= now).map((r) => r.title),
      sample: upcoming.slice(0, 3),
    });
  }

  const synced = new Date(now).toISOString();
  const row = ({ free: _free, ...e }: EventRow) => ({ ...e, synced_at: synced });
  const fresh = upcoming.filter((e) => !known.has(e.source_id)).map((e) => ({ ...row(e), tags: e.free ? ['free'] : [] }));
  const updates = upcoming.filter((e) => known.has(e.source_id)).map(row);

  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await db.from('events').insert(fresh.slice(i, i + 200));
    if (error) return json({ error: error.message }, 500);
  }
  for (let i = 0; i < updates.length; i += 200) {
    const { error } = await db.from('events').upsert(updates.slice(i, i + 200), { onConflict: 'source,source_id' });
    if (error) return json({ error: error.message }, 500);
  }

  // Upcoming events that are no longer on the calendar were deleted there, so remove them
  // (saves and hides of them go too). Only trust a complete list that isn't suspiciously short,
  // so an API hiccup can't empty the app.
  const live = new Set(upcoming.map((e) => e.source_id));
  const gone = (existing ?? []).filter((r) => !live.has(r.source_id) && Date.parse(r.starts_at) >= now);
  const upcomingBefore = (existing ?? []).filter((r) => Date.parse(r.starts_at) >= now).length;
  let removed = 0;
  let skippedRemoval: string | undefined;
  if (!list.complete) skippedRemoval = 'event list was cut off';
  else if (gone.length > Math.max(25, upcomingBefore / 4)) skippedRemoval = `${gone.length} would go; too many, check by hand`;
  else if (gone.length) {
    const { error } = await db.from('events').delete().in('id', gone.map((r) => r.id));
    if (error) return json({ error: error.message }, 500);
    removed = gone.length;
  }

  return json({
    calendar: list.events.length,
    upcoming: upcoming.length,
    added: fresh.length,
    updated: updates.length,
    removed,
    ...(skippedRemoval ? { skippedRemoval, wouldRemove: gone.slice(0, 10).map((r) => r.source_id) } : {}),
  });
});
