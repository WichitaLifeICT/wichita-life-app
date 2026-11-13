import { XMLParser } from 'npm:fast-xml-parser@4';

export type FeedItem = { source_name: string; title: string; url: string; published_at: string };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string =>
  typeof v === 'string' ? v : v && typeof v === 'object' && '#text' in v ? String((v as { '#text': unknown })['#text']) : '';

/**
 * Crime, police and tragedy headlines stay out of the app's news (it's about fun things in Wichita).
 * Keep in step with the hide_crime_news migration, which cleared older ones.
 */
export const CRIME_NEWS =
  /\b(police|policing|officers?|sheriff'?s?|deput(y|ies)|troopers?|arrest(s|ed)?|shoot(ing|ings|er)?|shot|gunshot|gunfire|gunman|bullets?|drive-by|stabb(ed|ing)|murder(ed|s)?|homicide|kill(ed|ing|s|er)?|manslaughter|charged|suspects?|crimes?|criminal|robber(y|ies)|robbed|burglar(y|ies)|theft|stolen|assault(ed)?|rape|kidnapp(ed|ing)|carjack(ed|ing)|fatal|dies|died|dead|deadly|death|jail(ed)?|prison|inmates?|sentenced|sentencing|convicted|guilty|indicted|fugitive|missing|amber alert|purple alert|silver alert|overdose|dui|swat|standoff|investigat(e|es|ion|ing|ors?)|fbi|kbi|warrant|cold case|hit-and-run|hit and run|abuse|stalking|cyberstalking)\b/i;

/** Outlets kept out of the app's news entirely (owner, Nov 13: "remove anything KMUW related"). */
export const BLOCKED_OUTLETS = /\bkmuw\b/i;

/** Google News appends " - Outlet Name" to titles; drop it. Skip blocked outlets, section pages, very short titles and crime news. */
function tidy(item: FeedItem): FeedItem | null {
  if (BLOCKED_OUTLETS.test(item.source_name) || BLOCKED_OUTLETS.test(item.url) || BLOCKED_OUTLETS.test(item.title.replace(/^.*\s-\s+/, ''))) return null;
  let title = item.title.replace(/\s+/g, ' ').trim();
  if (item.url.includes('news.google.com/')) title = title.replace(/\s*-\s+[^-]+$/, '').trim();
  if (title.split(' ').length < 4) return null;
  if (CRIME_NEWS.test(title)) return null;
  return { ...item, title };
}

export function parseFeed(source: string, xml: string): FeedItem[] {
  return parseRaw(source, xml).flatMap((i) => tidy(i) ?? []);
}

function parseRaw(source: string, xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  const now = new Date().toISOString();
  // RSS 2.0
  const rssItems = asArray(doc?.rss?.channel?.item);
  if (rssItems.length) {
    return rssItems.slice(0, 15).flatMap((i: Record<string, unknown>) => {
      const url = text(i.link).trim();
      const title = text(i.title).trim();
      if (!url || !title) return [];
      const date = i.pubDate ? new Date(text(i.pubDate)) : null;
      return [{ source_name: source, title, url, published_at: date && !isNaN(+date) ? date.toISOString() : now }];
    });
  }
  // Atom
  return asArray(doc?.feed?.entry)
    .slice(0, 15)
    .flatMap((e: Record<string, unknown>) => {
      const link = asArray(e.link as Record<string, string> | Record<string, string>[]).find((l) => !l.rel || l.rel === 'alternate');
      const url = link?.href ?? '';
      const title = text(e.title).trim();
      if (!url || !title) return [];
      const date = new Date(text(e.published ?? e.updated));
      return [{ source_name: source, title, url, published_at: isNaN(+date) ? now : date.toISOString() }];
    });
}
