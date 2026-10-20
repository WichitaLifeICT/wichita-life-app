import { dayKey, isThisWeekend } from '@/lib/format';
import type { EventItem } from '@/lib/types';

/**
 * Event categories. `tags` are ours (staff can edit them); `calendar_tags` come from the
 * Wichita Life calendar. Either one counts.
 */
const has = (e: EventItem, ours: string, ...calendar: string[]) =>
  e.tags.includes(ours) || calendar.some((t) => e.calendar_tags?.includes(t));

export const isLiveMusic = (e: EventItem) => has(e, 'music', 'Live Music');
export const isFree = (e: EventItem) => has(e, 'free', 'Free') || /^free$/i.test(e.price_text ?? '');
export const isFamily = (e: EventItem) => has(e, 'family', 'Family Friendly');
export const isFoodDrink = (e: EventItem) =>
  has(e, 'food', 'Food', 'Eat', 'Dinner', 'Brunch', 'Lunch', 'Drinks', 'Craft Beer', 'Wine Lovers', 'Whiskey Lovers');

// Calendar tags that are music genres, in the order chips appear. Display names on the right.
const GENRES: [tag: string, label: string][] = [
  ['Rock', 'Rock'],
  ['Jazz', 'Jazz'],
  ['Blues', 'Blues'],
  ['Soul', 'Soul'],
  ['Funk', 'Funk'],
  ['Country', 'Country'],
  ['Folk', 'Folk'],
  ['Singer-songwriter', 'Singer-songwriter'],
  ['Pop', 'Pop'],
  ['Alt - Indie', 'Indie'],
  ['Punk', 'Punk'],
  ['Metal', 'Metal'],
  ['Latin', 'Latin'],
  ['Rap', 'Hip-hop'],
  ['Hip Hop', 'Hip-hop'],
  ['Electronic', 'Electronic'],
  ['Dj', 'DJ'],
  ['Classical', 'Classical'],
];
const GENRE_LABEL = new Map(GENRES);

/** Display names of this show's genres ("Rock", "DJ"…). */
export const genresOf = (e: EventItem) => [
  ...new Set((e.calendar_tags ?? []).flatMap((t) => (GENRE_LABEL.has(t) ? [GENRE_LABEL.get(t)!] : []))),
];

/** Genre chips worth offering: ones on at least two of these shows, in a fixed order. */
export function genreChips(events: EventItem[]) {
  const counts = new Map<string, number>();
  for (const e of events) for (const g of genresOf(e)) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...new Set(GENRES.map(([, label]) => label))].filter((g) => (counts.get(g) ?? 0) >= 2);
}

/** Started or starting later today in Wichita, and not long over. */
export function isTonight(e: EventItem, now: Date) {
  if (dayKey(e.starts_at) !== dayKey(now.toISOString())) return false;
  const end = e.ends_at ? Date.parse(e.ends_at) : Date.parse(e.starts_at) + 3 * 3_600_000;
  return end >= now.getTime();
}

export { isThisWeekend };
