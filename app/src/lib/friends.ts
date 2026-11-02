/**
 * Friends: mutual connections between members. Adding someone from their friend link makes you
 * friends right away; tapping their name elsewhere sends a request they accept. Friends see
 * plans you show to friends, get plans you send them, and see which events friends saved.
 */
import { WEB_URL } from '@/lib/referral';
import { shareLink } from '@/lib/share';
import { supabase } from '@/lib/supabase';

export type Friend = { id: string; name: string | null; status: 'friend' | 'incoming' | 'sent'; since: string };

export type FriendPlan = {
  id: string;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  owner_name: string | null;
  /** Sent to you directly (rather than shown to all their friends). */
  sent: boolean;
  im_in: boolean;
  items: number;
};

function db() {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  return supabase;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const getFriends = () => rpc<Friend[]>('my_friends').then((d) => d ?? []);
export const getFriendsPlans = () => rpc<FriendPlan[]>('friends_plans').then((d) => d ?? []);

/** Returns 'pending' (they'll get a request), 'accepted' (they'd asked you) or 'already'. */
export const requestFriend = (member: string) => rpc<'pending' | 'accepted' | 'already'>('request_friend', { member });
export const respondFriend = (member: string, accept: boolean) => rpc<void>('respond_friend', { member, accept });
export const removeFriend = (member: string) => rpc<void>('remove_friend', { member });
export const addFriendByCode = (code: string) => rpc<{ id: string; name: string }>('add_friend_by_code', { code });
export const friendLinkOwner = (code: string) => rpc<string | null>('friend_link_owner', { code });
export const sendPlan = (plan: string, friends: string[]) => rpc<number>('send_plan', { plan, friends });

/** Friends who saved these events: event id → first names. */
export async function friendsSaved(eventIds: string[]): Promise<Map<string, string[]>> {
  if (!eventIds.length) return new Map();
  const rows = await rpc<{ event_id: string; names: string[] }[]>('friends_saved', { events: eventIds });
  return new Map((rows ?? []).map((r) => [r.event_id, r.names]));
}

/** Your friend link. It's your invite code too, so friends who join from it count as your referral. */
export const friendLink = (code: string) => `${WEB_URL}/f/${code}?ref=${code}`;

export function shareFriendLink(code: string, name?: string | null) {
  return shareLink(friendLink(code), `Add me${name ? ` (${name.split(' ')[0]})` : ''} on Wichita Life so we can make plans:`);
}

/** "Ana and Ben saved this", "Ana, Ben and 2 more saved this". */
export function namesLabel(names: string[], verb: string) {
  if (!names.length) return null;
  const shown = names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} more`] : names;
  return `${shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`} ${verb}`;
}
