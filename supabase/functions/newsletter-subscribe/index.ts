// Subscribes the signed-in member's email to the Wichita Life newsletter through beehiiv,
// then adds the +1 "newsletter" giveaway entry if they've entered the open giveaway.
// Existing subscribers get the bonus too. Uses the BEEHIIV_API_KEY secret.

import { adminClient, cors, json } from '../_shared/admin.ts';

const PUBLICATION_ID = Deno.env.get('BEEHIIV_PUBLICATION_ID') ?? 'pub_a063b428-f4ec-4b8a-acd8-865dbdea2ec5';
const SUBSCRIBED = ['active', 'validating'];

type Subscription = { status: string };

async function beehiiv(path: string, apiKey: string, init?: RequestInit) {
  return await fetch(`https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const apiKey = Deno.env.get('BEEHIIV_API_KEY');
  if (!apiKey) return json({ error: 'Newsletter signup is not set up yet' }, 500);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in first' }, 401);
  const db = adminClient();
  const { data: auth } = await db.auth.getUser(token);
  const user = auth.user;
  if (!user?.email) return json({ error: 'Sign in with an email address first' }, 401);
  const email = user.email.toLowerCase();

  // Already on the list?
  let status: string | undefined;
  const found = await beehiiv(`/subscriptions/by_email/${encodeURIComponent(email)}`, apiKey);
  if (found.ok) status = ((await found.json()) as { data: Subscription }).data.status;
  else if (found.status !== 404) return json({ error: `beehiiv ${found.status}` }, 502);

  if (!status || !SUBSCRIBED.includes(status)) {
    const created = await beehiiv('/subscriptions', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: 'wichita-life-app',
        utm_medium: 'app',
      }),
    });
    if (!created.ok) return json({ error: `beehiiv ${created.status}` }, 502);
    status = ((await created.json()) as { data: Subscription }).data.status;
  }

  const subscribed = SUBSCRIBED.includes(status);
  let bonus = false;
  if (subscribed) {
    const now = new Date().toISOString();
    const { data: giveaway } = await db
      .from('giveaways')
      .select('id')
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('ends_at')
      .limit(1)
      .maybeSingle();
    if (giveaway) {
      const { data: entered } = await db
        .from('giveaway_entries')
        .select('kind')
        .eq('giveaway_id', giveaway.id)
        .eq('user_id', user.id)
        .eq('kind', 'enter')
        .maybeSingle();
      if (entered) {
        const { error } = await db
          .from('giveaway_entries')
          .upsert(
            { giveaway_id: giveaway.id, user_id: user.id, kind: 'newsletter', entries: 1 },
            { onConflict: 'giveaway_id,user_id,kind', ignoreDuplicates: true },
          );
        bonus = !error;
      }
    }
  }
  return json({ status, subscribed, bonus });
});
