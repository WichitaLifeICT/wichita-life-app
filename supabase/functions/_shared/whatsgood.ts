// The Wichita Life events calendar (What's Good) API: https://docs.whatsgood.city/developers/read-events/
// Read-only key in the X-API-Key header. All event times are local wall-clock times in the
// account's time zone (America/Chicago), without an offset.

import { cleanTitle, decodeEntities, EVENTS_HOST, type EventRow } from './listings.ts';
import { localToUtc } from './time.ts';

export const WG_API = 'https://whatsgoodapi.up.railway.app/v1';

export type WgOccurrence = { id: string; start: string; end: string | null; no_time: boolean };

export type WgEvent = {
  id: string;
  status: 'active' | 'inactive';
  name: string;
  description: string | null;
  timezone: string;
  wgOccurrences: WgOccurrence[];
  recurrence: 'daily' | 'weekly' | null;
  venue: { name: string | null; address: string | null } | null;
  custom_fields: Record<string, number[]>;
  photos: string[];
  price: string | null;
  is_free: boolean;
  /** The calendar's Featured switch: shown as sponsored in the app. */
  featured?: boolean;
  /** The event's own website. */
  web_url?: string | null;
  updated_at: string;
};

type Page<T> = { data: T[]; next_cursor: string | null; has_more: boolean };

async function get<T>(key: string, path: string): Promise<T> {
  const res = await fetch(`${WG_API}${path}`, { headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`What's Good ${path.split('?')[0]}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Every event that hasn't ended yet (the API's default list), following the cursor to the end.
 * `complete` is false if the page cap was hit, so callers don't treat a partial list as the whole calendar.
 */
export async function fetchUpcomingEvents(key: string, maxPages = 50) {
  const events: WgEvent[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ limit: '200' });
    if (cursor) q.set('cursor', cursor);
    const res: Page<WgEvent> = await get(key, `/events?${q}`);
    events.push(...res.data);
    if (!res.has_more || !res.next_cursor) return { events, complete: true };
    cursor = res.next_cursor;
  }
  return { events, complete: false };
}

/** Tag option ID → name ("Live Music", "Free"…), from the account's `tags` custom field. */
export async function fetchTagNames(key: string) {
  const res: { data: { key: string; options: { id: number; name: string }[] }[] } = await get(key, '/custom-fields');
  return new Map((res.data.find((f) => f.key === 'tags')?.options ?? []).map((o) => [o.id, o.name.trim()]));
}

/** The calendar's page for an event. Its slug is the raw name, lowercased, punctuation dropped, each space an underscore. */
export function calendarUrl(id: string, name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '_');
  return `${EVENTS_HOST}/d/events-${id}_us_ks_wichita_${slug}`;
}

/** HTML description → plain text with paragraph breaks, or null for empty, "null" and promoted-ad text. */
export function plainDescription(html: string | null) {
  if (!html) return null;
  const text = decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Descriptions ending in "Promoted" are the calendar's ad for a different event, not this one.
  if (!text || text === 'null' || /Promoted\s*$/i.test(text)) return null;
  return tidyScraped(text)?.slice(0, 1000) ?? null;
}

const WEEKDAY = '(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)(?:day)?';
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*';

/**
 * Some descriptions were copied off a venue's website along with its page furniture: a day-by-day
 * schedule ("Monday, Oct. 5 — 8 a.m. … Tuesday, Oct. 6 — …"), a calendar grid ("9 10 Sun 11 Mon 12…")
 * or site boilerplate ("Create a Website Account…"). Keep the real text, or nothing.
 */
export function tidyScraped(text: string): string | null {
  let t = text.replace(/Create a Website Account[^.]*\.?|Manage notification subscriptions[^.]*\.?/gi, '').trim();
  // A list of dated sessions is a schedule, not a description; the app shows the dates itself.
  if ((t.match(new RegExp(`\\b${WEEKDAY},? ${MONTH}\\.? \\d{1,2}\\b`, 'gi')) ?? []).length >= 3) return null;
  // A calendar grid at the start: cut through its last time ("7:30 PM – 9:30 PM").
  const head = t.slice(0, 300);
  if ((head.match(new RegExp(`\\b${WEEKDAY} \\d{1,2}\\b`, 'g')) ?? []).length >= 3) {
    const times = [...head.matchAll(/\d{1,2}:\d{2}\s?(?:[AP]M)?/gi)];
    const last = times.at(-1);
    if (last) t = t.slice(last.index! + last[0].length).replace(/^[\s\-\u2013\u2014)#]+/, '');
  }
  return t.length >= 20 ? t : null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Day of the week of a local "YYYY-MM-DDTHH:MM" time, as a name. */
const localWeekday = (local: string) => DAYS[new Date(`${local.slice(0, 10)}T12:00:00Z`).getUTCDay()];

/** A price like "$25.00", "12.00", "$0-$5" or "$$" means paid, unless it says free. */
export function looksPaid(price: string | null) {
  return !!price && !/free/i.test(price) && (/[1-9]/.test(price) || /\$\$/.test(price));
}

/**
 * One app event per calendar event. Recurring events list every date in wgOccurrences; the
 * app shows the next one that hasn't ended (ended = its end, or start if none, more than 6 hours ago).
 * Returns null when every date is past.
 */
export function toEventRow(ev: WgEvent, tags: Map<number, string>, now = Date.now()): EventRow | null {
  const tz = ev.timezone || 'America/Chicago';
  const calendarTags = [...new Set((ev.custom_fields?.tags ?? []).map((id) => tags.get(id)).filter((n): n is string => !!n))];
  // A weekly event entered as repeating every day ("Free Admission Sundays", one Field of Screams
  // listing per night) carries its day as a tag. Keep only the dates on those days.
  const days = DAYS.filter((d) => calendarTags.includes(d));
  let occurrences = ev.wgOccurrences;
  if (days.length && occurrences.length > 1) {
    const onDay = occurrences.filter((o) => days.includes(localWeekday(o.start)));
    if (onDay.length) occurrences = onDay;
  }
  const next = occurrences
    .map((o) => ({ o, start: localToUtc(o.start, tz), end: o.end ? localToUtc(o.end, tz) : null }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find((x) => (x.end ?? x.start).getTime() >= now - 6 * 3_600_000);
  if (!next) return null;

  const midnight = /T00:00(:00)?$/.test(next.o.start.slice(0, 19));
  const price = ev.price?.trim() || null;
  // The calendar's "Free" tag and free flag are sometimes left on ticketed events; a real price wins.
  const free = !looksPaid(price) && (ev.is_free || calendarTags.includes('Free'));
  return {
    source: 'wichitalife_events',
    source_id: ev.id,
    title: cleanTitle(decodeEntities(ev.name)),
    description: plainDescription(ev.description),
    starts_at: next.start.toISOString(),
    ends_at: next.end?.toISOString() ?? null,
    all_day: next.o.no_time || midnight,
    // A start of exactly 12:00 AM almost always means no time was entered: the app shows "Time TBD".
    time_tbd: !next.o.no_time && midnight,
    venue: ev.venue?.name ? decodeEntities(ev.venue.name) : null,
    address: ev.venue?.address ? decodeEntities(ev.venue.address) : null,
    price_text: free && !price ? 'Free' : (price ?? null),
    url: calendarUrl(ev.id, ev.name),
    image_url: ev.photos?.[0] ?? null,
    calendar_tags: calendarTags,
    featured: !!ev.featured,
    website: ev.web_url && /^https?:\/\//i.test(ev.web_url) ? ev.web_url.slice(0, 500) : null,
    free,
  };
}
