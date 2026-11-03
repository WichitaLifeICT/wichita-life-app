import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewPlanForm } from '@/components/new-plan-form';
import { Card, LoadState, PressableCard, Screen, SectionHeader, Sticker, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { datesLabel, deletePlan, getMyPlans, getPublicPlans } from '@/lib/plans';

/** My plans: every itinerary the member has going, newest first, and a form to start one. */
export default function Plans() {
  const theme = useTheme();
  const track = useTrack();
  const { session } = useAuth();
  const q = useQuery(() => (session ? getMyPlans() : Promise.resolve([])), [session?.user.id]);
  const feed = useQuery(getPublicPlans, [session?.user.id]);
  // ✕ on a plan asks first ("Delete?"), then deletes on the second tap.
  const [confirm, setConfirm] = useState<string>();
  const [error, setError] = useState<string>();
  const remove = (id: string) => {
    if (confirm !== id) return setConfirm(id);
    setConfirm(undefined);
    deletePlan(id).then(q.refresh, (e) => setError(errorMessage(e)));
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/events'))}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Back
          </T>
        </Pressable>
      </View>
      <Screen
        refreshing={q.refreshing || feed.refreshing}
        onRefresh={() => {
          q.refresh();
          feed.refresh();
        }}>
        <Sticker color={Brand.orange} shadow={Brand.navy}>
          <T variant="label" color={Brand.navy}>
            Plan your weekend
          </T>
          <T variant="heading" color={Brand.navy}>
            My plans
          </T>
          <T color={Brand.navy}>
            Line up events, trivia nights, happy hours and places to eat, then share the plan with whoever’s coming.
          </T>
        </Sticker>

        {!session ? (
          <Card style={{ gap: Spacing.two }}>
            <T>Sign in to make plans and share them.</T>
            <T
              color={Brand.redText}
              style={{ fontFamily: Fonts.display }}
              onPress={() => router.push({ pathname: '/sign-in', params: { reason: 'Sign in to make plans' } })}>
              Sign in ›
            </T>
          </Card>
        ) : (
          <>
            <LoadState loading={q.loading} error={q.error} />
            {error ? <T color={Brand.redText}>{error}</T> : null}
            {(q.data ?? []).map((p) => (
              <PressableCard key={p.id} onPress={() => router.push({ pathname: '/plans/[id]', params: { id: p.id } })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
                  <T variant="cardTitle" style={{ flex: 1 }}>
                    {p.title} ›
                  </T>
                  {p.public_status === 'approved' ? (
                    <Tag label="Public" tone="green" />
                  ) : p.public_status === 'pending' ? (
                    <Tag label="In review" />
                  ) : p.share_code ? (
                    <Tag label="Shared" tone="blue" />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={confirm === p.id ? `Delete ${p.title}` : `Remove ${p.title}`}
                    hitSlop={10}
                    onPress={() => remove(p.id)}>
                    <T
                      variant="small"
                      color={Brand.redText}
                      style={{ fontFamily: Fonts.display, fontSize: confirm === p.id ? 12.5 : 16 }}>
                      {confirm === p.id ? 'Delete?' : '✕'}
                    </T>
                  </Pressable>
                </View>
                <T variant="small">
                  {[datesLabel(p), `${p.items} thing${p.items === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                </T>
              </PressableCard>
            ))}
            {q.data ? (
              <Card style={{ gap: Spacing.two }}>
                <SectionHeader title={q.data.length ? 'Start another plan' : 'Start your first plan'} />
                <NewPlanForm
                  onCreated={(id) => {
                    track('plan_created', { from: 'plans' });
                    router.push({ pathname: '/plans/[id]', params: { id } });
                    q.refresh();
                  }}
                />
              </Card>
            ) : null}
          </>
        )}

        <SectionHeader title="Plans around Wichita" />
        <T variant="small">Plans other members posted. Open one to see it, then copy it to make it yours.</T>
        <LoadState
          loading={feed.loading}
          error={feed.error}
          empty={feed.data && !feed.data.length ? 'No public plans yet. Post yours from any of your plans and be the first.' : undefined}
        />
        {(feed.data ?? []).map((p) => (
          <PressableCard key={p.id} onPress={() => router.push({ pathname: '/p/[code]', params: { code: p.id } })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
              <T variant="cardTitle" style={{ flex: 1 }}>
                {p.title} ›
              </T>
              {p.staff_pick ? <Tag label="Staff pick" tone="blue" /> : null}
            </View>
            <T variant="small">
              {[p.owner_name ? `by ${p.owner_name}` : null, datesLabel(p), `${p.items} thing${p.items === 1 ? '' : 's'}`]
                .filter(Boolean)
                .join(' · ')}
            </T>
            {p.preview.length ? (
              <T variant="small" color={theme.heading} numberOfLines={2}>
                {p.preview.join(' → ')}
              </T>
            ) : null}
          </PressableCard>
        ))}
      </Screen>
    </SafeAreaView>
  );
}
