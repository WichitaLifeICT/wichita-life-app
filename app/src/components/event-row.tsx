import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableCard, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { isFree } from '@/lib/events';
import { dateNum, monthShort, timeLabel } from '@/lib/format';
import type { EventItem } from '@/lib/types';

export function EventRow({ event, onOpen }: { event: EventItem; onOpen?: () => void }) {
  return (
    <PressableCard
      style={styles.row}
      accessibilityRole="button"
      onPress={() => {
        onOpen?.();
        router.push({ pathname: '/event/[id]', params: { id: event.id } });
      }}>
      <View style={styles.date}>
        <T style={styles.month}>{monthShort(event.starts_at)}</T>
        <T style={styles.day}>{dateNum(event.starts_at)}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="cardTitle">{event.title}</T>
        <T variant="small">
          {timeLabel(event.starts_at, event.all_day, event.time_tbd)}
          {event.venue ? ` · ${event.venue}` : ''}
        </T>
        <View style={{ flexDirection: 'row', gap: Spacing.one }}>
          {isFree(event) ? <Tag label="Free" tone="green" /> : null}
          {event.is_sponsored ? <Tag label="Sponsor" /> : null}
        </View>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  date: {
    width: 52,
    alignItems: 'center',
    backgroundColor: Brand.orange,
    borderWidth: 2,
    borderColor: Brand.navy,
    borderRadius: 12,
    paddingVertical: 4,
  },
  month: { fontFamily: Fonts.display, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: Brand.navy },
  day: { fontFamily: Fonts.display, fontSize: 21, lineHeight: 24, color: Brand.navy },
});
