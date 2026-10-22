// Scheduled pushes. Called by pg_cron with the cron secret and { "job": "..." }:
//   reminders: 6pm the evening before, one push per member for the events they saved and
//              the meetups they're going to
//   daily:     7am "Today in Wichita" (skipped Thursdays, which get the weekend guide)
//   weekend:   7am Thursday, after the weekend-guide newsletter goes out; members who picked
//              interests get their own picks for the weekend instead of the generic message
// Cron runs each job at two UTC hours so it lands right in both daylight and standard
// time; the job only sends during the matching Wichita hour.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { interestScore } from '../_shared/interests.ts';
import { sendToMembers, sendToTopic, type PushMessage } from '../_shared/push.ts';

const TZ = 'America/Chicago';
type Job = 'reminders' | 'daily' | 'weekend';
const HOURS: Record<Job, number> = { reminders: 18, daily: 7, weekend: 7 };

function wichitaParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, weekday: p.weekday };
}

/** Midnight in Wichita, `days` days from today, as a UTC Date. */
function wichitaMidnight(days: number, now = new Date()) {
  const p = wichitaParts(now);
  const guess = Date.UTC(p.y, p.mo - 1, p.d + days);
  const q = wichitaParts(new Date(guess));
  const offset = Date.UTC(q.y, q.mo - 1, q.d, q.h) - guess;
  return new Date(guess - offset);
}

const timeLabel = (iso: string, allDay: boolean) =>
  allDay
    ? 'All day'
    : new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
        .format(new Date(iso))
        .replace(':00', '');

function listTitles(titles: string[]) {
  if (titles.length <= 1) return titles.join('');
  return `${titles.slice(0, -1).join(', ')} and ${titles.at(-1)}`;
}

type EventRow = { id: string; title: string; starts_at: string; all_day: boolean; venue: string | null };
type Plan = { title: string; starts_at: string; all_day: boolean; venue: string | null; path: string };
type MeetupRow = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  details: { venue: string } | { venue: string }[] | null;
};

async function reminders() {
  const db = adminClient();
  const from = wichitaMidnight(1).toISOString();
  const to = wichitaMidnight(2).toISOString();
  const { data, error } = await db
    .from('saved_events')
    .select('user_id, event_id, event:events!inner(id, title, starts_at, all_day, venue, hidden)')
    .eq('remind', true)
    .is('reminded_at', null)
    .gte('event.starts_at', from)
    .lt('event.starts_at', to)
    .eq('event.hidden', false);
  if (error) throw new Error(error.message);

  // Meetups tomorrow that members are going to (not the waitlist).
  const { data: going, error: rsvpError } = await db
    .from('rsvps')
    .select('user_id, meetup_id, meetup:meetups!inner(id, title, starts_at, status, details:meetup_private(venue))')
    .eq('status', 'going')
    .is('reminded_at', null)
    .gte('meetup.starts_at', from)
    .lt('meetup.starts_at', to)
    .eq('meetup.status', 'open');
  if (rsvpError) throw new Error(rsvpError.message);

  const byMember = new Map<string, Plan[]>();
  const add = (member: string, plan: Plan) => byMember.set(member, [...(byMember.get(member) ?? []), plan]);
  for (const row of data ?? []) {
    const e = (Array.isArray(row.event) ? row.event[0] : row.event) as EventRow;
    add(row.user_id, { ...e, path: `/event/${e.id}` });
  }
  for (const row of going ?? []) {
    const m = (Array.isArray(row.meetup) ? row.meetup[0] : row.meetup) as MeetupRow;
    const details = Array.isArray(m.details) ? m.details[0] : m.details;
    add(row.user_id, { title: m.title, starts_at: m.starts_at, all_day: false, venue: details?.venue ?? null, path: '/meet' });
  }
  const messages = new Map<string, PushMessage>();
  for (const [member, events] of byMember) {
    events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const [first] = events;
    messages.set(
      member,
      events.length === 1
        ? {
            title: `Tomorrow: ${first.title}`,
            body: [timeLabel(first.starts_at, first.all_day), first.venue].filter(Boolean).join(' · '),
            data: { topic: 'reminder', path: first.path },
          }
        : {
            title: `Tomorrow: ${events.length} things on your list`,
            body: listTitles(events.slice(0, 3).map((e) => e.title)),
            data: { topic: 'reminder', path: '/account' },
          },
    );
  }
  const result = messages.size ? await sendToMembers(db, messages) : { sent: 0, removed: 0 };
  if (data?.length) {
    const now = new Date().toISOString();
    for (const row of data) {
      await db.from('saved_events').update({ reminded_at: now }).eq('user_id', row.user_id).eq('event_id', row.event_id);
    }
  }
  for (const row of going ?? []) {
    await db
      .from('rsvps')
      .update({ reminded_at: new Date().toISOString() })
      .eq('user_id', row.user_id)
      .eq('meetup_id', row.meetup_id);
  }
  return { members: messages.size, ...result };
}

