import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { PlanView } from '@/components/plan-view';
import { Button, Card, LoadState, SectionHeader, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import {
  getFriendStats,
  getPlanMakers,
  getPostedPlans,
  resolvePlanReports,
  reviewPlan,
  type ReviewPlan,
} from '@/lib/admin';
import { errorMessage, shortDay } from '@/lib/format';
import { getPlan, type PlanDetail } from '@/lib/plans';

/** Plans members posted to "Plans around Wichita": approve, turn down, pick, handle reports. */
export default function AdminPlans() {
  const q = useQuery(getPostedPlans);
  // Who's using plans and friends: counts and names only, never the plans themselves.
  const people = useQuery(async () => ({ makers: await getPlanMakers(), friends: await getFriendStats() }));
  const [showMakers, setShowMakers] = useState(false);
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
    <AdminPage title="Plans" refreshing={q.refreshing} onRefresh={() => (q.refresh(), people.refresh())}>
      {error ? <T color={Brand.redText}>{error}</T> : null}
      <T variant="small">
        Members can post their plans to “Plans around Wichita”. Approve the ones that are fine to show everyone (notes
        included). Staff picks show first.
      </T>
      {people.data ? (
        <Card style={{ gap: Spacing.two }}>
          <T variant="cardTitle">Friends & plans</T>
          <T>
            {people.data.friends.friendships} friend{' '}
            {people.data.friends.friendships === 1 ? 'connection' : 'connections'} ·{' '}
            {people.data.friends.members_with_friends} {people.data.friends.members_with_friends === 1 ? 'member has' : 'members have'}{' '}
            a friend
            {people.data.friends.pending ? ` · ${people.data.friends.pending} waiting for a yes` : ''}
          </T>
          <T>
            {people.data.makers.filter((m) => m.plans > 0 && !m.staff).length} members made{' '}
            {people.data.makers.filter((m) => !m.staff).reduce((n, m) => n + Number(m.plans), 0)} plans ·{' '}
            {people.data.makers.filter((m) => m.joined > 0 && !m.staff).length} said “I’m in” on someone else’s
          </T>
          <T variant="small">Plan numbers leave out staff; the friends line includes them. Plans are private, so this shows who and how many, not the plans.</T>
          <Button
            small
            tone="ghost"
            label={showMakers ? 'Hide who' : `See who’s making plans (${people.data.makers.length})`}
            onPress={() => setShowMakers((v) => !v)}
          />
          {showMakers
            ? people.data.makers.map((m) => (
                <View key={m.user_id} style={{ gap: 2, opacity: m.staff ? 0.6 : 1 }}>
                  <T>
                    <T style={{ fontFamily: Fonts.bodyBold }}>{m.display_name || 'Member'}</T> · {m.plans}{' '}
                    {Number(m.plans) === 1 ? 'plan' : 'plans'}
                    {m.posted ? ` (${m.posted} posted)` : ''}
                    {m.joined ? ` · in on ${m.joined} of others’` : ''}
                    {m.staff ? ' · staff' : ''}
                  </T>
                  {m.last_at ? <T variant="small">Last {shortDay(m.last_at)}</T> : null}
                </View>
              ))
            : null}
        </Card>
      ) : null}
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
