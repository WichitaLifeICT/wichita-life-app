import { supabase } from '@/lib/supabase';
import type {
  EventItem,
  Giveaway,
  Group,
  Job,
  Meetup,
  NewsItem,
  Post,
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

function countMap<T extends Record<string, unknown>>(rows: T[] | null, key: keyof T, value: keyof T) {
  return new Map((rows ?? []).map((r) => [r[key] as string, Number(r[value] ?? 0)]));
}

export async function getPosts(limit = 30): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getUpcomingEvents(limit = 100): Promise<EventItem[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from('events')
    .select('*')
    .gte('starts_at', startOfToday.toISOString())
    .order('starts_at')
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getEvent(id: string): Promise<EventItem | null> {
  const { data, error } = await db().from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getNews(limit = 10): Promise<NewsItem[]> {
  const { data, error } = await db()
    .from('news_items')
    .select('id, source_name, title, url, published_at')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getJobs(limit = 5): Promise<Job[]> {
  const { data, error } = await db()
    .from('jobs')
    .select('id, title, company, url, pay_text')
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
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUpcomingMeetups(): Promise<Meetup[]> {
  const client = db();
  const [{ data, error }, counts] = await Promise.all([
    client
      .from('meetups')
      .select('id, title, description, starts_at, area, capacity')
      .eq('status', 'open')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at'),
    client.from('meetup_counts').select('meetup_id, going'),
  ]);
  if (error) throw error;
  if (counts.error) throw counts.error;
  const going = countMap(counts.data, 'meetup_id', 'going');
  return data.map((m) => ({ ...m, going: going.get(m.id) ?? 0 }));
}

export async function getGroups(): Promise<Group[]> {
  const client = db();
  const [{ data, error }, counts] = await Promise.all([
    client.from('groups').select('id, slug, name, description').order('name'),
    client.from('group_counts').select('group_id, members'),
  ]);
  if (error) throw error;
  if (counts.error) throw counts.error;
  const members = countMap(counts.data, 'group_id', 'members');
  return data.map((g) => ({ ...g, members: members.get(g.id) ?? 0 }));
}

export async function getThreads(limit = 30): Promise<Thread[]> {
  const client = db();
  const [{ data, error }, counts] = await Promise.all([
    client
      .from('threads')
      .select('id, category, title, body, status, created_at, author:profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    client.from('thread_reply_counts').select('thread_id, replies'),
  ]);
  if (error) throw error;
  if (counts.error) throw counts.error;
  const replies = countMap(counts.data, 'thread_id', 'replies');
  return data.map(({ author, ...t }) => {
    const a = (Array.isArray(author) ? author[0] : author) as { display_name: string } | null;
    return { ...t, author_name: a?.display_name || 'Member', replies: replies.get(t.id) ?? 0 };
  });
}

export async function getActiveGiveaway(): Promise<Giveaway | null> {
  const client = db();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('giveaways')
    .select('id, title, prize, description, sponsor_name, ends_at, rules_url')
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('ends_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const counts = await client.from('giveaway_counts').select('entrants').eq('giveaway_id', data.id).maybeSingle();
  if (counts.error) throw counts.error;
  return { ...data, entrants: counts.data?.entrants ?? 0 };
}
