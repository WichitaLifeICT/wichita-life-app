import PostHog from 'posthog-react-native';
import { useCallback } from 'react';

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
  onboarding_completed: { interests: string[]; notifications: boolean; skipped: boolean };
  notification_permission_result: { granted: boolean; source: 'onboarding' | 'giveaway' | 'settings' | 'save_event' };
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
  search_used: { query: string; results: number };
  search_opened: { kind: string };
  eat_picked: { category: string; local_only: boolean; again: boolean };
  eat_opened: { place_id: string; action: 'directions' | 'website' };
  weekly_opened: { special_id: string; kind: string; action: 'directions' | 'link' };
  event_submit_opened: { from: 'events' };
  job_opened: { url: string };
  sponsor_clicked: { sponsor: string; placement: 'feed' };
  giveaway_entered: { giveaway_id: string };
  giveaway_bonus_started: { giveaway_id: string; kind: 'share' | 'newsletter' | 'save_event' };
  meetup_rsvp: { meetup_id: string; status: 'going' | 'waitlist' | 'canceled' };
  group_joined: { group_id: string; joined: boolean };
  thread_opened: { thread_id: string };
  thread_submitted: { category: string };
  reply_posted: { thread_id: string };
  content_reported: { kind: 'thread' | 'reply' };
  feedback_sent: { kind: string };
  poll_voted: { poll_id: string; changed: boolean };
  poll_suggested: { poll_id: string };
  newsletter_signup: { source: 'explore' | 'giveaway' };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

/** Typed wrapper around PostHog. Safe to call when PostHog isn't configured. */
export function useTrack() {
  return useCallback(<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]) => {
    posthog?.capture(event, props as Record<string, string | number | boolean | string[]>);
  }, []);
}
