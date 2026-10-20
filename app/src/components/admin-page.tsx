import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
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
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.one }}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Back
          </T>
        </Pressable>
        <T variant="heading">{title}</T>
      </View>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        {children}
      </Screen>
    </SafeAreaView>
  );
}
