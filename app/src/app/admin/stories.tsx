import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, LoadState, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { getRecentPosts, setFeatured, setPostKind } from '@/lib/admin';
import { shortDay } from '@/lib/format';
import type { PostKind } from '@/lib/types';

const KINDS: { id: PostKind; label: string }[] = [
  { id: 'deep', label: 'Deep dive' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'daily', label: 'Daily' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'guide', label: 'Guide' },
];

export default function AdminStories() {
  const q = useQuery(getRecentPosts);
  const [editing, setEditing] = useState<string>();
  const [error, setError] = useState<string>();
  const act = (fn: () => Promise<unknown>) => {
    setError(undefined);
    fn().then(q.refresh, (e: Error) => setError(e.message));
  };

  return (
    <AdminPage title="Stories" refreshing={q.refreshing} onRefresh={q.refresh}>
      <T variant="small">
        The featured story is the big card at the top of Today. With none featured, Today shows the newest non-Daily
        story. Types are set automatically (Wednesday = Deep dive, Thursday = Weekend); fix one here if needed.
      </T>
      {error ? <T color={Brand.red}>{error}</T> : null}
      <LoadState loading={q.loading} error={q.error} />
      <View style={{ gap: Spacing.two + 2 }}>
        {q.data?.map((p) => (
          <Card key={p.id} style={{ gap: Spacing.two }}>
            <T variant="small">
              {shortDay(p.published_at)} · {KINDS.find((k) => k.id === p.kind)?.label}
              {p.featured ? ' · ★ Featured' : ''}
            </T>
            <T variant="cardTitle">{p.title}</T>
            {editing === p.id ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                {KINDS.map((k) => (
                  <Chip
                    key={k.id}
                    label={k.label}
                    active={p.kind === k.id}
                    onPress={() => {
                      setEditing(undefined);
                      act(() => setPostKind(p.id, k.id));
                    }}
                  />
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button
                small
                tone={p.featured ? 'done' : 'ghost'}
                label={p.featured ? '★ Featured' : 'Feature on Today'}
                onPress={() => act(() => setFeatured(p.id, !p.featured))}
              />
              <Button
                small
                tone="ghost"
                label="Change type"
                onPress={() => setEditing(editing === p.id ? undefined : p.id)}
              />
            </View>
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}
