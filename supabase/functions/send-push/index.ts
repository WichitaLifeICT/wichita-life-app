// Sends a push notification to everyone who opted in to a topic.
// Called by staff (from Staff tools, with their Supabase session) or by a scheduled job.
// Body: { "topic": "daily" | "giveaways" | "weekend" | "breaking", "title": "...", "body": "...", "data": { "path": "/win" },
//         "interests": ["music", "food"] }  (optional: only members who picked one of these interests)
// Or { "group": "<group id>", "title", "body", "data" } to send to a Wichita Life group's members (no topic).
// Or { "entrants": "<giveaway id>" } to tell everyone who entered that giveaway to check who won (once per draw).
// "giveaways" is Giveaways & deals: members opt in, and it can go out once a week.

import { adminClient, cors, isCronRequest, json } from '../_shared/admin.ts';
import { sendToGroup, sendToMembers, sendToTopic, TOPICS, type Topic } from '../_shared/push.ts';

async function isStaff(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const db = adminClient();
  const { data: user } = await db.auth.getUser(token);
  if (!user.user) return false;
  const { data } = await db.from('profiles').select('role').eq('id', user.user.id).maybeSingle();
  return data?.role === 'admin' || data?.role === 'moderator';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!(await isCronRequest(req)) && !(await isStaff(req))) return json({ error: 'Forbidden' }, 403);

  const { topic, title, body, data, interests, group, entrants } = (await req.json()) as {
    topic?: Topic;
    group?: string;
    entrants?: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    interests?: string[];
  };
  const db = adminClient();
  if (entrants) {
    const result = await tellEntrants(db, entrants);
    return json(result, 'error' in result ? 400 : 200);
  }
  if (!title || !body) return json({ error: 'title and body are required' }, 400);
  // Giveaways & deals is promotional (opt-in only): at most one a week, Monday to Sunday.
  const once = topic === 'giveaways' && !group ? `promo:${wichitaMonday()}` : null;
  if (once) {
    const { data: claimed, error } = await db.rpc('claim_send', { k: once });
    if (error) return json({ error: error.message }, 500);
    if (!claimed)
      return json({ error: 'A Giveaways & deals push already went out this week. The next one can go Monday.' }, 409);
  }
  try {
    if (group) return json(await sendToGroup(db, group, { title, body, data }));
    if (!topic || !TOPICS.includes(topic)) return json({ error: 'topic or group is required' }, 400);
    // Staff sends are labeled "staff_<topic>" with their title, so each one shows separately on the dashboard.
    return json(
      await sendToTopic(db, topic, { title, body, data }, Array.isArray(interests) ? interests : [], {
        job: `staff_${topic}`,
        campaign: title,
      }),
    );
  } catch (e) {
    if (once) await db.rpc('release_send', { k: once });
    return json({ error: (e as Error).message }, 502);
  }
});

/**
 * Tells everyone who entered a giveaway, the winner included, to check who won ("Check who won the
 * Coffee Daze giveaway"); the Play tab shows the winner's name, and the winner sees "You won!". The
 * same message goes to everyone, so nobody is told they won by mistake. It's the result of something
 * they entered, so it doesn't need Giveaways & deals turned on. Needs the winner's name shown first.
 */
async function tellEntrants(
  db: ReturnType<typeof adminClient>,
  giveawayId: string,
): Promise<{ error: string } | { sent: number; already?: string }> {
  const { data: g, error } = await db
    .from('giveaways')
    .select('prize, winner_user_id, winner_label, entrants_notified_at')
    .eq('id', giveawayId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!g?.winner_user_id) return { error: 'Draw a winner first.' };
  if (!g.winner_label) return { error: 'Show the winner’s name in the app first, so everyone hears who won.' };
  if (g.entrants_notified_at) return { sent: 0, already: g.entrants_notified_at as string };
  const now = new Date().toISOString();
  const { data: rows, error: entriesError } = await db
    .from('giveaway_entries')
    .select('user_id')
    .eq('giveaway_id', giveawayId);
  if (entriesError) return { error: entriesError.message };
  // "$20 Coffee Daze gift card" -> "Coffee Daze"; other prizes are used as written.
  const name = (g.prize as string).replace(/^\$\s?\d[\d,.]*\s+/, '').replace(/\s+gift (card|certificate)s?$/i, '').trim() || g.prize;
  const message = {
    title: `🏆 Check who won the ${name} giveaway`,
    body: 'Tap to see if it was you!',
    data: { topic: 'giveaway_results', path: '/play' },
  };
  const people = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  try {
    const { sent } = await sendToMembers(db, new Map(people.map((id) => [id, message])), {
      job: 'giveaway_results',
      campaign: message.title,
    });
    if (sent > 0) await db.from('giveaways').update({ entrants_notified_at: now }).eq('id', giveawayId);
    return { sent };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** This week's Monday in Wichita, as YYYY-MM-DD. */
function wichitaMonday(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back)).toISOString().slice(0, 10);
}
