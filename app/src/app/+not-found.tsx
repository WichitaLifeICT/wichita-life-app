import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Sticker, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A link opened the app at an address it doesn't have (an app.wichitalifeict.com page that only lives on
 * the website, say). Instead of a blank "Unmatched Route" screen: a way back to Today. Golf links go to the
 * game.
 */
export default function NotFound() {
  const theme = useTheme();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith('/golf')) router.replace('/mini-golf');
  }, [pathname]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three }}>
        <Sticker color={Brand.orange} shadow={Brand.navy}>
          <T variant="heading" color={Brand.navy}>
            That page isn’t here
          </T>
          <T color={Brand.navy}>The link you opened isn’t a page in the app. Everything else is a tap away.</T>
        </Sticker>
        <Button tone="red" label="Go to Today" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}
