import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewPlanForm } from '@/components/new-plan-form';
import { Button, Card, ClosePill, LoadState, Screen, SectionHeader, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { errorMessage } from '@/lib/format';
import { addToPlan, datesLabel, getMyPlans, type PlanItemKind } from '@/lib/plans';

const KINDS: PlanItemKind[] = ['event', 'special', 'place', 'meetup', 'activity'];

/** "Add to plan": pick one of your plans (or start one) for an event, special, place or meetup. */
export default function AddToPlan() {
  const { kind, id, title } = useLocalSearchParams<{ kind: string; id: string; title?: string }>();
  const theme = useTheme();
  const track = useTrack();
  const q = useQuery(getMyPlans, []);
  const [added, setAdded] = useState<{ id: string; title: string }>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const valid = KINDS.includes(kind as PlanItemKind) && !!id;

  const add = async (planId: string, planTitle: string, isNew = false) => {
    setBusy(planId);
    setError(undefined);
    try {
      await addToPlan(
        planId,
        kind === 'activity' ? { kind: 'activity', activity_id: id } : { kind: kind as 'event' | 'special' | 'place' | 'meetup', ref_id: id },
      );
      track('plan_item_added', { kind, new_plan: isNew });
      setAdded({ id: planId, title: planTitle });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  };

  const plans = q.data ?? [];
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.one, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }}>
        <T variant="title">Add to plan</T>
        <ClosePill label={added ? 'Done' : 'Cancel'} onPress={() => router.back()} />
      </View>
      <Screen>
        {title ? <T>{title}</T> : null}
        {!valid ? <T>Nothing to add.</T> : added ? (
          <Card style={{ gap: Spacing.two }}>
            <T variant="cardTitle">Added to {added.title} ✓</T>
            <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
              <Button
                small
                tone="red"
                label="See plan"
                onPress={() => router.replace({ pathname: '/plans/[id]', params: { id: added.id } })}
              />
              <Button small tone="ghost" label="Keep browsing" onPress={() => router.back()} />
            </View>
          </Card>
        ) : (
          <>
            <LoadState loading={q.loading} error={q.error} />
            {plans.map((p) => (
              <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <View style={{ flex: 1 }}>
                  <T variant="cardTitle">{p.title}</T>
                  <T variant="small">
                    {[datesLabel(p), `${p.items} thing${p.items === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </T>
                </View>
                <Button small tone="red" label={busy === p.id ? 'Adding…' : 'Add'} disabled={!!busy} onPress={() => add(p.id, p.title)} />
              </Card>
            ))}
            {q.data && (creating || !plans.length) ? (
              <Card style={{ gap: Spacing.two }}>
                <SectionHeader title={plans.length ? 'New plan' : 'Start your first plan'} />
                <NewPlanForm cta="Create and add" onCreated={(newId) => {
                  track('plan_created', { from: 'add_to_plan' });
                  add(newId, 'your new plan', true);
                }} />
              </Card>
            ) : q.data ? (
              <Button tone="ghost" label="+ New plan" onPress={() => setCreating(true)} />
            ) : null}
            {error ? <T color={Brand.redText}>{error}</T> : null}
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
