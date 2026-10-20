import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Two or three equal options in a pill, like iOS's segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.wrap, { backgroundColor: theme.card, borderColor: theme.outline }]}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.id)}
            style={[styles.option, active && { backgroundColor: Brand.navy }]}>
            <Text style={[styles.label, { color: active ? Brand.white : theme.heading }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: 2, borderRadius: Radius.card, padding: 4, gap: 4 },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 10, minHeight: 44 },
  label: { fontFamily: Fonts.display, fontSize: 14 },
});
