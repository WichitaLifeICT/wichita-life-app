import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanView } from '@/components/plan-view';
import { Button, Card, Chip, ChipRow, Field, LoadState, Screen, SectionHeader, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { getFriends, sendPlan, type Friend } from '@/lib/friends';
import {
  addToPlan,
  datePresets,
  datesLabel,
  deletePlan,
  getPlan,
  goingLabel,
  planDays,
  removeFromPlan,
  setItemDay,
  setFriendsCanSee,
  setPlanPublic,
  setPlanSharing,
  sharePlan,
  shortDayName,
  updatePlan,
  type PlanItem,
} from '@/lib/plans';

/** One of my plans: the itinerary, notes, sharing, and editing the name and dates. */
export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const track = useTrack();
  const { profile } = useAuth();
  const q = useQuery(() => getPlan(id), [id]);
  const plan = q.data;
  const [notice, setNotice] = useState<string>();
  const [note, setNote] = useState('');
  const [noteDay, setNoteDay] = useState<string | null>(null);
  const [moving, setMoving] = useState<PlanItem>();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [friends, setFriends] = useState<Friend[]>();
  const [picked, setPicked] = useState<string[]>([]);
  const presets = useMemo(() => datePresets(), []);
  const days = plan ? planDays(plan) : [];

  const act = (fn: () => Promise<unknown>) => {
    setNotice(undefined);
    fn().then(q.refresh, (e) => setNotice(errorMessage(e)));
  };

  const share = () =>
    act(async () => {
      if (!plan) return;
      const code = plan.share_code ?? (await setPlanSharing(plan.id, true));
      if (!code) return;
      track('plan_shared', { items: plan.items.length });
      const status = await sharePlan(plan, code, profile?.referral_code);
      if (status) setNotice(status);
    });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/plans'));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={back}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ My plans
          </T>
        </Pressable>
      </View>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <LoadState loading={q.loading} error={q.error} empty={q.data === null ? 'This plan isn’t here anymore.' : undefined} />
        {plan ? (
          <>
            <Sticker color={Brand.orange} shadow={Brand.navy}>
              <T variant="label" color={Brand.navy}>
                {datesLabel(plan) ?? 'Plan'}
              </T>
              <T variant="heading" color={Brand.navy}>
                {plan.title}
              </T>
              <T variant="small" color={Brand.navy} style={{ fontFamily: Fonts.display }}>
                {goingLabel(plan.going) ? `🙌 ${goingLabel(plan.going)}` : 'Share it and your friends can tap “I’m in”.'}
              </T>
              <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
                <Button small tone="red" label={plan.share_code ? 'Share link' : 'Share plan'} onPress={share} />
                <Button
                  small
                  tone="ghost"
                  label={editing ? 'Done editing' : 'Edit name & dates'}
                  onPress={() => {
                    setTitle(plan.title);
                    setEditing(!editing);
                  }}
                />
              </View>
              {plan.share_code ? (
                <T variant="small" color={Brand.navy}>
                  Anyone with the link can see this plan.{' '}
                  <T
                    variant="small"
                    color={Brand.redText}
                    style={{ fontFamily: Fonts.display }}
                    onPress={() => act(() => setPlanSharing(plan.id, false))}>
                    Stop sharing
                  </T>
                </T>
              ) : null}
            </Sticker>

            {notice ? <T color={Brand.redText}>{notice}</T> : null}

            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">👋 Friends</T>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: !!plan.friends_can_see }}
                onPress={() => act(() => setFriendsCanSee(plan.id, !plan.friends_can_see))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <T style={{ fontSize: 18 }}>{plan.friends_can_see ? '☑️' : '⬜️'}</T>
                <T style={{ flex: 1 }}>Show this plan to all my friends</T>
              </Pressable>
              {friends ? (
                friends.length ? (
                  <>
                    <T variant="small">Pick friends to send it to. They’ll get a notification and can say they’re in.</T>
                    <ChipRow>
                      {friends.map((f) => (
                        <Chip
                          key={f.id}
                          label={f.name ?? 'Friend'}
                          active={picked.includes(f.id)}
                          onPress={() => setPicked((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))}
                        />
                      ))}
                    </ChipRow>
                    <Button
                      small
                      tone="red"
                      label={picked.length ? `Send to ${picked.length}` : 'Send'}
                      disabled={!picked.length}
                      onPress={() =>
                        act(async () => {
                          const n = await sendPlan(plan.id, picked);
                          track('plan_sent_to_friends', { friends: n });
                          setPicked([]);
                          setNotice(n ? `Sent to ${n} friend${n === 1 ? '' : 's'}.` : 'They already have it.');
                        })
                      }
                    />
                  </>
                ) : (
                  <T variant="small">
                    No friends yet.{' '}
                    <T variant="small" color={Brand.redText} onPress={() => router.push('/friends')}>
                      Add friends ›
                    </T>
                  </T>
                )
              ) : (
                <Button
                  small
                  tone="ghost"
                  label="Send to friends"
                  onPress={() =>
                    getFriends().then(
                      (all) => setFriends(all.filter((f) => f.status === 'friend')),
                      (e) => setNotice(errorMessage(e)),
                    )
                  }
                />
              )}
            </Card>

            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">
                {plan.public_status === 'approved'
                  ? '🌎 Public in Plans around Wichita'
                  : plan.public_status === 'pending'
                    ? '⏳ Waiting for a quick review'
                    : plan.public_status === 'rejected'
                      ? 'Not posted'
                      : 'Post to Plans around Wichita'}
              </T>
              <T variant="small">
                {plan.public_status === 'approved'
                  ? 'Anyone can see and copy this plan, notes included. Changing its name or adding a note sends it back for a quick review.'
                  : plan.public_status === 'pending'
                    ? 'The Wichita Life team checks posted plans, usually within a day. It shows up for everyone once it’s approved.'
                    : plan.public_status === 'rejected'
                      ? 'The team didn’t post this one. Check the name and notes, then try again.'
                      : 'Share your plan with all of Wichita. Others can browse it and copy it into their own plans. Your notes show too.'}
              </T>
              <View style={{ flexDirection: 'row' }}>
                {plan.public_status === 'approved' || plan.public_status === 'pending' ? (
                  <Button small tone="ghost" label={plan.public_status === 'approved' ? 'Take it down' : 'Cancel'} onPress={() => act(() => setPlanPublic(plan.id, false))} />
                ) : (
                  <Button
                    small
                    tone="navy"
                    label={plan.public_status === 'rejected' ? 'Try again' : 'Post publicly'}
                    disabled={!plan.items.length}
                    onPress={() =>
                      act(async () => {
                        await setPlanPublic(plan.id, true);
                        track('plan_posted', { items: plan.items.length });
                      })
                    }
                  />
                )}
              </View>
            </Card>

            {editing ? (
              <Card style={{ gap: Spacing.two }}>
                <Field label="Plan name" value={title} onChangeText={setTitle} maxLength={60} />
                <Button
                  small
                  tone="navy"
                  label="Save name"
                  disabled={!title.trim()}
                  onPress={() => act(() => updatePlan(plan.id, { title: title.trim() }))}
                />
                <T variant="label">Change dates</T>
                <ChipRow>
                  {presets.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.label}
                      active={p.starts_on === plan.starts_on && p.ends_on === plan.ends_on}
                      onPress={() => act(() => updatePlan(plan.id, { starts_on: p.starts_on, ends_on: p.ends_on }))}
                    />
                  ))}
                </ChipRow>
                <Button
                  small
                  tone="ghost"
                  label={confirmDelete ? 'Tap again to delete this plan' : 'Delete plan'}
                  onPress={() => {
                    if (!confirmDelete) return setConfirmDelete(true);
                    act(async () => {
                      await deletePlan(plan.id);
                      back();
                    });
                  }}
                />
              </Card>
            ) : null}

            {plan.items.length ? (
              <PlanView
                plan={plan}
                action={(item) => (
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    {item.kind === 'place' || item.kind === 'note' || item.kind === 'special' ? (
                      <T
                        variant="small"
                        color={Brand.blue}
                        style={{ fontFamily: Fonts.display }}
                        accessibilityRole="button"
                        onPress={() => setMoving(moving?.id === item.id ? undefined : item)}>
                        Day
                      </T>
                    ) : null}
                    <T
                      variant="small"
                      color={Brand.redText}
                      style={{ fontFamily: Fonts.display }}
                      accessibilityRole="button"
                      accessibilityLabel="Remove from plan"
                      onPress={() => act(() => removeFromPlan(item.id))}>
                      ✕
                    </T>
                  </View>
                )}
              />
            ) : (
              <Card style={{ gap: Spacing.two }}>
                <T variant="cardTitle">Nothing here yet</T>
                <T variant="small">
                  Tap “Add to plan” on an event, a trivia night or happy hour, a meetup, or a pick from Where should I eat.
                </T>
                <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
                  <Button small tone="ghost" label="Events" onPress={() => router.push('/events')} />
                  <Button
                    small
                    tone="ghost"
                    label="Happy hours & trivia"
                    onPress={() => router.push({ pathname: '/events', params: { view: 'weekly' } })}
                  />
                  <Button small tone="ghost" label="Where to eat" onPress={() => router.push('/explore')} />
                </View>
              </Card>
            )}

            {moving ? (
              <Card style={{ gap: Spacing.two }}>
                <T variant="cardTitle">Which day?</T>
                <ChipRow>
                  <Chip
                    label={moving.kind === 'special' ? 'Next time it’s on' : 'Anytime'}
                    active={!moving.on_date}
                    onPress={() => act(async () => (await setItemDay(moving.id, null), setMoving(undefined)))}
                  />
                  {days.map((d) => (
                    <Chip
                      key={d}
                      label={`${shortDayName(d)} ${Number(d.slice(8))}`}
                      active={moving.on_date === d}
                      onPress={() => act(async () => (await setItemDay(moving.id, d), setMoving(undefined)))}
                    />
                  ))}
                </ChipRow>
              </Card>
            ) : null}

            <Card style={{ gap: Spacing.two }}>
              <SectionHeader title="Add a note" />
              <Field
                label="Note"
                value={note}
                onChangeText={setNote}
                placeholder="Pick up Sam at 6, reservations under Lee…"
                maxLength={300}
              />
              <ChipRow>
                <Chip label="Anytime" active={!noteDay} onPress={() => setNoteDay(null)} />
                {days.map((d) => (
                  <Chip key={d} label={`${shortDayName(d)} ${Number(d.slice(8))}`} active={noteDay === d} onPress={() => setNoteDay(d)} />
                ))}
              </ChipRow>
              <Button
                small
                tone="navy"
                label="Add note"
                disabled={!note.trim()}
                onPress={() =>
                  act(async () => {
                    await addToPlan(plan.id, { kind: 'note', note, on_date: noteDay });
                    track('plan_item_added', { kind: 'note', new_plan: false });
                    setNote('');
                  })
                }
              />
            </Card>
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
