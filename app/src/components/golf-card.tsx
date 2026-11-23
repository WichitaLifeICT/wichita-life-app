import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { PressableCard, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useRequireSignIn } from '@/lib/auth';

/** The Play tab's card for Wichita Mini Golf (members only: it asks them to sign in first). */
export function GolfCard({ from }: { from: 'today' | 'play' }) {
  const theme = useTheme();
  const track = useTrack();
  const requireSignIn = useRequireSignIn();
  return (
    <PressableCard
      accessibilityRole="button"
      style={styles.row}
      onPress={() => {
        track('game_opened', { game: 'golf', from });
        if (!requireSignIn('Sign in to play mini golf')) return;
        // On the website the game is its own page; in the app it opens full screen.
        if (Platform.OS === 'web') window.location.assign('/golf/');
        else router.push('/mini-golf');
      }}>
      <View style={styles.emoji}>
        <T style={{ fontSize: 24 }}>⛳</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={[styles.cadence, { color: theme.link }]}>New · 9 holes · leaderboards</T>
        <T variant="cardTitle">Wichita Mini Golf</T>
        <T variant="small">Putt your way past nine Wichita landmarks, from the Keeper of the Plains to the first Pizza Hut.</T>
      </View>
      <T style={[styles.play, { color: theme.link }]}>Play ›</T>
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
    backgroundColor: '#5DB574',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadence: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: Brand.redText },
  play: { fontFamily: Fonts.display, color: Brand.redText },
});
