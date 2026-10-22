// Reads the Wichita Life Dinner Club dates from wichitalife.dnnr.io (a Next.js page whose
// data includes every dinner as `eventDate`). Dates are Wichita wall-clock times written with
// a "Z" (e.g. 2026-11-10T18:30:00.000Z is 6:30pm in Wichita), so they're converted here.

import { localToUtc } from './time.ts';

export const DINNER_CLUB_URL = 'https://wichitalife.dnnr.io/';

/** UTC instant for a Wichita wall-clock time. */
export const wichitaToUtc = (local: string) => localToUtc(local);

/** Distinct dinner dates on the page as local "YYYY-MM-DDTHH:MM", oldest first. */
export function dinnerDates(html: string) {
  const found = new Set<string>();
  for (const m of html.matchAll(/eventDate\\*"\s*:\s*\\*"\$D(\d{4}-\d\d-\d\dT\d\d:\d\d)/g)) found.add(m[1]);
  return [...found].sort();
}
