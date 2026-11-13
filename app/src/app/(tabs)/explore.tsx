import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActivityPicker } from '@/components/activity-picker';
import { EatPicker } from '@/components/eat-picker';
import { JobCard } from '@/components/job-card';
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
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { getGuides, getJobs, getPosts, getShopProducts } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { shortDay } from '@/lib/format';
import { openLink, openStory } from '@/lib/links';
import { subscribeNewsletter } from '@/lib/member';
import { getPolls } from '@/lib/polls';
import type { Guide, Job, Post, ShopProduct } from '@/lib/types';

const FILTERS: { id: 'all' | Post['kind']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'weekend', label: 'Weekend guides' },
  { id: 'deep', label: 'Deep dives' },
  { id: 'daily', label: 'Daily' },
  { id: 'spotlight', label: 'Spotlights' },
];
// Five stories and five guides show at first; More shows the rest.
const PAGE = 5;
const MORE = 10;
const GUIDES_SHOWN = 5;
const SHOP_URL = 'https://wichitalifeshop.myshopify.com/';
// Only the most recent few of each newsletter are worth browsing.
const KIND_LIMIT: Partial<Record<Post['kind'], number>> = { weekend: 5, daily: 5, deep: 10 };
const KIND_LABEL = { ...Object.fromEntries(FILTERS.map((f) => [f.id, f.label])), guide: 'Guide' } as Record<Post['kind'], string>;

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
/** Shopify can resize product photos; a small one keeps the row quick to load. */
const thumb = (url: string) => `${url}${url.includes('?') ? '&' : '?'}width=360`;

/** Keeps the newest KIND_LIMIT posts of each kind (posts arrive newest first). */
function capPerKind(posts: Post[]) {
  const seen: Partial<Record<Post['kind'], number>> = {};
  return posts.filter((p) => {
    seen[p.kind] = (seen[p.kind] ?? 0) + 1;
    return seen[p.kind]! <= (KIND_LIMIT[p.kind] ?? 15);
  });
}

