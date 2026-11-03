import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadState, PressableCard, Screen, SectionHeader, Sticker, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { friendLink, getFriends, getFriendsPlans, removeFriend, respondFriend, shareFriendLink, type Friend } from '@/lib/friends';
import { datesLabel } from '@/lib/plans';

/** Friends: your friend link and QR code, requests, friends' plans and your friends. */
export default function Friends() {
  const theme = useTheme();
  const track = useTrack();
  const { session, profile } = useAuth();
  const q = useQuery(
    async () => (session ? { friends: await getFriends(), plans: await getFriendsPlans() } : null),
    [session?.user.id],
  );
  const [notice, setNotice] = useState<string>();
  const [showQr, setShowQr] = useState(false);
  const [confirm, setConfirm] = useState<string>();

  const act = (fn: () => Promise<unknown>) => {
    setNotice(undefined);
    fn().then(q.refresh, (e) => setNotice(errorMessage(e)));
  };

  const all = q.data?.friends ?? [];
  const incoming = all.filter((f) => f.status === 'incoming');
  const friends = all.filter((f) => f.status === 'friend');
  const sent = all.filter((f) => f.status === 'sent');
  const code = profile?.friend_code;

  const row = (f: Friend, actions: React.ReactNode) => (
    <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Brand.blue, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontFamily: Fonts.display }} color={Brand.white}>
          {(f.name ?? '?').charAt(0).toUpperCase()}
        </T>
      </View>
      <T style={{ flex: 1, fontFamily: Fonts.display }}>{f.name ?? 'A member'}</T>
      {actions}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/meet'))}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Back
          </T>
        </Pressable>
      </View>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <Sticker color={Brand.blue} shadow={Brand.orange}>
          <T variant="label" color={Brand.orange}>
            Make plans together
          </T>
          <T variant="heading" color={Brand.white}>
            Friends
          </T>
          <T color="#EAF0FA">
            Send friends your link or let them scan your code. Friends see the plans you show them, can say they’re in,
            and see which events you saved.
          </T>
          {session && code ? (
            <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
              <Button
                small
                tone="orange"
                label="Share my friend link"
                onPress={async () => {
                  track('friend_link_shared', { how: 'link' });
                  setNotice((await shareFriendLink(code, profile?.referral_code, profile?.display_name)) ?? undefined);
                }}
              />
              <Button
                small
                tone="ghost"
                label={showQr ? 'Hide my code' : 'Show my code'}
                onPress={() => {
                  if (!showQr) track('friend_link_shared', { how: 'qr' });
                  setShowQr(!showQr);
                }}
              />
            </View>
          ) : null}
        </Sticker>

        {showQr && code ? (
          <Card style={{ alignItems: 'center', gap: Spacing.two }}>
            <View style={{ padding: Spacing.two, backgroundColor: Brand.white, borderRadius: 12 }}>
              <QRCode value={friendLink(code, profile?.referral_code)} size={200} color={Brand.navy} backgroundColor={Brand.white} />
            </View>
            <T variant="small">Have a friend point their phone camera here.</T>
          </Card>
        ) : null}

        {notice ? <T>{notice}</T> : null}

        {!session ? (
          <Card style={{ gap: Spacing.two }}>
            <T>Sign in to add friends.</T>
            <Button
              small
              tone="red"
              label="Sign in"
              onPress={() => router.push({ pathname: '/sign-in', params: { reason: 'Sign in to add friends' } })}
            />
          </Card>
        ) : (
          <>
            <LoadState loading={q.loading} error={q.error} />

            {incoming.length ? (
              <Card style={{ gap: Spacing.one }}>
                <SectionHeader title="Friend requests" />
                {incoming.map((f) =>
                  row(
                    f,
                    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                      <Button small tone="red" label="Accept" onPress={() => act(() => respondFriend(f.id, true))} />
                      <Button small tone="ghost" label="No thanks" onPress={() => act(() => respondFriend(f.id, false))} />
                    </View>,
                  ),
                )}
              </Card>
            ) : null}

            {q.data?.plans.length ? (
              <>
                <SectionHeader title="Friends’ plans" />
                {q.data.plans.map((p) => (
                  <PressableCard key={p.id} onPress={() => router.push({ pathname: '/p/[code]', params: { code: p.id } })}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
                      <T variant="cardTitle" style={{ flex: 1 }}>
                        {p.title} ›
                      </T>
                      {p.im_in ? <Tag label="You’re in" tone="green" /> : p.sent ? <Tag label="Sent to you" /> : null}
                    </View>
                    <T variant="small">
                      {[p.owner_name ? `${p.owner_name}’s plan` : null, datesLabel(p), `${p.items} thing${p.items === 1 ? '' : 's'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                  </PressableCard>
                ))}
              </>
            ) : null}

            {q.data ? (
              <Card style={{ gap: Spacing.one }}>
                <SectionHeader title={friends.length ? `Your friends (${friends.length})` : 'Your friends'} />
                {friends.length ? (
                  friends.map((f) =>
                    row(
                      f,
                      <T
                        variant="small"
                        color={Brand.redText}
                        accessibilityRole="button"
                        onPress={() => {
                          if (confirm !== f.id) return setConfirm(f.id);
                          act(() => removeFriend(f.id));
                        }}>
                        {confirm === f.id ? 'Tap to remove' : 'Remove'}
                      </T>,
                    ),
                  )
                ) : (
                  <T variant="small">No friends yet. Share your link to add some.</T>
                )}
                {sent.length ? <T variant="label" style={{ marginTop: Spacing.two }}>Waiting on them</T> : null}
                {sent.map((f) =>
                  row(
                    f,
                    <T variant="small" color={Brand.redText} accessibilityRole="button" onPress={() => act(() => removeFriend(f.id))}>
                      Cancel
                    </T>,
                  ),
                )}
              </Card>
            ) : null}
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
