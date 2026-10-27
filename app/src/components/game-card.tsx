import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableCard, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { GAMES, type GameId } from '@/lib/games';

export function GameCard({ id, from, headline }: { id: GameId; from: 'today' | 'play'; headline?: string }) {
  const track = useTrack();
  const game = GAMES.find((g) => g.id === id)!;
  return (
    <PressableCard
      accessibilityRole="button"
      style={styles.row}
      onPress={() => {
        track('game_opened', { game: id, from });
        router.push({ pathname: '/game/[id]', params: { id } });
      }}>
      <View style={styles.emoji}>
        <T style={{ fontSize: 24 }}>{game.emoji}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={styles.cadence}>{headline ?? game.cadence}</T>
        <T variant="cardTitle">{game.title}</T>
        <T variant="small">{game.blurb}</T>
      </View>
      <T style={styles.play}>Play ›</T>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Brand.navy,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadence: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: Brand.redText },
  play: { fontFamily: Fonts.display, color: Brand.redText },
});
