import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameFrame } from '@/components/game-frame';
import { T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GAMES, gameUrl, isGameId } from '@/lib/games';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const game = isGameId(id) ? GAMES.find((g) => g.id === id)! : GAMES[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.two,
        }}>
        <T variant="title">
          {game.emoji} {game.title}
        </T>
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/play'))}
          hitSlop={12}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            Close
          </T>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <GameFrame url={gameUrl(game.id)} />
      </View>
    </SafeAreaView>
  );
}
