import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { finishSignIn, useAuth } from '@/lib/auth';

// On web, a failed link comes back with the reason in the URL.
function webError() {
  if (Platform.OS !== 'web') return undefined;
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.slice(1));
  return params.get('error_description') ?? undefined;
}

/** Sign-in links and Google land here. Web finishes on its own; phones exchange the code. */
export default function AuthCallback() {
  const theme = useTheme();
  const url = Linking.useLinkingURL();
  const { session, profile } = useAuth();
  const [error, setError] = useState<string | undefined>(webError);

  useEffect(() => {
    if (Platform.OS === 'web' || !url) return;
    finishSignIn(url).catch((e: Error) => setError(e.message));
  }, [url]);

  useEffect(() => {
    if (!session || !profile) return;
    if (!profile.display_name) router.replace('/sign-in');
    else router.replace('/');
  }, [session, profile]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.three,
        backgroundColor: theme.background,
        padding: Spacing.four,
      }}>
      {error ? (
        <>
          <T variant="title">That sign-in link didn&apos;t work</T>
          <T variant="small" style={{ textAlign: 'center' }}>
            {error}. Links work once and expire after an hour; request a new one, or type the code from the email.
          </T>
          <Button tone="red" label="Try again" onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={Brand.blue} />
          <T variant="small">Signing you in…</T>
        </>
      )}
    </View>
  );
}
