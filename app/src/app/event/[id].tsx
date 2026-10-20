import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadState, Screen, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getEvent } from '@/lib/api';
import { genresOf, isFree, isLiveMusic } from '@/lib/events';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { dayHeading, timeLabel } from '@/lib/format';
import { openLink } from '@/lib/links';
import { getSavedEventIds, setEventSaved } from '@/lib/member';
import { enablePush, getPushPermission } from '@/lib/push';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const track = useTrack();
  const q = useQuery(() => getEvent(id), [id]);
  const e = q.data;
  const { session } = useAuth();
  const requireSignIn = useRequireSignIn();
  const savedQ = useQuery(async () => (session ? (await getSavedEventIds()).has(id) : false), [id, session?.user.id]);
  const [savedOverride, setSavedOverride] = useState<boolean>();
  const saved = savedOverride ?? savedQ.data ?? false;

  const toggleSave = () => {
    if (!requireSignIn('Sign in to save events')) return;
    const next = !saved;
    setSavedOverride(next);
    track('event_saved', { event_id: id, saved: next });
    setEventSaved(id, next).catch(() => setSavedOverride(!next));
    // Reminders go out the evening before; ask for notifications the first time someone saves.
    if (next)
      getPushPermission().then((p) => {
        if (p === 'undetermined') enablePush('save_event');
      });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          paddingHorizontal: Spacing.three,
          paddingTop: Spacing.two,
          alignItems: 'flex-end',
        }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            Close
          </T>
        </Pressable>
      </View>
      <Screen>
        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data === null ? 'This event is no longer listed.' : undefined}
        />
        {e ? (
          <View style={{ gap: Spacing.three }}>
            <View style={{ gap: Spacing.one }}>
              <T variant="label" color={Brand.red}>
                {dayHeading(e.starts_at)}
              </T>
              <T variant="heading" style={{ fontSize: 26, lineHeight: 31 }}>
                {e.title}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }}>
                {isFree(e) ? <Tag label="Free" tone="green" /> : null}
                {isLiveMusic(e) ? <Tag label="Live music" tone="blue" /> : null}
                {genresOf(e).map((g) => (
                  <Tag key={g} label={g} />
                ))}
                {e.is_sponsored ? <Tag label="Sponsor" /> : null}
              </View>
            </View>
            <View style={{ gap: Spacing.two }}>
              <Fact label="When" value={timeLabel(e.starts_at, e.all_day)} />
              {e.venue ? <Fact label="Where" value={[e.venue, e.address].filter(Boolean).join(', ')} /> : null}
              {e.price_text ? <Fact label="Cost" value={e.price_text} /> : null}
            </View>
            <Button tone={saved ? 'done' : 'navy'} label={saved ? '✓ Saved' : 'Save event'} onPress={toggleSave} />
            {saved ? <T variant="small">Saved to your account. With notifications on, we’ll remind you the evening before.</T> : null}
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
