/** UTC instant for a wall-clock time like "2026-11-10T18:30" in a time zone (Wichita by default), handling daylight saving. */
export function localToUtc(local: string, timeZone = 'America/Chicago') {
  const asUtc = new Date(`${local.slice(0, 19)}Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(asUtc);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const shown = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  // asUtc shown in that zone is `shown`; the gap is the zone's offset at that moment.
  return new Date(asUtc.getTime() + (asUtc.getTime() - shown));
}
