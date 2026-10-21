import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { JobCard } from '@/components/job-card';
import { AppHeader, Button, LoadState, PressableCard, Screen, SectionHeader, Sticker, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getActiveGiveaway, getActiveSponsor, getJobs, getNews, getPosts, getUpcomingEvents } from '@/lib/api';
import { genresOf, isLiveMusic, isTonight } from '@/lib/events';
import { greeting, isFridayInWichita, isThisWeekend, relativeTime, shortDay, timeLabel, todayHeading } from '@/lib/format';
import { openLink } from '@/lib/links';
import { getOpenPoll } from '@/lib/polls';
import type { NewsItem, Post } from '@/lib/types';

const KIND_LABEL: Record<Post['kind'], string> = {
  daily: 'Daily',
  deep: 'Deep dive',
  weekend: 'Weekend guide',
  spotlight: 'Spotlight',
  guide: 'Guide',
};

type FeedItem = { type: 'post'; post: Post } | { type: 'news'; news: NewsItem } | { type: 'sponsor' };

export default function TodayScreen() {
  const theme = useTheme();
  const track = useTrack();
  const q = useQuery(async () => {
    const [posts, events, news, jobs, sponsor, giveaway, poll] = await Promise.all([
      getPosts(12),
      getUpcomingEvents(300),
      getNews(8),
      getJobs(3),
      getActiveSponsor(),
      getActiveGiveaway(),
      getOpenPoll().catch(() => null),
    ]);
    const now = new Date();
    const musicTonight = events.filter((e) => isLiveMusic(e) && isTonight(e, now)).slice(0, 10);
    return { posts, events, news, jobs, sponsor, giveaway, poll, musicTonight, friday: isFridayInWichita() };
  });

  const hero = q.data?.posts.find((p) => p.featured) ?? q.data?.posts.find((p) => p.kind !== 'daily');
  const weekend = q.data?.events.filter((e) => isThisWeekend(e.starts_at)).slice(0, 8) ?? [];

  // Alternate local news with Wichita Life posts; sponsor slot in position four.
  const feed = useMemo<FeedItem[]>(() => {
    if (!q.data) return [];
    const posts = q.data.posts.filter((p) => p.id !== hero?.id).slice(0, 5);
    const items: FeedItem[] = [];
    const max = Math.max(posts.length, q.data.news.length);
    for (let i = 0; i < max; i++) {
      if (q.data.news[i]) items.push({ type: 'news', news: q.data.news[i] });
      if (posts[i]) items.push({ type: 'post', post: posts[i] });
    }
    if (q.data.sponsor) items.splice(Math.min(3, items.length), 0, { type: 'sponsor' });
    return items;
  }, [q.data, hero?.id]);

  const openPost = (post: Post) => {
    track('story_opened', { post_id: post.id, kind: post.kind, from: 'today' });
    openLink(post.url);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Today" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <View>
          <T variant="script">{greeting()}, Wichita.</T>
          <T variant="small">{todayHeading()}</T>
        </View>

        <LoadState loading={q.loading} error={q.error} />

        {q.data ? (
          q.data.friday ? (
            <GameCard id="crossroads" from="today" headline="New crossword today" />
          ) : (
            <GameCard id="wheatle" from="today" headline="Today's Wheatle" />
          )
        ) : null}

        {q.data?.giveaway ? (
          <Sticker color={Brand.orange} shadow={Brand.red}>
            <T variant="label" color={Brand.navy}>
              Giveaway
            </T>
            <T variant="title" color={Brand.navy}>
              {q.data.giveaway.title}
            </T>
            <T variant="small" color={Brand.navy}>
              Ends {shortDay(q.data.giveaway.ends_at)} · {q.data.giveaway.entrants.toLocaleString()} entered
            </T>
            <Button label="Enter to win" onPress={() => router.navigate('/play')} />
          </Sticker>
        ) : null}

        {q.data?.poll ? (
          <PressableCard accessibilityRole="button" onPress={() => router.navigate('/explore')}>
            <T variant="small">Wichita votes · {q.data.poll.vote_count.toLocaleString()} so far</T>
            <T variant="cardTitle">{q.data.poll.question}</T>
            <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display }}>
              Cast your vote ›
            </T>
          </PressableCard>
        ) : null}

        {q.data?.musicTonight.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionHeader
              title="Live music tonight"
              action="See all"
              onAction={() => router.navigate({ pathname: '/events', params: { view: 'music' } })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
              {q.data.musicTonight.map((e) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  style={styles.showCard}
                  onPress={() => {
                    track('event_viewed', { event_id: e.id, title: e.title, from: 'today' });
                    router.push({ pathname: '/event/[id]', params: { id: e.id } });
                  }}>
                  <T style={styles.showWhen}>
                    {timeLabel(e.starts_at, e.all_day)}
                    {genresOf(e).length ? ` · ${genresOf(e)[0]}` : ''}
                  </T>
                  <T style={styles.showTitle} numberOfLines={2}>
                    {e.title}
                  </T>
                  {e.venue ? (
                    <T style={styles.showVenue} numberOfLines={1}>
                      {e.venue}
                    </T>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {weekend.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionHeader title="This weekend" action="See all" onAction={() => router.navigate('/events')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
              {weekend.map((e) => (
                <PressableCard
                  key={e.id}
                  style={[styles.weekendCard, { borderColor: Brand.navy, borderWidth: 2 }]}
                  onPress={() => {
                    track('event_viewed', { event_id: e.id, title: e.title, from: 'today' });
                    router.push({ pathname: '/event/[id]', params: { id: e.id } });
                  }}>
                  <T style={styles.when}>
                    {shortDay(e.starts_at)} · {timeLabel(e.starts_at, e.all_day)}
                  </T>
                  <T variant="cardTitle">{e.title}</T>
                  {e.venue ? <T variant="small">{e.venue}</T> : null}
                  {e.is_sponsored ? <Tag label="Sponsor" /> : null}
                </PressableCard>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {feed.length ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Your feed" />
            {feed.map((item) => {
              if (item.type === 'sponsor' && q.data?.sponsor) {
                const s = q.data.sponsor;
                return (
                  <View key="sponsor" style={[styles.sponsor, { backgroundColor: theme.blueSoft, borderColor: Brand.blue }]}>
                    <T variant="label" color={Brand.blue}>
                      Sponsored · Together with {s.name}
                    </T>
                    <T variant="cardTitle">{s.headline}</T>
                    {s.body ? <T variant="small">{s.body}</T> : null}
                    {s.cta_url ? (
                      <Button
                        small
                        tone="red"
                        label={s.cta_label ?? 'Learn more'}
                        onPress={() => {
                          track('sponsor_clicked', { sponsor: s.name, placement: 'feed' });
                          openLink(s.cta_url!);
                        }}
                      />
                    ) : null}
                  </View>
                );
              }
              if (item.type === 'post') {
                return (
                  <PressableCard key={item.post.id} onPress={() => openPost(item.post)} accessibilityRole="link">
                    <T variant="small">
                      <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display }}>
                        Wichita Life
                      </T>
                      {` · ${KIND_LABEL[item.post.kind]}`}
                    </T>
                    <T variant="cardTitle">{item.post.title}</T>
                  </PressableCard>
                );
              }
              if (item.type === 'news') {
                const n = item.news;
                return (
                  <PressableCard
                    key={n.id}
                    accessibilityRole="link"
                    onPress={() => {
                      track('news_opened', { source: n.source_name, url: n.url });
                      openLink(n.url);
                    }}>
                    <T variant="small">
                      {n.source_name} · {relativeTime(n.published_at)} ↗
                    </T>
                    <T variant="cardTitle" style={{ fontFamily: Fonts.bodySemi }}>
                      {n.title}
                    </T>
                  </PressableCard>
                );
              }
              return null;
            })}
          </View>
        ) : null}

        {hero ? (
          <Pressable onPress={() => openPost(hero)} accessibilityRole="link">
            <Sticker color={Brand.red} shadow={Brand.blue}>
              <T variant="label" color="#FFF3DF">
                {KIND_LABEL[hero.kind]}
              </T>
              <T variant="heading" color={Brand.white}>
                {hero.title}
              </T>
              {hero.excerpt ? <T color={Brand.white}>{hero.excerpt}</T> : null}
            </Sticker>
          </Pressable>
        ) : null}

        {q.data?.jobs.length ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Jobs this week" action="See all" onAction={() => router.push('/jobs')} />
            {q.data.jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </View>
        ) : null}

        <PressableCard
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/feedback', params: { from: 'today' } })}>
          <T variant="small">Help us make Wichita Life better</T>
          <T variant="cardTitle">Send feedback ›</T>
        </PressableCard>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  hrow: { gap: Spacing.three - 4, paddingRight: Spacing.three, paddingBottom: Spacing.one },
  weekendCard: { width: 176 },
  showCard: {
    width: 176,
    gap: 4,
    backgroundColor: Brand.navy,
    borderWidth: 2,
    borderColor: Brand.navy,
    borderRadius: 14,
    padding: 12,
  },
  showWhen: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: Brand.orange },
  showTitle: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 19, color: Brand.white },
  showVenue: { fontSize: 12, color: '#DFE6F2' },
  when: {
    fontFamily: Fonts.display,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.red,
  },
  sponsor: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 14, gap: 6 },
});
