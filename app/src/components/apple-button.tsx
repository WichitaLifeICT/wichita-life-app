import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * "Continue with Apple" for the website, drawn to Apple's guidelines (black in light mode, white in dark) and
 * sized like the Google button. The iPhone app uses Apple's own built-in button instead.
 */
export function AppleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#000000' : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, dark ? styles.dark : styles.light, (pressed || disabled) && { opacity: 0.7 }]}>
      <Svg width={19} height={22} viewBox="0 0 24 24">
        <Path
          fill={ink}
          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        />
      </Svg>
      <Text style={[styles.label, { color: ink }]}>Continue with Apple</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  light: { backgroundColor: '#000000', borderColor: '#000000' },
  dark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  label: { fontSize: 19, fontWeight: '500' },
});
