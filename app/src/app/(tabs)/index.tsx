import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { PastPoll, PollCard } from '@/components/poll-card';
import { AppHeader, Button, LoadState, Place, PressableCard, Screen, SectionHeader, Sticker, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getActiveGiveaway, getActiveSponsor, getNews, getPosts, getUpcomingEvents, getWeather } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isMusicShow } from '@/lib/arts';
import { genresOf, interestsOf, isSponsored, isTonight, pickedFor } from '@/lib/events';
import { INTERESTS } from '@/lib/interests';
import { greeting, isFridayInWichita, isThisWeekend, relativeTime, shortDay, timeLabel, todayHeading } from '@/lib/format';
import { openLink, openStory } from '@/lib/links';
import { dismissEvent, getDismissedEventIds, updateProfile } from '@/lib/member';
import { getDailyQuestion, getOpenPoll, getYesterdaysQuestion } from '@/lib/polls';
import { countLabel, getWeeklySpecials, isLaterToday, viewFor, wichitaNow, type WeeklyKind } from '@/lib/weekly';
import type { EventItem, NewsItem, Post, Weather } from '@/lib/types';

const KIND_LABEL: Record<Post['kind'], string> = {
  daily: 'Daily',
  deep: 'Deep dive',
  weekend: 'Weekend guide',
  spotlight: 'Spotlight',
  guide: 'Guide',
};

const FEED_PAGE = 5;

/** "☀️ 61° · H 59° L 33°" beside the date: the temperature now, then today's high and low. */
function WeatherLine({ weather: w }: { weather: Weather }) {
  const theme = useTheme();
  const range = [w.high_f !== null ? `H ${Math.max(w.high_f, w.temp_f)}°` : null, w.low_f !== null ? `L ${w.low_f}°` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View
      style={styles.weather}
      accessible
      accessibilityLabel={`${w.temp_f} degrees${w.conditions ? `, ${w.conditions.toLowerCase()}` : ''}${
        w.high_f !== null ? `. High ${Math.max(w.high_f, w.temp_f)}` : ''
      }${w.low_f !== null ? `, low ${w.low_f}` : ''}`}>
      {/* The icon sits tight against the temperature; the high and low get a little more room. */}
      <View style={styles.weatherNow}>
        <T style={{ fontSize: 13, lineHeight: 19 }}>{w.icon}</T>
        <T style={{ fontFamily: Fonts.displaySemi, fontSize: 15, lineHeight: 19 }} color={theme.heading}>
          {w.temp_f}°
        </T>
      </View>
      {range ? <T variant="small">{range}</T> : null}
    </View>
  );
}

type FeedItem = { type: 'post'; post: Post } | { type: 'news'; news: NewsItem } | { type: 'sponsor' };

