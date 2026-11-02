/**
 * Quick fixes sent with `npm run update` (expo-updates). The app checks when it starts; iOS
 * usually resumes an app rather than restarting it, so it also checks when it comes back to the
 * foreground (at most every 15 minutes). A downloaded fix applies the next time the app starts.
 */
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

const EVERY_MS = 15 * 60_000;
let lastCheck = 0;

async function fetchIfAvailable() {
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return false;
  await Updates.fetchUpdateAsync();
  return true;
}

export function useBackgroundUpdates() {
  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastCheck < EVERY_MS) return;
      lastCheck = Date.now();
      fetchIfAvailable().catch(() => {});
    });
    return () => sub.remove();
  }, []);
}

/** For the Check for updates link: downloads the newest fix and restarts into it. */
export async function updateNow(): Promise<string> {
  if (!Updates.isEnabled) return 'Updates only work in the store and TestFlight app.';
  try {
    if (await fetchIfAvailable()) {
      await Updates.reloadAsync();
      return 'Updating…';
    }
    return 'You have the latest version.';
  } catch {
    return 'Couldn’t check right now. Try again in a minute.';
  }
}

/** "Version 1.0.0 (4) · update Nov 2" or "… · as installed". */
export function versionLabel() {
  const build = Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : '';
  const update =
    Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt
      ? `update ${Updates.createdAt.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : 'as installed';
  return `Version ${Application.nativeApplicationVersion ?? ''}${build} · ${update}`;
}
