import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type LegalSection = { heading: string; body: (string | string[])[] };

/** Plain, readable page for the privacy policy and terms. Strings are paragraphs; arrays are bullet lists. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Back
          </T>
        </Pressable>
      </View>
      <Screen>
        <View style={{ gap: Spacing.one }}>
          <T variant="heading">{title}</T>
          <T variant="small">Last updated {updated}</T>
        </View>
        <T>{intro}</T>
        {sections.map((s) => (
          <View key={s.heading} style={{ gap: Spacing.two }}>
            <T variant="title">{s.heading}</T>
            {s.body.map((part, i) =>
              Array.isArray(part) ? (
                <View key={i} style={{ gap: Spacing.one }}>
                  {part.map((item) => (
                    <T key={item}>• {item}</T>
                  ))}
                </View>
              ) : (
                <T key={i}>{part}</T>
              ),
            )}
          </View>
        ))}
      </Screen>
    </SafeAreaView>
  );
}
