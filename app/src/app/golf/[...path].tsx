import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';

/**
 * app.wichitalifeict.com/golf links (a shared "Try to beat my score!" challenge, say) open the app on phones
 * that have it. This sends them to the game inside the app, on the same hole, with the challenge.
 * On the website these addresses are the golf pages themselves, so it just loads them.
 */
export default function GolfLink() {
  const { path, c, n, r } = useLocalSearchParams<{ path?: string | string[]; c?: string; n?: string; r?: string }>();
  const track = useTrack();
  useEffect(() => {
    const first = Array.isArray(path) ? path[0] : path;
    const hole = Math.min(9, Math.max(1, Number(first) || 1));
    if (Platform.OS === 'web') {
      window.location.replace(`/golf/${hole === 1 ? '' : `${hole}/`}${window.location.search}`);
      return;
    }
    track('game_opened', { game: 'golf', from: 'link' });
    router.replace({ pathname: '/mini-golf', params: { hole: String(hole), ...(c ? { c } : {}), ...(r ? { r } : {}), ...(n ? { n } : {}) } });
  }, [path, c, n, r, track]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#2D7045' }}>
      <ActivityIndicator color={Brand.white} />
    </View>
  );
}
