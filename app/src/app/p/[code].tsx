import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanView } from '@/components/plan-view';
import { Button, Card, LoadState, Screen, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { datesLabel, getSharedPlan } from '@/lib/plans';

/** A shared plan, read-only: where plan links land, in the app or on the web. */
export default function SharedPlan() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const theme = useTheme();
  const track = useTrack();
  const q = useQuery(() => getSharedPlan(code), [code]);
  const plan = q.data;

  useEffect(() => {
    if (plan) track('plan_viewed_shared', { mine: plan.mine, items: plan.items.length });
  }, [plan, track]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Wichita Life
          </T>
        </Pressable>
      </View>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data === null ? 'This plan isn’t shared anymore. Ask whoever sent it for a new link.' : undefined}
        />
        {plan ? (
          <>
            <Sticker color={Brand.orange} shadow={Brand.navy}>
              <T variant="label" color={Brand.navy}>
                {plan.owner_name ? `${plan.owner_name}’s plan` : 'A Wichita Life plan'}
                {datesLabel(plan) ? ` · ${datesLabel(plan)}` : ''}
              </T>
              <T variant="heading" color={Brand.navy}>
                {plan.title}
              </T>
            </Sticker>
            {plan.items.length ? <PlanView plan={plan} /> : <T>Nothing in this plan yet.</T>}
            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">{plan.mine ? 'This is your plan' : 'Make your own plan'}</T>
              <T variant="small">
                {plan.mine
                  ? 'This is the view people see from your link.'
                  : 'Wichita Life finds events, trivia nights, happy hours and places to eat, and lines them up for your weekend.'}
              </T>
              <Button
                small
                tone="red"
                label={plan.mine ? 'Edit this plan' : 'Start planning'}
                onPress={() => (plan.mine ? router.push({ pathname: '/plans/[id]', params: { id: plan.id } }) : router.push('/plans'))}
              />
            </Card>
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
