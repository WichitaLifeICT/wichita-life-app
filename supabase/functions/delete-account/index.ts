// Deletes the signed-in member's account and everything tied to it (saves, RSVPs, entries,
// board posts), which the database removes through `on delete cascade`.
// The app stores require in-app account deletion for any app with sign-up.

import { adminClient, cors, json } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in first' }, 401);
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Sign in first' }, 401);

  const { error: delErr } = await db.auth.admin.deleteUser(data.user.id);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ deleted: true });
});
