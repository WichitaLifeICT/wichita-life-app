import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EatPicker } from '@/components/eat-picker';
import { PastPoll, PollCard } from '@/components/poll-card';
import {
  AppHeader,
  Button,
  Chip,
  ChipRow,
  LoadState,
  PressableCard,
  Screen,
  SectionHeader,
  Sticker,
  T,
} from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { getGuides, getPosts } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { shortDay } from '@/lib/format';
import { openLink } from '@/lib/links';
import { subscribeNewsletter } from '@/lib/member';
import { getPolls } from '@/lib/polls';
import type { Guide, Post } from '@/lib/types';

const FILTERS: { id: 'all' | Post['kind']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'weekend', label: 'Weekend guides' },
  { id: 'deep', label: 'Deep dives' },
  { id: 'guide', label: 'Guides' },
  { id: 'daily', label: 'Daily' },
];
const KIND_LABEL = Object.fromEntries(FILTERS.map((f) => [f.id, f.label])) as Record<Post['kind'], string>;

export default function ExploreScreen() {
  const track = useTrack();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const { session } = useAuth();
  const userId = session?.user.id;
  const q = useQuery(async () => {
    const [posts, guides] = await Promise.all([getPosts(60), getGuides()]);
    return { posts, guides };
  });
  // Votes reload on their own when you sign in or vote, without refetching stories.
  const polls = useQuery(() => getPolls().catch(() => ({ current: null, past: [] })), [userId]);
  const posts = (q.data?.posts ?? []).filter((p) => filter === 'all' || p.kind === filter);
  const [subscribed, setSubscribed] = useState<'busy' | 'yes' | 'confirm'>();
  // Signed-in members subscribe in one tap with their account email; guests use the beehiiv page.
  const subscribe = async () => {
    if (!session) return openLink('https://wichitalife.beehiiv.com/subscribe');
    setSubscribed('busy');
    try {
      const r = await subscribeNewsletter();
      track('newsletter_signup', { source: 'explore' });
      setSubscribed(r.subscribed ? 'yes' : 'confirm');
    } catch {
      setSubscribed(undefined);
      openLink('https://wichitalife.beehiiv.com/subscribe');
    }
  };
  const openGuide = (g: Guide) => {
    track('guide_opened', { slug: g.slug });
    openLink(g.url);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Explore" />
      <Screen
        refreshing={q.refreshing}
        onRefresh={() => {
          q.refresh();
          polls.refresh();
        }}>
        {polls.data?.current ? <PollCard state={polls.data.current} onChanged={polls.refresh} /> : null}

        <EatPicker />

        {polls.data?.past.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionHeader title="Wichita picked" />
            {polls.data.past.map((p) => (
              <PastPoll key={p.poll.id} state={p} />
            ))}
          </View>
        ) : null}

        <Sticker color={Brand.blue} shadow={Brand.orange}>
          <T variant="title" color={Brand.white}>
            Get Wichita Life in your inbox
          </T>
          <T color="#EAF0FA">45,000+ Wichitans read it. Local news Mondays and Fridays, a deep dive every Wednesday, weekend plans every Thursday.</T>
          <Button
            tone={subscribed === 'yes' ? 'done' : 'orange'}
            label={subscribed === 'yes' ? "✓ You're subscribed" : subscribed === 'busy' ? 'Subscribing…' : 'Subscribe'}
            disabled={subscribed === 'busy' || subscribed === 'yes'}
            onPress={subscribe}
          />
          {subscribed === 'confirm' ? (
            <T variant="small" color="#EAF0FA">
              Almost there: check your inbox to confirm.
            </T>
          ) : null}
        </Sticker>

        {q.data?.guides.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionHeader
              title="Local guides"
              action="All guides ↗"
              onAction={() => openLink('https://wichitalifeict.com/guides')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideRow}>
              {q.data.guides.map((g) => (
                <PressableCard
                  key={g.id}
                  style={styles.guideCard}
                  accessibilityRole="link"
                  onPress={() => openGuide(g)}>
                  {g.image_url ? <Image source={g.image_url} style={styles.guideImage} contentFit="cover" /> : null}
                  <T variant="cardTitle" numberOfLines={2}>
                    {g.title}
                  </T>
                </PressableCard>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ChipRow>

        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data && !posts.length ? 'No stories here yet.' : undefined}
        />

        <View style={{ gap: Spacing.two + 2 }}>
          {posts.map((p) => (
            <PressableCard
              key={p.id}
              accessibilityRole="link"
              onPress={() => {
                track('story_opened', { post_id: p.id, kind: p.kind, from: 'explore' });
                openLink(p.url);
              }}>
              <T variant="small">
                {KIND_LABEL[p.kind]} · {shortDay(p.published_at)}
              </T>
              <T variant="title" style={{ fontSize: 16, lineHeight: 21 }}>
                {p.title}
              </T>
            </PressableCard>
          ))}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  guideRow: { gap: Spacing.three - 4, paddingRight: Spacing.three, paddingBottom: Spacing.one },
  guideCard: { width: 200, padding: Spacing.two + 2 },
  guideImage: { width: '100%', height: 110, borderRadius: 10, marginBottom: Spacing.one },
});
