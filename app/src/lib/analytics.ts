import PostHog from 'posthog-react-native';
import { useCallback } from 'react';

import { env, isPosthogConfigured } from '@/lib/env';

/** One shared client; null until EXPO_PUBLIC_POSTHOG_KEY is set, so tracking is a no-op in dev. */
export const posthog = isPosthogConfigured ? new PostHog(env.posthogKey, { host: env.posthogHost }) : null;

/**
 * Every product event the app sends, with its properties. Adding an event here is
 * the only way to send one, so the PostHog dashboard stays tidy. See docs/ANALYTICS.md.
 */
export type AnalyticsEvents = {
  onboarding_step_viewed: { step: 'welcome' | 'interests' | 'notifications' };
  onboarding_completed: { interests: string[]; notifications: boolean };
  notification_permission_result: { granted: boolean; source: 'onboarding' | 'giveaway' | 'settings' | 'save_event' };
  push_opened: { kind: string; target?: string };
  guide_opened: { slug: string };
  story_opened: { post_id: string; kind: string; from: 'today' | 'read' | 'push' };
  news_opened: { source: string; url: string };
  event_viewed: { event_id: string; from: 'today' | 'events' | 'push' };
  event_saved: { event_id: string; saved: boolean };
  event_link_opened: { event_id: string; url: string };
  events_filtered: { filter: string };
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
  newsletter_signup: { source: 'read' | 'giveaway' };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

/** Typed wrapper around PostHog. Safe to call when PostHog isn't configured. */
export function useTrack() {
  return useCallback(<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]) => {
    posthog?.capture(event, props as Record<string, string | number | boolean | string[]>);
  }, []);
}
