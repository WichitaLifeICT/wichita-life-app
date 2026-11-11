import { useColorScheme as useSystemScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

/** The phone's (or browser's) light/dark setting, unless they picked one on the Account screen. */
export function useColorScheme() {
  const system = useSystemScheme();
  const pref = useAppearance();
  return pref === 'auto' ? system : pref;
}
