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
// Events: the Wichita Life calendar (What's Good), read through its API in sync-events
// ---------------------------------------------------------------------------

export const EVENTS_HOST = 'https://events.wichitalifeict.com';

export type EventRow = {
  source: 'wichitalife_events';
  source_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  /** No real time on the calendar (listed at 12:00 AM); shown as "Time TBD". */
  time_tbd: boolean;
  venue: string | null;
  address: string | null;
  price_text: string | null;
  url: string;
  image_url: string | null;
  /** The calendar's own tags for this event ("Live Music", "Rock", "Date Night"…). */
  calendar_tags: string[];
  /** Featured on the calendar, so sponsored in the app. */
  featured: boolean;
  /** The event's own website (sponsor banners match on it). */
  website: string | null;
  free: boolean;
};

export function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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
