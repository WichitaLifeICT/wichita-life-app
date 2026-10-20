/**
 * Staff tools. These use the signed-in staff member's session; the database's staff
 * rules (private.is_staff()) are what actually allow them, so members get nothing here.
 */
import { supabase } from '@/lib/supabase';
import type { PostKind, ThreadCategory } from '@/lib/types';

function db() {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  return supabase;
}

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// Community board ---------------------------------------------------------------

export type ReviewThread = {
  id: string;
  author_id: string;
  category: ThreadCategory;
  title: string;
  body: string;
  status: 'pending' | 'approved' | 'removed';
  created_at: string;
  author_name: string;
};

export type OpenReport = {
  id: string;
  reason: string;
  created_at: string;
  thread: { id: string; title: string; body: string; status: string } | null;
  reply: { id: string; body: string; status: string } | null;
};

export async function getThreadsForReview(status: 'pending' | 'approved'): Promise<ReviewThread[]> {
  const rows = check(
    await db()
      .from('threads')
      .select(
        'id, author_id, category, title, body, status, created_at, author:profiles!threads_author_id_fkey(display_name)',
      )
      .eq('status', status)
      .order('created_at', { ascending: status === 'pending' })
      .limit(50),
  );
  return rows.map(({ author, ...t }) => {
    const a = (Array.isArray(author) ? author[0] : author) as { display_name: string } | null;
    return { ...t, author_name: a?.display_name || 'Member' } as ReviewThread;
  });
}

export async function setThreadStatus(id: string, status: 'approved' | 'removed') {
  const { data } = await db().auth.getSession();
  check(
    await db()
      .from('threads')
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: data.session?.user.id })
      .eq('id', id),
  );
}

export async function getOpenReports(): Promise<OpenReport[]> {
  const rows = check(
    await db()
      .from('reports')
      .select('id, reason, created_at, thread:threads(id, title, body, status), reply:replies(id, body, status)')
      .eq('resolved', false)
      .order('created_at'),
  );
  return rows.map((r) => ({
    ...r,
    thread: (Array.isArray(r.thread) ? r.thread[0] : r.thread) ?? null,
    reply: (Array.isArray(r.reply) ? r.reply[0] : r.reply) ?? null,
  })) as OpenReport[];
}

export async function resolveReport(id: string, removeContent: boolean, report: OpenReport) {
  if (removeContent && report.thread) await setThreadStatus(report.thread.id, 'removed');
  if (removeContent && report.reply)
    check(await db().from('replies').update({ status: 'removed' }).eq('id', report.reply.id));
  check(await db().from('reports').update({ resolved: true }).eq('id', id));
}

// Giveaways ---------------------------------------------------------------------

export type AdminGiveaway = {
  id: string;
  title: string;
  prize: string;
  description: string | null;
  sponsor_name: string | null;
  starts_at: string;
  ends_at: string;
  rules_url: string;
  entrant_count: number;
  winner_user_id: string | null;
};

export type GiveawayInput = Omit<AdminGiveaway, 'id' | 'entrant_count' | 'winner_user_id'>;
export type Person = { user_id: string; display_name: string; email: string };

export async function getGiveaways(): Promise<AdminGiveaway[]> {
  return check(
    await db()
      .from('giveaways')
      .select(
        'id, title, prize, description, sponsor_name, starts_at, ends_at, rules_url, entrant_count, winner_user_id',
      )
      .order('starts_at', { ascending: false })
      .limit(30),
  );
}

export async function saveGiveaway(input: GiveawayInput, id?: string) {
  if (id) check(await db().from('giveaways').update(input).eq('id', id));
  else check(await db().from('giveaways').insert(input));
}

export async function drawWinner(giveawayId: string): Promise<Person & { entries: number }> {
  const rows = check(await db().rpc('draw_giveaway_winner', { giveaway: giveawayId }));
  return rows[0];
}

export async function getWinner(giveawayId: string): Promise<(Person & { entries: number }) | null> {
  const rows = check(await db().rpc('giveaway_winner', { giveaway: giveawayId }));
  return rows[0] ?? null;
}

// Meetups -----------------------------------------------------------------------

export type AdminMeetup = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  area: string;
  capacity: number;
  status: 'draft' | 'open' | 'closed' | 'canceled';
  going_count: number;
  waitlist_count: number;
  details: { venue: string; address: string | null; host_notes: string | null } | null;
};

export type MeetupInput = {
  title: string;
  description: string | null;
  starts_at: string;
  area: string;
  capacity: number;
  status: AdminMeetup['status'];
  venue: string;
  address: string | null;
  host_notes: string | null;
};

export async function getMeetups(): Promise<AdminMeetup[]> {
  const rows = check(
    await db()
      .from('meetups')
      .select(
        'id, title, description, starts_at, area, capacity, status, going_count, waitlist_count, details:meetup_private(venue, address, host_notes)',
      )
      .order('starts_at', { ascending: false })
      .limit(40),
  );
  return rows.map((m) => ({
    ...m,
    details: (Array.isArray(m.details) ? m.details[0] : m.details) ?? null,
  })) as AdminMeetup[];
}

export async function saveMeetup(input: MeetupInput, id?: string) {
  const { venue, address, host_notes, ...meetup } = input;
  let meetupId = id;
  if (id) check(await db().from('meetups').update(meetup).eq('id', id));
  else meetupId = check<{ id: string }>(await db().from('meetups').insert(meetup).select('id').single()).id;
  check(await db().from('meetup_private').upsert({ meetup_id: meetupId, venue, address, host_notes }));
}

export async function getAttendees(meetupId: string): Promise<(Person & { status: 'going' | 'waitlist' })[]> {
  return check(await db().rpc('meetup_attendees', { meetup: meetupId }));
}

// Stories -----------------------------------------------------------------------

export type AdminPost = { id: string; title: string; kind: PostKind; featured: boolean; published_at: string };

export async function getRecentPosts(): Promise<AdminPost[]> {
  return check(
    await db()
      .from('posts')
      .select('id, title, kind, featured, published_at')
      .order('published_at', { ascending: false })
      .limit(30),
  );
}

/** Only one story is featured at a time. */
export async function setFeatured(postId: string, featured: boolean) {
  if (featured) check(await db().from('posts').update({ featured: false }).eq('featured', true));
  check(await db().from('posts').update({ featured }).eq('id', postId));
}

export async function setPostKind(postId: string, kind: PostKind) {
  check(await db().from('posts').update({ kind }).eq('id', postId));
}

// Push --------------------------------------------------------------------------

export type PushTopic = 'daily' | 'giveaways' | 'weekend' | 'breaking';

export async function sendPush(topic: PushTopic, title: string, body: string) {
  const { data, error } = await db().functions.invoke('send-push', { body: { topic, title, body } });
  if (error) throw error;
  return data as { sent: number };
}

// Feedback -----------------------------------------------------------------------

export type FeedbackStatus = 'new' | 'read' | 'done';

export type FeedbackItem = {
  id: string;
  kind: 'idea' | 'bug' | 'love' | 'other';
  message: string;
  status: FeedbackStatus;
  staff_note: string | null;
  screen: string | null;
  platform: string | null;
  app_version: string | null;
  created_at: string;
  sender_name: string;
  reply_email: string | null;
};

export async function getFeedback(status: FeedbackStatus | 'all'): Promise<FeedbackItem[]> {
  return check(await db().rpc('feedback_inbox', { want_status: status }));
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus) {
  check(await db().from('feedback').update({ status }).eq('id', id));
}
