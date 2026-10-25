import { type ComponentRef, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Options in a pill, like iOS's segmented control. Equal widths by default; with `scroll` each option
 * keeps its natural width and the row swipes sideways, for when there are too many to fit.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  scroll?: boolean;
}) {
  const theme = useTheme();
  // Keep the selected option in view when the row scrolls (e.g. opening straight to the last tab).
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Record<string, number>>({});
  const reveal = (id: string) => {
    const x = offsets.current[id];
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  };
  useEffect(() => reveal(value), [value]);
  const items = options.map((o) => {
    const active = o.id === value;
    return (
      <Pressable
        key={o.id}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(o.id)}
        onLayout={
          scroll
            ? (ev) => {
                offsets.current[o.id] = ev.nativeEvent.layout.x;
                if (o.id === value) reveal(o.id);
              }
            : undefined
        }
        style={[styles.option, scroll ? styles.natural : styles.equal, active && { backgroundColor: Brand.navy }]}>
        <Text style={[styles.label, { color: active ? Brand.white : theme.heading }]}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.wrap, scroll && styles.scrollWrap, { backgroundColor: theme.card, borderColor: theme.outline }]}>
      {scroll ? (
        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {items}
        </ScrollView>
      ) : (
        items
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: 2, borderRadius: Radius.card, padding: 4, gap: 4 },
  scrollWrap: { paddingHorizontal: 0 },
  row: { gap: 4, paddingHorizontal: 4 },
  option: { alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 10, minHeight: 44 },
  equal: { flex: 1 },
  natural: { paddingHorizontal: 14 },
  label: { fontFamily: Fonts.display, fontSize: 14 },
});
