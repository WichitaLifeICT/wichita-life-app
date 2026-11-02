// Live music straight from venues' own calendars, for places the Wichita Life calendar doesn't cover.
// Each venue is read through a public feed; rows go in public.events with source 'venue_feed' and a
// source_id of '<venue key>:<the venue's own id>'.

import { cleanTitle, decodeEntities, type EventRow } from './listings.ts';

export type VenueFeed = {
  key: string;
  name: string;
  /** How the Wichita Life calendar names this venue (an ilike pattern), to skip shows it already lists. */
  calendarVenue: string;
  fetch: () => Promise<EventRow[]>;
};

/** HTML → plain text, or null if there's nothing much. */
function plain(html: string | null) {
  const text = decodeEntities((html ?? '').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length >= 20 ? text.slice(0, 1000) : null;
}

/** "2026-11-08 22:00:00" (UTC) → ISO. */
const utc = (s: string | null | undefined) => (s ? new Date(`${s.replace(' ', 'T')}Z`).toISOString() : null);

type TribeEvent = {
  id: number;
  url: string;
  title: string;
  description: string;
  all_day: boolean;
  utc_start_date: string;
  utc_end_date: string | null;
  cost: string;
  image: false | { url: string };
  venue: { slug: string; venue: string; address: string } | [];
};

// Wichita Brewing Company (The Events Calendar on WordPress). The feed mixes in trivia, drink
// deals and classes, and has no categories, so keep only titles that name music.
const WBC_MUSIC = /abrewstic|live music|\bdj\b|jazz|bluegrass|\bband\b|acoustic|concert|unplugged/i;

async function wichitaBrewing(): Promise<EventRow[]> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
  let next: string | null = `https://www.wichitabrew.com/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`;
  const events: TribeEvent[] = [];
  for (let page = 0; next && page < 6; page++) {
    const res = await fetch(next, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Wichita Brewing: HTTP ${res.status}`);
    const body: { events?: TribeEvent[]; next_rest_url?: string } = await res.json();
    events.push(...(body.events ?? []));
    next = body.next_rest_url ?? null;
  }
  return events.flatMap((e) => {
    const title = cleanTitle(decodeEntities(e.title));
    const venue = Array.isArray(e.venue) ? null : e.venue;
    if (!WBC_MUSIC.test(title) || !venue) return [];
    const price = decodeEntities(e.cost ?? '').trim() || null;
    return [
      {
        source: 'venue_feed' as const,
        source_id: `wbc:${e.id}`,
        title,
        description: plain(e.description),
        starts_at: utc(e.utc_start_date)!,
        ends_at: utc(e.utc_end_date),
        all_day: e.all_day,
        time_tbd: false,
        venue: `Wichita Brewing Company (${decodeEntities(venue.venue).replace(/^WBC\s+/i, '')})`,
        address: decodeEntities(venue.address) || null,
        price_text: price && /free/i.test(price) ? 'Free' : price,
        url: e.url,
        image_url: e.image ? e.image.url : null,
        calendar_tags: ['Live Music'],
        featured: false,
        website: 'https://www.wichitabrew.com/',
        free: !!price && /free/i.test(price),
      },
    ];
  });
}

export const VENUE_FEEDS: VenueFeed[] = [
  { key: 'wbc', name: 'Wichita Brewing Company', calendarVenue: '%wichita brew%', fetch: wichitaBrewing },
];
