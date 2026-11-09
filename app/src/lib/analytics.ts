import * as Linking from 'expo-linking';
import PostHog from 'posthog-react-native';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { env, isPosthogConfigured } from '@/lib/env';

/**
 * One shared client; null until EXPO_PUBLIC_POSTHOG_KEY is set, so tracking is a no-op in dev.
 * Crashes and unhandled errors go to PostHog → Error tracking. Screens that crash while drawing
 * are reported by the error boundary in app/_layout.tsx.
 */
export const posthog = isPosthogConfigured
  ? new PostHog(env.posthogKey, {
      host: env.posthogHost,
      errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true } },
    })
  : null;

/**
 * Every product event the app sends, with its properties. Adding an event here is
 * the only way to send one, so the PostHog dashboard stays tidy. See docs/ANALYTICS.md.
 */
export type AnalyticsEvents = {
  onboarding_step_viewed: { step: 'welcome' | 'interests' | 'notifications' };
  onboarding_completed: { interests: string[]; notifications: boolean; skipped: boolean; deals: boolean };
  notification_permission_result: { granted: boolean; source: 'onboarding' | 'giveaway' | 'settings' | 'save_event' };
  /** Turned on Giveaways & deals (opt-in promotional pushes). Onboarding opt-ins show as onboarding_completed deals = true. */
  deals_opted_in: { source: 'giveaway' };
  push_opened: { kind: string; target?: string };
  guide_opened: { slug: string };
  game_opened: { game: string; from: 'today' | 'play' };
  story_opened: { post_id: string; kind: string; from: 'today' | 'explore' | 'push' };
  news_opened: { source: string; url: string };
  event_viewed: { event_id: string; title: string; from: 'today' | 'for_you' | 'events' | 'push' };
  event_saved: { event_id: string; saved: boolean };
  event_shared: { event_id: string };
  event_calendar_added: { event_id: string };
  event_directions: { event_id: string };
  event_link_opened: { event_id: string; url: string };
  events_filtered: { filter: string };
  pick_dismissed: { event_id: string; action: 'hide' | 'interest'; interest?: string };
  search_used: { query: string; results: number };
  search_opened: { kind: string };
  eat_picked: { category: string; local_only: boolean; again: boolean };
  activity_picked: { kind: string; again: boolean };
  activity_opened: { activity_id: string; action: 'directions' | 'website' };
  eat_opened: { place_id: string; action: 'directions' | 'website' };
  weekly_suggested: { kind: string };
  plan_created: { from: 'plans' | 'add_to_plan' };
  plan_item_added: { kind: string; new_plan: boolean };
  plan_shared: { items: number };
  plan_calendar_added: { mine: boolean; items: number };
  calendar_subscribed: { how: 'subscribe' | 'link' };
  plan_posted: { items: number };
  plan_joined: { joining: boolean };
  plan_sent_to_friends: { friends: number };
  friend_link_shared: { how: 'link' | 'qr' };
  friend_added: { how: 'link' | 'request' };
  plan_copied: { from: 'public' | 'link' };
  plan_reported: { plan_id: string };
  plan_viewed_shared: { mine: boolean; items: number };
  weekly_opened: { special_id: string; kind: string; action: 'directions' | 'link' | 'share' };
  event_submit_opened: { from: 'events' };
  job_opened: { url: string };
  sponsor_clicked: { sponsor: string; placement: 'feed' };
  giveaway_entered: { giveaway_id: string };
  giveaway_bonus_started: { giveaway_id: string; kind: 'share' | 'newsletter' | 'save_event' | 'poll_vote' };
  meetup_rsvp: { meetup_id: string; status: 'going' | 'waitlist' | 'canceled' };
  group_joined: { group_id: string; joined: boolean };
  group_opened: { slug: string };
  meetup_signup_opened: { meetup_id: string };
  club_opened: { club_id: string; category: string };
  club_suggested: { type: 'club' | 'group'; category?: string };
  thread_opened: { thread_id: string };
  thread_submitted: { category: string };
  reply_posted: { thread_id: string };
  content_reported: { kind: 'thread' | 'reply' };
  feedback_sent: { kind: string };
  spotlight_nominate_opened: { from: string };
  spotlight_nominated: { signed_in: boolean };
  poll_voted: { poll_id: string; changed: boolean; daily?: boolean };
  poll_suggested: { poll_id: string };
  newsletter_signup: { source: 'explore' | 'giveaway' };
  sign_in_prompt_tapped: { from: string };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

/** Typed wrapper around PostHog. Safe to call when PostHog isn't configured. */
export function useTrack() {
  return useCallback(<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]) => {
    posthog?.capture(event, props as Record<string, string | number | boolean | string[]>);
  }, []);
}

/**
 * Opening the app or site once with ?team=1 marks that phone or browser as staff, so it's left out
 * of PostHog's numbers even when nobody is signed in (Internal / Test users cohort). Harmless if a
 * member finds it: it only hides their own visits from our charts.
 */
export function useTeamDeviceFlag() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    const href = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : url;
    if (href && Linking.parse(href).queryParams?.team === '1') {
      posthog?.capture('$set', { $set: { $internal_or_test_user: true } });
    }
  }, [url]);
}
