/**
 * Things signed-in members do. Every write here is checked again by the database's
 * row-level security rules (supabase/migrations), so the app can't grant itself anything.
 */
import { supabase } from '@/lib/supabase';
import type { EventItem, NotificationPrefs, ThreadCategory } from '@/lib/types';

async function me() {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Sign in first');
  return { db: supabase, id };
}

// Profile -------------------------------------------------------------------

export async function updateProfile(fields: { display_name?: string; interests?: string[]; onboarded?: boolean }) {
  const { db, id } = await me();
  const { onboarded, ...rest } = fields;
  const { error } = await db
    .from('profiles')
    .update({
      ...rest,
      ...(onboarded ? { onboarded_at: new Date().toISOString() } : {}),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs | null> {
  const { db, id } = await me();
  const { data, error } = await db
    .from('notification_prefs')
    .select('daily, giveaways, weekend, breaking')
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setNotificationPref(key: keyof NotificationPrefs, value: boolean) {
  const { db, id } = await me();
  const { error } = await db
    .from('notification_prefs')
    .update({ [key]: value, updated_at: new Date().toISOString() })
    .eq('user_id', id);
  if (error) throw error;
}

// Saved events ----------------------------------------------------------------

export async function getSavedEventIds(): Promise<Set<string>> {
  const { db, id } = await me();
  const { data, error } = await db.from('saved_events').select('event_id').eq('user_id', id);
  if (error) throw error;
  return new Set(data.map((r) => r.event_id));
}

export async function getSavedEvents(): Promise<EventItem[]> {
  const { db, id } = await me();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data, error } = await db
    .from('saved_events')
    .select('event:events!inner(*)')
    .eq('user_id', id)
    .gte('event.starts_at', startOfToday.toISOString());
  if (error) throw error;
  return data
    .map((r) => (Array.isArray(r.event) ? r.event[0] : r.event) as EventItem)
    .filter(Boolean)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function setEventSaved(eventId: string, saved: boolean) {
  const { db, id } = await me();
  const { error } = saved
    ? await db.from('saved_events').upsert({ user_id: id, event_id: eventId }, { ignoreDuplicates: true })
    : await db.from('saved_events').delete().eq('user_id', id).eq('event_id', eventId);
  if (error) throw error;
}

// Giveaways -------------------------------------------------------------------

/** Entries this member has in a giveaway, by kind ('enter', 'save_event', ...). */
export async function getMyEntries(giveawayId: string): Promise<Record<string, number>> {
  const { db, id } = await me();
  const { data, error } = await db
    .from('giveaway_entries')
    .select('kind, entries')
    .eq('giveaway_id', giveawayId)
    .eq('user_id', id);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.kind, r.entries]));
}

export async function enterGiveaway(giveawayId: string) {
  const { db, id } = await me();
  const { error } = await db
    .from('giveaway_entries')
    .upsert({ giveaway_id: giveawayId, user_id: id, kind: 'enter' }, { ignoreDuplicates: true });
  if (error) throw error;
}

// Meetups and groups ------------------------------------------------------------

export type MyRsvp = { status: 'going' | 'waitlist' };

export async function getMyRsvps(): Promise<Record<string, MyRsvp['status']>> {
  const { db, id } = await me();
  const { data, error } = await db.from('rsvps').select('meetup_id, status').eq('user_id', id);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.meetup_id, r.status]));
}

/** RSVPs past capacity land on the waitlist (decided by the database). Returns the status given. */
export async function rsvp(meetupId: string): Promise<MyRsvp['status']> {
  const { db, id } = await me();
  const { data, error } = await db.from('rsvps').insert({ meetup_id: meetupId, user_id: id }).select('status').single();
  if (error) throw error;
  return data.status;
}

export async function cancelRsvp(meetupId: string) {
  const { db, id } = await me();
  const { error } = await db.from('rsvps').delete().eq('meetup_id', meetupId).eq('user_id', id);
  if (error) throw error;
}

/** Exact venue and address, only readable once you're going. */
export async function getMeetupDetails(meetupId: string) {
  const { db } = await me();
  const { data, error } = await db
    .from('meetup_private')
    .select('venue, address, host_notes')
    .eq('meetup_id', meetupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyGroupIds(): Promise<Set<string>> {
  const { db, id } = await me();
  const { data, error } = await db.from('group_members').select('group_id').eq('user_id', id);
  if (error) throw error;
  return new Set(data.map((r) => r.group_id));
}

export async function setGroupJoined(groupId: string, joined: boolean) {
  const { db, id } = await me();
  const { error } = joined
    ? await db.from('group_members').upsert({ group_id: groupId, user_id: id }, { ignoreDuplicates: true })
    : await db.from('group_members').delete().eq('group_id', groupId).eq('user_id', id);
  if (error) throw error;
}

// Community board ---------------------------------------------------------------

export async function submitThread(category: ThreadCategory, title: string, body: string) {
  const { db, id } = await me();
  const { error } = await db.from('threads').insert({
    author_id: id,
    category,
    title: title.trim(),
    body: body.trim(),
  });
  if (error) throw error;
}

export async function reportThread(threadId: string, reason: string) {
  const { db, id } = await me();
  const { error } = await db.from('reports').insert({ reporter_id: id, thread_id: threadId, reason });
  if (error) throw error;
}

export async function blockMember(memberId: string) {
  const { db, id } = await me();
  const { error } = await db
    .from('blocks')
    .upsert({ blocker_id: id, blocked_id: memberId }, { ignoreDuplicates: true });
  if (error) throw error;
}
