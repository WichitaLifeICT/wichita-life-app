import { Platform } from 'react-native';

const KEY = 'wl:next';

/**
 * Website only: a page outside the app screens (like the /golf game) that sent someone to sign in, so they
 * land back there afterward. Kept for this browser tab, and only plain paths on this site.
 */
export function rememberNextPage(next: unknown) {
  if (Platform.OS !== 'web' || typeof next !== 'string' || !/^\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\/?$/.test(next)) return;
  try {
    sessionStorage.setItem(KEY, next);
  } catch {
    // storage blocked: they'll land on Today instead
  }
}

/** Sends them back to the remembered page, if there is one. Returns true when it's navigating away. */
export function goToNextPage(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const next = sessionStorage.getItem(KEY);
    if (!next) return false;
    sessionStorage.removeItem(KEY);
    window.location.assign(next);
    return true;
  } catch {
    return false;
  }
}