export default function TodayScreen() {
  const theme = useTheme();
  const track = useTrack();
  const q = useQuery(async () => {
    const [posts, events, news, weather, sponsor, giveaway, poll, weekly, daily, yesterday] = await Promise.all([
      getPosts(12),
      getUpcomingEvents(300),
      getNews(12),
      getWeather().catch(() => null),
      getActiveSponsor(),
      getActiveGiveaway(),
      getOpenPoll().catch(() => null),
      getWeeklySpecials().catch(() => []),
      getDailyQuestion().catch(() => null),
      getYesterdaysQuestion().catch(() => null),
    ]);
    const now = new Date();
    const musicTonight = events.filter((e) => isMusicShow(e) && isTonight(e, now)).slice(0, 10);
    // Happy hours, trivia and other regulars still to come today, counted by kind.
    const wNow = wichitaNow(now);
    const todayCounts = new Map<WeeklyKind, number>();
    for (const w of weekly) if (isLaterToday(w, wNow)) todayCounts.set(w.kind, (todayCounts.get(w.kind) ?? 0) + 1);
    const weeklyToday = [...todayCounts].sort((a, b) => b[1] - a[1]);
    const weekAhead = events.filter((e) => Date.parse(e.starts_at) < now.getTime() + 7 * 86_400_000);
    return {
      posts,
      events,
      weekAhead,
      weeklyToday,
      news,
      weather,
      sponsor,
      giveaway,
      poll,
      daily,
      yesterday,
      musicTonight,
      friday: isFridayInWichita(),
    };
  }, [], { cacheKey: 'today' });

  // The giveaway card sits near the top of Today, so showing it counts as a view (once per giveaway).
  const giveawayId = q.data?.giveaway?.id;
  useEffect(() => {
    if (giveawayId) track('giveaway_viewed', { giveaway_id: giveawayId, from: 'today' });
  }, [giveawayId, track]);

  const hero = q.data?.posts.find((p) => p.featured) ?? q.data?.posts.find((p) => p.kind !== 'daily');
  const { profile, session, refreshProfile } = useAuth();
  const userId = session?.user.id;
  const interests = useMemo(() => profile?.interests ?? [], [profile?.interests]);
  // Events they've said they're not interested in (✕ on a Picked for you card).
  const dismissed = useQuery(() => (userId ? getDismissedEventIds() : Promise.resolve(new Set<string>())), [userId]);
  const [justHidden, setJustHidden] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string>();
  const [pickNotice, setPickNotice] = useState<string>();
  // Events this week that fit what the member said they're into (from the welcome screens).
  const picked = useMemo(() => {
    const skip = (e: EventItem) => dismissed.data?.has(e.id) || justHidden.includes(e.id);
    return pickedFor((q.data?.weekAhead ?? []).filter((e) => !skip(e)), interests);
  }, [q.data, interests, dismissed.data, justHidden]);
  // The weekend row puts their kind of thing first, and leaves out what's already picked above.
  const weekend = useMemo(() => {
    const all = (q.data?.events ?? []).filter((e) => isThisWeekend(e.starts_at) && !picked.includes(e));
    const fits = (e: EventItem) => (interestsOf(e, interests).length ? 0 : 1);
    return [...all].sort((a, b) => fits(a) - fits(b)).slice(0, 8);
  }, [q.data, picked, interests]);
  const interestLabel = (e: EventItem) => {
    const id = interestsOf(e, interests)[0];
    return INTERESTS.find((i) => i.id === id)?.label;
  };
  const hidePick = (e: EventItem) => {
    setMenuFor(undefined);
    setJustHidden((h) => [...h, e.id]);
    setPickNotice('Hidden. We won’t pick that one for you again.');
    track('pick_dismissed', { event_id: e.id, action: 'hide' });
    dismissEvent(e.id).catch(() => {});
  };
  const dropInterest = (e: EventItem, interest: string) => {
    setMenuFor(undefined);
    const label = INTERESTS.find((i) => i.id === interest)?.label ?? interest;
    setPickNotice(`Got it: less ${label.replace(/^\S+\s/, '').toLowerCase()}. Change it anytime on your Account page.`);
    track('pick_dismissed', { event_id: e.id, action: 'interest', interest });
    updateProfile({ interests: interests.filter((i) => i !== interest) })
      .then(refreshProfile)
      .catch(() => {});
  };
  const openEvent = (e: EventItem, from: 'today' | 'for_you') => {
    track('event_viewed', { event_id: e.id, title: e.title, from });
    router.push({ pathname: '/event/[id]', params: { id: e.id } });
  };

  // Your feed shows 5 at first; "Show 5 more" opens the next 5.
  const [feedShown, setFeedShown] = useState(FEED_PAGE);
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
    openStory(post);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Today" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <View>
          <T variant="script">{greeting()}, Wichita.</T>
          <View style={styles.dateRow}>
            <T variant="small">{todayHeading()}</T>
            {q.data?.weather ? <WeatherLine weather={q.data.weather} /> : null}
          </View>
        </View>

        <LoadState loading={q.loading} error={q.error} staleSince={q.staleSince} />

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

        {!session ? (
          <Sticker color={Brand.blue} shadow={Brand.navy}>
            <T variant="title" color={Brand.white}>
              Make Wichita Life yours
            </T>
            <View style={{ gap: 4 }}>
              {[
                Platform.OS === 'web' ? 'Save events to your own list' : 'Save events and get a reminder the night before',
                'Enter giveaways and earn bonus entries',
                'Picks for you, based on what you’re into',
                'Vote, RSVP to meetups and post on the board',
              ].map((line) => (
                <T key={line} color="#EAF0FA">
                  ✓ {line}
                </T>
              ))}
            </View>
            <Button
              tone="orange"
              label="Sign in, it’s free"
              onPress={() => {
                track('sign_in_prompt_tapped', { from: 'today' });
                router.push('/sign-in');
              }}
            />
            <T variant="small" color="#EAF0FA">
              Takes 10 seconds with {Platform.OS === 'ios' ? 'Apple, Google' : 'Google'} or your email. No password.
            </T>
          </Sticker>
        ) : null}

        {q.data?.poll ? (
          <PressableCard accessibilityRole="button" onPress={() => router.navigate('/explore')}>
            <T variant="small">Wichita votes · {q.data.poll.vote_count.toLocaleString()} so far</T>
            <T variant="cardTitle">{q.data.poll.question}</T>
            <T variant="small" color={theme.link} style={{ fontFamily: Fonts.display }}>
              Cast your vote ›
            </T>
          </PressableCard>
        ) : null}

        {q.data?.weeklyToday.length ? (
          <PressableCard
            accessibilityRole="button"
            // Opens Daily deals when happy hours lead the list, Weekly when trivia or the like do.
            onPress={() =>
              router.navigate({ pathname: '/events', params: { view: viewFor(q.data!.weeklyToday[0][0]) } })
            }>
            <T variant="small">Deals & weekly specials</T>
            <T variant="cardTitle">
              Today:{' '}
              {q.data.weeklyToday
                .slice(0, 3)
                .map(([kind, n]) => countLabel(kind, n))
                .join(' · ')}
            </T>
            <T variant="small" color={theme.link} style={{ fontFamily: Fonts.display }}>
              See where ›
            </T>
          </PressableCard>
        ) : null}

        {q.data?.daily ? <PollCard state={q.data.daily} onChanged={q.refresh} giveawayOpen={Boolean(q.data.giveaway)} /> : null}
        {q.data?.yesterday ? <PastPoll state={q.data.yesterday} label="Yesterday Wichita said" /> : null}

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
                    {timeLabel(e.starts_at, e.all_day, e.time_tbd)}
                    {genresOf(e).length ? ` · ${genresOf(e)[0]}` : ''}
                  </T>
                  <T style={styles.showTitle} numberOfLines={2}>
                    {e.title}
                  </T>
                  {e.venue ? (
                    <T style={styles.showVenue} numberOfLines={1}>
                      📍 {e.venue}
                    </T>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {picked.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionHeader title="Picked for you" action="Edit interests" onAction={() => router.push('/account')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
              {picked.map((e) => {
                const interest = interestsOf(e, interests)[0];
                return (
                  <EventCard
                    key={e.id}
                    event={e}
                    reason={interestLabel(e)}
                    onPress={() => openEvent(e, 'for_you')}
                    onDismiss={() => setMenuFor(menuFor === e.id ? undefined : e.id)}
                    menu={
                      menuFor === e.id ? (
                        <View style={{ gap: Spacing.one }}>
                          <Button small tone="ghost" label="Hide this event" onPress={() => hidePick(e)} />
                          {interest ? (
                            <Button
                              small
                              tone="ghost"
                              label={`Not into ${interestLabel(e)?.replace(/^\S+\s/, '')}`}
                              onPress={() => dropInterest(e, interest)}
                            />
                          ) : null}
                          <Button small tone="ghost" label="Never mind" onPress={() => setMenuFor(undefined)} />
                        </View>
                      ) : undefined
                    }
                  />
                );
              })}
            </ScrollView>
            {pickNotice ? <T variant="small">{pickNotice}</T> : null}
          </View>
        ) : pickNotice ? (
          <T variant="small">{pickNotice}</T>
        ) : null}

        {weekend.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionHeader title="This weekend" action="See all" onAction={() => router.navigate('/events')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
              {weekend.map((e) => (
                <EventCard key={e.id} event={e} onPress={() => openEvent(e, 'today')} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {q.data ? (
          q.data.friday ? (
            <GameCard id="crossroads" from="today" headline="New crossword today" />
          ) : (
            <GameCard id="wheatle" from="today" headline="Today's Wheatle" />
          )
        ) : null}

        {feed.length ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Your feed" />
            {feed.slice(0, feedShown).map((item) => {
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
                      <T variant="small" color={theme.link} style={{ fontFamily: Fonts.display }}>
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
            {feed.length > feedShown ? (
              <Button small tone="ghost" label="Show 5 more" onPress={() => setFeedShown((n) => n + FEED_PAGE)} />
            ) : null}
          </View>
        ) : null}

        {hero ? (
          <Pressable onPress={() => openPost(hero)} accessibilityRole="link">
            <Sticker color={Brand.redText} shadow={Brand.blue}>
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

function EventCard({
  event: e,
  reason,
  onPress,
  onDismiss,
  menu,
}: {
  event: EventItem;
  reason?: string;
  onPress: () => void;
  /** Shows a ✕ for "not interested". */
  onDismiss?: () => void;
  /** The not-interested choices, when open; they replace the card's details. */
  menu?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <PressableCard style={[styles.weekendCard, { borderColor: theme.outline, borderWidth: 2 }]} onPress={onPress}>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Not interested in ${e.title}`}
          hitSlop={10}
          onPress={onDismiss}
          style={styles.dismiss}>
          <T style={{ fontSize: 14, lineHeight: 16 }}>✕</T>
        </Pressable>
      ) : null}
      <T style={[styles.when, { color: theme.link }, onDismiss && { paddingRight: 24 }]}>
        {shortDay(e.starts_at)} · {timeLabel(e.starts_at, e.all_day, e.time_tbd)}
      </T>
      {/* Where leads: for happy hours and specials the place is the headline. */}
      {e.venue ? <Place name={e.venue} lines={2} /> : null}
      <T variant="cardTitle">{e.title}</T>
      {menu ?? (isSponsored(e) ? <Tag label="Sponsor" /> : reason ? <T variant="small">{reason}</T> : null)}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  hrow: { gap: Spacing.three - 4, paddingRight: Spacing.three, paddingBottom: Spacing.one },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
    marginTop: Spacing.two,
  },
  weather: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  weatherNow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  weekendCard: { width: 176 },
  dismiss: { position: 'absolute', top: 8, right: 10, zIndex: 1, padding: 2 },
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
  showVenue: { fontSize: 12.5, fontFamily: Fonts.bodyBold, color: '#FFF3DF' },
  when: {
    fontFamily: Fonts.display,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.redText,
  },
  sponsor: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 14, gap: 6 },
});