export default function ExploreScreen() {
  const theme = useTheme();
  const track = useTrack();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  // Stories show 5 at first; More adds 10. No infinite scroll.
  const [showing, setShowing] = useState(PAGE);
  const { session } = useAuth();
  const userId = session?.user.id;
  const q = useQuery(async () => {
    // The shop and jobs rows are a bonus: if they can't load, the rest of Explore still does.
    const [posts, guides, shop, jobs] = await Promise.all([
      getPosts(150),
      getGuides(),
      getShopProducts().catch((): ShopProduct[] => []),
      getJobs(3).catch((): Job[] => []),
    ]);
    return { posts, guides, shop, jobs };
  }, [], { cacheKey: 'explore' });
  const shop = q.data?.shop ?? [];
  const openShop = (product?: ShopProduct) => {
    track('shop_opened', { from: 'explore', ...(product ? { product: product.handle } : {}) });
    openLink(product?.url ?? SHOP_URL);
  };
  // Votes reload on their own when you sign in or vote, without refetching stories.
  const polls = useQuery(() => getPolls().catch(() => ({ current: null, past: [] })), [userId]);
  const posts = capPerKind(q.data?.posts ?? []).filter((p) => filter === 'all' || p.kind === filter);
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

        <ActivityPicker />

        {q.data?.guides.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionHeader
              title="Local guides"
              action="All guides ↗"
              onAction={() => openLink('https://wichitalifeict.com/guides')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideRow}>
              {q.data.guides.slice(0, GUIDES_SHOWN).map((g) => (
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
              {q.data.guides.length > GUIDES_SHOWN ? (
                <PressableCard
                  style={[styles.guideCard, styles.moreCard]}
                  accessibilityRole="link"
                  accessibilityLabel="More local guides"
                  onPress={() => openLink('https://wichitalifeict.com/guides')}>
                  <T variant="cardTitle" color={theme.link}>
                    More guides ↗
                  </T>
                  <T variant="small">{q.data.guides.length - GUIDES_SHOWN} more on wichitalifeict.com</T>
                </PressableCard>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => (setFilter(f.id), setShowing(PAGE))} />
          ))}
        </ChipRow>

        {filter === 'spotlight' ? (
          <Sticker color={Brand.navy} shadow={Brand.orange}>
            <T variant="title" color={Brand.white}>
              {posts.length ? 'Know someone we should feature?' : 'Spotlights are coming'}
            </T>
            <T color="#EAF0FA">
              {posts.length
                ? 'Nominate a Wichitan, small business, or group doing something great. You can nominate yourself, too.'
                : 'Stories about the Wichitans, small businesses, and groups that make this city great. Know someone we should feature? Tell us about them.'}
            </T>
            <Button
              tone="orange"
              label="Nominate someone"
              onPress={() => {
                track('spotlight_nominate_opened', { from: 'explore' });
                router.push('/nominate');
              }}
            />
          </Sticker>
        ) : null}

        <LoadState
          loading={q.loading}
          error={q.error}
          staleSince={q.staleSince}
          empty={q.data && !posts.length && filter !== 'spotlight' ? 'No stories here yet.' : undefined}
        />

        <View style={{ gap: Spacing.two + 2 }}>
          {posts.slice(0, showing).map((p) => (
            <PressableCard
              key={p.id}
              accessibilityRole="link"
              onPress={() => {
                track('story_opened', { post_id: p.id, kind: p.kind, from: 'explore' });
                openStory(p);
              }}>
              <T variant="small">
                {KIND_LABEL[p.kind]} · {shortDay(p.published_at)}
              </T>
              <T variant="title" style={{ fontSize: 16, lineHeight: 21 }}>
                {p.title}
              </T>
            </PressableCard>
          ))}
          {posts.length > showing ? (
            <Button tone="ghost" label={`More stories (${posts.length - showing})`} onPress={() => setShowing((n) => n + MORE)} />
          ) : null}
        </View>

        <Sticker color={Brand.orange} shadow={Brand.blue}>
          <T variant="label" color={Brand.navy}>
            Wichita Life shop
          </T>
          <T variant="title" color={Brand.navy}>
            Rep Wichita
          </T>
          {shop.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopRow}>
              {shop.map((p) => (
                <PressableCard
                  key={p.id}
                  style={styles.shopCard}
                  accessibilityRole="link"
                  accessibilityLabel={`${p.title}, ${money(p.price)}`}
                  onPress={() => openShop(p)}>
                  {p.image_url ? (
                    <Image source={thumb(p.image_url)} style={styles.shopImage} contentFit="cover" />
                  ) : null}
                  <T variant="small" numberOfLines={2}>
                    {p.title}
                  </T>
                  <T variant="cardTitle">{money(p.price)}</T>
                </PressableCard>
              ))}
            </ScrollView>
          ) : (
            <T color={Brand.navy}>
              Wichita hats, stickers, polos and our Wichita cityscape puzzle. Easy gifts for anyone who loves this city.
            </T>
          )}
          <Button tone="red" label="Shop all ↗" onPress={() => openShop()} />
        </Sticker>

        {q.data?.jobs?.length ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Jobs this week" action="See all" onAction={() => router.push('/jobs')} />
            {q.data.jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </View>
        ) : null}

        {/* The newsletter signup sits last: there are other ways to subscribe (welcome, account). */}
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
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  guideRow: { gap: Spacing.three - 4, paddingRight: Spacing.three, paddingBottom: Spacing.one },
  guideCard: { width: 200, padding: Spacing.two + 2 },
  guideImage: { width: '100%', height: 110, borderRadius: 10, marginBottom: Spacing.one },
  moreCard: { width: 150, justifyContent: 'center' },
  shopRow: { gap: Spacing.two, paddingRight: Spacing.two },
  shopCard: { width: 140, padding: Spacing.two, gap: 2 },
  shopImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: Spacing.one, backgroundColor: '#FFFFFF' },
});
