import { dedupeEvents } from '@/lib/events';
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
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
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
export async function getNews(limit = 10): Promise<NewsItem[]> {
  const { data, error } = await db()
    .from('news_items')
    .select('id, source_name, title, url, published_at')
    .eq('hidden', false)
    .eq('filtered', false)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
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
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUpcomingMeetups(): Promise<Meetup[]> {
  const { data, error } = await db()
    .from('meetups')
    .select('id, title, description, starts_at, area, capacity, going_count')
    .eq('status', 'open')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return data.map(({ going_count, ...m }) => ({ ...m, going: going_count }));
}

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await db().from('groups').select('id, slug, name, description, member_count').order('name');
  if (error) throw error;
  return data.map(({ member_count, ...g }) => ({ ...g, members: member_count }));
}

export async function getThreads(limit = 30): Promise<Thread[]> {
  const { data, error } = await db()
    .from('threads')
    .select('id, author_id, category, title, body, status, created_at, reply_count, author:profiles!threads_author_id_fkey(display_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(({ author, reply_count, ...t }) => {
    const a = (Array.isArray(author) ? author[0] : author) as { display_name: string } | null;
    return { ...t, author_name: a?.display_name || 'Member', replies: reply_count };
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
