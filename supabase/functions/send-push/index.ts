// Sends a push notification to everyone who opted in to a topic.
// Called by staff (from Staff tools, with their Supabase session) or by a scheduled job.
// Body: { "topic": "daily" | "giveaways" | "weekend" | "breaking", "title": "...", "body": "...", "data": { "path": "/win" } }

import { adminClient, cors, isCronRequest, json } from '../_shared/admin.ts';
import { sendToTopic, TOPICS, type Topic } from '../_shared/push.ts';

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

  try {
    return json(await sendToTopic(adminClient(), topic, { title, body, data }));
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
