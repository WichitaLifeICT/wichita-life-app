import { Platform } from 'react-native';

// After a new web version goes live, a tab still running the old one can ask for a piece of the
// app that no longer exists. Reloading picks up the new version, so do that instead of showing an error.
const STALE = /AsyncRequireError|Loading module|Requiring unknown module|ChunkLoadError|Loading chunk/i;
const KEY = 'stale-bundle-reload';

export function isStaleBundleError(error: unknown) {
  if (Platform.OS !== 'web' || !error) return false;
  const e = error as { name?: string; message?: string };
  return STALE.test(`${e.name ?? ''} ${e.message ?? String(error)}`);
}

/** Reloads the page once; if it already reloaded in the last minute, returns false so the error shows. */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload, the browser cache will have the new version.
  }
  window.location.reload();
  return true;
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    if (isStaleBundleError(e.reason) && reloadForNewVersion()) e.preventDefault();
  });
  window.addEventListener('error', (e) => {
    if (isStaleBundleError(e.error ?? e.message) && reloadForNewVersion()) e.preventDefault();
  });
}
