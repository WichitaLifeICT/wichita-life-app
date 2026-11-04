// Plans in the phone calendar. GET /functions/v1/calendar?t=<member's calendar token>
//   - with &plan=<plan id>: that plan as a .ics file ("Add plan to calendar", a one-time copy)
//   - without: the member's live feed (plans they made or are in, plus saved events) that
//     phone and Google calendars subscribe to and re-check on their own.
// The token is the member's secret (public.my_calendar_token); public.calendar_items checks it.

import { adminClient } from '../_shared/admin.ts';

type Item = {
  uid: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day_on: string | null;
  all_day_until: string | null;
  location: string | null;
  url: string;
  details: string | null;
  calendar_name: string;
};

// iCalendar text: escape \ ; , and newlines, and fold lines at 75 bytes.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ymd = (d: string) => d.replace(/-/g, '');
const nextDay = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let rest = line;
  while (enc.encode(rest).length > 75) {
    let cut = 75;
    while (enc.encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

function vevent(i: Item, now: string) {
  const when = i.starts_at
    ? [
        `DTSTART:${stamp(i.starts_at)}`,
        `DTEND:${stamp(i.ends_at ?? new Date(Date.parse(i.starts_at) + 2 * 3_600_000).toISOString())}`,
      ]
    : [`DTSTART;VALUE=DATE:${ymd(i.all_day_on!)}`, `DTEND;VALUE=DATE:${ymd(nextDay(i.all_day_until ?? i.all_day_on!))}`];
  return [
    'BEGIN:VEVENT',
    `UID:${i.uid}@wichitalifeict.com`,
    `DTSTAMP:${now}`,
    ...when,
    `SUMMARY:${esc(i.title)}`,
    ...(i.location ? [`LOCATION:${esc(i.location)}`] : []),
    `DESCRIPTION:${esc([i.details, i.url].filter(Boolean).join('\n\n'))}`,
    `URL:${i.url}`,
    ...(i.all_day_on ? ['TRANSP:TRANSPARENT'] : []),
    'END:VEVENT',
  ];
}

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams;
  const token = params.get('t') ?? '';
  const plan = params.get('plan');
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response('Calendar link not found', { status: 404 });
  if (plan && !/^[0-9a-f-]{36}$/i.test(plan)) return new Response('Plan not found', { status: 404 });

  const { data, error } = await adminClient().rpc('calendar_items', { token, plan: plan ?? null });
  if (error) {
    console.error('calendar_items', error.message);
    return new Response('Calendar unavailable, try again soon', { status: 503 });
  }
  const items = (data ?? []) as Item[];
  // A wrong or reset link, or a plan you can't see: same answer, so links can't be probed.
  if (plan && !items.length) return new Response('Plan not found', { status: 404 });

  const name = items[0]?.calendar_name ?? 'Wichita Life';
  const now = stamp(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wichita Life//App//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:PUBLISH`,
    `X-WR-CALNAME:${esc(plan ? name : 'Wichita Life')}`,
    'X-WR-TIMEZONE:America/Chicago',
    ...(plan ? [] : ['REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H']),
    ...items.flatMap((i) => vevent(i, now)),
    'END:VCALENDAR',
  ];
  const filename = plan ? name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'plan' : 'wichita-life';
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}.ics"`,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
});
