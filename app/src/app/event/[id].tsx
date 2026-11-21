import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddToPlanButton } from '@/components/add-to-plan-button';
import { FriendsSaved } from '@/components/friends-card';
import { SendEvent } from '@/components/send-event';
import { StaffEventTools } from '@/components/staff-event-tools';
import { Button, LoadState, ModalClose, MoreButton, Screen, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getEvent } from '@/lib/api';
import { isMusicShow } from '@/lib/arts';
import { genresOf, isFree, isSponsored } from '@/lib/events';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { dayHeading, timeLabel } from '@/lib/format';
import { openLink } from '@/lib/links';
import { addToCalendar, openDirections } from '@/lib/event-actions';
import { eventSentToMe } from '@/lib/friends';
import { bumpInterest, interestedLabel, useInterestCount } from '@/lib/interest';
import { getSavedEventIds, setEventSaved } from '@/lib/member';
import { enablePush, getPushPermission } from '@/lib/push';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const track = useTrack();
  const q = useQuery(() => getEvent(id), [id]);
  const e = q.data;
  const { session, profile } = useAuth();
  const isStaff = !!profile && profile.role !== 'member';
  const requireSignIn = useRequireSignIn();
  const savedQ = useQuery(async () => (session ? (await getSavedEventIds()).has(id) : false), [id, session?.user.id]);
  const [savedOverride, setSavedOverride] = useState<boolean>();
  const [sharing, setSharing] = useState(false);
  const saved = savedOverride ?? savedQ.data ?? false;
  const interested = useInterestCount(id, true);
  const sentQ = useQuery(() => (session ? eventSentToMe(id) : Promise.resolve([])), [id, session?.user.id]);

  // "Interested" saves the event to their account (with a reminder the evening before) and adds
  // them to the public count.
  const toggleSave = () => {
    if (!requireSignIn('Sign in to mark events you’re interested in')) return;
    const next = !saved;
    setSavedOverride(next);
    bumpInterest(id, next ? 1 : -1);
    track('event_saved', { event_id: id, saved: next });
    setEventSaved(id, next).catch(() => {
      setSavedOverride(!next);
      bumpInterest(id, next ? -1 : 1);
    });
    // Reminders go out the evening before; ask for notifications the first time someone saves.
    if (next)
      getPushPermission().then((p) => {
        if (p === 'undetermined') enablePush('save_event');
      });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <ModalClose />
      <Screen>
        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data === null ? 'This event is no longer listed.' : undefined}
        />
        {e ? (
          <View style={{ gap: Spacing.three }}>
            <View style={{ gap: Spacing.one }}>
              <T variant="label" color={Brand.redText}>
                {dayHeading(e.starts_at)}
              </T>
              <T variant="heading" style={{ fontSize: 26, lineHeight: 31 }}>
                {e.title}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }}>
                {isFree(e) ? <Tag label="Free" tone="green" /> : null}
                {isMusicShow(e) ? <Tag label="Live music" tone="blue" /> : null}
                {genresOf(e).map((g) => (
                  <Tag key={g} label={g} />
                ))}
                {isSponsored(e) ? <Tag label="Sponsor" /> : null}
              </View>
            </View>
            <View style={{ gap: Spacing.two }}>
              <Fact label="When" value={timeLabel(e.starts_at, e.all_day, e.time_tbd)} />
              {e.venue ? <Fact label="Where" value={[e.venue, e.address].filter(Boolean).join(', ')} /> : null}
              {e.price_text ? <Fact label="Cost" value={e.price_text} /> : null}
            </View>
            {/* Interested and Share up top; Add to plan, then the rest under More, so the screen isn't a wall of buttons. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two }}>
              <Button tone={saved ? 'done' : 'navy'} label={saved ? '★ Interested' : '☆ Interested'} onPress={toggleSave} />
              <Button tone="red" label="📨 Share" onPress={() => setSharing(!sharing)} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two }}>
              <AddToPlanButton kind="event" id={e.id} title={e.title} />
              <MoreButton
                title={e.title}
                actions={[
                  {
                    label: 'Save to phone calendar',
                    onPress: () => {
                      track('event_calendar_added', { event_id: e.id });
                      addToCalendar(e);
                    },
                  },
                  ...(e.venue || e.address
                    ? [
                        {
                          label: 'Directions',
                          onPress: () => {
                            track('event_directions', { event_id: e.id });
                            openDirections(e);
                          },
                        },
                      ]
                    : []),
                ]}
              />
            </View>
            {sharing ? <SendEvent event={e} onClose={() => setSharing(false)} /> : null}
            {interested ? (
              <T variant="small" style={{ fontFamily: Fonts.display }}>
                🙌 {interestedLabel(interested)}
              </T>
            ) : null}
            <FriendsSaved eventId={e.id} />
            {(sentQ.data ?? []).slice(0, 2).map((s) => (
              <T key={s.sent_at} variant="small" style={{ fontFamily: Fonts.display }}>
                📨 {s.name ?? 'A friend'} sent you this{s.note ? `: “${s.note}”` : ''}
              </T>
            ))}
            {saved ? (
              <T variant="small">Saved to your account. With notifications on, we’ll remind you the evening before.</T>
            ) : null}
            {e.description ? <T>{e.description}</T> : null}
            {e.url ? (
              <Button
                tone="red"
                label={
                  e.url.includes('events.wichitalifeict.com') ? 'View on Wichita Life Events ↗' : 'Tickets & details ↗'
                }
                onPress={() => {
                  track('event_link_opened', { event_id: e.id, url: e.url! });
                  openLink(e.url!);
                }}
              />
            ) : null}
            {isStaff ? <StaffEventTools key={`${e.id}:${e.starts_at}:${e.title}`} event={e} onChanged={q.refresh} /> : null}
          </View>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
      <T variant="small" style={{ width: 64 }}>
        {label}
      </T>
      <T style={{ flex: 1 }}>{value}</T>
    </View>
  );
}
