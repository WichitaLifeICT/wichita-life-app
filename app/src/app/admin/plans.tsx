import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { PlanView } from '@/components/plan-view';
import { Button, Card, LoadState, SectionHeader, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { getPostedPlans, resolvePlanReports, reviewPlan, type ReviewPlan } from '@/lib/admin';
import { errorMessage } from '@/lib/format';
import { getPlan, type PlanDetail } from '@/lib/plans';

/** Plans members posted to "Plans around Wichita": approve, turn down, pick, handle reports. */
export default function AdminPlans() {
  const q = useQuery(getPostedPlans);
  const [open, setOpen] = useState<Record<string, PlanDetail | null>>({});
  const [error, setError] = useState<string>();

  const act = (fn: () => Promise<unknown>) => {
    setError(undefined);
    fn().then(q.refresh, (e) => setError(errorMessage(e)));
  };
  const toggle = (id: string) => {
    if (id in open) return setOpen(({ [id]: _, ...rest }) => rest);
    getPlan(id).then((p) => setOpen((o) => ({ ...o, [id]: p })), (e) => setError(errorMessage(e)));
  };

  const rows = q.data ?? [];
  const reported = rows.filter((p) => p.reports.length);
  const pending = rows.filter((p) => p.public_status === 'pending' && !p.reports.length);
  const live = rows.filter((p) => p.public_status === 'approved' && !p.reports.length);

  const card = (p: ReviewPlan) => (
    <Card key={p.id} style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
        <T variant="cardTitle" style={{ flex: 1 }}>
          {p.title}
        </T>
        {p.staff_pick ? <Tag label="Staff pick" tone="blue" /> : null}
      </View>
      <T variant="small">
        by {p.owner?.display_name ?? 'a member'} · {p.public_status}
        {p.reports.length ? ` · ${p.reports.length} report${p.reports.length === 1 ? '' : 's'}` : ''}
      </T>
      {open[p.id] ? <PlanView plan={open[p.id]!} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        <Button small tone="ghost" label={p.id in open ? 'Hide plan' : 'Read plan'} onPress={() => toggle(p.id)} />
        {p.public_status !== 'approved' ? (
          <Button small tone="red" label="Approve" onPress={() => act(() => reviewPlan(p.id, { public_status: 'approved' }))} />
        ) : (
          <Button
            small
            tone="ghost"
            label={p.staff_pick ? 'Unpick' : 'Staff pick'}
            onPress={() => act(() => reviewPlan(p.id, { staff_pick: !p.staff_pick }))}
          />
        )}
        {p.public_status !== 'rejected' ? (
          <Button
            small
            tone="ghost"
            label={p.public_status === 'approved' ? 'Take down' : 'Turn down'}
            onPress={() =>
              act(async () => {
                await reviewPlan(p.id, { public_status: 'rejected' });
                await resolvePlanReports(p.id);
              })
            }
          />
        ) : null}
        {p.reports.length ? (
          <Button small tone="ghost" label="Reports are fine" onPress={() => act(() => resolvePlanReports(p.id))} />
        ) : null}
      </View>
    </Card>
  );

  return (
    <AdminPage title="Plans" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.redText}>{error}</T> : null}
      <T variant="small">
        Members can post their plans to “Plans around Wichita”. Approve the ones that are fine to show everyone (notes
        included). Staff picks show first.
      </T>
      <LoadState loading={q.loading} error={q.error} empty={q.data && !rows.length ? 'No posted plans yet.' : undefined} />
      {reported.length ? <SectionHeader title="Reported" /> : null}
      {reported.map(card)}
      {pending.length ? <SectionHeader title="Waiting for review" /> : null}
      {pending.map(card)}
      {live.length ? <SectionHeader title="Public now" /> : null}
      {live.map(card)}
    </AdminPage>
  );
}
