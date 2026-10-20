import { NativeTabs } from 'expo-router/native-tabs';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS = [
  { name: 'index', label: 'Today', sf: 'sun.max', icon: require('@/assets/images/tabs/today.png') },
  { name: 'events', label: 'Events', sf: 'calendar', icon: require('@/assets/images/tabs/events.png') },
  { name: 'meet', label: 'Meet', sf: 'person.2', icon: require('@/assets/images/tabs/meet.png') },
  { name: 'play', label: 'Play', sf: 'gamecontroller', icon: require('@/assets/images/tabs/play.png') },
  { name: 'read', label: 'Read', sf: 'book', icon: require('@/assets/images/tabs/read.png') },
] as const;

export default function AppTabs() {
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.card}
      iconColor={{ default: theme.textSecondary, selected: Brand.red }}
      labelStyle={{ default: { color: theme.textSecondary }, selected: { color: Brand.red } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} src={tab.icon} renderingMode="template" />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
