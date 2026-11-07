import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { finishSignIn, linkSignInError, useAuth } from '@/lib/auth';

// On web, a failed link comes back with the reason in the URL.
function webError() {
  if (Platform.OS !== 'web') return undefined;
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.slice(1));
  return params.get('error_description') ?? undefined;
}

// Plain-English reasons. The common one: Gmail (or another app) opened the link in its own browser,
// which isn't the app or browser that asked for it, so it can't finish there.
function friendly(message: string) {
  if (/code verifier|code_verifier|flow state/i.test(message)) {
    return 'The link opened in a different app or browser than the one you signed in from (Gmail often does this).';
  }
  return message.replace(/\.$/, '') + '.';
}

const STUCK_AFTER_MS = 12000;

/** Sign-in links and Google land here. Web finishes on its own; phones exchange the code. */
export default function AuthCallback() {
  const theme = useTheme();
  const url = Linking.useLinkingURL();
  const { session, profile } = useAuth();
  const [error, setError] = useState<string | undefined>(() => {
    const e = webError();
    return e ? friendly(e) : undefined;
  });

  useEffect(() => {
    if (Platform.OS === 'web' || !url) return;
    finishSignIn(url).catch((e: Error) => setError(friendly(e.message)));
  }, [url]);

  // Web: the link is finished by the Supabase client as the page loads; surface it if that failed.
  const [linkHadCode] = useState(() => Platform.OS === 'web' && new URLSearchParams(window.location.search).has('code'));
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    linkSignInError(linkHadCode)
      .then((m) => m && setError((prev) => prev ?? friendly(m)))
      .catch(() => {});
  }, [linkHadCode]);

  // Never spin forever.
  useEffect(() => {
    const t = setTimeout(
      () => setError((prev) => prev ?? 'Signing in is taking longer than it should.'),
      STUCK_AFTER_MS,
    );
    return () => clearTimeout(t);
  }, []);

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
            {error} Go back to where you typed your email and enter the code from the email instead. The code works
            on any device.
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
