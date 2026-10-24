import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, ChipRow, LoadState, SectionHeader, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { getOpenReports, getThreadsForReview, resolveReport, setThreadStatus } from '@/lib/admin';
import { relativeTime } from '@/lib/format';

export default function AdminBoard() {
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const [error, setError] = useState<string>();
  const q = useQuery(async () => {
    const [threads, reports] = await Promise.all([getThreadsForReview(tab), getOpenReports()]);
    return { threads, reports };
  }, [tab]);

  const act = (fn: () => Promise<unknown>) => {
    setError(undefined);
    fn().then(q.refresh, (e: Error) => setError(e.message));
  };

  return (
    <AdminPage title="Community board" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.red}>{error}</T> : null}
      <LoadState loading={q.loading} error={q.error} />

      {q.data?.reports.length ? (
        <View style={{ gap: Spacing.two }}>
          <SectionHeader title={`Reports (${q.data.reports.length})`} />
          {q.data.reports.map((r) => (
            <Card key={r.id} style={{ gap: Spacing.two }}>
              <T variant="small">
                Reported {relativeTime(r.created_at)} · {r.reason}
              </T>
              <T variant="cardTitle">{r.thread?.title ?? r.reply?.body ?? '(already deleted)'}</T>
              {r.thread?.body ? <T variant="small">{r.thread.body}</T> : null}
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <Button small tone="red" label="Remove it" onPress={() => act(() => resolveReport(r.id, true, r))} />
                <Button small tone="ghost" label="It's fine" onPress={() => act(() => resolveReport(r.id, false, r))} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <View style={{ gap: Spacing.two }}>
        <ChipRow>
          <Chip label="Waiting for review" active={tab === 'pending'} onPress={() => setTab('pending')} />
          <Chip label="Live" active={tab === 'approved'} onPress={() => setTab('approved')} />
        </ChipRow>
        {q.data && !q.data.threads.length ? (
          <T variant="small">{tab === 'pending' ? 'Nothing waiting. Nice.' : 'No live posts yet.'}</T>
        ) : null}
        {q.data?.threads.map((t) => (
          <Card key={t.id} style={{ gap: Spacing.two }}>
            <T variant="small">
              {t.group ? `${t.group.name} board` : t.category.replace(/_/g, ' ')} · {t.author_name} · {relativeTime(t.created_at)}
            </T>
            <T variant="cardTitle">{t.title}</T>
            {t.body ? <T variant="small">{t.body}</T> : null}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              {t.status === 'pending' ? (
                <Button
                  small
                  tone="done"
                  label="Approve"
                  onPress={() => act(() => setThreadStatus(t.id, 'approved'))}
                />
              ) : null}
              <Button small tone="ghost" label="Remove" onPress={() => act(() => setThreadStatus(t.id, 'removed'))} />
            </View>
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}
