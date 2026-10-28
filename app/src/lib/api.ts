import { dedupeEvents } from '@/lib/events';
import { startOfWichitaDay } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type {
  EventItem,
  Guide,
  Giveaway,
  Group,
  Job,
  Meetup,
  NewsItem,
  Post,
  Reply,
  Sponsor,
  Thread,
} from '@/lib/types';

/** Thrown when the app runs without Supabase settings, so screens can explain what's missing. */
export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase is not connected yet.');
  }
}

function db() {
  if (!supabase) throw new NotConfiguredError();
  return supabase;
}

export async function getPosts(limit = 30): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select('*')
    // Staff can see hidden posts (in Stories), so filter them here too.
    .eq('hidden', false)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getGuides(): Promise<Guide[]> {
  const { data, error } = await db()
    .from('guides')
    .select('id, slug, title, summary, image_url, url, position, updated_at')
    .eq('active', true)
    .order('position');
  if (error) throw error;
  return data;
}

export async function getUpcomingEvents(limit = 100): Promise<EventItem[]> {
  const startOfToday = startOfWichitaDay();
  const { data, error } = await db()
    .from('events')
    .select('*')
    .eq('hidden', false)
    .gte('starts_at', startOfToday.toISOString())
    .order('starts_at')
    .limit(limit);
  if (error) throw error;
  return dedupeEvents(data);
}

export async function getEvent(id: string): Promise<EventItem | null> {
  const { data, error } = await db().from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Staff accounts can also read hidden and filtered rows (for Staff tools), so the
// public lists below filter them out explicitly rather than relying on access rules.
/** Feeds sometimes send HTML entities in titles ("&#039;"). */
const decodeTitle = (s: string) =>
  s
    .replace(/&#0*39;|&#x0*27;|&apos;|&rsquo;/gi, '’')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ');

export async function getNews(limit = 10): Promise<NewsItem[]> {
  const { data, error } = await db()
    .from('news_items')
    .select('id, source_name, title, url, published_at')
    .eq('hidden', false)
    .eq('filtered', false)
    .order('published_at', { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  // Outlets often post the same story twice under different links; show it once.
  const seen = new Set<string>();
  return data
    .map((n) => ({ ...n, title: decodeTitle(n.title) }))
    .filter((n) => {
      const key = n.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export async function getJobs(limit = 5): Promise<Job[]> {
  const { data, error } = await db()
    .from('jobs')
    .select('id, title, company, url, pay_text, location, job_type, posted_at')
    .eq('active', true)
    .order('posted_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getActiveSponsor(): Promise<Sponsor | null> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('sponsors')
    .select('id, name, headline, body, cta_label, cta_url')
    .lte('starts_at', now)
    .gte('ends_at', now)
    // If two overlap, the one that started most recently wins.
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const MEETUP_FIELDS = 'id, title, description, starts_at, area, capacity, going_count, signup_url, group:groups(name, slug)';

type MeetupRow = Omit<Meetup, 'going' | 'group'> & { going_count: number; group: unknown };
const toMeetup = ({ going_count, group, ...m }: MeetupRow): Meetup => ({
  ...m,
  going: going_count,
  group: ((Array.isArray(group) ? group[0] : group) as Meetup['group']) ?? null,
});

/** Upcoming open meetups, optionally only one group's. */
export async function getUpcomingMeetups(groupId?: string): Promise<Meetup[]> {
  let q = db().from('meetups').select(MEETUP_FIELDS).eq('status', 'open').gte('starts_at', new Date().toISOString());
  if (groupId) q = q.eq('group_id', groupId);
  const { data, error } = await q.order('starts_at');
  if (error) throw error;
  return (data as MeetupRow[]).map(toMeetup);
}

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await db()
    .from('groups')
    .select('id, slug, name, description, member_count')
    .eq('pending', false)
    .order('name');
  if (error) throw error;
  return data.map(({ member_count, ...g }) => ({ ...g, members: member_count }));
}

export async function getGroup(slug: string): Promise<Group | null> {
  const { data, error } = await db()
    .from('groups')
    .select('id, slug, name, description, member_count')
    .eq('slug', slug)
    .eq('pending', false)
    .maybeSingle();
  if (error) throw error;
  return data && { id: data.id, slug: data.slug, name: data.name, description: data.description, members: data.member_count };
}

const THREAD_FIELDS =
  'id, author_id, category, title, body, status, created_at, reply_count, author:profiles!threads_author_id_fkey(display_name), group:groups(name, slug)';

const one = <T>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null;

function toThread({ author, reply_count, group, ...t }: Record<string, unknown>): Thread {
  const a = one(author as { display_name: string } | null);
  return {
    ...(t as Omit<Thread, 'author_name' | 'replies' | 'group'>),
    author_name: a?.display_name || 'Member',
    replies: reply_count as number,
    group: one(group as Thread['group']),
  };
}

/** Board posts, newest first: the whole board, or one group's board. */
export async function getThreads(limit = 30, groupId?: string): Promise<Thread[]> {
  let q = db().from('threads').select(THREAD_FIELDS);
  if (groupId) q = q.eq('group_id', groupId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data.map(toThread);
}

export async function getThread(id: string): Promise<Thread | null> {
  const { data, error } = await db().from('threads').select(THREAD_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toThread(data) : null;
}

/** Replies on a post, oldest first. Only signed-in members can see names. */
export async function getReplies(threadId: string): Promise<Reply[]> {
  const { data, error } = await db()
    .from('replies')
    .select('id, thread_id, author_id, body, created_at, author:profiles(display_name)')
    .eq('thread_id', threadId)
    .eq('status', 'approved')
    .order('created_at');
  if (error) throw error;
  return data.map(({ author, ...r }) => {
    const a = (Array.isArray(author) ? author[0] : author) as { display_name: string } | null;
    return { ...r, author_name: a?.display_name || 'Member' };
  });
}

export async function getActiveGiveaway(): Promise<Giveaway | null> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('giveaways')
    .select('id, title, prize, description, sponsor_name, ends_at, rules_url, entrant_count')
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('ends_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { entrant_count, ...g } = data;
  return { ...g, entrants: entrant_count };
}
