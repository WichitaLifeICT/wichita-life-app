// Local guides from wichitalifeict.com/guides. The guides page links to each guide, and
// each guide page carries Open Graph tags (title, description, image, dates).

export const SITE = 'https://www.wichitalifeict.com';

// Site navigation and other non-guide pages linked from the guides page.
const NOT_GUIDES = new Set([
  '/', '/about', '/advertise', '/blog', '/events', '/guides', '/insiders', '/jobs', '/newsletter',
  '/podcast', '/search', '/shop', '/feed.xml',
]);

/** Guide paths in the order they appear on the guides page. */
export function guideLinks(html: string): string[] {
  const seen = new Set<string>();
  for (const m of html.matchAll(/href="(\/[a-z0-9-]+)"/g)) {
    if (!NOT_GUIDES.has(m[1])) seen.add(m[1]);
  }
  return [...seen];
}

function meta(html: string, key: string) {
  const m =
    html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${key}"`, 'i'));
  return m ? decode(m[1]).trim() || null : null;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function ldDate(html: string, key: 'dateModified' | 'datePublished') {
  return html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))?.[1] ?? null;
}

const iso = (s: string | null) => (s && !isNaN(Date.parse(s)) ? new Date(s).toISOString() : null);

export type GuideRow = {
  slug: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  url: string;
  position: number;
  published_at: string | null;
  updated_at: string | null;
  active: true;
};

export function parseGuidePage(path: string, html: string, position: number): GuideRow | null {
  const rawTitle = meta(html, 'og:title') ?? html.match(/<title>([^<]+)<\/title>/)?.[1] ?? null;
  if (!rawTitle) return null;
  const published = iso(meta(html, 'article:published_time') ?? ldDate(html, 'datePublished'));
  const updated = iso(meta(html, 'article:modified_time') ?? ldDate(html, 'dateModified')) ?? published;
  return {
    slug: path.slice(1),
    title: decode(rawTitle).replace(/\s+[—–-]\s+Wichita Life$/, '').trim(),
    summary: meta(html, 'og:description') ?? meta(html, 'description'),
    image_url: meta(html, 'og:image'),
    url: `https://wichitalifeict.com${path}`,
    position,
    published_at: published,
    updated_at: updated,
    active: true,
  };
}
