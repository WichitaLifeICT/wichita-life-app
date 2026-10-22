// Reads the Wichita Life Dinner Club dates from wichitalife.dnnr.io (a Next.js page whose
// data includes every dinner as `eventDate`). Dates are Wichita wall-clock times written with
// a "Z" (e.g. 2026-11-10T18:30:00.000Z is 6:30pm in Wichita), so they're converted here.

export const DINNER_CLUB_URL = 'https://wichitalife.dnnr.io/';

/** UTC instant for a wall-clock time in Wichita (America/Chicago), handling daylight saving. */
export function wichitaToUtc(local: string) {
  const asUtc = new Date(`${local}Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(asUtc);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const shown = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
  // asUtc shown in Chicago is `shown`; the gap is Chicago's offset at that moment.
  return new Date(asUtc.getTime() + (asUtc.getTime() - shown));
}

/** Distinct dinner dates on the page as local "YYYY-MM-DDTHH:MM", oldest first. */
export function dinnerDates(html: string) {
  const found = new Set<string>();
  for (const m of html.matchAll(/eventDate\\*"\s*:\s*\\*"\$D(\d{4}-\d\d-\d\dT\d\d:\d\d)/g)) found.add(m[1]);
  return [...found].sort();
}
