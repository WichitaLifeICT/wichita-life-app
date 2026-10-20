import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EventRow } from '@/components/event-row';
import { ShowsByDay, TonightShows } from '@/components/live-music';
import { Segmented } from '@/components/segmented';
import { AppHeader, Chip, ChipRow, LoadState, PressableCard, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { getUpcomingEvents } from '@/lib/api';
import { genreChips, genresOf, isFamily, isFoodDrink, isFree, isLiveMusic, isThisWeekend, isTonight } from '@/lib/events';
import { dayHeading, dayKey } from '@/lib/format';
import { openLink } from '@/lib/links';
import type { EventItem } from '@/lib/types';

type ViewId = 'events' | 'music';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'free', label: 'Free' },
  { id: 'family', label: 'Family' },
  { id: 'food', label: 'Food & drink' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function matches(e: EventItem, f: FilterId) {
  if (f === 'all') return true;
  if (f === 'weekend') return isThisWeekend(e.starts_at);
  if (f === 'free') return isFree(e);
  if (f === 'family') return isFamily(e);
  return isFoodDrink(e);
}

function byDay(events: EventItem[]) {
  const groups = new Map<string, EventItem[]>();
  for (const e of events) {
    const k = dayKey(e.starts_at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.values()];
}

export default function EventsScreen() {
  const track = useTrack();
  const params = useLocalSearchParams<{ view?: string }>();
  const view: ViewId = params.view === 'music' ? 'music' : 'events';
  const [filter, setFilter] = useState<FilterId>('all');
  const [musicFilter, setMusicFilter] = useState('all');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const q = useQuery(() => getUpcomingEvents(500));

  const all = useMemo(() => q.data ?? [], [q.data]);
  const shows = useMemo(() => all.filter(isLiveMusic), [all]);
  const tonight = useMemo(() => shows.filter((e) => isTonight(e, now)), [shows, now]);
  const genres = useMemo(() => genreChips(shows), [shows]);

  const eventDays = useMemo(() => byDay(all.filter((e) => !isLiveMusic(e) && matches(e, filter))), [all, filter]);

  const music = useMemo(() => {
    if (musicFilter === 'all') return { tonight, days: byDay(shows.filter((e) => !tonight.includes(e))) };
    if (musicFilter === 'tonight') return { tonight, days: [] };
    const pick = (e: EventItem) =>
      musicFilter === 'weekend'
        ? isThisWeekend(e.starts_at)
        : musicFilter === 'free'
          ? isFree(e)
          : genresOf(e).includes(musicFilter);
    return { tonight: [], days: byDay(shows.filter(pick)) };
  }, [shows, tonight, musicFilter]);

  const switchTo = (v: ViewId) => {
    router.setParams({ view: v });
    track('events_filtered', { filter: v === 'music' ? 'live_music' : 'events' });
  };

  // Banner on the Events side so nobody misses the music.
  const weekCount = shows.filter((e) => Date.parse(e.starts_at) < now.getTime() + 7 * 86_400_000).length;
  const tonightVenues = [...new Set(tonight.map((e) => e.venue).filter(Boolean))].slice(0, 3).join(', ');
  const teaser = tonight.length
    ? { title: 'Live music tonight', sub: `${tonight.length} show${tonight.length === 1 ? '' : 's'} · ${tonightVenues}` }
    : weekCount
      ? { title: 'Live music this week', sub: `${weekCount} shows around Wichita` }
      : null;

  const musicEmpty =
    musicFilter === 'tonight' ? 'No shows listed for tonight. Try This weekend.' : 'No shows match yet. Try another filter.';

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Events" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <Segmented
          options={[
            { id: 'events', label: 'Events' },
            { id: 'music', label: '♫  Live Music' },
          ]}
          value={view}
          onChange={switchTo}
        />

        {view === 'events' ? (
          <>
            <ChipRow>
              {FILTERS.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  active={filter === f.id}
                  onPress={() => {
                    setFilter(f.id);
                    track('events_filtered', { filter: f.id });
                  }}
                />
              ))}
            </ChipRow>

            {teaser && filter === 'all' ? (
              <Pressable accessibilityRole="button" onPress={() => switchTo('music')} style={styles.teaser}>
                <View style={styles.teaserIcon}>
                  <T style={{ fontSize: 20, color: Brand.navy }}>♫</T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={styles.teaserTitle}>{teaser.title}</T>
                  <T style={styles.teaserSub} numberOfLines={1}>
                    {teaser.sub}
                  </T>
                </View>
                <T style={styles.teaserGo}>See ›</T>
              </Pressable>
            ) : null}

            <LoadState
              loading={q.loading}
              error={q.error}
              empty={q.data && !eventDays.length ? 'Nothing matches yet. Try another filter.' : undefined}
            />

            {eventDays.map((events) => (
              <View key={events[0].id} style={{ gap: Spacing.two + 2 }}>
                <T variant="cardTitle" style={{ fontSize: 16 }}>
                  {dayHeading(events[0].starts_at)}
                </T>
                {events.map((e) => (
                  <EventRow key={e.id} event={e} onOpen={() => track('event_viewed', { event_id: e.id, from: 'events' })} />
                ))}
              </View>
            ))}
          </>
        ) : (
          <>
            <ChipRow>
              {[
                { id: 'all', label: 'All shows' },
                { id: 'tonight', label: 'Tonight' },
                { id: 'weekend', label: 'This weekend' },
                { id: 'free', label: 'No cover' },
                ...genres.map((g) => ({ id: g, label: g })),
              ].map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  active={musicFilter === c.id}
                  onPress={() => {
                    setMusicFilter(c.id);
                    track('events_filtered', { filter: `music:${c.id}` });
                  }}
                />
              ))}
            </ChipRow>

            <LoadState
              loading={q.loading}
              error={q.error}
              empty={q.data && !music.tonight.length && !music.days.length ? musicEmpty : undefined}
            />

            {music.tonight.length ? <TonightShows events={music.tonight} label="Tonight" /> : null}
            <ShowsByDay days={music.days} />
          </>
        )}

        <PressableCard accessibilityRole="link" onPress={() => openLink('https://events.wichitalifeict.com')}>
          <T variant="small">Powered by events.wichitalifeict.com</T>
          <T variant="cardTitle">See the full calendar or submit an event ↗</T>
        </PressableCard>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.navy,
    borderWidth: 2,
    borderColor: Brand.navy,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: Brand.red,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginRight: 4,
  },
  teaserIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserTitle: { fontFamily: Fonts.display, fontSize: 15, color: Brand.white },
  teaserSub: { fontSize: 12.5, color: '#DFE6F2' },
  teaserGo: { fontFamily: Fonts.display, fontSize: 14, color: Brand.orange },
});
