import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { genresOf, isFree } from '@/lib/events';
import { dayHeading, timeParts } from '@/lib/format';
import type { EventItem } from '@/lib/types';

function details(e: EventItem) {
  const price = isFree(e) ? 'No cover' : e.price_text;
  return [e.venue, price, genresOf(e).slice(0, 2).join(' · ')].filter(Boolean).join(' · ');
}

function useOpen() {
  const track = useTrack();
  return (e: EventItem) => {
    track('event_viewed', { event_id: e.id, from: 'events' });
    router.push({ pathname: '/event/[id]', params: { id: e.id } });
  };
}

/** Tonight's shows on a dark card: big start times, band, venue, cover and genre. */
export function TonightShows({ events, label }: { events: EventItem[]; label: string }) {
  const open = useOpen();
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={styles.between}>
        <T variant="title">{label}</T>
        <T variant="small">
          {events.length} show{events.length === 1 ? '' : 's'}
        </T>
      </View>
      <View style={styles.tonight}>
        {events.map((e, i) => {
          const { time, ampm } = timeParts(e.starts_at);
          const genres = genresOf(e);
          return (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              onPress={() => open(e)}
              style={[styles.tonightRow, i > 0 && styles.tonightDivider]}>
              <View style={styles.timeCol}>
                <T style={styles.bigTime}>{e.all_day ? 'All' : time}</T>
                <T style={styles.ampm}>{e.all_day ? 'DAY' : ampm}</T>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <T style={styles.band}>{e.title}</T>
                {e.venue ? <T style={styles.venue}>{e.venue}</T> : null}
                <View style={styles.badges}>
                  {isFree(e) ? (
                    <T style={[styles.badge, { backgroundColor: '#E0F1E5' }]}>No cover</T>
                  ) : e.price_text ? (
                    <T style={[styles.badge, { backgroundColor: Brand.white }]}>{e.price_text}</T>
                  ) : null}
                  {genres.length ? (
                    <T style={[styles.badge, { backgroundColor: '#FDE9C8' }]}>{genres.slice(0, 2).join(' · ')}</T>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Upcoming shows grouped by day, with the start time in front. */
export function ShowsByDay({ days }: { days: EventItem[][] }) {
  const theme = useTheme();
  const open = useOpen();
  return (
    <>
      {days.map((shows) => (
        <View key={shows[0].id} style={{ gap: Spacing.two }}>
          <T variant="cardTitle" style={{ fontSize: 16 }}>
            {dayHeading(shows[0].starts_at)}
          </T>
          {shows.map((e) => {
            const { time, ampm } = timeParts(e.starts_at);
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                onPress={() => open(e)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.card, borderColor: theme.line, opacity: pressed ? 0.85 : 1 },
                ]}>
                <View style={styles.timeCol}>
                  <T style={[styles.rowTime, { color: Brand.red }]}>{e.all_day ? 'All' : time}</T>
                  <T style={[styles.ampm, { color: Brand.red }]}>{e.all_day ? 'DAY' : ampm}</T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="cardTitle">{e.title}</T>
                  <T variant="small">{details(e)}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  tonight: { backgroundColor: Brand.navy, borderWidth: 2, borderColor: Brand.navy, borderRadius: 16, overflow: 'hidden' },
  tonightRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  tonightDivider: { borderTopWidth: 1, borderTopColor: 'rgba(248,190,106,0.25)' },
  timeCol: { width: 54, alignItems: 'center' },
  bigTime: { fontFamily: Fonts.displayHeavy, fontSize: 18, lineHeight: 22, color: Brand.orange },
  rowTime: { fontFamily: Fonts.displayHeavy, fontSize: 15, lineHeight: 19 },
  ampm: { fontFamily: Fonts.display, fontSize: 10, letterSpacing: 0.8, color: Brand.orange },
  band: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 19, color: Brand.white },
  venue: { fontSize: 12.5, color: '#DFE6F2' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badge: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.navy,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
});
