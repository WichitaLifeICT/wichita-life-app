import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventRow } from '@/components/event-row';
import { Button, Card, Field, LoadState, Screen, SectionHeader, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { deleteAccount, signOut, useAuth } from '@/lib/auth';
import {
  claimReferral,
  getNotificationPrefs,
  getSavedEvents,
  setNotificationPref,
  updateProfile,
  wasReferred,
  type ReferralResult,
} from '@/lib/member';
import type { NotificationPrefs } from '@/lib/types';

const PREFS: { key: keyof NotificationPrefs; label: string; sub: string }[] = [
  {
    key: 'daily',
    label: 'Today in Wichita',
    sub: 'A short morning heads-up, 7am',
  },
  { key: 'weekend', label: 'Weekend guide', sub: 'Thursdays' },
  {
    key: 'giveaways',
    label: 'Giveaways',
    sub: 'New giveaways and winner news',
  },
  {
    key: 'breaking',
    label: 'Big local news',
    sub: 'Rare: weather and major news only',
  },
];

const INVITE_MESSAGES: Record<ReferralResult, string> = {
  ok: '',
  already_claimed: 'You already used a friend’s code.',
  too_late: 'Invite codes only work in your first week.',
  not_found: 'We couldn’t find that code. Check it and try again.',
  own_code: 'That’s your own code! Share it with friends instead.',
  sign_in: 'Sign in first.',
};

export default function Account() {
  const theme = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id;
  const q = useQuery(async () => {
    if (!userId) return null;
    const [saved, prefs, referred] = await Promise.all([getSavedEvents(), getNotificationPrefs(), wasReferred()]);
    // Friends' invite codes only count for accounts made in the last week.
    const isNew = Date.now() - new Date(profile?.created_at ?? 0).getTime() < 7 * 24 * 3600 * 1000;
    return { saved, prefs, referred, isNew };
  }, [userId, profile?.created_at]);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const shownPrefs = prefs ?? q.data?.prefs ?? null;
  const [name, setName] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteResult, setInviteResult] = useState<ReferralResult>();
  const [error, setError] = useState<string>();

  const togglePref = (key: keyof NotificationPrefs, value: boolean) => {
    if (!shownPrefs) return;
    setPrefs({ ...shownPrefs, [key]: value });
    setNotificationPref(key, value).catch((e: Error) => {
      setError(e.message);
      setPrefs(shownPrefs);
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          paddingHorizontal: Spacing.three,
          paddingTop: Spacing.two,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
        <T variant="title">Your account</T>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            Close
          </T>
        </Pressable>
      </View>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        {!session ? (
          <Card style={{ gap: Spacing.two }}>
            <T variant="cardTitle">You&apos;re browsing as a guest</T>
            <T variant="small">Sign in to save events, enter giveaways, RSVP to meetups and post on the board.</T>
            <Button tone="red" label="Sign in" onPress={() => router.push('/sign-in')} />
          </Card>
        ) : (
          <>
            <View style={{ gap: Spacing.two }}>
              <Field
                label="Name on the community board"
                value={name ?? profile?.display_name ?? ''}
                onChangeText={setName}
                maxLength={40}
                placeholder="Ana L."
              />
              <T variant="small">Signed in as {session.user.email}</T>
              {name !== undefined && name.trim() !== profile?.display_name ? (
                <Button
                  small
                  label="Save name"
                  disabled={name.trim().length < 2}
                  onPress={() =>
                    updateProfile({ display_name: name.trim() })
                      .then(refreshProfile)
                      .then(() => setName(undefined))
                      .catch((e: Error) => setError(e.message))
                  }
                />
              ) : null}
            </View>

            <LoadState loading={q.loading} error={q.error} />

            {q.data?.isNew && !q.data.referred && inviteResult !== 'ok' ? (
              <Card style={{ gap: Spacing.two }}>
                <T variant="cardTitle">Did a friend invite you?</T>
                <T variant="small">Enter their invite code and they get bonus giveaway entries.</T>
                <Field
                  label="Friend's invite code"
                  value={inviteCode}
                  onChangeText={(v) => setInviteCode(v.toUpperCase().slice(0, 6))}
                  autoCapitalize="characters"
                  placeholder="ABC234"
                />
                <Button
                  small
                  label="Add code"
                  disabled={inviteCode.length !== 6}
                  onPress={() =>
                    claimReferral(inviteCode)
                      .then(setInviteResult)
                      .catch((e: Error) => setError(e.message))
                  }
                />
                {inviteResult ? (
                  <T variant="small" color={Brand.red}>
                    {INVITE_MESSAGES[inviteResult]}
                  </T>
                ) : null}
              </Card>
            ) : null}
            {inviteResult === 'ok' ? <T variant="small">Thanks! Your friend got their bonus entries.</T> : null}

            {q.data ? (
              <View style={{ gap: Spacing.two }}>
                <SectionHeader title="Saved events" />
                {q.data.saved.length ? null : <T variant="small">Tap Save on any event and it shows up here.</T>}
                {q.data.saved.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </View>
            ) : null}

            {shownPrefs ? (
              <View style={{ gap: Spacing.two }}>
                <SectionHeader title="Notifications" />
                {PREFS.map((p) => (
                  <Card
                    key={p.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: Spacing.two,
                    }}>
                    <View style={{ flex: 1 }}>
                      <T variant="cardTitle">{p.label}</T>
                      <T variant="small">{p.sub}</T>
                    </View>
                    <Switch
                      accessibilityLabel={p.label}
                      value={shownPrefs[p.key]}
                      onValueChange={(v) => togglePref(p.key, v)}
                      trackColor={{ true: Brand.blue, false: theme.line }}
                    />
                  </Card>
                ))}
                <T variant="small">Push notifications arrive with the phone app.</T>
              </View>
            ) : null}

            {error ? (
              <T variant="small" color={Brand.red}>
                {error}
              </T>
            ) : null}

            {profile && profile.role !== 'member' ? (
              <Button tone="navy" label="Staff tools" onPress={() => router.push('/admin')} />
            ) : null}

            <View style={{ gap: Spacing.two }}>
              <Button tone="ghost" label="Sign out" onPress={() => signOut().then(() => router.back())} />
              <Button
                tone={confirmDelete ? 'red' : 'ghost'}
                small
                label={confirmDelete ? 'Tap again to permanently delete your account' : 'Delete account'}
                onPress={() => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  deleteAccount()
                    .then(() => router.replace('/'))
                    .catch((e: Error) => setError(e.message));
                }}
              />
              {confirmDelete ? (
                <T variant="small">
                  This removes your saves, RSVPs, giveaway entries and board posts. It can&apos;t be undone.
                </T>
              ) : null}
            </View>
          </>
        )}
        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <T variant="small" color={Brand.red} onPress={() => router.push('/privacy')}>
            Privacy Policy
          </T>
          <T variant="small" color={Brand.red} onPress={() => router.push('/terms')}>
            Terms & Community Guidelines
          </T>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
