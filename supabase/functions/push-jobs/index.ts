// Scheduled pushes. Called by pg_cron with the cron secret and { "job": "..." }. Each member's
// switches in notification_prefs decide what they get:
//   reminders: 6pm the evening before, one push per member for the events they saved, the
//              meetups they're going to and plans starting tomorrow            (reminders, on)
//   week:      5pm Tuesday "Coming up this week", only for members with saved events or plans
//              Wednesday to Sunday                                              (reminders, on)
//   weekend:   8am Thursday "Your Wichita weekend": their own plans and saved events first,
//              then picks by interests                                          (weekend, on)
//   tonight:   4pm Friday, three picks for tonight, only for members with nothing saved or
//              planned for the weekend                                          (tonight, on)
//   daily:     8am "Today in Wichita" with the question of the day, not Thursdays (daily, opt-in)
//   plan_join, friend, plan_sent: sent by the database (private.notify) when someone joins your
//              plan, friends you or sends you a plan; held overnight until 8am  (friends, on)
// Giveaways & deals (opt-in) and big local news are sent by staff from send-push.
// Cron runs each job at two UTC hours so it lands right in both daylight and standard
// time; the job only sends during the matching Wichita hour, and only once that day.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { interestScore } from '../_shared/interests.ts';
import { sendToMembers, sendToTopic, type PushMessage } from '../_shared/push.ts';

const TZ = 'America/Chicago';
type Job = 'reminders' | 'week' | 'daily' | 'weekend' | 'tonight' | 'plan_join' | 'friend' | 'plan_sent';
const HOURS: Record<Job, number | null> = {
  reminders: 18,
  week: 17,
  daily: 8,
  weekend: 8,
  tonight: 16,
  plan_join: null,
  friend: null,
  plan_sent: null,
};

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

