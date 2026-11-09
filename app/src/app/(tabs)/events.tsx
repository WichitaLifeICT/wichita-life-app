import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ArtsView } from '@/components/arts-view';
import { EventRow } from '@/components/event-row';
import { ShowsByDay, TonightShows } from '@/components/live-music';
import { Segmented } from '@/components/segmented';
import { SportsView } from '@/components/sports-view';
import { WeeklyList } from '@/components/weekly-list';
import { AppHeader, Button, Chip, ChipRow, LoadState, PressableCard, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { getNews, getUpcomingEvents } from '@/lib/api';
import { getArtsEvents, isMusicShow } from '@/lib/arts';
import { CALENDAR_URL, SUBMIT_EVENT_URL } from '@/lib/event-actions';
import { genreChips, genresOf, isFamily, isFoodDrink, isFree, isThisWeekend, isTonight } from '@/lib/events';
import { dayHeading, dayKey } from '@/lib/format';
import { openLink } from '@/lib/links';
import { getSportsEvents, isSportsNews } from '@/lib/sports';
import type { EventItem } from '@/lib/types';
import { getWeeklySpecials, isDeal, isHappeningNow, isLaterToday, wichitaNow } from '@/lib/weekly';

// 'deals' (happy hours and food deals) opens from its own box under the bar, not a tab in it.
type ViewId = 'events' | 'music' | 'weekly' | 'sports' | 'arts' | 'deals';
const VIEWS: ViewId[] = ['events', 'music', 'weekly', 'sports', 'arts', 'deals'];

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
  const view: ViewId = VIEWS.find((v) => v === params.view) ?? 'events';
  const [filter, setFilter] = useState<FilterId>('all');
  const [musicFilter, setMusicFilter] = useState('all');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const q = useQuery(() => getUpcomingEvents(500), [], { cacheKey: 'events' });
  const weekly = useQuery(getWeeklySpecials, [], { cacheKey: 'weekly' });
  // Sports loads its own games (far-off seasons) and headlines.
  const sports = useQuery(async () => {
    const [games, news] = await Promise.all([getSportsEvents(), getNews(80).catch(() => [])]);
    return { games, news: news.filter(isSportsNews) };
  });
  const arts = useQuery(getArtsEvents);

  const all = useMemo(() => q.data ?? [], [q.data]);
  const shows = useMemo(() => all.filter(isMusicShow), [all]);
  const tonight = useMemo(() => shows.filter((e) => isTonight(e, now)), [shows, now]);
  const genres = useMemo(() => genreChips(shows), [shows]);

  const eventDays = useMemo(() => byDay(all.filter((e) => !isMusicShow(e) && matches(e, filter))), [all, filter]);

  const music = useMemo(() => {
    if (musicFilter === 'all') return { tonight, days: byDay(shows.filter((e) => !tonight.includes(e))) };
    if (musicFilter === 'tonight') return { tonight, days: [] };
    const pick = (e: EventItem) =>
      musicFilter === 'weekend' ? isThisWeekend(e.starts_at) : genresOf(e).includes(musicFilter);
    return { tonight: [], days: byDay(shows.filter(pick)) };
  }, [shows, tonight, musicFilter]);

  const switchTo = (v: ViewId) => {
    router.setParams({ view: v });
    track('events_filtered', { filter: v === 'music' ? 'live_music' : v });
  };

  const submitEvent = () => {
    track('event_submit_opened', { from: 'events' });
    openLink(SUBMIT_EVENT_URL);
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

  // "35 today · 4 on now"
  const dealsSub = useMemo(() => {
    if (!weekly.data) return 'Happy hours & food deals';
    const wNow = wichitaNow(now);
    const deals = weekly.data.filter((s) => isDeal(s.kind));
    const today = deals.filter((s) => isLaterToday(s, wNow)).length;
    const onNow = deals.filter((s) => isHappeningNow(s, wNow)).length;
    if (!today) return 'See this week’s deals';
    return `${today} today${onNow ? ` · ${onNow} on now` : ''}`;
  }, [weekly.data, now]);
  const dealsOpen = view === 'deals';

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Events" />
      <Screen
        refreshing={q.refreshing || weekly.refreshing || sports.refreshing || arts.refreshing}
        onRefresh={() => {
          q.refresh();
          weekly.refresh();
          sports.refresh();
          arts.refresh();
        }}>
        <Segmented
          options={[
            { id: 'events', label: 'Events' },
            { id: 'music', label: '♫ Music' },
            { id: 'weekly', label: '🎤 Weekly' },
            { id: 'sports', label: '🏀 Sports' },
            { id: 'arts', label: '🎭 Arts' },
          ]}
          scroll
          value={view}
          onChange={switchTo}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: dealsOpen }}
          accessibilityLabel={`Daily deals. ${dealsSub}`}
          onPress={() => switchTo(dealsOpen ? 'events' : 'deals')}
          style={({ pressed }) => [styles.deals, { opacity: pressed ? 0.85 : 1 }]}>
          <View style={styles.dealsIcon}>
            <T style={{ fontSize: 20 }}>🍻</T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={styles.dealsTitle}>Daily deals & happy hours</T>
            <T style={styles.dealsSub} numberOfLines={1}>
              {dealsSub}
            </T>
          </View>
          <T style={styles.dealsGo}>{dealsOpen ? 'Hide' : 'See ›'}</T>
        </Pressable>
        <PressableCard
          accessibilityRole="button"
          onPress={() => router.push('/plans')}
          style={{ paddingVertical: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <T style={{ fontSize: 20 }}>🗓️</T>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: Fonts.display }}>My plans ›</T>
            <T variant="small">Line up your weekend, then share it with your crew.</T>
          </View>
        </PressableCard>

        <Button tone="red" label="+ Submit an event" onPress={submitEvent} />

        {view === 'arts' ? (
          <ArtsView shows={arts.data} loading={arts.loading} error={arts.error} now={now} />
        ) : view === 'sports' ? (
          <SportsView
            games={sports.data?.games}
            news={sports.data?.news ?? []}
            loading={sports.loading}
            error={sports.error}
            now={now}
          />
        ) : view === 'weekly' || view === 'deals' ? (
          <WeeklyList
            key={view}
            mode={view}
            specials={weekly.data}
            loading={weekly.loading}
            error={weekly.error}
            now={now}
          />
        ) : view === 'events' ? (
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
              staleSince={q.staleSince}
              empty={q.data && !eventDays.length ? 'Nothing matches yet. Try another filter.' : undefined}
            />

            {eventDays.map((events) => (
              <View key={events[0].id} style={{ gap: Spacing.two + 2 }}>
                <T variant="cardTitle" style={{ fontSize: 16 }}>
                  {dayHeading(events[0].starts_at)}
                </T>
                {events.map((e) => (
                  <EventRow key={e.id} event={e} onOpen={() => track('event_viewed', { event_id: e.id, title: e.title, from: 'events' })} />
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

        <PressableCard accessibilityRole="link" onPress={() => openLink(CALENDAR_URL)}>
          <T variant="small">Powered by events.wichitalifeict.com</T>
          <T variant="cardTitle">See the full calendar ↗</T>
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
  deals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.orange,
    borderWidth: 2,
    borderColor: Brand.navy,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: Brand.blue,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginRight: 4,
  },
  dealsIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealsTitle: { fontFamily: Fonts.display, fontSize: 15, color: Brand.navy },
  dealsSub: { fontSize: 12.5, color: Brand.navy },
  dealsGo: { fontFamily: Fonts.display, fontSize: 14, color: Brand.navy },
});
