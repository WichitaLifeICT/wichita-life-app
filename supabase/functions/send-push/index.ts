// Sends a push notification to everyone who opted in to a topic.
// Called by staff (from Staff tools, with their Supabase session) or by a scheduled job.
// Body: { "topic": "daily" | "giveaways" | "weekend" | "breaking", "title": "...", "body": "...", "data": { "path": "/win" },
//         "interests": ["music", "food"] }  (optional: only members who picked one of these interests)
// Or { "group": "<group id>", "title", "body", "data" } to send to a Wichita Life group's members (no topic).
// Or { "winner": "<giveaway id>" } to tell that giveaway's drawn winner they won (once per draw),
// or { "entrants": "<giveaway id>" } to tell everyone else who entered who won (once per draw).
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

  const { topic, title, body, data, interests, group, winner, entrants } = (await req.json()) as {
    topic?: Topic;
    group?: string;
    winner?: string;
    entrants?: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    interests?: string[];
  };
  const db = adminClient();
  if (winner || entrants) {
    const result = winner ? await notifyWinner(db, winner) : await tellEntrants(db, entrants!);
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
 * Tells a giveaway's winner they won, on every phone where they allowed notifications. It's about
 * their own entry, not a promotion, so it doesn't need Giveaways & deals turned on. Sent once per draw.
 */
async function notifyWinner(
  db: ReturnType<typeof adminClient>,
  giveawayId: string,
): Promise<{ error: string } | { sent: number; already?: string }> {
  const { data: g, error } = await db
    .from('giveaways')
    .select('prize, winner_user_id, winner_notified_at')
    .eq('id', giveawayId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!g?.winner_user_id) return { error: 'Draw a winner first.' };
  if (g.winner_notified_at) return { sent: 0, already: g.winner_notified_at as string };
  try {
    const { sent } = await sendToMembers(
      db,
      new Map([
        [
          g.winner_user_id as string,
          {
            title: '🎉 You won a Wichita Life giveaway!',
            body: `You won the ${g.prize}. Check your email for a message from update@wichitalifeict.com and reply within 7 days to claim it.`,
            data: { topic: 'giveaway_winner', path: '/play' },
          },
        ],
      ]),
      { job: 'giveaway_winner' },
    );
    if (sent > 0) {
      await db.from('giveaways').update({ winner_notified_at: new Date().toISOString() }).eq('id', giveawayId);
    }
    return { sent };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Tells everyone else who entered a giveaway who won ("Sarah M. won the $20 Coffee Daze gift card!"),
 * and that the next giveaway is open if one is. It's the result of something they entered, so it
 * doesn't need Giveaways & deals turned on. Needs the winner's name shown in the app first.
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
  const [{ data: rows, error: entriesError }, { data: open }] = await Promise.all([
    db.from('giveaway_entries').select('user_id').eq('giveaway_id', giveawayId).neq('user_id', g.winner_user_id),
    db.from('giveaways').select('id').lte('starts_at', now).gte('ends_at', now).limit(1).maybeSingle(),
  ]);
  if (entriesError) return { error: entriesError.message };
  const message = {
    title: `🏆 ${g.winner_label} won the ${g.prize}!`,
    body: open ? 'Thanks for entering. A new giveaway is open now: tap to enter.' : 'Thanks for entering! Watch for the next giveaway.',
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