/** A Wichita date `days` from today, as YYYY-MM-DD. */
function wichitaDate(days: number, now = new Date()) {
  const p = wichitaParts(now);
  return new Date(Date.UTC(p.y, p.mo - 1, p.d + days)).toISOString().slice(0, 10);
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

const dayName = (d: Date, timeZone = TZ) => new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(d);

/** These members, minus anyone who turned this kind of notification off. */
async function whoWants(column: 'reminders' | 'friends', ids: string[]) {
  const off = await forMembers<{ user_id: string }>(ids, (batch) =>
    adminClient().from('notification_prefs').select('user_id').in('user_id', batch).eq(column, false),
  );
  const no = new Set(off.map((r) => r.user_id));
  return ids.filter((id) => !no.has(id));
}

/** Members who have this switch on. */
async function membersWith(column: 'reminders' | 'weekend' | 'tonight') {
  const { data, error } = await adminClient().from('notification_prefs').select('user_id').eq(column, true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => p.user_id as string);
}

type AgendaItem = { title: string; at: string; day: string; path: string; plan: boolean };

/**
 * Each member's own things between two Wichita days (offsets from today, both included): events
 * they saved, and plans they made or said they're in on.
 */
async function agendaFor(ids: string[], fromDay: number, toDay: number) {
  const db = adminClient();
  const agenda = new Map<string, AgendaItem[]>();
  const add = (member: string, item: AgendaItem) => agenda.set(member, [...(agenda.get(member) ?? []), item]);
  const saved = await forMembers<{ user_id: string; event: unknown }>(ids, (batch) =>
    db
      .from('saved_events')
      .select('user_id, event:events!inner(id, title, starts_at, hidden)')
      .in('user_id', batch)
      .gte('event.starts_at', wichitaMidnight(fromDay).toISOString())
      .lt('event.starts_at', wichitaMidnight(toDay + 1).toISOString())
      .eq('event.hidden', false),
  );
  for (const row of saved) {
    const e = (Array.isArray(row.event) ? row.event[0] : row.event) as { id: string; title: string; starts_at: string };
    add(row.user_id, { title: e.title, at: e.starts_at, day: dayName(new Date(e.starts_at)), path: `/event/${e.id}`, plan: false });
  }
  const from = wichitaDate(fromDay);
  const to = wichitaDate(toDay);
  const { data: plans, error } = await db
    .from('plans')
    .select('id, title, owner_id, share_code, starts_on, plan_joins(user_id)')
    .lte('starts_on', to)
    .or(`ends_on.gte.${from},and(ends_on.is.null,starts_on.gte.${from})`);
  if (error) throw new Error(error.message);
  const wanted = new Set(ids);
  for (const p of plans ?? []) {
    const starts = p.starts_on < from ? from : (p.starts_on as string);
    const item = { title: `“${p.title}”`, at: `${starts}T12:00:00Z`, day: dayName(new Date(`${starts}T12:00:00Z`), 'UTC'), plan: true };
    if (wanted.has(p.owner_id)) add(p.owner_id, { ...item, path: `/plans/${p.id}` });
    for (const j of (p.plan_joins ?? []) as { user_id: string }[]) {
      if (wanted.has(j.user_id)) add(j.user_id, { ...item, path: p.share_code ? `/p/${p.share_code}` : `/p/${p.id}` });
    }
  }
  for (const items of agenda.values()) items.sort((a, b) => a.at.localeCompare(b.at));
  return agenda;
}

/** "Bingo (Thu), “Saturday crawl” (Sat) and 2 more" */
function agendaLine(items: AgendaItem[]) {
  const shown = items.slice(0, 3).map((i) => `${i.title} (${i.day})`);
  return items.length > 3 ? `${shown.join(', ')} and ${items.length - 3} more` : listTitles(shown);
}

/** One thing opens it; several open the plans list or the saved list. */
const agendaPath = (items: AgendaItem[]) =>
  items.length === 1 ? items[0].path : items.some((i) => i.plan) ? '/plans' : '/account';

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

  // Plans starting tomorrow, for their owner and everyone who's in.
  const tomorrow = wichitaDate(1);
  const { data: plans, error: planError } = await db
    .from('plans')
    .select('id, title, owner_id, share_code, plan_items(count), plan_joins(user_id)')
    .eq('starts_on', tomorrow)
    .is('reminded_at', null);
  if (planError) throw new Error(planError.message);
  for (const p of plans ?? []) {
    const items = (p.plan_items as unknown as { count: number }[])[0]?.count ?? 0;
    if (!items) continue;
    const plan = { title: `your plan “${p.title}”`, starts_at: from, all_day: true, venue: `${items} thing${items === 1 ? '' : 's'} lined up`, path: `/plans/${p.id}` };
    add(p.owner_id, plan);
    for (const j of (p.plan_joins ?? []) as { user_id: string }[]) {
      add(j.user_id, { ...plan, title: `“${p.title}”`, path: p.share_code ? `/p/${p.share_code}` : `/p/${p.id}` });
    }
  }
  // Members who turned reminders off are still marked reminded below, so nothing arrives late.
  const allowed = new Set(await whoWants('reminders', [...byMember.keys()]));
  const messages = new Map<string, PushMessage>();
  for (const [member, events] of byMember) {
    if (!allowed.has(member)) continue;
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
  if (plans?.length) {
    await db.from('plans').update({ reminded_at: new Date().toISOString() }).in('id', plans.map((p) => p.id));
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
  // Today's question of the day, answered on the Today tab (+1 giveaway entry while one runs).
  const now = new Date().toISOString();
  const { data: questions } = await adminClient()
    .from('polls')
    .select('question')
    .eq('daily', true)
    .eq('published', true)
    .lte('starts_at', now)
    .gt('ends_at', now)
    .limit(1);
  const question = questions?.[0]?.question;
  if (!events.length && !question) return { skipped: 'no events or question today' };
  const picks = events.slice(0, 3).map((e) => e.title);
  const parts = [
    events.length ? `${events.length} thing${events.length === 1 ? '' : 's'} to do today, including ${listTitles(picks)}.` : '',
    question ? `Today's question: ${question}` : '',
  ];
  return await sendToTopic(adminClient(), 'daily', {
    title: 'Today in Wichita',
    body: parts.filter(Boolean).join(' '),
    data: { path: question ? '/' : '/events' },
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
  // Everyone with the weekend push on. Their own plans and saved events come first; picks by
  // interests fill in, leaving out events they saved or said they're not interested in.
  const ids = await membersWith('weekend');
  const agenda = await agendaFor(ids, 1, 3);
  if (!post && !events.length && !agenda.size) return { skipped: 'nothing to send' };
  const generic: PushMessage = {
    title: 'Your Wichita weekend guide is here',
    body: post
      ? post.title
      : `${events.length} things to do this weekend, including ${listTitles(events.slice(0, 2).map((e) => e.title))}.`,
    data: { topic: 'weekend', path: post ? '/explore' : '/events' },
  };

  const profiles = await forMembers<{ id: string; interests: string[] }>(ids, (batch) =>
    db.from('profiles').select('id, interests').in('id', batch),
  );
  const dismissed = await forMembers<{ user_id: string; event_id: string }>(ids, (batch) =>
    db.from('dismissed_events').select('user_id, event_id').in('user_id', batch),
  );
  const hidden = new Set(dismissed.map((d) => `${d.user_id}/${d.event_id}`));

  const messages = new Map<string, PushMessage>();
  let personalized = 0;
  let withPlans = 0;
  for (const p of profiles) {
    const mine = agenda.get(p.id) ?? [];
    const picks = events
      .filter((e) => !hidden.has(`${p.id}/${e.id}`) && !mine.some((m) => m.path === `/event/${e.id}`))
      .map((e) => ({ e, n: interestScore(e, p.interests ?? []) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.e.starts_at.localeCompare(b.e.starts_at))
      .slice(0, mine.length ? 2 : 3)
      .map((x) => x.e.title);
    if (picks.length) personalized++;
    if (mine.length) {
      withPlans++;
      messages.set(p.id, {
        title: 'Your Wichita weekend',
        body: `On your list: ${agendaLine(mine)}.${picks.length ? ` Also picked for you: ${listTitles(picks)}.` : ''}`,
        data: { topic: 'weekend', path: agendaPath(mine) },
      });
    } else if (picks.length) {
      messages.set(p.id, {
        title: 'Your Wichita weekend',
        body: `Picked for you: ${listTitles(picks)}. Make it a plan and send it to friends.`,
        data: { topic: 'weekend', path: '/' },
      });
    } else if (post || events.length) {
      messages.set(p.id, generic);
    }
  }
  if (!messages.size) return { personalized, withPlans, sent: 0, removed: 0 };
  return { personalized, withPlans, ...(await sendToMembers(db, messages)) };
}

/** Tuesday 5pm: a look at the week for members who have something coming up Wednesday to Sunday. */
async function week() {
  if (wichitaParts(new Date()).weekday !== 'Tue') return { skipped: 'not Tuesday' };
  const agenda = await agendaFor(await membersWith('reminders'), 1, 5);
  const messages = new Map<string, PushMessage>();
  for (const [member, items] of agenda) {
    messages.set(member, {
      title: 'Coming up this week',
      body: `${agendaLine(items)}.`,
      data: { topic: 'reminder', path: agendaPath(items) },
    });
  }
  if (!messages.size) return { members: 0, sent: 0, removed: 0 };
  return { members: messages.size, ...(await sendToMembers(adminClient(), messages)) };
}

async function members(ids: string[]) {
  return forMembers<{ id: string; interests: string[] }>(ids, (batch) =>
    adminClient().from('profiles').select('id, interests').in('id', batch),
  );
}

/**
 * Friday 4pm: three things for tonight, picked by interests when a member has them. Only for
 * members with nothing saved or planned for the weekend yet.
 */
async function tonight() {
  if (wichitaParts(new Date()).weekday !== 'Fri') return { skipped: 'not Friday' };
  const db = adminClient();
  // From 5pm tonight until 2am.
  const events = (await eventsBetween(new Date(wichitaMidnight(0).getTime() + 17 * 3_600_000), new Date(wichitaMidnight(1).getTime() + 2 * 3_600_000)))
    .filter((e) => !e.all_day);
  if (events.length < 3) return { skipped: 'not enough tonight' };
  const ids = await membersWith('tonight');
  const planned = await agendaFor(ids, 0, 2);
  const profiles = await members(ids.filter((id) => !planned.has(id)));
  const messages = new Map<string, PushMessage>();
  for (const p of profiles) {
    const ranked = events
      .map((e) => ({ e, n: interestScore(e, p.interests ?? []) }))
      .sort((a, b) => b.n - a.n || Number(b.e.is_sponsored) - Number(a.e.is_sponsored) || a.e.starts_at.localeCompare(b.e.starts_at))
      .slice(0, 3)
      .map((x) => `${x.e.title} (${timeLabel(x.e.starts_at, false)})`);
    messages.set(p.id, {
      title: 'Tonight in Wichita',
      body: `${listTitles(ranked)}. Add one to a plan and send it to your crew.`,
      data: { topic: 'weekend', path: '/events' },
    });
  }
  if (!messages.size) return { sent: 0, removed: 0 };
  return await sendToMembers(db, messages);
}

/** Someone said they're in on a plan: tell its owner. */
async function planJoin(planId?: string, memberId?: string) {
  if (!planId || !memberId) return { skipped: 'missing plan or member' };
  const db = adminClient();
  const [{ data: plan }, { data: who }] = await Promise.all([
    db.from('plans').select('id, title, owner_id').eq('id', planId).maybeSingle(),
    db.from('profiles').select('display_name').eq('id', memberId).maybeSingle(),
  ]);
  if (!plan) return { skipped: 'plan gone' };
  if (!(await whoWants('friends', [plan.owner_id as string])).length) return { skipped: 'friend notifications off' };
  const name = (who?.display_name ?? 'Someone').split(' ')[0];
  return await sendToMembers(
    db,
    new Map([[plan.owner_id as string, { title: `${name} is in!`, body: `${name} is in for “${plan.title}”.`, data: { topic: 'plan', path: `/plans/${plan.id}` } }]]),
  );
}

async function firstName(id: string) {
  const { data } = await adminClient().from('profiles').select('display_name').eq('id', id).maybeSingle();
  return (data?.display_name ?? 'Someone').split(' ')[0];
}

/** Friend requests, accepts, and someone adding you from your friend link. */
async function friend(kind?: string, from?: string, to?: string) {
  if (!kind || !from || !to) return { skipped: 'missing details' };
  const name = await firstName(from);
  const message: PushMessage =
    kind === 'request'
      ? { title: `${name} wants to be friends`, body: 'Tap to say yes on Wichita Life.', data: { topic: 'friends', path: '/friends' } }
      : kind === 'accepted'
        ? { title: `${name} said yes!`, body: 'You’re friends on Wichita Life now.', data: { topic: 'friends', path: '/friends' } }
        : { title: `${name} added you as a friend`, body: 'They used your friend link. See their plans on Wichita Life.', data: { topic: 'friends', path: '/friends' } };
  if (!(await whoWants('friends', [to])).length) return { skipped: 'friend notifications off' };
  return await sendToMembers(adminClient(), new Map([[to, message]]));
}

/** A friend sent you a plan. */
async function planSent(planId?: string, from?: string, to?: string[]) {
  if (!planId || !from || !to?.length) return { skipped: 'missing details' };
  const db = adminClient();
  const { data: plan } = await db.from('plans').select('id, title').eq('id', planId).maybeSingle();
  if (!plan) return { skipped: 'plan gone' };
  const name = await firstName(from);
  const message: PushMessage = {
    title: `${name} sent you a plan`,
    body: `“${plan.title}”. Tap “I’m in” if you’re coming.`,
    data: { topic: 'friends', path: `/p/${plan.id}` },
  };
  const recipients = await whoWants('friends', to);
  if (!recipients.length) return { skipped: 'friend notifications off' };
  return await sendToMembers(db, new Map(recipients.map((id) => [id, message])));
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);
  const body = (await req.json().catch(() => ({}))) as {
    job?: Job;
    force?: boolean;
    plan?: string;
    member?: string;
    kind?: string;
    from?: string;
    to?: string | string[];
  };
  const { job, force, plan, member } = body;
  if (!job || !(job in HOURS)) return json({ error: `job must be one of ${Object.keys(HOURS).join(', ')}` }, 400);
  const hour = HOURS[job];
  if (!force && hour !== null && wichitaParts(new Date()).h !== hour) return json({ skipped: 'not the right hour in Wichita' });
  // Scheduled pushes go out once a day, even if this runs twice (a retry, or a manual run with force).
  const once = hour !== null ? `${job}:${wichitaDate(0)}` : null;
  const db = adminClient();
  if (once) {
    const { data: claimed, error } = await db.rpc('claim_send', { k: once });
    if (error) return json({ error: error.message }, 500);
    if (!claimed) return json({ job, skipped: 'already sent today' });
  }
  try {
    const run = {
      reminders,
      week,
      daily,
      weekend,
      tonight,
      plan_join: () => planJoin(plan, member),
      friend: () => friend(body.kind, body.from, typeof body.to === 'string' ? body.to : undefined),
      plan_sent: () => planSent(plan, body.from, Array.isArray(body.to) ? body.to : undefined),
    }[job];
    const result = await run();
    // A job that skipped (e.g. Thursday's daily) didn't send, so it doesn't use up the day.
    if (once && 'skipped' in result) await db.rpc('release_send', { k: once });
    return json({ job, ...result });
  } catch (e) {
    if (once) await db.rpc('release_send', { k: once });
    return json({ error: (e as Error).message }, 500);
  }
});
