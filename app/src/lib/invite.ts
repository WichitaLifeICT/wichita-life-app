import { WEB_URL } from '@/lib/referral';
import { shareLink } from '@/lib/share';

/**
 * Inviting someone to Wichita Life. The link opens the get-the-app page, which sends iPhones to the
 * App Store and Android phones to Google Play. Members' links carry their invite code (?ref=), and
 * the message spells the code out too, since it can't ride along through an app store: new members
 * enter it in Account in their first week, and the inviter earns giveaway bonus entries.
 */
export function appInviteLink(code?: string) {
  return `${WEB_URL}/get?from=invite${code ? `&ref=${code}` : ''}`;
}

export function shareAppInvite(code?: string) {
  const pitch = 'Get the Wichita Life app: events, live music, deals, giveaways and meetups around Wichita. It’s free.';
  return shareLink(appInviteLink(code), code ? `${pitch} Use my invite code ${code} when you sign up:` : pitch);
}
