import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, ChipRow, LoadState, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { getFeedback, setFeedbackStatus, type FeedbackItem, type FeedbackStatus } from '@/lib/admin';
import { relativeTime } from '@/lib/format';
import { openLink } from '@/lib/links';

const TABS: { id: FeedbackStatus | 'all'; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'read', label: 'Read' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

const KIND: Record<FeedbackItem['kind'], { label: string; tone: 'orange' | 'green' | 'blue' }> = {
  idea: { label: 'Idea', tone: 'blue' },
  bug: { label: 'Broken', tone: 'orange' },
  love: { label: 'Love', tone: 'green' },
  other: { label: 'Other', tone: 'blue' },
};

export default function AdminFeedback() {
  const [tab, setTab] = useState<FeedbackStatus | 'all'>('new');
  const [error, setError] = useState<string>();
  const q = useQuery(() => getFeedback(tab), [tab]);

  const move = (id: string, status: FeedbackStatus) => {
    setError(undefined);
    setFeedbackStatus(id, status).then(q.refresh, (e: Error) => setError(e.message));
  };

  return (
    <AdminPage title="Feedback" refreshing={q.refreshing} onRefresh={q.refresh}>
      <ChipRow>
        {TABS.map((t) => (
          <Chip key={t.id} label={t.label} active={tab === t.id} onPress={() => setTab(t.id)} />
        ))}
      </ChipRow>
      {error ? <T color={Brand.redText}>{error}</T> : null}
      <LoadState
        loading={q.loading}
        error={q.error}
        empty={q.data && !q.data.length ? (tab === 'new' ? 'No new feedback. Nice.' : 'Nothing here.') : undefined}
      />
      {q.data?.map((f) => (
        <Card key={f.id} style={{ gap: Spacing.two }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
            <Tag label={KIND[f.kind].label} tone={KIND[f.kind].tone} />
            <T variant="small">
              {f.sender_name} · {relativeTime(f.created_at)}
              {f.screen ? ` · from ${f.screen}` : ''}
              {f.platform ? ` · ${f.platform}` : ''}
            </T>
          </View>
          <T>{f.message}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {f.reply_email ? (
              <Button
                small
                tone="navy"
                label="Reply by email"
                onPress={() =>
                  openLink(`mailto:${f.reply_email}?subject=${encodeURIComponent('Your Wichita Life feedback')}`)
                }
              />
            ) : null}
            {f.status !== 'read' ? <Button small tone="ghost" label="Mark read" onPress={() => move(f.id, 'read')} /> : null}
            {f.status !== 'done' ? <Button small tone="done" label="Done" onPress={() => move(f.id, 'done')} /> : null}
          </View>
        </Card>
      ))}
    </AdminPage>
  );
}
