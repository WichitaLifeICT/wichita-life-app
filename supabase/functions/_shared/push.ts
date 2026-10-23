import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const TOPICS = ['daily', 'giveaways', 'weekend', 'breaking'] as const;
export type Topic = (typeof TOPICS)[number];

/** One notification; `path` opens that screen in the app when tapped (e.g. "/event/<id>"). */
export type PushMessage = { title: string; body: string; data?: Record<string, unknown> };

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

/** Push tokens for these members, looked up in batches to keep the query string short. */
async function tokensFor(db: SupabaseClient, userIds: string[]) {
  const rows: { user_id: string; token: string }[] = [];
  for (let i = 0; i < userIds.length; i += 500) {
    const { data, error } = await db.from('push_tokens').select('user_id, token').in('user_id', userIds.slice(i, i + 500));
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}

/** Sends through Expo's push service and removes tokens for apps that were uninstalled. */
async function deliver(db: SupabaseClient, messages: (PushMessage & { to: string })[]) {
  let sent = 0;
  const dead: string[] = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map((m) => ({ ...m, sound: 'default' }))),
    });
    if (!res.ok) throw new Error(`Expo push ${res.status}`);
    const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
    tickets.forEach((t, j) => {
      if (t.status === 'ok') sent++;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j].to);
    });
  }
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  return { sent, removed: dead.length };
}

/** Members who picked any of these interests (on the welcome screens or Account page). */
async function membersInterestedIn(db: SupabaseClient, interests: string[]) {
  const { data, error } = await db.from('profiles').select('id').overlaps('interests', interests);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((p) => p.id as string));
}

/** Sends one message to everyone who turned this topic on, optionally only those with one of these interests. */
export async function sendToTopic(db: SupabaseClient, topic: Topic, message: PushMessage, interests: string[] = []) {
  const { data: prefs, error } = await db.from('notification_prefs').select('user_id').eq(topic, true);
  if (error) throw new Error(error.message);
  let ids = (prefs ?? []).map((p) => p.user_id as string);
  if (interests.length) {
    const interested = await membersInterestedIn(db, interests);
    ids = ids.filter((id) => interested.has(id));
  }
  const tokens = await tokensFor(db, ids);
  return await deliver(
    db,
    tokens.map((t) => ({ ...message, to: t.token, data: { topic, ...message.data } })),
  );
}

/** Sends one message to everyone in a Wichita Life group (joining a group is the opt-in). */
export async function sendToGroup(db: SupabaseClient, groupId: string, message: PushMessage) {
  const { data, error } = await db.from('group_members').select('user_id').eq('group_id', groupId);
  if (error) throw new Error(error.message);
  const tokens = await tokensFor(db, (data ?? []).map((m) => m.user_id as string));
  return await deliver(
    db,
    tokens.map((t) => ({ ...message, to: t.token, data: { topic: 'group', group_id: groupId, ...message.data } })),
  );
}

/** Sends each member their own message (e.g. reminders for their saved events). */
export async function sendToMembers(db: SupabaseClient, messages: Map<string, PushMessage>) {
  const tokens = await tokensFor(db, [...messages.keys()]);
  return await deliver(
    db,
    tokens.map((t) => ({ ...messages.get(t.user_id)!, to: t.token })),
  );
}
