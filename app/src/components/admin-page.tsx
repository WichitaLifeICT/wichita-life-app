import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosePill, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Plain page frame for staff tools: back link, title, scrolling content. */
export function AdminPage({
  title,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.two, alignItems: 'flex-start' }}>
        <ClosePill label="‹ Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <T variant="heading">{title}</T>
      </View>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        {children}
      </Screen>
    </SafeAreaView>
  );
}
