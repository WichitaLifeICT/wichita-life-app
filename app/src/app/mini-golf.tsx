import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GolfFrame } from '@/components/golf-frame';
import { ClosePill, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Wichita Mini Golf, full screen. (Called mini-golf so it doesn't clash with the website's /golf pages.)
 * `hole` opens a given hole; `c` (a hole's strokes) or `r` (a best round on all 9) and `n` carry a friend's
 * challenge ("Ana L. got 3 strokes").
 */
export default function MiniGolfScreen() {
  const theme = useTheme();
  const { hole, c, n, r } = useLocalSearchParams<{ hole?: string; c?: string; n?: string; r?: string }>();
  const holeNo = Math.min(9, Math.max(1, Number(hole) || 1));
  const query = new URLSearchParams();
  if (c && /^\d{1,2}$/.test(c)) query.set('c', c);
  if (r && /^\d{1,3}$/.test(r)) query.set('r', r);
  if ((c || r) && n) query.set('n', n.slice(0, 24));
  const qs = query.toString();
  const path = `/golf/${holeNo === 1 ? '' : `${holeNo}/`}${qs ? `?${qs}` : ''}`;
  // Read from the app-wide provider: inside a full-screen modal on iOS, SafeAreaView reports no top inset.
  const insets = useSafeAreaInsets();
  // On the website the game is its own page.
  useEffect(() => {
    if (Platform.OS === 'web') window.location.replace('/golf/');
  }, []);
  if (Platform.OS === 'web') return null;
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.background }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.three,
        }}>
        <T variant="title">⛳ Wichita Mini Golf</T>
        <ClosePill onPress={() => (router.canGoBack() ? router.back() : router.replace('/play'))} />
      </View>
      <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#2D7045' }}>
        <GolfFrame path={path} />
      </View>
    </View>
  );
}
