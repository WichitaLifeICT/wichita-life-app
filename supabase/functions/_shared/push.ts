import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { capture } from './posthog.ts';

export const TOPICS = ['daily', 'giveaways', 'weekend', 'breaking'] as const;
export type Topic = (typeof TOPICS)[number];

/** One notification; `path` opens that screen in the app when tapped (e.g. "/event/<id>"). */
export type PushMessage = { title: string; body: string; data?: Record<string, unknown> };

/**
 * What a send is, for the notifications dashboard: `job` names the kind of push (reminders, weekend, promo…).
 * `campaign` is the title of a one-to-many push (a staff send or the daily), so each one can be compared;
 * personal pushes leave it out because their titles carry friends' names.
 */
export type SendLabel = { job: string; campaign?: string };

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };
type Outgoing = PushMessage & { to: string; user: string };

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

/**
 * Sends through Expo's push service and removes tokens for apps that were uninstalled. Each member reached
 * is recorded in PostHog as `push_sent` (once per member, however many phones), so opens can be compared
 * with sends. The job and campaign ride along in the push so the app's `push_opened` carries them too.
 */
async function deliver(db: SupabaseClient, messages: Outgoing[], label: SendLabel) {
  let sent = 0;
  const dead: string[] = [];
  const reached = new Map<string, string>();
  const extra = { job: label.job, ...(label.campaign ? { campaign: label.campaign } : {}) };
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map(({ user: _user, ...m }) => ({ ...m, data: { ...m.data, ...extra }, sound: 'default' }))),
    });
    if (!res.ok) throw new Error(`Expo push ${res.status}`);
    const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
    tickets.forEach((t, j) => {
      if (t.status === 'ok') {
        sent++;
        reached.set(batch[j].user, String(batch[j].data?.topic ?? 'unknown'));
      } else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j].to);
    });
  }
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  await capture(
    [...reached].map(([user, kind]) => ({ event: 'push_sent', distinct_id: user, properties: { kind, ...extra } })),
  );
  return { sent, removed: dead.length };
}

/** Members who picked any of these interests (on the welcome screens or Account page). */
async function membersInterestedIn(db: SupabaseClient, interests: string[]) {
  const { data, error } = await db.from('profiles').select('id').overlaps('interests', interests);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((p) => p.id as string));
}

/** Sends one message to everyone who turned this topic on, optionally only those with one of these interests. */
export async function sendToTopic(
  db: SupabaseClient,
  topic: Topic,
  message: PushMessage,
  interests: string[] = [],
  label: SendLabel = { job: topic, campaign: message.title },
) {
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
    tokens.map((t) => ({ ...message, to: t.token, user: t.user_id, data: { topic, ...message.data } })),
    label,
  );
}

/** Sends one message to everyone in a Wichita Life group (joining a group is the opt-in). */
export async function sendToGroup(db: SupabaseClient, groupId: string, message: PushMessage) {
  const { data, error } = await db.from('group_members').select('user_id').eq('group_id', groupId);
  if (error) throw new Error(error.message);
  const tokens = await tokensFor(db, (data ?? []).map((m) => m.user_id as string));
  return await deliver(
    db,
    tokens.map((t) => ({
      ...message,
      to: t.token,
      user: t.user_id,
      data: { topic: 'group', group_id: groupId, ...message.data },
    })),
    { job: 'group', campaign: message.title },
  );
}

/** Sends each member their own message (e.g. reminders for their saved events). */
export async function sendToMembers(db: SupabaseClient, messages: Map<string, PushMessage>, label: SendLabel) {
  const tokens = await tokensFor(db, [...messages.keys()]);
  return await deliver(
    db,
    tokens.map((t) => ({ ...messages.get(t.user_id)!, to: t.token, user: t.user_id })),
    label,
  );
}
