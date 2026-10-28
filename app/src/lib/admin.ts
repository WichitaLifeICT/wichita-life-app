/**
 * Staff tools. These use the signed-in staff member's session; the database's staff
 * rules (private.is_staff()) are what actually allow them, so members get nothing here.
 */
import type { Activity } from '@/lib/activities';
import { supabase } from '@/lib/supabase';
import type { PostKind, ThreadCategory } from '@/lib/types';
import type { Place } from '@/lib/places';
import type { WeeklySpecial } from '@/lib/weekly';
import { CLUB_FIELDS, type Club } from '@/lib/clubs';

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
  group: { name: string } | null;
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
        'id, author_id, category, title, body, status, created_at, author:profiles!threads_author_id_fkey(display_name), group:groups(name)',
      )
      .eq('status', status)
      .order('created_at', { ascending: status === 'pending' })
      .limit(50),
  );
  return rows.map(({ author, group, ...t }) => {
    const a = (Array.isArray(author) ? author[0] : author) as { display_name: string } | null;
    const g = (Array.isArray(group) ? group[0] : group) as { name: string } | null;
    return { ...t, author_name: a?.display_name || 'Member', group: g ?? null } as ReviewThread;
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
  prize_value: number | null;
  prize_provider: string | null;
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
        'id, title, prize, description, sponsor_name, prize_value, prize_provider, starts_at, ends_at, rules_url, entrant_count, winner_user_id',
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
  signup_url: string | null;
  source_key: string | null;
  group_id: string | null;
  details: { venue: string; address: string | null; host_notes: string | null } | null;
};

export type MeetupInput = {
  title: string;
  description: string | null;
  starts_at: string;
  area: string;
  capacity: number;
  status: AdminMeetup['status'];
  signup_url: string | null;
  group_id: string | null;
  venue: string;
  address: string | null;
  host_notes: string | null;
};

export async function getMeetups(): Promise<AdminMeetup[]> {
  const rows = check(
    await db()
      .from('meetups')
      .select(
        'id, title, description, starts_at, area, capacity, status, going_count, waitlist_count, signup_url, source_key, group_id, details:meetup_private(venue, address, host_notes)',
      )
      .order('starts_at', { ascending: false })
      .limit(40),
  );
  return rows.map((m) => ({
    ...m,
    details: (Array.isArray(m.details) ? m.details[0] : m.details) ?? null,
  })) as AdminMeetup[];
}

/** Saves a meetup and returns its id. */
export async function saveMeetup(input: MeetupInput, id?: string) {
  const { venue, address, host_notes, ...meetup } = input;
  let meetupId = id;
  if (id) check(await db().from('meetups').update(meetup).eq('id', id));
  else meetupId = check<{ id: string }>(await db().from('meetups').insert(meetup).select('id').single()).id;
  check(await db().from('meetup_private').upsert({ meetup_id: meetupId, venue, address, host_notes }));
  return meetupId!;
}

export async function getAttendees(meetupId: string): Promise<(Person & { status: 'going' | 'waitlist' })[]> {
  return check(await db().rpc('meetup_attendees', { meetup: meetupId }));
}

// Stories -----------------------------------------------------------------------

export type AdminPost = {
  id: string;
  title: string;
  kind: PostKind;
  featured: boolean;
  hidden: boolean;
  published_at: string;
};

export async function getRecentPosts(): Promise<AdminPost[]> {
  return check(
    await db()
      .from('posts')
      .select('id, title, kind, featured, hidden, published_at')
      .order('published_at', { ascending: false })
      .limit(30),
  );
}

/** Only one story is featured at a time. */
export async function setFeatured(postId: string, featured: boolean) {
  if (featured) check(await db().from('posts').update({ featured: false }).eq('featured', true));
  check(await db().from('posts').update({ featured }).eq('id', postId));
}

/** Hidden posts don't show anywhere in the app; the newsletter sync leaves this alone. */
export async function setPostHidden(postId: string, hidden: boolean) {
  check(await db().from('posts').update({ hidden, ...(hidden ? { featured: false } : {}) }).eq('id', postId));
}

export async function setPostKind(postId: string, kind: PostKind) {
  check(await db().from('posts').update({ kind }).eq('id', postId));
}

// Push --------------------------------------------------------------------------

export type PushTopic = 'daily' | 'giveaways' | 'weekend' | 'breaking';

/** Sends to everyone with this topic on, or only those who picked one of these interests. */
export async function sendPush(topic: PushTopic, title: string, body: string, interests: string[] = []) {
  const { data, error } = await db().functions.invoke('send-push', { body: { topic, title, body, interests } });
  if (error) throw error;
  return data as { sent: number };
}

/** Sends a push to everyone in a Wichita Life group. */
export async function sendGroupPush(groupId: string, title: string, body: string, data?: Record<string, unknown>) {
  const { data: result, error } = await db().functions.invoke('send-push', { body: { group: groupId, title, body, data } });
  if (error) throw error;
  return result as { sent: number };
}

/** How many phones a push to a group's members would reach. */
export async function groupPushAudience(groupId: string): Promise<number> {
  return check(await db().rpc('group_push_audience', { target: groupId }));
}

/** Who joined a group, newest first. */
export async function getGroupMembers(
  groupId: string,
): Promise<{ user_id: string; display_name: string | null; email: string; joined_at: string }[]> {
  return check(await db().rpc('group_member_list', { target: groupId }));
}

/** How many phones a push would reach. */
export async function pushAudience(topic: PushTopic, interests: string[]): Promise<number> {
  return check(await db().rpc('push_audience', { topic, interests }));
}

// Feedback -----------------------------------------------------------------------

export type FeedbackStatus = 'new' | 'read' | 'done';

export type FeedbackItem = {
  id: string;
  kind: 'idea' | 'bug' | 'love' | 'other' | 'spotlight';
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

// Polls ---------------------------------------------------------------------------

export type AdminPollOption = { id: string; label: string; status: 'pending' | 'approved' | 'removed' };

export type AdminPoll = {
  id: string;
  question: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  published: boolean;
  allow_suggestions: boolean;
  /** Question of the day on Today (one day long) rather than a Wichita vote on Explore. */
  daily: boolean;
  vote_count: number;
  options: AdminPollOption[];
};

export type PollInput = Omit<AdminPoll, 'id' | 'vote_count' | 'options'>;

export async function getAdminPolls(): Promise<AdminPoll[]> {
  return check(
    await db()
      .from('polls')
      .select(
        'id, question, description, starts_at, ends_at, published, allow_suggestions, daily, vote_count, options:poll_options(id, label, status)',
      )
      .order('ends_at', { ascending: false })
      .limit(20),
  );
}

/** Saves the poll and adds any new options (one per line in the form). */
export async function savePoll(input: PollInput, newOptions: string[], id?: string) {
  let pollId = id;
  if (id) check(await db().from('polls').update(input).eq('id', id));
  else pollId = check<{ id: string }>(await db().from('polls').insert(input).select('id').single()).id;
  if (newOptions.length)
    check(await db().from('poll_options').insert(newOptions.map((label) => ({ poll_id: pollId, label }))));
}

export async function setPollOptionStatus(id: string, status: AdminPollOption['status']) {
  check(await db().from('poll_options').update({ status }).eq('id', id));
}

export async function countPendingSuggestions(): Promise<number> {
  const { count, error } = await db()
    .from('poll_options')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Groups ---------------------------------------------------------------------------

export type AdminGroup = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  member_count: number;
  pending: boolean;
};

export async function getAdminGroups(): Promise<AdminGroup[]> {
  return check(await db().from('groups').select('id, slug, name, description, member_count, pending').order('name'));
}

export async function saveGroup(
  input: { name: string; slug: string; description: string | null; pending?: boolean },
  id?: string,
) {
  if (id) check(await db().from('groups').update(input).eq('id', id));
  else check(await db().from('groups').insert(input));
}

export async function deleteGroup(id: string) {
  check(await db().from('groups').delete().eq('id', id));
}

// Sponsors -------------------------------------------------------------------------

export type AdminSponsor = {
  id: string;
  name: string;
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string;
  ends_at: string;
};

export type SponsorInput = Omit<AdminSponsor, 'id'>;

export async function getAdminSponsors(): Promise<AdminSponsor[]> {
  return check(
    await db()
      .from('sponsors')
      .select('id, name, headline, body, cta_label, cta_url, starts_at, ends_at')
      .order('starts_at', { ascending: false })
      .limit(30),
  );
}

export async function saveSponsor(input: SponsorInput, id?: string) {
  if (id) check(await db().from('sponsors').update(input).eq('id', id));
  else check(await db().from('sponsors').insert(input));
}

export async function deleteSponsor(id: string) {
  check(await db().from('sponsors').delete().eq('id', id));
}

// Weekly specials ------------------------------------------------------------------

export type WeeklyInput = Omit<WeeklySpecial, 'id'>;

export async function getAdminWeekly(): Promise<WeeklySpecial[]> {
  return check(
    await db()
      .from('weekly_specials')
      .select('id, kind, title, venue, address, days, starts, ends, details, url, active, verified_on, pending')
      .order('venue'),
  );
}

export async function saveWeekly(input: WeeklyInput, id?: string) {
  if (id) check(await db().from('weekly_specials').update(input).eq('id', id));
  else check(await db().from('weekly_specials').insert(input));
}

export async function deleteWeekly(id: string) {
  check(await db().from('weekly_specials').delete().eq('id', id));
}

// Activities ("What should we do?") ---------------------------------------------------

export type ActivityInput = Omit<Activity, 'id'>;

export async function getAdminActivities(): Promise<Activity[]> {
  return check(
    await db().from('activities').select('id, name, kinds, blurb, address, website, months, active, sort').order('sort').order('name'),
  );
}

export async function saveActivity(input: ActivityInput, id?: string) {
  if (id) check(await db().from('activities').update(input).eq('id', id));
  else check(await db().from('activities').insert(input));
}

export async function deleteActivity(id: string) {
  check(await db().from('activities').delete().eq('id', id));
}

// Restaurants (places to eat) ---------------------------------------------------------

export async function getAdminPlaces(): Promise<Place[]> {
  const all: Place[] = [];
  // More than the API's 1,000-row page, so read in pages.
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await db()
        .from('places')
        .select('id, name, kind, cuisine, categories, address, website, phone, opening_hours, chain, status, local_pick, note, source')
        .order('name')
        .range(from, from + 999),
    ) as Place[];
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

export async function updatePlace(id: string, fields: Partial<Pick<Place, 'chain' | 'status' | 'local_pick' | 'note' | 'categories'>>) {
  check(await db().from('places').update(fields).eq('id', id));
}

export async function addPlace(fields: Pick<Place, 'name' | 'kind' | 'categories' | 'address' | 'website' | 'note' | 'local_pick'>) {
  check(await db().from('places').insert({ ...fields, chain: false, source: 'staff' }));
}

// Clubs ----------------------------------------------------------------------------

export async function getAdminClubs(): Promise<Club[]> {
  return check(await db().from('clubs').select(CLUB_FIELDS).order('name'));
}

export async function saveClub(input: Omit<Club, 'id' | 'last_post_on'>, id?: string) {
  if (id) check(await db().from('clubs').update(input).eq('id', id));
  else check(await db().from('clubs').insert(input));
}

export async function deleteClub(id: string) {
  check(await db().from('clubs').delete().eq('id', id));
}

export type ClubUpdate = {
  id: string;
  club_id: string;
  received_at: string;
  last_post_on: string | null;
  still_meets: boolean | null;
  schedule: string | null;
  notes: string | null;
};

/** What the club-checking bot reported that needs a person: schedule changes and "stopped meeting". */
export async function getClubUpdates(): Promise<ClubUpdate[]> {
  return check(
    await db()
      .from('club_updates')
      .select('id, club_id, received_at, last_post_on, still_meets, schedule, notes')
      .eq('status', 'pending')
      .order('received_at', { ascending: false }),
  );
}

/** Applies a report: the new schedule, and hides the club if it stopped meeting. */
export async function applyClubUpdate(u: ClubUpdate) {
  const changes: Record<string, unknown> = { verified_on: new Date().toISOString().slice(0, 10) };
  if (u.schedule) changes.schedule = u.schedule;
  if (u.still_meets === false) changes.active = false;
  check(await db().from('clubs').update(changes).eq('id', u.club_id));
  check(await db().from('club_updates').update({ status: 'applied' }).eq('id', u.id));
}

export async function dismissClubUpdate(id: string) {
  check(await db().from('club_updates').update({ status: 'dismissed' }).eq('id', id));
}

/** The bot's private link (staff only). */
export async function getClubUpdatesLink(): Promise<string> {
  return check(await db().rpc('club_updates_link'));
}