async function eventsBetween(from: Date, to: Date) {
  const { data, error } = await adminClient()
    .from('events')
    .select('id, title, starts_at, all_day, venue, is_sponsored, tags, calendar_tags')
    .eq('hidden', false)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('is_sponsored', { ascending: false })
    .order('starts_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function daily() {
  if (wichitaParts(new Date()).weekday === 'Thu') return { skipped: 'Thursday gets the weekend guide' };
  const events = await eventsBetween(wichitaMidnight(0), wichitaMidnight(1));
  if (!events.length) return { skipped: 'no events today' };
  const picks = events.slice(0, 3).map((e) => e.title);
  return await sendToTopic(adminClient(), 'daily', {
    title: 'Today in Wichita',
    body: `${events.length} thing${events.length === 1 ? '' : 's'} to do today, including ${listTitles(picks)}.`,
    data: { path: '/events' },
  });
}

/** Rows for these member IDs, read in batches to keep the query string short. */
async function forMembers<T>(ids: string[], read: (batch: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await read(ids.slice(i, i + 500));
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}

async function weekend() {
  if (wichitaParts(new Date()).weekday !== 'Thu') return { skipped: 'not Thursday' };
  const db = adminClient();
  const { data: post } = await db
    .from('posts')
    .select('title')
    .eq('kind', 'weekend')
    .eq('hidden', false)
    .gte('published_at', wichitaMidnight(0).toISOString())
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const events = await eventsBetween(wichitaMidnight(1), wichitaMidnight(4));
  if (!post && !events.length) return { skipped: 'nothing to send' };
  const generic: PushMessage = {
    title: 'Your Wichita weekend guide is here',
    body: post
      ? post.title
      : `${events.length} things to do this weekend, including ${listTitles(events.slice(0, 2).map((e) => e.title))}.`,
    data: { topic: 'weekend', path: post ? '/explore' : '/events' },
  };

  // Everyone with the weekend guide turned on; those with interests get their own picks,
  // leaving out events they said they're not interested in.
  const { data: prefs, error } = await db.from('notification_prefs').select('user_id').eq('weekend', true);
  if (error) throw new Error(error.message);
  const ids = (prefs ?? []).map((p) => p.user_id as string);
  const profiles = await forMembers<{ id: string; interests: string[] }>(ids, (batch) =>
    db.from('profiles').select('id, interests').in('id', batch),
  );
  const dismissed = await forMembers<{ user_id: string; event_id: string }>(ids, (batch) =>
    db.from('dismissed_events').select('user_id, event_id').in('user_id', batch),
  );
  const hidden = new Set(dismissed.map((d) => `${d.user_id}/${d.event_id}`));

  const messages = new Map<string, PushMessage>();
  let personalized = 0;
  for (const p of profiles) {
    const picks = events
      .filter((e) => !hidden.has(`${p.id}/${e.id}`))
      .map((e) => ({ e, n: interestScore(e, p.interests ?? []) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.e.starts_at.localeCompare(b.e.starts_at))
      .slice(0, 3)
      .map((x) => x.e.title);
    if (picks.length) personalized++;
    messages.set(
      p.id,
      picks.length
        ? {
            title: 'Your Wichita weekend',
            body: `Picked for you: ${listTitles(picks)}.${post ? ' Plus the weekend guide is out.' : ''}`,
            data: { topic: 'weekend', path: '/' },
          }
        : generic,
    );
  }
  if (!messages.size) return { personalized, sent: 0, removed: 0 };
  return { personalized, ...(await sendToMembers(db, messages)) };
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);
  const { job, force } = (await req.json().catch(() => ({}))) as { job?: Job; force?: boolean };
  if (!job || !(job in HOURS)) return json({ error: 'job must be reminders, daily or weekend' }, 400);
  if (!force && wichitaParts(new Date()).h !== HOURS[job]) return json({ skipped: 'not the right hour in Wichita' });
  try {
    const run = { reminders, daily, weekend }[job];
    return json({ job, ...(await run()) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
