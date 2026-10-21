import { router, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Sticker, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { posthog } from '@/lib/analytics';

/** Shown instead of a screen that crashed while drawing. The crash goes to PostHog → Error tracking. */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  useEffect(() => {
    posthog?.captureException(error, { handled_by: 'error_boundary' });
  }, [error]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three, backgroundColor: theme.background }}>
      <Sticker color={Brand.orange} shadow={Brand.blue}>
        <T variant="heading" color={Brand.navy}>
          Well, that wasn’t supposed to happen
        </T>
        <T color={Brand.navy}>Something on this screen broke. We’ve been told about it and we’re on it.</T>
      </Sticker>
      <Button tone="red" label="Try again" onPress={retry} />
      <Button tone="ghost" label="Back to Today" onPress={() => (router.replace('/'), retry())} />
    </View>
  );
}
