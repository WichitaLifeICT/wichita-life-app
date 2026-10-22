// Reading the club-checking bot's reports (see club-updates). Bots phrase things loosely, so
// this accepts a few spellings and ignores anything it can't make sense of.

export type ClubReport = {
  name: string | null;
  url: string | null;
  lastPost: string | null; // YYYY-MM-DD
  stillMeets: boolean | null;
  schedule: string | null;
  notes: string | null;
};

const text = (v: unknown, max: number) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return !s || /^(unknown|n\/a|none|null|-)$/i.test(s) ? null : s.slice(0, max);
};

/** "yes" / "no" / true / false → boolean; anything else → null (unknown). */
function yesNo(v: unknown) {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return null;
  if (/^(yes|true|active|still meets|y)\b/i.test(v.trim())) return true;
  if (/^(no|false|inactive|stopped|not active|n)\b/i.test(v.trim())) return false;
  return null;
}

/** A date no later than tomorrow, as YYYY-MM-DD. */
function day(v: unknown, now = Date.now()) {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v.trim().slice(0, 30));
  if (isNaN(t) || t > now + 86_400_000 || t < Date.parse('2015-01-01')) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** The reports in a request body: {"clubs": [...]}, a bare list, or either wrapped in text. */
export function parseReports(body: string, now = Date.now()): ClubReport[] {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    // Some bots wrap JSON in prose or a ```json block; take the outermost JSON value.
    const m = body.match(/[[{][\s\S]*[\]}]/);
    if (!m) return [];
    try {
      data = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(data) ? data : (data as { clubs?: unknown })?.clubs;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 100).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    const report: ClubReport = {
      name: text(r.name ?? r.club, 120),
      url: text(r.url ?? r.link ?? r.page, 300),
      lastPost: day(r.last_post ?? r.last_post_on ?? r.most_recent_post ?? r.lastPost, now),
      stillMeets: yesNo(r.still_meets ?? r.active ?? r.stillMeets),
      schedule: text(r.schedule ?? r.meets ?? r.when, 200),
      notes: text(r.notes ?? r.next_meetup ?? r.next_event, 500),
    };
    return report.name || report.url ? [report] : [];
  });
}

/** instagram.com/run__316 and https://www.instagram.com/run__316/?hl=en are the same page. */
export const pageKey = (url: string) =>
  url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.|m\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Finds the club a report is about: by page link first, then by name. */
export function matchClub<C extends { id: string; name: string; url: string }>(report: ClubReport, clubs: C[]) {
  if (report.url) {
    const key = pageKey(report.url);
    const hit = clubs.find((c) => pageKey(c.url) === key);
    if (hit) return hit;
  }
  if (report.name) {
    const key = nameKey(report.name);
    return clubs.find((c) => nameKey(c.name) === key) ?? clubs.find((c) => key.length >= 4 && nameKey(c.name).includes(key));
  }
  return undefined;
}

/** Whether two schedules say different things (ignoring case, spacing and punctuation). */
export const scheduleChanged = (before: string | null, after: string | null) =>
  !!after && nameKey(after) !== nameKey(before ?? '');
