// Sends a push notification to everyone who opted in to a topic.
// Called by staff (from the admin site, with their Supabase session) or by a scheduled job.
// Body: { "topic": "daily" | "giveaways" | "weekend" | "breaking", "title": "...", "body": "...", "data": { ... } }

import { adminClient, cors, isCronRequest, json } from '../_shared/admin.ts';

const TOPICS = ['daily', 'giveaways', 'weekend', 'breaking'] as const;
type Topic = (typeof TOPICS)[number];

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

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

  const { topic, title, body, data } = (await req.json()) as {
    topic: Topic;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  };
  if (!TOPICS.includes(topic) || !title || !body) return json({ error: 'topic, title and body are required' }, 400);

  const db = adminClient();
  const { data: prefs, error: prefErr } = await db.from('notification_prefs').select('user_id').eq(topic, true);
  if (prefErr) return json({ error: prefErr.message }, 500);
  const userIds = (prefs ?? []).map((p) => p.user_id);
  if (!userIds.length) return json({ sent: 0 });

  // Look up tokens in batches to keep the query string short.
  const tokens: string[] = [];
  for (let i = 0; i < userIds.length; i += 500) {
    const { data: rows, error } = await db.from('push_tokens').select('token').in('user_id', userIds.slice(i, i + 500));
    if (error) return json({ error: error.message }, 500);
    tokens.push(...(rows ?? []).map((r) => r.token));
  }

  let sent = 0;
  const dead: string[] = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map((to) => ({ to, title, body, sound: 'default', data: { topic, ...data } }))),
    });
    if (!res.ok) return json({ error: `Expo push ${res.status}`, sent }, 502);
    const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
    tickets.forEach((t, j) => {
      if (t.status === 'ok') sent++;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j]);
    });
  }

  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  return json({ sent, removed: dead.length });
});
