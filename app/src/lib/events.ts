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

// ---------------------------------------------------------------------------
// Duplicates. The calendar sometimes lists one event several times (same venue,
// same start, same or near-same title). Show one, keeping the most complete copy.
// ---------------------------------------------------------------------------

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'at', 'in', 'on', 'with', 'for', 'to', 'live', 'presents', 's']);

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));

/** "Century II Performing Arts & Convention Center" and "Century II" are the same place. */
const venueKey = (venue: string | null) => words((venue ?? '').split(/,| - | – /)[0]).slice(0, 3).join(' ');

function sameTitle(a: string, b: string) {
  const x = words(a).join(' ');
  const y = words(b).join(' ');
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const xs = new Set(x.split(' '));
  const ys = new Set(y.split(' '));
  const shared = [...xs].filter((w) => ys.has(w)).length;
  const overlap = shared / Math.min(xs.size, ys.size);
  // "Dink or Treat: Kids Open Play" and "Dink or Treat: Adult Pickleball Tournament" stay separate.
  return overlap >= 0.6 || (shared >= 3 && overlap >= 0.5);
}

// Titles like "Everclear · November 6 · The Cotillion · Wichita, KS" or "11:30p Thorn Hays" read worse.
const messyTitle = (t: string) => / · /.test(t) || /^\d{1,2}(:\d\d)?\s?[ap]m?\b/i.test(t);

const completeness = (e: EventItem) =>
  (e.is_sponsored ? 100 : 0) +
  (messyTitle(e.title) ? 0 : 5) +
  (e.description ? 4 : 0) +
  (e.image_url ? 2 : 0) +
  (e.calendar_tags?.length ?? 0) * 0.1;

export function dedupeEvents(events: EventItem[]): EventItem[] {
  const groups = new Map<string, EventItem[][]>();
  for (const e of events) {
    const venue = venueKey(e.venue);
    // Without a venue there's nothing reliable to match on.
    const key = venue ? `${e.starts_at.slice(0, 16)}|${venue}` : `id|${e.id}`;
    const clusters = groups.get(key) ?? [];
    const match = clusters.find((c) => c.some((other) => sameTitle(other.title, e.title)));
    if (match) match.push(e);
    else clusters.push([e]);
    groups.set(key, clusters);
  }
  const keep = new Map<string, EventItem>();
  for (const clusters of groups.values()) {
    for (const c of clusters) {
      const best = [...c].sort((a, b) => completeness(b) - completeness(a))[0];
      const tags = [...new Set(c.flatMap((e) => e.tags))];
      const calendarTags = [...new Set(c.flatMap((e) => e.calendar_tags ?? []))];
      keep.set(best.id, { ...best, tags, calendar_tags: calendarTags });
    }
  }
  // Keep the original (start-time) order.
  return events.filter((e) => keep.has(e.id)).map((e) => keep.get(e.id)!);
}
