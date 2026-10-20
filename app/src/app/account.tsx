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
import { getNotificationPrefs, getSavedEvents, setNotificationPref, updateProfile } from '@/lib/member';
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

export default function Account() {
  const theme = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id;
  const q = useQuery(async () => {
    if (!userId) return null;
    const [saved, prefs] = await Promise.all([getSavedEvents(), getNotificationPrefs()]);
    return { saved, prefs };
  }, [userId]);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const shownPrefs = prefs ?? q.data?.prefs ?? null;
  const [name, setName] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      </Screen>
    </SafeAreaView>
  );
}
