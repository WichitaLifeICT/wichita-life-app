import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { shortDay, timeLabel } from '@/lib/format';
import { openLink } from '@/lib/links';
import { getMeetupDetails, getMyRsvps } from '@/lib/member';
import type { Meetup } from '@/lib/types';

export type RsvpStatus = 'going' | 'waitlist';
type Place = Awaited<ReturnType<typeof getMeetupDetails>>;

/** Your RSVPs, and the exact venue of meetups you're going to (only readable once you're going). */
export async function loadMyMeetups(signedIn: boolean) {
  const myRsvps = signedIn ? await getMyRsvps() : ({} as Record<string, RsvpStatus>);
  const going = Object.entries(myRsvps)
    .filter(([, s]) => s === 'going')
    .map(([id]) => id);
  const details = Object.fromEntries(await Promise.all(going.map(async (id) => [id, await getMeetupDetails(id)] as const)));
  return { myRsvps, details: details as Record<string, Place> };
}

/**
 * One meetup: RSVP in the app, or a Sign up link for meetups hosted elsewhere.
 * `showGroup` labels it with its Wichita Life group (tap to open the group).
 */
export function MeetupCard({
  meetup: m,
  mine,
  place,
  onRsvp,
  showGroup = true,
}: {
  meetup: Meetup;
  mine?: RsvpStatus;
  place?: Place;
  onRsvp: () => void;
  showGroup?: boolean;
}) {
  const theme = useTheme();
  const track = useTrack();
  const group = showGroup && m.group ? m.group : null;
  const groupLabel = group ? (
    <T
      variant="small"
      color={Brand.blue}
      style={{ fontFamily: Fonts.display }}
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/group/[slug]', params: { slug: group.slug } })}>
      {group.name} ›
    </T>
  ) : null;

  if (m.signup_url) {
    const url = m.signup_url;
    return (
      <Card style={{ gap: Spacing.two }}>
        {groupLabel}
        <T variant="cardTitle">{m.title}</T>
        <T variant="small">
          {shortDay(m.starts_at)} · {timeLabel(m.starts_at)} · {m.area}
        </T>
        {m.description ? <T variant="small">{m.description}</T> : null}
        <View style={styles.between}>
          <T variant="small" style={{ flex: 1 }}>
            Sign up on {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
          </T>
          <Button
            small
            tone="red"
            label="Sign up ↗"
            onPress={() => {
              track('meetup_signup_opened', { meetup_id: m.id });
              openLink(url);
            }}
          />
        </View>
      </Card>
    );
  }

  const left = m.capacity - m.going;
  return (
    <Card style={{ gap: Spacing.two }}>
      {groupLabel}
      <View style={styles.between}>
        <T variant="cardTitle" style={{ flex: 1 }}>
          {m.title}
        </T>
        <T style={styles.seats}>{left > 0 ? `${left} spots left` : 'Waitlist'}</T>
      </View>
      <T variant="small">
        {shortDay(m.starts_at)} · {timeLabel(m.starts_at)} · {m.area}
      </T>
      {m.description ? <T variant="small">{m.description}</T> : null}
      {place ? (
        <T variant="small" color={theme.heading}>
          📍 {[place.venue, place.address].filter(Boolean).join(', ')}
        </T>
      ) : null}
      <View style={styles.between}>
        <T variant="small">
          {mine === 'going' ? "You're going · " : mine === 'waitlist' ? "You're on the waitlist · " : ''}
          {m.going} going
        </T>
        <Button
          small
          tone={mine ? 'ghost' : 'red'}
          label={mine ? 'Cancel' : left > 0 ? 'RSVP' : 'Join waitlist'}
          onPress={onRsvp}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  seats: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: Brand.redText },
});
