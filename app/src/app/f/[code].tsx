import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadState, Screen, Sticker, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { addFriendByCode, friendLinkOwner } from '@/lib/friends';

/** Someone's friend link (app.wichitalifeict.com/f/<code>): add them in one tap. */
export default function FriendLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const theme = useTheme();
  const track = useTrack();
  const { session, profile } = useAuth();
  const requireSignIn = useRequireSignIn();
  const q = useQuery(() => friendLinkOwner(code), [code]);
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();
  const name = q.data;
  const isMe = profile?.referral_code?.toUpperCase() === code?.toUpperCase();

  const add = async () => {
    if (!requireSignIn(`Sign up to add ${name ?? 'your friend'}`)) return;
    try {
      const f = await addFriendByCode(code);
      track('friend_added', { how: 'link' });
      setDone(f.name);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <Screen>
        <LoadState loading={q.loading} error={q.error} empty={q.data === null ? 'This friend link doesn’t work anymore.' : undefined} />
        {name ? (
          <>
            <Sticker color={Brand.blue} shadow={Brand.orange}>
              <T variant="label" color={Brand.orange}>
                Wichita Life
              </T>
              <T variant="heading" color={Brand.white}>
                {isMe ? 'This is your friend link' : done ? `You and ${name} are friends 🎉` : `Add ${name} as a friend`}
              </T>
              <T color="#EAF0FA">
                {isMe
                  ? 'Send it to friends so they can add you.'
                  : done
                    ? `You’ll see the plans ${name} shows to friends, and ${name} will see yours.`
                    : `Make plans together: see each other’s weekend plans, say you’re in, and find out who’s going.`}
              </T>
            </Sticker>
            {!isMe ? (
              <View style={{ gap: Spacing.two }}>
                {done ? (
                  <Button tone="red" label="See friends" onPress={() => router.replace('/friends')} />
                ) : (
                  <Button tone="red" label={session ? `Add ${name}` : `Sign up free to add ${name}`} onPress={add} />
                )}
                {error ? <T color={Brand.redText}>{error}</T> : null}
              </View>
            ) : null}
            <Card style={{ gap: Spacing.one }}>
              <T variant="cardTitle">What’s Wichita Life?</T>
              <T variant="small">
                Events, trivia nights, happy hours, places to eat and plans with friends around Wichita, all in one free app.
              </T>
            </Card>
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
