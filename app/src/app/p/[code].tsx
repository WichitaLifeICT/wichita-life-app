import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanView } from '@/components/plan-view';
import { BackBar, Button, Card, LoadState, Screen, Sticker, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { addPlanToCalendar } from '@/lib/calendar';
import { errorMessage } from '@/lib/format';
import { requestFriend } from '@/lib/friends';
import { copyPlan, datesLabel, getPlan, getSharedPlan, goingLabel, reportPlan, setPlanJoin, sharePlan } from '@/lib/plans';

const isId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s);

/**
 * A plan someone shared (by its link code) or posted publicly (by its id), read-only. Links
 * carry the sharer's invite code (?ref=), which the app remembers for when a friend joins.
 */
export default function SharedPlan() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const theme = useTheme();
  const track = useTrack();
  const { session, profile } = useAuth();
  const requireSignIn = useRequireSignIn();
  const [notice, setNotice] = useState<string>();
  const [reported, setReported] = useState(false);
  const byId = isId(code);
  const q = useQuery(() => (byId ? getPlan(code) : getSharedPlan(code)), [code, session?.user.id]);
  const plan = q.data;

  useEffect(() => {
    if (plan) track('plan_viewed_shared', { mine: plan.mine, items: plan.items.length });
  }, [plan, track]);

  const copy = async () => {
    if (!plan || !requireSignIn('Sign in to save this plan')) return;
    try {
      const id = await copyPlan(byId ? { id: plan.id } : { code });
      track('plan_copied', { from: byId ? 'public' : 'link' });
      router.push({ pathname: '/plans/[id]', params: { id } });
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };

  const share = async () => {
    if (!plan) return;
    setNotice((await sharePlan(plan, byId ? plan.id : code, profile?.referral_code)) ?? undefined);
  };

  const join = async () => {
    if (!plan || !requireSignIn('Sign in to say you’re in')) return;
    try {
      await setPlanJoin(byId ? { id: plan.id } : { code }, !plan.im_in);
      track('plan_joined', { joining: !plan.im_in });
      q.refresh();
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };

  const report = async () => {
    if (!plan || !requireSignIn('Sign in to report')) return;
    try {
      await reportPlan(plan.id, 'Reported from the app');
      track('plan_reported', { plan_id: plan.id });
      setReported(true);
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <BackBar label="Plans" onPress={() => (router.canGoBack() ? router.back() : router.replace('/plans'))} />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data === null ? 'This plan isn’t shared anymore. Ask whoever sent it for a new link.' : undefined}
        />
        {plan ? (
          <>
            <Sticker color={Brand.orange} shadow={Brand.navy}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
                <T variant="label" color={Brand.navy} style={{ flex: 1 }}>
                  {plan.owner_name ? `${plan.owner_name}’s plan` : 'A Wichita Life plan'}
                  {datesLabel(plan) ? ` · ${datesLabel(plan)}` : ''}
                </T>
                {plan.staff_pick ? <Tag label="Staff pick" tone="blue" /> : null}
              </View>
              <T variant="heading" color={Brand.navy}>
                {plan.title}
              </T>
              {goingLabel(plan.going) ? (
                <T variant="small" color={Brand.navy} style={{ fontFamily: Fonts.display }}>
                  🙌 {goingLabel(plan.going)}
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
                {!plan.mine ? (
                  <Button small tone={plan.im_in ? 'done' : 'navy'} label={plan.im_in ? '✓ You’re in' : 'I’m in'} onPress={join} />
                ) : null}
                {plan.mine ? (
                  <Button small tone="red" label="Edit this plan" onPress={() => router.push({ pathname: '/plans/[id]', params: { id: plan.id } })} />
                ) : (
                  <Button small tone="ghost" label="Copy to my plans" onPress={copy} />
                )}
                <Button small tone="ghost" label="Share" onPress={share} />
                {plan.mine || plan.im_in ? (
                  <Button
                    small
                    tone="ghost"
                    label="Add to calendar"
                    onPress={() => {
                      setNotice(undefined);
                      track('plan_calendar_added', { mine: plan.mine, items: plan.items.length });
                      addPlanToCalendar(plan.id).catch((e) => setNotice(errorMessage(e)));
                    }}
                  />
                ) : null}
              </View>
            </Sticker>
            {notice ? <T>{notice}</T> : null}

            {plan.items.length ? <PlanView plan={plan} /> : <T>Nothing in this plan yet.</T>}

            {session && plan.going.some((g) => g.id !== session.user.id) ? (
              <Card style={{ gap: Spacing.one }}>
                <T variant="cardTitle">Who’s in</T>
                {plan.going
                  .filter((g) => g.id !== session.user.id)
                  .map((g) => (
                    <View key={g.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T>{g.name}</T>
                      <T
                        variant="small"
                        color={Brand.redText}
                        accessibilityRole="button"
                        onPress={async () => {
                          try {
                            const r = await requestFriend(g.id);
                            if (r !== 'already') track('friend_added', { how: 'request' });
                            setNotice(
                              r === 'already'
                                ? `You and ${g.name} are friends (or a request is waiting).`
                                : r === 'accepted'
                                  ? `You and ${g.name} are friends now.`
                                  : `Friend request sent to ${g.name}.`,
                            );
                          } catch (e) {
                            setNotice(errorMessage(e));
                          }
                        }}>
                        + Add friend
                      </T>
                    </View>
                  ))}
              </Card>
            ) : null}

            {!session ? (
              <Card style={{ gap: Spacing.two }}>
                <T variant="cardTitle">Plan your own Wichita weekend</T>
                <T variant="small">
                  Wichita Life finds events, trivia nights, happy hours and places to eat. Save this plan, change it up and share it
                  with your crew. It’s free.
                </T>
                <Button
                  small
                  tone="red"
                  label={Platform.OS === 'web' ? 'Join Wichita Life free' : 'Sign up free'}
                  onPress={() => router.push({ pathname: '/sign-in', params: { reason: 'Sign up to make your own plans' } })}
                />
              </Card>
            ) : null}

            {!plan.mine && plan.public_status === 'approved' ? (
              <T variant="small" color={reported ? theme.textSecondary : Brand.redText} onPress={reported ? undefined : report}>
                {reported ? 'Thanks. The team will take a look.' : 'Report this plan'}
              </T>
            ) : null}
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
