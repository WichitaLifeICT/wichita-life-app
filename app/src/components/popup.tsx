import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClosePill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A card that pops up over the screen. Tap Close, tap outside it, or use the back button to close.
 * Long content scrolls inside the card.
 */
export function Popup({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.ink }]}>
          <View style={styles.closeRow}>
            <ClosePill onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 28, 52, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    borderWidth: 2,
    borderRadius: 18,
    overflow: 'hidden',
  },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  body: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.three },
});
