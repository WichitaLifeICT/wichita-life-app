import { Linking, Platform } from 'react-native';

import { env } from '@/lib/env';
import { shareLink } from '@/lib/share';
import type { EventItem } from '@/lib/types';
import { shortDay, timeLabel } from '@/lib/format';

/** The event's page on the Wichita Life calendar, where it's actually posted. */
export const eventPageUrl = (e: EventItem) => e.url ?? `https://events.wichitalifeict.com`;

export function shareEvent(e: EventItem) {
  const when = `${shortDay(e.starts_at)}, ${timeLabel(e.starts_at, e.all_day)}`;
  return shareLink(eventPageUrl(e), `${e.title} · ${when}${e.venue ? ` · ${e.venue}` : ''}`);
}

/** A calendar file from the event-ics function; phones open it as "Add to Calendar". */
export function addToCalendar(e: EventItem) {
  return Linking.openURL(`${env.supabaseUrl}/functions/v1/event-ics?id=${e.id}`);
}

/** Apple Maps on iPhone, Google Maps everywhere else. */
export function openDirections(e: EventItem) {
  const place = [e.venue, e.address].filter(Boolean).join(', ') || e.title;
  const q = encodeURIComponent(/wichita/i.test(place) ? place : `${place}, Wichita, KS`);
  return Linking.openURL(
    Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`,
  );
}
