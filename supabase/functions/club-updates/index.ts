// The club-checking bot's inbox. Its link (with ?key=…) is in Staff tools > Clubs.
//   GET  → the clubs to check, with their pages, and the format to reply in.
//   POST → what it found: {"clubs": [{"name", "url", "last_post", "still_meets", "schedule", "notes"}]}.
//   GET with &report=<that JSON, URL-encoded> does the same, for bots that can only open links.
// Latest post dates are saved right away (clubs with no post in 60 days drop off Meet on their
// own), and a club the bot says stopped meeting is hidden right away. Schedule changes wait for
// staff in Staff tools > Clubs, since the bot can be wrong.

import { adminClient, json } from '../_shared/admin.ts';
import { matchClub, parseReports, scheduleChanged } from '../_shared/club-updates.ts';

const FORMAT = {
  clubs: [
    {
      name: 'Run 316',
      url: 'https://www.instagram.com/run__316/',
      last_post: '2026-10-19',
      still_meets: 'yes | no | unknown',
      schedule: 'Saturdays 8am at Naftzger Park',
      notes: 'Next run, special events, anything else worth knowing',
    },
  ],
};

Deno.serve(async (req) => {
  const db = adminClient();
  const params = new URL(req.url).searchParams;
  const key = params.get('key') ?? req.headers.get('x-api-key');
  if (!key) return json({ error: 'Missing key' }, 401);
  const { data: ok } = await db.rpc('verify_club_updates_key', { key });
  if (ok !== true) return json({ error: 'Wrong key' }, 403);

  const { data: clubs, error } = await db
    .from('clubs')
    .select('id, name, url, schedule, last_post_on')
    .eq('active', true)
    .eq('pending', false)
    .order('priority', { ascending: false })
    .order('name');
  if (error) return json({ error: error.message }, 500);

  const report = params.get('report');
  if (req.method === 'GET' && !report) {
    return json({
      instructions:
        "Check each club's page. For each, find the date of their most recent post, whether they still meet, and their current meetup day, time and place. Use \"unknown\" when you can't tell. Don't guess. Send it back as JSON in reply_format: POST it to this same link, or if you can only open links, open this same link with &report= followed by the JSON, URL-encoded.",
      reply_format: FORMAT,
      clubs: clubs.map((c) => ({ name: c.name, url: c.url, schedule_we_have: c.schedule })),
    });
  }
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Use GET or POST' }, 405);

  const reports = parseReports(report ?? (await req.text()));
  if (!reports.length) return json({ error: 'No clubs found in the message', reply_format: FORMAT }, 400);

  const unmatched: string[] = [];
  let datesSaved = 0;
  let forReview = 0;
  const hidden: string[] = [];
  for (const r of reports) {
    const club = matchClub(r, clubs);
    if (!club) {
      unmatched.push(r.name ?? r.url ?? '?');
      continue;
    }
    if (r.lastPost && (!club.last_post_on || r.lastPost > club.last_post_on)) {
      const { error } = await db.from('clubs').update({ last_post_on: r.lastPost }).eq('id', club.id);
      if (error) return json({ error: error.message }, 500);
      datesSaved++;
    }
    if (r.stillMeets === false) {
      // Hidden right away; Staff tools > Clubs > Show brings it back. Logged as an applied update.
      const { error } = await db.from('clubs').update({ active: false }).eq('id', club.id);
      if (error) return json({ error: error.message }, 500);
      await db.from('club_updates').update({ status: 'dismissed' }).eq('club_id', club.id).eq('status', 'pending');
      await db
        .from('club_updates')
        .insert({ club_id: club.id, last_post_on: r.lastPost, still_meets: false, notes: r.notes, status: 'applied' });
      hidden.push(club.name);
      continue;
    }
    if (scheduleChanged(club.schedule, r.schedule)) {
      // One open update per club; a newer report replaces it.
      const update = {
        club_id: club.id,
        received_at: new Date().toISOString(),
        last_post_on: r.lastPost,
        still_meets: r.stillMeets,
        schedule: r.schedule,
        notes: r.notes,
      };
      const { data: open } = await db.from('club_updates').select('id').eq('club_id', club.id).eq('status', 'pending').maybeSingle();
      const { error } = open
        ? await db.from('club_updates').update(update).eq('id', open.id)
        : await db.from('club_updates').insert(update);
      if (error) return json({ error: error.message }, 500);
      forReview++;
    }
  }
  return json({ received: reports.length, datesSaved, forReview, hidden, unmatched });
});
