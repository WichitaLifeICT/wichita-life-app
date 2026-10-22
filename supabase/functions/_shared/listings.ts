import { XMLParser } from 'npm:fast-xml-parser@4';

// ---------------------------------------------------------------------------
// Jobs: Kardow RSS (jobs.wichitalifeict.com/feed)
// ---------------------------------------------------------------------------

export type JobRow = {
  title: string;
  company: string;
  url: string;
  location: string | null;
  job_type: string | null;
  pay_text: string | null;
  posted_at: string;
  source: 'kardow';
  active: true;
};

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();

function field(html: string, label: string) {
  const m = html.match(new RegExp(`<strong>${label}:</strong>\\s*([^<]+)`, 'i'));
  return m ? decodeEntities(m[1]).trim() : null;
}

export function parseKardowFeed(text: string): JobRow[] {
  const doc = xml.parse(text);
  return asArray(doc?.rss?.channel?.item).flatMap((item: Record<string, unknown>) => {
    const fullTitle = decodeEntities(str(item.title));
    const url = str(item.link);
    if (!fullTitle || !url) return [];
    const desc = str(item.description);
    // Titles look like "Role at Company"; the description also has a Company field.
    const company = field(desc, 'Company') ?? fullTitle.split(' at ').slice(-1)[0];
    const title = fullTitle.endsWith(` at ${company}`) ? fullTitle.slice(0, -(` at ${company}`).length) : fullTitle;
    const salary = field(desc, 'Salary');
    const date = new Date(str(item.pubDate));
    return [
      {
        title,
        company,
        url,
        location: field(desc, 'Location'),
        job_type: field(desc, 'Type'),
        pay_text: salary && !/not specified/i.test(salary) ? salary : null,
        posted_at: isNaN(+date) ? new Date().toISOString() : date.toISOString(),
        source: 'kardow',
        active: true,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Events: What's Good calendar pages (events.wichitalifeict.com)
// ---------------------------------------------------------------------------

export const EVENTS_HOST = 'https://events.wichitalifeict.com';

/**
 * The calendar's schema.org times are consistently one hour earlier than the times its pages
 * display (checked Oct 22 under daylight time and Nov 3 under standard time), so add it back.
 * If What's Good fixes this, set it to 0.
 */
const CALENDAR_TIME_FIX_MS = 60 * 60 * 1000;
const fixTime = (iso: string) => new Date(Date.parse(iso) + CALENDAR_TIME_FIX_MS).toISOString();

export type EventRow = {
  source: 'wichitalife_events';
  source_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  address: string | null;
  price_text: string | null;
  url: string;
  image_url: string | null;
  /** The calendar's own tags for this event ("Live Music", "Rock", "Date Night"…). */
  calendar_tags: string[];
  free: boolean;
};

/** Event page paths ("/d/events-3866_us_ks_wichita_...") linked from a listing page. */
export function eventLinks(html: string): string[] {
  const ids = new Map<string, string>();
  for (const m of html.matchAll(/\/d\/events-(\d+)_[a-z0-9_]+/g)) if (!ids.has(m[1])) ids.set(m[1], m[0]);
  return [...ids.values()];
}

export const eventId = (path: string) => path.match(/events-(\d+)_/)?.[1] ?? null;

/** Event pages from the sitemap changed within `days`, with their last-modified time. The sitemap uses the site's canonical host. */
export function recentSitemapLinks(sitemapXml: string, days: number, now = Date.now()): { path: string; lastmod: number }[] {
  const out: { path: string; lastmod: number }[] = [];
  for (const m of sitemapXml.matchAll(/<loc>[^<]*?(\/d\/events-\d+_[a-z0-9_]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    const lastmod = Date.parse(m[2]);
    if (now - lastmod <= days * 86_400_000) out.push({ path: m[1], lastmod });
  }
  return out;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

type LdEvent = {
  '@type'?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  image?: string | string[];
  location?: { name?: string; address?: string | { streetAddress?: string } };
  offers?: { price?: string | number } | { price?: string | number }[];
};

function isEvent(node: LdEvent) {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes('Event') : t === 'Event';
}

/**
 * The event's own tag chips. Each is a link to the calendar filtered by that tag:
 * <a href="…/events?t=41"><div …>🎸<!-- --> <!-- -->Live Music</div></a>
 */
export function eventTags(html: string): string[] {
  const names = [...html.matchAll(/events\?t=\d+"[^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>/g)].map((m) => {
    const parts = m[1].split('<!-- -->');
    return decodeEntities(parts[parts.length - 1].replace(/<[^>]+>/g, '')).trim();
  });
  return [...new Set(names.filter((n) => n && n.length <= 40))];
}

/** Reads the schema.org Event block from an event page. Venue and listing pages return null. */
export function parseEventPage(path: string, html: string): EventRow | null {
  const id = eventId(path);
  if (!id) return null;
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const nodes = (Array.isArray(data) ? data : [data]).flatMap((d) =>
      d && typeof d === 'object' && '@graph' in d ? (d as { '@graph': LdEvent[] })['@graph'] : [d as LdEvent],
    );
    const ev = nodes.find((n) => n && isEvent(n));
    if (!ev?.name || !ev.startDate) continue;

    const offer = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers;
    const price = offer?.price != null ? Number(offer.price) : null;
    const address = typeof ev.location?.address === 'string' ? ev.location.address : ev.location?.address?.streetAddress;
    const image = Array.isArray(ev.image) ? ev.image[0] : ev.image;
    // Descriptions ending in "Promoted" are the calendar's ad for a different event, not this one.
    // Some pages carry the literal text "null" when there's no description.
    const description =
      ev.description && ev.description.trim() !== 'null' && !/Promoted\s*$/i.test(ev.description)
        ? ev.description.trim()
        : null;

    const calendarTags = eventTags(html);
    return {
      source: 'wichitalife_events',
      source_id: id,
      title: cleanTitle(decodeEntities(ev.name)),
      description: description ? decodeEntities(description).slice(0, 1000) : null,
      starts_at: fixTime(ev.startDate),
      ends_at: ev.endDate ? fixTime(ev.endDate) : null,
      venue: ev.location?.name ? decodeEntities(ev.location.name) : null,
      address: address ? decodeEntities(address) : null,
      price_text: price == null || isNaN(price) ? null : price === 0 ? 'Free' : `$${price % 1 ? price.toFixed(2) : price}`,
      url: `${EVENTS_HOST}${path}`,
      image_url: image ?? null,
      calendar_tags: calendarTags,
      free: price === 0 || calendarTags.includes('Free'),
    };
  }
  return null;
}

/**
 * Some calendar listings start with the show time, like "1a Stimulus", "9p Kimberly Page" or
 * "11:30p Thorn Hays". The time is already on the event, so drop it from the name.
 * (Best fixed on the calendar itself; this keeps the app tidy meanwhile.)
 */
export function cleanTitle(name: string) {
  const title = name.trim();
  const stripped = title.replace(/^\d{1,2}(?::\d{2})?\s?(?:a|p)\.?(?:m\.?)?(?=\s)[\s\-\u2013\u2014:|\u00b7]*/i, '').trim();
  return stripped.length >= 2 ? stripped : title;
}
