import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadState, Screen, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getEvent } from '@/lib/api';
import { dayHeading, timeLabel } from '@/lib/format';
import { openLink } from '@/lib/links';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const track = useTrack();
  const q = useQuery(() => getEvent(id), [id]);
  const e = q.data;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two, alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            Close
          </T>
        </Pressable>
      </View>
      <Screen>
        <LoadState loading={q.loading} error={q.error} empty={q.data === null ? 'This event is no longer listed.' : undefined} />
        {e ? (
          <View style={{ gap: Spacing.three }}>
            <View style={{ gap: Spacing.one }}>
              <T variant="label" color={Brand.red}>
                {dayHeading(e.starts_at)}
              </T>
              <T variant="heading" style={{ fontSize: 26, lineHeight: 31 }}>
                {e.title}
              </T>
              <View style={{ flexDirection: 'row', gap: Spacing.one }}>
                {e.tags.includes('free') ? <Tag label="Free" tone="green" /> : null}
                {e.is_sponsored ? <Tag label="Sponsor" /> : null}
              </View>
            </View>
            <View style={{ gap: Spacing.two }}>
              <Fact label="When" value={timeLabel(e.starts_at, e.all_day)} />
              {e.venue ? <Fact label="Where" value={[e.venue, e.address].filter(Boolean).join(', ')} /> : null}
              {e.price_text ? <Fact label="Cost" value={e.price_text} /> : null}
            </View>
            {e.description ? <T>{e.description}</T> : null}
            {e.url ? (
              <Button
                tone="red"
                label={e.url.includes('events.wichitalifeict.com') ? 'View on Wichita Life Events ↗' : 'Tickets & details ↗'}
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
