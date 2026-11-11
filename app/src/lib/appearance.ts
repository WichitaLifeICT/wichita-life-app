/**
 * Light, dark, or follow the phone ("auto"), picked on the Account screen and saved on this device.
 * On phones the choice also goes to the system (Appearance.setColorScheme) so the tab bar, keyboard
 * and alerts match the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

export type AppearancePref = 'auto' | 'light' | 'dark';

const KEY = 'wl.appearance';
const listeners = new Set<() => void>();
let current: AppearancePref = 'auto';

const valid = (v: unknown): v is AppearancePref => v === 'auto' || v === 'light' || v === 'dark';

function apply(pref: AppearancePref) {
  current = pref;
  if (Platform.OS !== 'web') Appearance.setColorScheme(pref === 'auto' ? 'unspecified' : pref);
  listeners.forEach((l) => l());
}

// The web reads its saved choice right away so the page doesn't flash the other theme first.
if (Platform.OS === 'web') {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (valid(saved)) current = saved;
  } catch {
    // Storage blocked (private window): follow the browser.
  }
} else {
  AsyncStorage.getItem(KEY)
    .then((saved) => {
      if (valid(saved) && saved !== 'auto') apply(saved);
    })
    .catch(() => {});
}

export function setAppearance(pref: AppearancePref) {
  apply(pref);
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY, pref);
    } catch {
      // Not saved; it still applies until the page reloads.
    }
  } else {
    AsyncStorage.setItem(KEY, pref).catch(() => {});
  }
}

export function useAppearance(): AppearancePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
    () => current,
  );
}
