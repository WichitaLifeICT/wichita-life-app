// "Add to calendar": GET /functions/v1/event-ics?id=<event id> returns the event as a .ics file,
// which phones and calendar apps open as "Add to Calendar". Public (events are public), read-only.

import { adminClient } from '../_shared/admin.ts';

const APP_URL = 'https://app.wichitalifeict.com';

// iCalendar text: escape \ ; , and newlines, and fold lines at 75 bytes.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const day = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso))
    .replace(/-/g, '');

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Missing event id', { status: 400 });

  const { data: e } = await adminClient()
    .from('events')
    .select('id, title, description, starts_at, ends_at, all_day, venue, address, url')
    .eq('id', id)
    .eq('hidden', false)
    .maybeSingle();
  if (!e) return new Response('Event not found', { status: 404 });

  const end = e.ends_at ?? new Date(Date.parse(e.starts_at) + 2 * 3_600_000).toISOString();
  const link = `${APP_URL}/event/${e.id}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wichita Life//App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@wichitalifeict.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    ...(e.all_day
      ? [`DTSTART;VALUE=DATE:${day(e.starts_at)}`]
      : [`DTSTART:${stamp(e.starts_at)}`, `DTEND:${stamp(end)}`]),
    `SUMMARY:${esc(e.title)}`,
    ...(e.venue || e.address ? [`LOCATION:${esc([e.venue, e.address].filter(Boolean).join(', '))}`] : []),
    `DESCRIPTION:${esc([e.description === 'null' ? null : e.description, `Details: ${e.url ?? link}`].filter(Boolean).join('\n\n'))}`,
    `URL:${e.url ?? link}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const filename = (e.title as string).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event';
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}.ics"`,
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
