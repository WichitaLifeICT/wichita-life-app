// The part of a venue's page that talks about deals, times and prices (used by check-deals).

/** Lines that mention deals, times or prices: the part of a page worth comparing. */
const DEALISH =
  /happy hour|special|deal|trivia|karaoke|open mic|bingo|half[- ]?off|\boff\b|\$\s?\d|\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday|daily/i;

function pageText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** The deal-ish lines of a page, at most ~2,000 characters, in page order and without repeats. */
export function dealExcerpt(html: string) {
  const seen = new Set<string>();
  const lines: string[] = [];
  let size = 0;
  for (const line of pageText(html)) {
    if (line.length < 4 || line.length > 400 || !DEALISH.test(line) || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    size += line.length;
    if (size > 2000) break;
  }
  return lines.join('\n');
}
