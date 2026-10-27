/**
 * Things to do for Explore's "What should we do?" picker. The list lives in the database
 * (`activities`) and is edited in Staff tools → Activities.
 */
import { supabase } from '@/lib/supabase';

export type Activity = {
  id: string;
  name: string;
  kinds: ActivityKind[];
  blurb: string;
  address: string;
  website?: string | null;
  /** Months it's open (1 = January). Left out for year-round spots; seasonal ones only come up in season. */
  months?: number[] | null;
  active?: boolean;
  sort?: number;
};

export type ActivityKind =
  | 'golf'
  | 'bowling'
  | 'arcade'
  | 'minigolf'
  | 'karts'
  | 'pickleball'
  | 'animals'
  | 'museums'
  | 'creative'
  | 'active'
  | 'outdoors'
  | 'daytrip'
  | 'movies';

export const ACTIVITY_KINDS: { id: ActivityKind; label: string }[] = [
  { id: 'golf', label: '⛳ Golf' },
  { id: 'pickleball', label: '🏓 Pickleball' },
  { id: 'animals', label: '🦒 Animals' },
  { id: 'minigolf', label: '🏌️ Mini golf' },
  { id: 'bowling', label: '🎳 Bowling' },
  { id: 'arcade', label: '🕹️ Arcades' },
  { id: 'karts', label: '🏎️ Racing & go-karts' },
  { id: 'museums', label: '🏛️ Museums' },
  { id: 'creative', label: '🎨 Make something' },
  { id: 'active', label: '🤸 Jump & climb' },
  { id: 'outdoors', label: '🌳 Outdoors' },
  { id: 'movies', label: '🍿 Movies' },
  { id: 'daytrip', label: '🚗 Day trips' },
];

/** This month in Wichita, 1–12. */
const thisMonth = () => Number(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));

export const inSeason = (a: Activity, month = thisMonth()) => !a.months || a.months.includes(month);

/** Seasonal spots open right now, for the "In season" chip. */
export const seasonalNow = (list: Activity[], month = thisMonth()) => list.filter((a) => a.months?.includes(month));

/**
 * A random activity of this kind (any kind when null; 'season' for seasonal spots open now), skipping the ones
 * already shown. Out-of-season spots never come up.
 */
export function randomActivity(list: Activity[], kind: ActivityKind | 'season' | null, skip: string[] = []) {
  const pool = list.filter(
    (a) =>
      inSeason(a) && (kind === 'season' ? !!a.months : !kind || a.kinds.includes(kind)) && !skip.includes(a.id),
  );
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/** The active spots, in list order. */
export async function getActivities(): Promise<Activity[]> {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const { data, error } = await supabase
    .from('activities')
    .select('id, name, kinds, blurb, address, website, months')
    .eq('active', true)
    .order('sort');
  if (error) throw error;
  return data as Activity[];
}
