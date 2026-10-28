/** Local clubs that already exist around town (run clubs, board game groups…), each with a link. */
import { supabase } from '@/lib/supabase';

export type ClubCategory = 'run' | 'games' | 'books' | 'sports' | 'social' | 'arts' | 'professional' | 'other';

export const CLUB_CATEGORIES: { id: ClubCategory; label: string }[] = [
  { id: 'run', label: 'Run clubs' },
  { id: 'games', label: 'Games' },
  { id: 'books', label: 'Books' },
  { id: 'sports', label: 'Sports' },
  { id: 'social', label: 'Social' },
  { id: 'arts', label: 'Arts & music' },
  { id: 'professional', label: 'Professional' },
  { id: 'other', label: 'Other' },
];
export const CLUB_LABEL = Object.fromEntries(CLUB_CATEGORIES.map((c) => [c.id, c.label])) as Record<ClubCategory, string>;

export type Club = {
  id: string;
  name: string;
  category: ClubCategory;
  description: string | null;
  schedule: string | null;
  url: string;
  active: boolean;
  pending: boolean;
  verified_on: string | null;
  /** Pinned clubs (higher first) lead the list. */
  priority: number;
  /** Their latest Facebook/Instagram post, as reported by the club-checking bot. */
  last_post_on: string | null;
};

export const CLUB_FIELDS = 'id, name, category, description, schedule, url, active, pending, verified_on, priority, last_post_on';

function db() {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  return supabase;
}

/** Clubs whose latest post is older than this aren't shown (clubs not checked yet still are). */
export const ACTIVE_DAYS = 60;

export async function getClubs(): Promise<Club[]> {
  const since = new Date(Date.now() - ACTIVE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db()
    .from('clubs')
    .select(CLUB_FIELDS)
    .eq('active', true)
    .eq('pending', false)
    .or(`last_post_on.is.null,last_post_on.gte.${since}`)
    .order('name');
  if (error) throw error;
  // Pinned clubs first, then grouped by category (run clubs first), then by name.
  const order = (c: Club) => CLUB_CATEGORIES.findIndex((x) => x.id === c.category);
  return (data as Club[]).sort(
    (a, b) => b.priority - a.priority || order(a) - order(b) || a.name.localeCompare(b.name),
  );
}

/** "instagram.com" → "Instagram", so the button says where it goes. */
export function linkLabel(url: string) {
  const host = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  if (host.includes('instagram')) return 'Instagram';
  if (host.includes('facebook')) return 'Facebook';
  if (host.includes('meetup')) return 'Meetup';
  return 'Website';
}

/** Adds https:// when someone types "instagram.com/club". */
export function normalizeUrl(input: string) {
  const url = input.trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function userId() {
  const { data } = await db().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Sign in first');
  return id;
}

const LIMIT = 'That’s the limit for today. Thanks for all the ideas!';

/** A member tells us about an existing club; staff approve it before it shows. */
export async function suggestClub(input: Pick<Club, 'name' | 'category' | 'description' | 'schedule' | 'url'>) {
  const { error } = await db()
    .from('clubs')
    .insert({ ...input, pending: true, active: false, suggested_by: await userId() });
  if (error?.code === '42501') throw new Error(LIMIT);
  if (error) throw error;
}

/** A member proposes a new Wichita Life interest group; staff approve it before it shows. */
export async function suggestGroup(name: string, description: string) {
  const slug = `${name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await db()
    .from('groups')
    .insert({ name, description, slug, pending: true, suggested_by: await userId() });
  if (error?.code === '42501') throw new Error(LIMIT);
  if (error) throw error;
}

/** "Active · posted Oct 19" when the club posted in the last ACTIVE_DAYS (`today` passed in from loaders). */
export function activeLabel(c: Club, today: number) {
  if (!c.last_post_on) return null;
  const posted = Date.parse(`${c.last_post_on}T12:00:00`);
  if (today - posted > ACTIVE_DAYS * 86_400_000) return null;
  return `Active · posted ${new Date(posted).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })}`;
}
