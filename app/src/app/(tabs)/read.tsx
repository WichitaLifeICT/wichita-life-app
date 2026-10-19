import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader, Button, Chip, ChipRow, LoadState, PressableCard, Screen, Sticker, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { getPosts } from '@/lib/api';
import { shortDay } from '@/lib/format';
import { openLink } from '@/lib/links';
import type { Post } from '@/lib/types';

const FILTERS: { id: 'all' | Post['kind']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'weekend', label: 'Weekend guides' },
  { id: 'spotlight', label: 'Spotlights' },
  { id: 'deep', label: 'Deep dives' },
  { id: 'guide', label: 'Guides' },
  { id: 'daily', label: 'Daily' },
];
const KIND_LABEL = Object.fromEntries(FILTERS.map((f) => [f.id, f.label])) as Record<Post['kind'], string>;

export default function ReadScreen() {
  const track = useTrack();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const q = useQuery(() => getPosts(60));
  const posts = (q.data ?? []).filter((p) => filter === 'all' || p.kind === filter);

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Read" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <Sticker color={Brand.blue} shadow={Brand.orange}>
          <T variant="title" color={Brand.white}>
            Get Wichita Life in your inbox
          </T>
          <T color="#EAF0FA">45,000+ Wichitans read it. Weekend plans every Thursday, deep dives all week.</T>
          <Button tone="orange" label="Subscribe" onPress={() => openLink('https://wichitalife.beehiiv.com/subscribe')} />
        </Sticker>

        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ChipRow>

        <LoadState loading={q.loading} error={q.error} empty={q.data && !posts.length ? 'No stories here yet.' : undefined} />

        <View style={{ gap: Spacing.two + 2 }}>
          {posts.map((p) => (
            <PressableCard
              key={p.id}
              accessibilityRole="link"
              onPress={() => {
                track('story_opened', { post_id: p.id, kind: p.kind, from: 'read' });
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
