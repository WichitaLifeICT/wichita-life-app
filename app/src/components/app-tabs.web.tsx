import { Image } from 'expo-image';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Brand, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS = [
  { name: 'index', href: '/', label: 'Today', icon: require('@/assets/images/tabs/today.png') },
  { name: 'events', href: '/events', label: 'Events', icon: require('@/assets/images/tabs/events.png') },
  { name: 'meet', href: '/meet', label: 'Meet', icon: require('@/assets/images/tabs/meet.png') },
  { name: 'play', href: '/play', label: 'Play', icon: require('@/assets/images/tabs/play.png') },
  { name: 'explore', href: '/explore', label: 'Explore', icon: require('@/assets/images/tabs/explore.png') },
] as const;

/** Web uses a custom bottom bar; native uses the platform tab bar (app-tabs.tsx). */
export default function AppTabs() {
  const theme = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={[styles.bar, { backgroundColor: theme.card, borderColor: Brand.navy }]}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

// The slot's ref type doesn't line up with Pressable's; the ref still passes through at runtime.
type TabButtonProps = Omit<TabTriggerSlotProps, 'ref'> & { label: string; icon: number };

function TabButton({ label, icon, isFocused, ...props }: TabButtonProps) {
  const theme = useTheme();
  const color = isFocused ? Brand.red : theme.textSecondary;
  return (
    <Pressable {...props} style={styles.tab}>
      <Image source={icon} style={{ width: 22, height: 22 }} tintColor={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 2 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 9, paddingBottom: 11 },
  label: { fontFamily: Fonts.displaySemi, fontSize: 11 },
});
